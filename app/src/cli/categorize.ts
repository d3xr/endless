import { Command } from 'commander';
import chalk from 'chalk';
import type { Transaction, Category } from 'zenmoney-api';

import { config } from '../config/index.js';
import { authenticate, fetchNewData, batchUpdateCategories } from '../services/zenmoney.js';
import { categorize, clusterByPayee, buildCategoryLookup } from '../ai/categorizer.js';
import { prepareBatchItems, categorizeBatchLLM } from '../ai/batch-llm.js';
import {
  getStagingFile,
  saveStagingFile,
  clearStagingFile,
  type StagingFile,
  type StagedDecision,
  type CachedTransaction,
  type Zone,
} from '../storage/index.js';
import { runReview } from './review.js';
import {
  printHeader,
  printZoneSummary,
  printBatchProgress,
  printPushSummary,
  printError,
  printSuccess,
} from './display.js';
import { createInterface } from 'readline';

function assignZone(confidence: number): Zone {
  if (confidence >= 0.90) return 'green';
  if (confidence >= 0.70) return 'yellow';
  if (confidence >= 0.40) return 'orange';
  return 'red';
}

export function createCategorizeCommand(): Command {
  return new Command('categorize')
    .description('Batch-categorize all uncategorized transactions with AI')
    .option('--dry-run', 'Preview without writing to ZenMoney')
    .option('--resume', 'Resume from existing staging file')
    .option('--auto-only', 'Only apply GREEN zone, skip interactive review')
    .action(async (opts: { dryRun?: boolean; resume?: boolean; autoOnly?: boolean }) => {
      try {
        await run(opts);
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

async function run(opts: { dryRun?: boolean; resume?: boolean; autoOnly?: boolean }) {
  let staging: StagingFile;

  if (opts.resume) {
    const existing = getStagingFile();
    if (!existing) {
      printError('Нет staging файла. Запустите categorize без --resume.');
      return;
    }
    staging = existing;
    const pending = staging.decisions.filter((d) => d.status === 'pending').length;
    console.log(chalk.cyan(`\n  Загружен staging: ${staging.totalTransactions} транзакций, ${pending} ожидают ревью`));
  } else {
    staging = await buildStaging();
  }

  if (staging.decisions.length === 0) {
    printSuccess('Нет транзакций для категоризации!');
    return;
  }

  // Show zone summary
  printZoneSummary(staging.zones, staging.totalTransactions);

  // Load categories for review (from cached entities)
  process.stdout.write(chalk.dim('  Загрузка категорий... '));
  authenticate();
  const data = await fetchNewData(false);
  console.log(chalk.green('OK'));

  if (opts.autoOnly) {
    // Only auto-approve GREEN
    const green = staging.decisions.filter((d) => d.zone === 'green' && d.status === 'pending');
    for (const d of green) d.status = 'approved';
    saveStagingFile(staging);
    console.log(chalk.green(`\n  ${green.length} GREEN транзакций авто-применено`));
  } else {
    // Run interactive review
    const { approved, skipped } = await runReview(staging, data.categories);

    const autoGreen = staging.decisions.filter(
      (d) => d.zone === 'green' && d.status === 'approved'
    ).length;
    printPushSummary(approved - autoGreen, skipped, autoGreen);
  }

  // Collect approved decisions
  const toApply = staging.decisions.filter((d) => d.status === 'approved');
  const resolvedApply = toApply.map((d) => {
    const catId = d.userOverride?.categoryId || d.categoryId;
    return { transactionId: d.transactionId, categoryId: catId };
  }).filter((d) => d.categoryId);

  if (resolvedApply.length === 0) {
    console.log(chalk.yellow('\n  Нечего записывать.'));
    return;
  }

  // Confirm push
  if (!opts.dryRun) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) =>
      rl.question(chalk.bold(`\n  Записать ${resolvedApply.length} категоризаций в ZenMoney? [y/N] `), resolve)
    );
    rl.close();

    if (answer.trim().toLowerCase() !== 'y') {
      console.log(chalk.yellow('  Отменено. Staging сохранён — можно продолжить с --resume.'));
      return;
    }

    // Push to ZenMoney
    process.stdout.write(chalk.dim(`  Записываю ${resolvedApply.length} категоризаций... `));

    // Build fake Transaction objects for batchUpdate (only need id)
    const updates = resolvedApply.map((d) => ({
      transaction: { id: d.transactionId } as Transaction,
      categoryIds: [d.categoryId!],
    }));

    await batchUpdateCategories(updates);
    console.log(chalk.green('OK'));

    clearStagingFile();
    printSuccess(`${resolvedApply.length} транзакций категоризировано и записано в ZenMoney!`);
  } else {
    console.log(chalk.yellow(`\n  [DRY RUN] ${resolvedApply.length} категоризаций НЕ записано. Staging сохранён.\n`));
  }
}

async function buildStaging(): Promise<StagingFile> {
  // Step 1: Auth & fetch
  process.stdout.write(chalk.dim('  Подключение к ZenMoney... '));
  authenticate();
  console.log(chalk.green('OK'));

  process.stdout.write(chalk.dim('  Загрузка всех транзакций... '));
  const data = await fetchNewData(true); // full sync
  console.log(chalk.green(`OK (${data.transactions.length})`));

  // Filter uncategorized, non-transfer
  const uncategorized = data.transactions.filter((tx) => {
    if (tx.tag && tx.tag.length > 0) return false;
    // Skip transfers (both income and outcome between different accounts)
    if (tx.income > 0 && tx.outcome > 0 && tx.incomeAccount !== tx.outcomeAccount) return false;
    return true;
  });

  console.log(chalk.bold(`\n  ${uncategorized.length} транзакций без категории`));

  if (uncategorized.length === 0) {
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      totalTransactions: 0,
      zones: { green: 0, yellow: 0, orange: 0, red: 0 },
      decisions: [],
      transactionCache: {},
    };
  }

  // Step 2: Rule-based categorization
  process.stdout.write(chalk.dim('  Правила (payee + MCC + feedback)... '));
  const ruleResults = new Map<string, { tx: Transaction; cat: ReturnType<typeof categorize> }>();
  let rulesMatched = 0;

  for (const tx of uncategorized) {
    const result = categorize(tx, data.categories, data.merchants as any);
    ruleResults.set(tx.id, { tx, cat: result });
    if (result.level !== 'none') rulesMatched++;
  }
  console.log(chalk.green(`${rulesMatched} распознано`));

  // Step 3: Cluster unresolved for LLM
  const unresolved = [...ruleResults.values()]
    .filter((r) => r.cat.level === 'none')
    .map((r) => ({
      transaction: r.tx,
      displayPayee: r.tx.payee || r.tx.originalPayee || r.tx.comment || '?',
    }));

  let llmResults = new Map<string, { categoryTitle: string; confidence: number; reason: string }>();

  if (unresolved.length > 0 && config.anthropic.apiKey) {
    const clusters = clusterByPayee(unresolved);
    console.log(chalk.dim(`  Кластеризация... ${unresolved.length} → ${clusters.size} кластеров`));

    const batchItems = prepareBatchItems(clusters, data.merchants as any);

    console.log(chalk.dim(`  AI-категоризация...`));
    const batchResults = await categorizeBatchLLM(
      batchItems,
      data.categories,
      config.anthropic.apiKey,
      (done, total) => printBatchProgress(done, total)
    );

    // Map batch results back to cluster keys
    for (const r of batchResults) {
      llmResults.set(r.clusterKey, {
        categoryTitle: r.categoryTitle,
        confidence: r.confidence,
        reason: r.reason,
      });
    }

    // Also build cluster key → transaction IDs mapping
    const clusterToTxIds = new Map<string, string[]>();
    for (const [key, items] of clusters) {
      clusterToTxIds.set(key, items.map((i) => i.transaction.id));
    }

    // Assign LLM results to transactions via cluster keys
    for (const [clusterKey, result] of llmResults) {
      const txIds = clusterToTxIds.get(clusterKey) || [];
      for (const txId of txIds) {
        const existing = ruleResults.get(txId);
        if (existing && existing.cat.level === 'none' && result.categoryTitle) {
          // Resolve category ID
          const lookup = buildCategoryLookup(data.categories);
          const catId = lookup.find(result.categoryTitle);
          existing.cat = {
            categoryTitle: result.categoryTitle,
            categoryId: catId,
            confidence: result.confidence,
            reason: result.reason,
            level: 'llm',
          };
        }
      }
    }
  } else if (unresolved.length > 0) {
    console.log(chalk.yellow('  Пропускаю AI (нет ANTHROPIC_API_KEY)'));
  }

  // Step 4: Build staging file
  const decisions: StagedDecision[] = [];
  const transactionCache: Record<string, CachedTransaction> = {};
  const zones = { green: 0, yellow: 0, orange: 0, red: 0 };

  // Build cluster key lookup for each transaction
  const txClusterKeys = new Map<string, string>();
  const allForClustering = uncategorized.map((tx) => ({
    transaction: tx,
    displayPayee: tx.payee || tx.originalPayee || tx.comment || '?',
  }));
  const allClusters = clusterByPayee(allForClustering);
  for (const [key, items] of allClusters) {
    for (const item of items) {
      txClusterKeys.set(item.transaction.id, key);
    }
  }

  for (const tx of uncategorized) {
    const result = ruleResults.get(tx.id);
    if (!result) continue;

    const zone = assignZone(result.cat.confidence);
    zones[zone]++;

    decisions.push({
      transactionId: tx.id,
      clusterKey: txClusterKeys.get(tx.id) || `__single_${tx.id}`,
      zone,
      categoryId: result.cat.categoryId,
      categoryTitle: result.cat.categoryTitle,
      confidence: result.cat.confidence,
      reason: result.cat.reason,
      status: 'pending',
    });

    transactionCache[tx.id] = {
      id: tx.id,
      date: tx.date,
      payee: tx.payee,
      originalPayee: tx.originalPayee,
      comment: tx.comment,
      outcome: tx.outcome,
      income: tx.income,
      mcc: tx.mcc,
      outcomeAccount: tx.outcomeAccount,
      incomeAccount: tx.incomeAccount,
      outcomeInstrument: tx.outcomeInstrument,
      incomeInstrument: tx.incomeInstrument,
    };
  }

  const staging: StagingFile = {
    version: 1,
    createdAt: new Date().toISOString(),
    totalTransactions: uncategorized.length,
    zones,
    decisions,
    transactionCache,
  };

  saveStagingFile(staging);
  return staging;
}
