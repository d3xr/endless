import chalk from 'chalk';
import type { ProcessedTransaction } from '../services/processor.js';
import type { DayDigest } from '../services/processor.js';

export function printHeader(text: string): void {
  console.log();
  console.log(chalk.bold.cyan(`  ${text}`));
  console.log(chalk.dim('  ' + '─'.repeat(50)));
}

export function printSync(count: number): void {
  console.log();
  console.log(chalk.bold(`  Синхронизация... ${chalk.green(count)} новых транзакций`));
}

export function printAutoCategories(transactions: ProcessedTransaction[]): void {
  const auto = transactions.filter((t) => t.status === 'auto');
  if (auto.length === 0) return;

  printHeader(`Автоматически категоризировано: ${auto.length}`);

  // Group by category
  const groups = new Map<string, { amount: number; count: number; symbol: string }>();
  for (const t of auto) {
    const cat = t.categorization.categoryTitle;
    const existing = groups.get(cat) || { amount: 0, count: 0, symbol: '₽' };
    existing.amount += t.transaction.outcome || t.transaction.income;
    existing.count += 1;
    groups.set(cat, existing);
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1].amount - a[1].amount);

  for (const [cat, data] of sorted) {
    const amount = chalk.yellow(data.amount.toLocaleString('ru-RU') + ' ₽');
    const count = chalk.dim(`(${data.count})`);
    console.log(`    ${chalk.white(cat.padEnd(20))} ${amount.padStart(15)}  ${count}`);
  }
}

export function printAlreadyCategorized(transactions: ProcessedTransaction[]): void {
  const already = transactions.filter((t) => t.status === 'already-categorized');
  if (already.length === 0) return;

  console.log(chalk.dim(`\n  Уже категоризировано: ${already.length}`));
}

export function printTransfers(transactions: ProcessedTransaction[]): void {
  const transfers = transactions.filter((t) => t.status === 'transfer');
  if (transfers.length === 0) return;

  console.log(chalk.dim(`  Переводы между счетами: ${transfers.length}`));
}

export function printReviewItem(
  index: number,
  total: number,
  tx: ProcessedTransaction
): void {
  console.log();
  console.log(
    chalk.bold.white(`  [${index + 1}/${total}] `) +
      chalk.white(tx.displayPayee) +
      chalk.yellow(` ${tx.displayAmount}`)
  );
  console.log(chalk.dim(`         ${tx.transaction.date}  •  ${tx.displayAccount}`));

  if (tx.categorization.categoryTitle) {
    const conf = tx.categorization.confidence;
    const confColor = conf >= 0.7 ? chalk.green : conf >= 0.4 ? chalk.yellow : chalk.red;
    console.log(
      `         Предлагаю: ${chalk.cyan(tx.categorization.categoryTitle)} ` +
        confColor(`(${Math.round(conf * 100)}%)`)
    );
    console.log(chalk.dim(`         ${tx.categorization.reason}`));
  } else {
    console.log(chalk.dim(`         Не удалось определить категорию`));
  }
}

export function printReviewPrompt(hasSuggestion: boolean): void {
  if (hasSuggestion) {
    console.log(
      chalk.dim(`         `) +
        chalk.green('[Enter]') +
        chalk.dim(' Принять  ') +
        chalk.yellow('[c]') +
        chalk.dim(' Изменить  ') +
        chalk.red('[s]') +
        chalk.dim(' Пропустить')
    );
  } else {
    console.log(
      chalk.dim(`         `) +
        chalk.yellow('[c]') +
        chalk.dim(' Назначить категорию  ') +
        chalk.red('[s]') +
        chalk.dim(' Пропустить')
    );
  }
}

export function printDigest(digest: DayDigest): void {
  printHeader('Итоги');

  if (digest.total.spent > 0) {
    console.log(
      `    Расходы:   ${chalk.red('-' + digest.total.spent.toLocaleString('ru-RU'))} ${digest.total.symbol}`
    );
  }
  if (digest.total.income > 0) {
    console.log(
      `    Доходы:    ${chalk.green('+' + digest.total.income.toLocaleString('ru-RU'))} ${digest.total.symbol}`
    );
  }

  const autoRate =
    digest.autoCount + digest.alreadyCount > 0
      ? Math.round(
          ((digest.autoCount + digest.alreadyCount) /
            (digest.autoCount + digest.alreadyCount + digest.reviewCount)) *
            100
        )
      : 0;

  console.log();
  console.log(
    chalk.dim('    Автоматизация: ') +
      chalk.green(`${autoRate}%`) +
      chalk.dim(
        ` (${digest.autoCount} авто + ${digest.alreadyCount} уже + ${digest.reviewCount} ручных)`
      )
  );

  if (digest.transferCount > 0) {
    console.log(chalk.dim(`    Переводов: ${digest.transferCount}`));
  }
  console.log();
}

