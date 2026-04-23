import { createInterface } from 'readline';
import chalk from 'chalk';
import type { Category } from 'zenmoney-api';
import type { StagingFile, StagedDecision, Zone } from '../storage/index.js';
import { saveStagingFile, saveFeedbackRule } from '../storage/index.js';
import {
  printZoneHeader,
  printClusterHeader,
  printSuggestion,
  printCategoryList,
} from './display.js';
import { buildCategoryLookup } from '../ai/categorizer.js';

function createPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));
  return { ask, close: () => rl.close() };
}

interface ClusterGroup {
  clusterKey: string;
  decisions: StagedDecision[];
  totalAmount: number;
  displayPayee: string;
  comment: string | null;
}

function groupByCluster(
  decisions: StagedDecision[],
  staging: StagingFile
): ClusterGroup[] {
  const groups = new Map<string, ClusterGroup>();
  for (const d of decisions) {
    const existing = groups.get(d.clusterKey);
    const cached = staging.transactionCache[d.transactionId];
    const amount = cached ? (cached.outcome || cached.income) : 0;
    const payee = cached?.payee || cached?.originalPayee || cached?.comment || '?';

    if (existing) {
      existing.decisions.push(d);
      existing.totalAmount += amount;
    } else {
      groups.set(d.clusterKey, {
        clusterKey: d.clusterKey,
        decisions: [d],
        totalAmount: amount,
        displayPayee: payee,
        comment: cached?.comment || null,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.decisions.length - a.decisions.length);
}

/**
 * Run the 4-zone interactive review.
 * Modifies staging.decisions in place and saves after each zone.
 */
export async function runReview(
  staging: StagingFile,
  categories: Map<string, Category>
): Promise<{ approved: number; skipped: number }> {
  let totalApproved = 0;
  let totalSkipped = 0;

  // Build category list for manual selection
  const lookup = buildCategoryLookup(categories);
  const categoryList = Array.from(categories.values())
    .map((c) => {
      if (c.parent) {
        const parent = categories.get(c.parent);
        return {
          title: parent ? `${parent.title.trim()} > ${c.title.trim()}` : c.title.trim(),
          id: c.id,
        };
      }
      return { title: c.title.trim(), id: c.id };
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

  // --- GREEN: auto-approve ---
  const greenDecisions = staging.decisions.filter((d) => d.zone === 'green' && d.status === 'pending');
  if (greenDecisions.length > 0) {
    for (const d of greenDecisions) {
      d.status = 'approved';
    }
    totalApproved += greenDecisions.length;
    printZoneHeader('green', `${greenDecisions.length} авто-применено`);
    console.log(chalk.green(`    ${greenDecisions.length} транзакций категоризировано автоматически`));
    saveStagingFile(staging);
  }

  // --- YELLOW: confirm or skip ---
  const yellowDecisions = staging.decisions.filter((d) => d.zone === 'yellow' && d.status === 'pending');
  if (yellowDecisions.length > 0) {
    const clusters = groupByCluster(yellowDecisions, staging);
    printZoneHeader('yellow', `${clusters.length} кластеров (${yellowDecisions.length} транзакций)`);
    console.log(chalk.dim('    Enter=принять, s=пропустить, c=изменить\n'));

    const { ask, close } = createPrompt();

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      printClusterHeader('yellow', i, clusters.length, cluster.displayPayee, cluster.decisions.length, cluster.totalAmount);
      if (cluster.comment) console.log(chalk.dim(`    // ${cluster.comment}`));

      const bestDecision = cluster.decisions[0];
      if (bestDecision.categoryTitle) {
        printSuggestion(bestDecision.categoryTitle, bestDecision.confidence, bestDecision.reason);
      }

      const answer = (await ask(chalk.dim('    > '))).trim().toLowerCase();

      if (answer === 's') {
        for (const d of cluster.decisions) d.status = 'skipped';
        totalSkipped += cluster.decisions.length;
      } else if (answer === 'c') {
        const selected = await pickCategory(ask, categoryList);
        if (selected) {
          for (const d of cluster.decisions) {
            d.status = 'approved';
            d.userOverride = selected;
          }
          totalApproved += cluster.decisions.length;
          console.log(chalk.green(`    → ${selected.categoryTitle} (${cluster.decisions.length} тр.)`));
          saveFeedbackForCluster(cluster, selected, staging);
        } else {
          for (const d of cluster.decisions) d.status = 'skipped';
          totalSkipped += cluster.decisions.length;
        }
      } else {
        // Enter = accept suggestion
        for (const d of cluster.decisions) d.status = 'approved';
        totalApproved += cluster.decisions.length;
        console.log(chalk.green(`    → ${bestDecision.categoryTitle}`));
        if (bestDecision.categoryId) {
          saveFeedbackForCluster(cluster, { categoryId: bestDecision.categoryId, categoryTitle: bestDecision.categoryTitle }, staging);
        }
      }
    }

    close();
    saveStagingFile(staging);
  }

  // --- ORANGE: pick from options ---
  const orangeDecisions = staging.decisions.filter((d) => d.zone === 'orange' && d.status === 'pending');
  if (orangeDecisions.length > 0) {
    const clusters = groupByCluster(orangeDecisions, staging);
    printZoneHeader('orange', `${clusters.length} кластеров (${orangeDecisions.length} транзакций)`);
    console.log(chalk.dim('    Выбери номер категории или s=пропустить\n'));

    const { ask, close } = createPrompt();

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      printClusterHeader('orange', i, clusters.length, cluster.displayPayee, cluster.decisions.length, cluster.totalAmount);
      if (cluster.comment) console.log(chalk.dim(`    // ${cluster.comment}`));

      const bestDecision = cluster.decisions[0];
      if (bestDecision.categoryTitle) {
        printSuggestion(bestDecision.categoryTitle, bestDecision.confidence, bestDecision.reason);
      }

      console.log(chalk.dim('    Или введи номер из полного списка:'));

      const answer = (await ask(chalk.dim('    > '))).trim().toLowerCase();

      if (answer === 's') {
        for (const d of cluster.decisions) d.status = 'skipped';
        totalSkipped += cluster.decisions.length;
      } else if (answer === '' && bestDecision.categoryId) {
        for (const d of cluster.decisions) d.status = 'approved';
        totalApproved += cluster.decisions.length;
        console.log(chalk.green(`    → ${bestDecision.categoryTitle}`));
        saveFeedbackForCluster(cluster, { categoryId: bestDecision.categoryId, categoryTitle: bestDecision.categoryTitle }, staging);
      } else if (answer === 'l' || answer === 'list') {
        printCategoryList(categoryList);
        const selected = await pickCategory(ask, categoryList);
        if (selected) {
          for (const d of cluster.decisions) {
            d.status = 'approved';
            d.userOverride = selected;
          }
          totalApproved += cluster.decisions.length;
          console.log(chalk.green(`    → ${selected.categoryTitle} (${cluster.decisions.length} тр.)`));
          saveFeedbackForCluster(cluster, selected, staging);
        } else {
          for (const d of cluster.decisions) d.status = 'skipped';
          totalSkipped += cluster.decisions.length;
        }
      } else {
        // Try as search query
        const matches = fuzzySearch(answer, categoryList);
        if (matches.length === 1) {
          const sel = { categoryId: matches[0].id, categoryTitle: matches[0].title };
          for (const d of cluster.decisions) {
            d.status = 'approved';
            d.userOverride = sel;
          }
          totalApproved += cluster.decisions.length;
          console.log(chalk.green(`    → ${sel.categoryTitle}`));
          saveFeedbackForCluster(cluster, sel, staging);
        } else if (matches.length > 1) {
          console.log(chalk.dim('    Найдено:'));
          for (let j = 0; j < matches.length; j++) {
            console.log(chalk.dim(`      ${j + 1}. ${matches[j].title}`));
          }
          const pick = (await ask(chalk.dim('    Номер: '))).trim();
          const idx = parseInt(pick, 10) - 1;
          if (idx >= 0 && idx < matches.length) {
            const sel = { categoryId: matches[idx].id, categoryTitle: matches[idx].title };
            for (const d of cluster.decisions) {
              d.status = 'approved';
              d.userOverride = sel;
            }
            totalApproved += cluster.decisions.length;
            console.log(chalk.green(`    → ${sel.categoryTitle}`));
            saveFeedbackForCluster(cluster, sel, staging);
          } else {
            for (const d of cluster.decisions) d.status = 'skipped';
            totalSkipped += cluster.decisions.length;
          }
        } else {
          console.log(chalk.yellow('    Не найдено. Пропускаю.'));
          for (const d of cluster.decisions) d.status = 'skipped';
          totalSkipped += cluster.decisions.length;
        }
      }
    }

    close();
    saveStagingFile(staging);
  }

  // --- RED: manual search ---
  const redDecisions = staging.decisions.filter((d) => d.zone === 'red' && d.status === 'pending');
  if (redDecisions.length > 0) {
    const clusters = groupByCluster(redDecisions, staging);
    printZoneHeader('red', `${clusters.length} кластеров (${redDecisions.length} транзакций)`);
    console.log(chalk.dim('    Введи название категории или часть, s=пропустить, l=список\n'));

    const { ask, close } = createPrompt();

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      printClusterHeader('red', i, clusters.length, cluster.displayPayee, cluster.decisions.length, cluster.totalAmount);
      if (cluster.comment) console.log(chalk.dim(`    // ${cluster.comment}`));

      // Show all transaction details for red zone
      for (const d of cluster.decisions) {
        const cached = staging.transactionCache[d.transactionId];
        if (cached) {
          const amt = cached.outcome > 0 ? `-${cached.outcome}` : `+${cached.income}`;
          console.log(chalk.dim(`      ${cached.date} ${amt}₽ ${cached.comment || ''}`));
        }
      }

      const answer = (await ask(chalk.dim('    Категория: '))).trim();

      if (answer.toLowerCase() === 's' || answer === '') {
        for (const d of cluster.decisions) d.status = 'skipped';
        totalSkipped += cluster.decisions.length;
        continue;
      }

      if (answer.toLowerCase() === 'l') {
        printCategoryList(categoryList);
        const selected = await pickCategory(ask, categoryList);
        if (selected) {
          for (const d of cluster.decisions) {
            d.status = 'approved';
            d.userOverride = selected;
          }
          totalApproved += cluster.decisions.length;
          console.log(chalk.green(`    → ${selected.categoryTitle}`));
          saveFeedbackForCluster(cluster, selected, staging);
        } else {
          for (const d of cluster.decisions) d.status = 'skipped';
          totalSkipped += cluster.decisions.length;
        }
        continue;
      }

      // Fuzzy search
      const matches = fuzzySearch(answer, categoryList);
      if (matches.length === 1) {
        const sel = { categoryId: matches[0].id, categoryTitle: matches[0].title };
        for (const d of cluster.decisions) {
          d.status = 'approved';
          d.userOverride = sel;
        }
        totalApproved += cluster.decisions.length;
        console.log(chalk.green(`    → ${sel.categoryTitle}`));
        saveFeedbackForCluster(cluster, sel, staging);
      } else if (matches.length > 1) {
        for (let j = 0; j < matches.length; j++) {
          console.log(chalk.dim(`      ${j + 1}. ${matches[j].title}`));
        }
        const pick = (await ask(chalk.dim('    Номер: '))).trim();
        const idx = parseInt(pick, 10) - 1;
        if (idx >= 0 && idx < matches.length) {
          const sel = { categoryId: matches[idx].id, categoryTitle: matches[idx].title };
          for (const d of cluster.decisions) {
            d.status = 'approved';
            d.userOverride = sel;
          }
          totalApproved += cluster.decisions.length;
          console.log(chalk.green(`    → ${sel.categoryTitle}`));
          saveFeedbackForCluster(cluster, sel, staging);
        } else {
          for (const d of cluster.decisions) d.status = 'skipped';
          totalSkipped += cluster.decisions.length;
        }
      } else {
        console.log(chalk.yellow(`    Не найдено "${answer}". Пропускаю.`));
        for (const d of cluster.decisions) d.status = 'skipped';
        totalSkipped += cluster.decisions.length;
      }
    }

    close();
    saveStagingFile(staging);
  }

  return { approved: totalApproved, skipped: totalSkipped };
}

async function pickCategory(
  ask: (prompt: string) => Promise<string>,
  categoryList: Array<{ title: string; id: string }>
): Promise<{ categoryId: string; categoryTitle: string } | null> {
  printCategoryList(categoryList);
  const answer = (await ask(chalk.dim('\n    Номер: '))).trim();
  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < categoryList.length) {
    return { categoryId: categoryList[idx].id, categoryTitle: categoryList[idx].title };
  }
  return null;
}

function fuzzySearch(
  query: string,
  categoryList: Array<{ title: string; id: string }>
): Array<{ title: string; id: string }> {
  const lower = query.toLowerCase().trim();
  return categoryList.filter(
    (c) => c.title.toLowerCase().includes(lower) || lower.includes(c.title.toLowerCase())
  );
}

function saveFeedbackForCluster(
  cluster: ClusterGroup,
  selected: { categoryId: string; categoryTitle: string },
  staging: StagingFile
): void {
  const seenPayees = new Set<string>();
  for (const d of cluster.decisions) {
    const cached = staging.transactionCache[d.transactionId];
    if (!cached) continue;
    const payee = cached.payee || cached.originalPayee || '';
    if (payee && !seenPayees.has(payee.toLowerCase())) {
      seenPayees.add(payee.toLowerCase());
      saveFeedbackRule({
        payee,
        originalPayee: cached.originalPayee,
        mcc: cached.mcc,
        assignedCategory: selected.categoryId,
        categoryTitle: selected.categoryTitle,
        count: 1,
        lastUsed: new Date().toISOString(),
      });
    }
  }
}
