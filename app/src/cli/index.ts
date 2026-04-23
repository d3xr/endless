#!/usr/bin/env node

import { Command } from 'commander';
import { createInterface } from 'readline';
import chalk from 'chalk';

import { authenticate, fetchNewData, batchUpdateCategories, completeSyncState } from '../services/zenmoney.js';
import { processTransactions, buildDigest, type ProcessedTransaction } from '../services/processor.js';
import { clusterByPayee } from '../ai/categorizer.js';
import { saveFeedbackRule, addDailyStats, getSyncState } from '../storage/index.js';
import { createCategorizeCommand } from './categorize.js';
import {
  printHeader,
  printSync,
  printAutoCategories,
  printAlreadyCategorized,
  printTransfers,
  printReviewItem,
  printReviewPrompt,
  printDigest,
  printNoNewTransactions,
  printError,
  printSuccess,
  printCategoryList,
} from './display.js';

const program = new Command();

program
  .name('endless')
  .description('AI-powered financial autopilot on top of ZenMoney')
  .version('0.1.0');

// --- Helper: readline question ---
function createPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));
  return { ask, close: () => rl.close() };
}

// --- SYNC command ---
program
  .command('sync')
  .description('Sync and categorize new transactions')
  .option('--dry-run', 'Preview without writing changes to ZenMoney')
  .option('--full', 'Full re-sync (ignore last timestamp)')
  .action(async (opts: { dryRun?: boolean; full?: boolean }) => {
    try {
      // Step 1: Auth (just setToken, instant)
      process.stdout.write(chalk.dim('  Подключение к ZenMoney... '));
      authenticate();
      console.log(chalk.green('OK'));

      // Step 2: Fetch
      process.stdout.write(chalk.dim('  Загрузка данных... '));
      const data = await fetchNewData(opts.full);
      console.log(chalk.green(`OK (${data.transactions.length} транзакций)`));

      if (data.transactions.length === 0) {
        printNoNewTransactions();
        completeSyncState(data.serverTimestamp);
        return;
      }

      printSync(data.transactions.length);

      // Step 3: Process
      const processed = await processTransactions(
        data.transactions,
        data.categories,
        data.accounts as any,
        data.instruments as any,
        data.merchants as any
      );

      const autoApply = processed.filter((p) => p.status === 'auto');
      const needsReview = processed.filter((p) => p.status === 'needs-review');

      // Show auto-results
      printAutoCategories(processed);
      printAlreadyCategorized(processed);
      printTransfers(processed);

      // Batch-apply auto-categories
      if (!opts.dryRun && autoApply.length > 0) {
        const updates = autoApply
          .filter((p) => p.categorization.categoryId)
          .map((p) => ({
            transaction: p.transaction,
            categoryIds: [p.categorization.categoryId!],
          }));

        if (updates.length > 0) {
          process.stdout.write(chalk.dim(`\n  Применяю ${updates.length} авто-категорий... `));
          await batchUpdateCategories(updates);
          console.log(chalk.green('OK'));
        }
      }

      // Step 4: Interactive review with CLUSTERING
      if (needsReview.length > 0) {
        printHeader(`Нужна помощь: ${needsReview.length}`);

        // Cluster similar transactions
        const clusters = clusterByPayee(needsReview);
        const clusterEntries = [...clusters.entries()].sort(
          (a, b) => b[1].length - a[1].length // biggest clusters first
        );

        const { ask, close } = createPrompt();

        // Build category list
        const categoryList = Array.from(data.categories.values())
          .filter((c) => !c.parent)
          .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
          .map((c) => ({ title: c.title, id: c.id }));

        let manualCount = 0;
        let skippedCount = 0;
        let clusterIdx = 0;

        for (const [clusterKey, items] of clusterEntries) {
          clusterIdx++;

          if (items.length > 1) {
            // --- CLUSTER MODE: batch assign same category to all ---
            console.log();
            console.log(
              chalk.bold.magenta(`  [Группа ${clusterIdx}/${clusterEntries.length}] `) +
                chalk.white(`${items.length} похожих транзакций:`)
            );

            // Show all transactions in cluster
            let totalAmount = 0;
            for (const item of items) {
              const tx = item.transaction;
              const amt = tx.outcome > 0 ? tx.outcome : tx.income;
              totalAmount += amt;
              const payee = tx.payee || tx.originalPayee || '?';
              const comment = tx.comment ? chalk.dim(` // ${tx.comment}`) : '';
              console.log(
                chalk.dim(`    ${tx.date}`) +
                  `  ${chalk.white(payee)}` +
                  `  ${chalk.yellow(item.displayAmount)}` +
                  comment
              );
            }
            console.log(
              chalk.dim(`    Итого: `) + chalk.yellow(totalAmount.toLocaleString('ru-RU') + ' ₽')
            );

            // Show AI suggestion if any
            const bestSuggestion = items
              .map((i) => i.categorization)
              .filter((c) => c.categoryTitle)
              .sort((a, b) => b.confidence - a.confidence)[0];

            if (bestSuggestion) {
              const confColor =
                bestSuggestion.confidence >= 0.7
                  ? chalk.green
                  : bestSuggestion.confidence >= 0.4
                    ? chalk.yellow
                    : chalk.red;
              console.log(
                `\n    Предлагаю: ${chalk.cyan(bestSuggestion.categoryTitle)} ` +
                  confColor(`(${Math.round(bestSuggestion.confidence * 100)}%)`) +
                  chalk.dim(` — ${bestSuggestion.reason}`)
              );
            }

            console.log(
              chalk.dim(`\n    `) +
                chalk.green('[Enter]') +
                chalk.dim(' Принять  ') +
                chalk.yellow('[c]') +
                chalk.dim(' Изменить  ') +
                chalk.red('[s]') +
                chalk.dim(' Пропустить')
            );

            const answer = (await ask(chalk.dim('    > '))).trim().toLowerCase();

            if (answer === 's' || answer === 'skip') {
              skippedCount += items.length;
              continue;
            }

            let selectedCategory: { title: string; id: string } | null = null;

            if (answer === '' && bestSuggestion?.categoryId) {
              selectedCategory = { title: bestSuggestion.categoryTitle, id: bestSuggestion.categoryId };
            } else {
              // Show category picker
              console.log();
              printCategoryList(categoryList);
              const catAnswer = (await ask(chalk.dim('\n    Номер категории: '))).trim();
              const catIndex = parseInt(catAnswer, 10) - 1;
              if (catIndex >= 0 && catIndex < categoryList.length) {
                selectedCategory = categoryList[catIndex];
              }
            }

            if (selectedCategory) {
              // Apply to ALL items in cluster
              if (!opts.dryRun) {
                const updates = items.map((item) => ({
                  transaction: item.transaction,
                  categoryIds: [selectedCategory!.id],
                }));
                await batchUpdateCategories(updates);

                // Save feedback for each unique payee
                const seenPayees = new Set<string>();
                for (const item of items) {
                  const payee = item.transaction.payee || item.transaction.originalPayee || '';
                  if (payee && !seenPayees.has(payee.toLowerCase())) {
                    seenPayees.add(payee.toLowerCase());
                    saveFeedbackRule({
                      payee,
                      originalPayee: item.transaction.originalPayee,
                      mcc: item.transaction.mcc,
                      assignedCategory: selectedCategory.id,
                      categoryTitle: selectedCategory.title,
                      count: 1,
                      lastUsed: new Date().toISOString(),
                    });
                  }
                }
              }
              manualCount += items.length;
              console.log(
                chalk.green(`    → ${selectedCategory.title} (${items.length} транзакций)`)
              );
            } else {
              console.log(chalk.yellow('    Пропущено'));
              skippedCount += items.length;
            }
          } else {
            // --- SINGLE ITEM MODE ---
            const p = items[0];
            printReviewItem(clusterIdx - 1, clusterEntries.length, p);

            // Show comment if present
            if (p.transaction.comment) {
              console.log(chalk.dim(`         Комментарий: `) + chalk.italic(p.transaction.comment));
            }

            printReviewPrompt(!!p.categorization.categoryTitle);

            const answer = (await ask(chalk.dim('         > '))).trim().toLowerCase();

            if (answer === 's' || answer === 'skip') {
              skippedCount++;
              continue;
            }

            if (answer === '' && p.categorization.categoryTitle && p.categorization.categoryId) {
              if (!opts.dryRun) {
                await batchUpdateCategories([
                  { transaction: p.transaction, categoryIds: [p.categorization.categoryId] },
                ]);
                saveFeedbackRule({
                  payee: p.transaction.payee || p.transaction.originalPayee || '',
                  originalPayee: p.transaction.originalPayee,
                  mcc: p.transaction.mcc,
                  assignedCategory: p.categorization.categoryId,
                  categoryTitle: p.categorization.categoryTitle,
                  count: 1,
                  lastUsed: new Date().toISOString(),
                });
              }
              manualCount++;
              console.log(chalk.green(`         → ${p.categorization.categoryTitle}`));
              continue;
            }

            // Category picker
            console.log();
            printCategoryList(categoryList);
            const catAnswer = (await ask(chalk.dim('\n         Номер категории: '))).trim();
            const catIndex = parseInt(catAnswer, 10) - 1;

            if (catIndex >= 0 && catIndex < categoryList.length) {
              const selected = categoryList[catIndex];
              if (!opts.dryRun) {
                await batchUpdateCategories([
                  { transaction: p.transaction, categoryIds: [selected.id] },
                ]);
                saveFeedbackRule({
                  payee: p.transaction.payee || p.transaction.originalPayee || '',
                  originalPayee: p.transaction.originalPayee,
                  mcc: p.transaction.mcc,
                  assignedCategory: selected.id,
                  categoryTitle: selected.title,
                  count: 1,
                  lastUsed: new Date().toISOString(),
                });
              }
              manualCount++;
              console.log(chalk.green(`         → ${selected.title}`));
            } else {
              skippedCount++;
            }
          }
        }

        close();
      }

      // Step 5: Digest
      const digest = buildDigest(processed, data.instruments as any);
      printDigest(digest);

      // Step 6: Save state
      if (!opts.dryRun) {
        completeSyncState(data.serverTimestamp);
        addDailyStats({
          date: digest.date,
          totalTransactions: processed.length,
          autoCategories: autoApply.length,
          manualCategories: needsReview.length,
          skipped: 0,
          totalSpent: digest.total.spent,
          totalIncome: digest.total.income,
        });
      }

      if (opts.dryRun) {
        console.log(chalk.yellow('  [DRY RUN] Изменения не записаны в ZenMoney\n'));
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// --- CATEGORIZE command ---
program.addCommand(createCategorizeCommand());

// --- STATUS ---
program
  .command('status')
  .description('Show current sync status and stats')
  .action(() => {
    const state = getSyncState();
    printHeader('Статус Endless');

    if (state.lastSyncDate) {
      console.log(`    Последняя синхронизация: ${chalk.cyan(state.lastSyncDate)}`);
      console.log(`    Server timestamp: ${chalk.dim(String(state.lastServerTimestamp))}`);
    } else {
      console.log(chalk.yellow('    Ещё не было синхронизаций. Запустите: endless sync'));
    }
    console.log();
  });

// --- RESET ---
program
  .command('reset')
  .description('Reset sync state (will re-fetch all transactions)')
  .action(() => {
    completeSyncState(0);
    printSuccess('Сброшено. Следующий sync загрузит все данные.');
  });

program.parse();