export function printNoNewTransactions(): void {
  console.log();
  console.log(chalk.green('  Все транзакции актуальны. Нечего синхронизировать.'));
  console.log();
}

export function printError(message: string): void {
  console.error(chalk.red(`\n  Ошибка: ${message}\n`));
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`\n  ${message}\n`));
}

export function printCategoryList(
  categories: Array<{ title: string; id: string }>,
  numbered: boolean = true
): void {
  for (let i = 0; i < categories.length; i++) {
    const prefix = numbered ? chalk.dim(`  ${(i + 1).toString().padStart(2)}.`) : '   ';
    console.log(`${prefix} ${categories[i].title}`);
  }
}

// --- Zone Display ---

const ZONE_COLORS = {
  green: chalk.green,
  yellow: chalk.yellow,
  orange: chalk.hex('#FF8C00'),
  red: chalk.red,
} as const;

const ZONE_LABELS = {
  green: 'GREEN',
  yellow: 'YELLOW',
  orange: 'ORANGE',
  red: 'RED',
} as const;

export function printZoneSummary(zones: Record<string, number>, total: number): void {
  console.log();
  console.log(chalk.bold('  ' + '═'.repeat(50)));
  console.log(`  ${ZONE_COLORS.green('■')} GREEN  (авто):    ${chalk.bold(String(zones.green).padStart(4))}`);
  console.log(`  ${ZONE_COLORS.yellow('■')} YELLOW (ревью):   ${chalk.bold(String(zones.yellow).padStart(4))}`);
  console.log(`  ${ZONE_COLORS.orange('■')} ORANGE (выбор):   ${chalk.bold(String(zones.orange).padStart(4))}`);
  console.log(`  ${ZONE_COLORS.red('■')} RED    (вручную): ${chalk.bold(String(zones.red).padStart(4))}`);
  console.log(chalk.bold('  ' + '═'.repeat(50)));
  console.log();
}

export function printZoneHeader(zone: 'green' | 'yellow' | 'orange' | 'red', label: string): void {
  const color = ZONE_COLORS[zone];
  console.log();
  console.log(color(`  ── ${ZONE_LABELS[zone]}: ${label} ──`));
}

export function printBatchProgress(done: number, total: number): void {
  const pct = Math.round((done / total) * 100);
  const filled = Math.round((done / total) * 20);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  process.stdout.write(`\r  AI-категоризация: [${chalk.cyan(bar)}] ${done}/${total} (${pct}%)`);
  if (done === total) console.log();
}

export function printClusterHeader(
  zone: 'green' | 'yellow' | 'orange' | 'red',
  index: number,
  total: number,
  payee: string,
  count: number,
  amount: number
): void {
  const color = ZONE_COLORS[zone];
  const tag = color(`[${ZONE_LABELS[zone]} ${index + 1}/${total}]`);
  const txLabel = count > 1 ? ` (${count} тр., ${amount.toLocaleString('ru-RU')} ₽)` : ` (${amount.toLocaleString('ru-RU')} ₽)`;
  console.log(`\n  ${tag} ${chalk.white(payee)}${chalk.dim(txLabel)}`);
}

export function printSuggestion(
  categoryTitle: string,
  confidence: number,
  reason?: string,
  alternatives?: Array<{ title: string; confidence: number }>
): void {
  const pct = Math.round(confidence * 100);
  const confColor = confidence >= 0.7 ? chalk.green : confidence >= 0.4 ? chalk.yellow : chalk.red;
  console.log(`    → ${chalk.cyan(categoryTitle)} ${confColor(`(${pct}%)`)}`);
  if (reason) console.log(chalk.dim(`      ${reason}`));
  if (alternatives && alternatives.length > 0) {
    for (let i = 0; i < alternatives.length; i++) {
      const alt = alternatives[i];
      const altPct = Math.round(alt.confidence * 100);
      console.log(`    ${chalk.dim(`${i + 2}.`)} ${alt.title} ${chalk.dim(`(${altPct}%)`)}`);
    }
  }
}

export function printPushSummary(
  approved: number,
  skipped: number,
  autoGreen: number
): void {
  console.log();
  console.log(chalk.bold('  ' + '═'.repeat(50)));
  console.log(chalk.bold('  Итого к записи в ZenMoney:'));
  if (autoGreen > 0) console.log(`    GREEN:  ${chalk.green(String(autoGreen))} авто`);
  if (approved > 0) console.log(`    Ревью:  ${chalk.cyan(String(approved))} одобрено`);
  if (skipped > 0) console.log(`    ${chalk.dim(`Пропущено: ${skipped}`)}`);
  console.log(`    ${'─'.repeat(30)}`);
  console.log(chalk.bold(`    Всего:  ${autoGreen + approved} категоризаций`));
  console.log(chalk.bold('  ' + '═'.repeat(50)));
}
