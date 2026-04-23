import type { Transaction, Category } from 'zenmoney-api';
import { categorize, categorizeLLM, type CategorizationResult } from '../ai/categorizer.js';
import { config } from '../config/index.js';

export interface ProcessedTransaction {
  transaction: Transaction;
  categorization: CategorizationResult;
  status: 'auto' | 'needs-review' | 'already-categorized' | 'transfer';
  displayPayee: string;
  displayAmount: string;
  displayAccount: string;
}

const AUTO_CONFIDENCE_THRESHOLD = 0.85;

type SimpleAccount = { id: string; title: string; type: string; balance: number | null };
type SimpleInstrument = { id: number; shortTitle: string; symbol: string };
type SimpleMerchant = { id: string; title: string };

export async function processTransactions(
  transactions: Transaction[],
  categories: Map<string, Category>,
  accounts: Map<string, SimpleAccount>,
  instruments: Map<number, SimpleInstrument>,
  merchants?: Map<string, SimpleMerchant>
): Promise<ProcessedTransaction[]> {
  const results: ProcessedTransaction[] = [];

  for (const tx of transactions) {
    const processed = await processOne(tx, categories, accounts, instruments, merchants);
    results.push(processed);
  }

  return results;
}

async function processOne(
  tx: Transaction,
  categories: Map<string, Category>,
  accounts: Map<string, SimpleAccount>,
  instruments: Map<number, SimpleInstrument>,
  merchants?: Map<string, SimpleMerchant>
): Promise<ProcessedTransaction> {
  // Build display strings — include comment when payee is missing
  const payeePart = tx.payee || tx.originalPayee || '';
  const commentPart = tx.comment || '';
  const displayPayee = payeePart || commentPart || 'Без описания';

  // Amount
  const isExpense = tx.outcome > 0;
  const amount = isExpense ? tx.outcome : tx.income;
  const instrumentId = isExpense ? tx.outcomeInstrument : tx.incomeInstrument;
  const instrument = instruments.get(instrumentId);
  const symbol = instrument?.symbol || instrument?.shortTitle || '?';
  const sign = isExpense ? '-' : '+';
  const displayAmount = `${sign}${amount.toLocaleString('ru-RU')} ${symbol}`;

  // Account
  const accountId = isExpense ? tx.outcomeAccount : tx.incomeAccount;
  const account = accounts.get(accountId);
  const displayAccount = account?.title || '?';

  // Transfer between own accounts
  if (tx.income > 0 && tx.outcome > 0 && tx.incomeAccount !== tx.outcomeAccount) {
    return {
      transaction: tx,
      categorization: {
        categoryTitle: 'Перевод',
        categoryId: null,
        confidence: 1,
        reason: 'Перевод между счетами',
        level: 'none',
      },
      status: 'transfer',
      displayPayee,
      displayAmount,
      displayAccount,
    };
  }

  // Already categorized
  if (tx.tag && tx.tag.length > 0) {
    const catId = tx.tag[0];
    const cat = categories.get(catId);
    return {
      transaction: tx,
      categorization: {
        categoryTitle: cat?.title || '?',
        categoryId: catId,
        confidence: 1,
        reason: 'Уже категоризировано',
        level: 'none',
      },
      status: 'already-categorized',
      displayPayee,
      displayAmount,
      displayAccount,
    };
  }

  // Run 5-level categorizer (now includes comment analysis)
  let result = categorize(tx, categories, merchants);

  // If local rules failed → try LLM
  if (result.level === 'none' && config.anthropic.apiKey) {
    const categoryTitles = Array.from(categories.values()).map((c) => c.title);
    result = await categorizeLLM(tx, categoryTitles, config.anthropic.apiKey, merchants);

    // Resolve category ID
    if (result.categoryTitle) {
      for (const [id, cat] of categories) {
        if (cat.title.toLowerCase() === result.categoryTitle.toLowerCase()) {
          result.categoryId = id;
          break;
        }
      }
    }
  }

  const status: ProcessedTransaction['status'] =
    result.confidence >= AUTO_CONFIDENCE_THRESHOLD ? 'auto' : 'needs-review';

  return { transaction: tx, categorization: result, status, displayPayee, displayAmount, displayAccount };
}

export interface DayDigest {
  date: string;
  total: { spent: number; income: number; symbol: string };
  byCategory: Map<string, { amount: number; count: number }>;
  autoCount: number;
  reviewCount: number;
  alreadyCount: number;
  transferCount: number;
}

export function buildDigest(
  processed: ProcessedTransaction[],
  instruments: Map<number, SimpleInstrument>
): DayDigest {
  let totalSpent = 0;
  let totalIncome = 0;
  let mainSymbol = '₽';

  const byCategory = new Map<string, { amount: number; count: number }>();
  let autoCount = 0;
  let reviewCount = 0;
  let alreadyCount = 0;
  let transferCount = 0;

  for (const p of processed) {
    const tx = p.transaction;
    const isExpense = tx.outcome > 0;

    if (isExpense) totalSpent += tx.outcome;
    else totalIncome += tx.income;

    const instId = isExpense ? tx.outcomeInstrument : tx.incomeInstrument;
    const inst = instruments.get(instId);
    if (inst) mainSymbol = inst.symbol || inst.shortTitle;

    switch (p.status) {
      case 'auto': autoCount++; break;
      case 'needs-review': reviewCount++; break;
      case 'already-categorized': alreadyCount++; break;
      case 'transfer': transferCount++; break;
    }

    if (p.categorization.categoryTitle && p.status !== 'transfer') {
      const cat = p.categorization.categoryTitle;
      const existing = byCategory.get(cat) || { amount: 0, count: 0 };
      existing.amount += isExpense ? tx.outcome : tx.income;
      existing.count += 1;
      byCategory.set(cat, existing);
    }
  }

  return {
    date: new Date().toISOString().split('T')[0],
    total: { spent: totalSpent, income: totalIncome, symbol: mainSymbol },
    byCategory,
    autoCount,
    reviewCount,
    alreadyCount,
    transferCount,
  };
}
