import type { Transaction, Category } from 'zenmoney-api';
import { extractSignals, formatCategoryList } from './categorizer.js';

export interface BatchItem {
  clusterKey: string;
  representative: Transaction;
  transactionCount: number;
  signals: {
    payee: string;
    originalPayee: string;
    comment: string;
    merchantTitle: string;
    mcc: number | null;
  };
}

export interface BatchResult {
  clusterKey: string;
  categoryTitle: string;
  confidence: number;
  reason: string;
}

const BATCH_SIZE = 20;
const CONCURRENCY = 3;

/**
 * Run LLM categorization in efficient batches.
 * Groups clusters into batches of 20, runs 3 in parallel.
 * ~15 API calls for 300 clusters = ~45 seconds total.
 */
export async function categorizeBatchLLM(
  items: BatchItem[],
  categories: Map<string, Category>,
  anthropicKey: string,
  onProgress?: (done: number, total: number) => void
): Promise<BatchResult[]> {
  if (!anthropicKey || items.length === 0) return [];

  const categoryList = formatCategoryList(categories);
  const batches: BatchItem[][] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const results: BatchResult[] = [];
  let completed = 0;

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((batch) => processSingleBatch(batch, categoryList, anthropicKey))
    );
    for (const batchResults of chunkResults) {
      results.push(...batchResults);
      completed++;
      onProgress?.(completed, batches.length);
    }
  }

  return results;
}

async function processSingleBatch(
  items: BatchItem[],
  categoryList: string[],
  anthropicKey: string
): Promise<BatchResult[]> {
  const transactionLines = items.map((item, i) => {
    const parts: string[] = [`${i + 1}.`];
    if (item.signals.payee) parts.push(`Получатель: "${item.signals.payee}"`);
    if (item.signals.originalPayee && item.signals.originalPayee !== item.signals.payee) {
      parts.push(`Ориг: "${item.signals.originalPayee}"`);
    }
    if (item.signals.comment) parts.push(`Комментарий: "${item.signals.comment}"`);
    if (item.signals.mcc) parts.push(`MCC: ${item.signals.mcc}`);
    const amount = item.representative.outcome > 0
      ? item.representative.outcome
      : item.representative.income;
    const type = item.representative.outcome > 0 ? 'расход' : 'доход';
    parts.push(`${type} ${amount}₽`);
    if (item.transactionCount > 1) parts.push(`(${item.transactionCount} похожих)`);
    return parts.join(' | ');
  }).join('\n');

  const prompt = `Категоризируй транзакции. Для каждой выбери ОДНУ наиболее подходящую категорию из списка.

Доступные категории:
${categoryList.join(', ')}

Транзакции:
${transactionLines}

Ответь СТРОГО как JSON массив (без markdown):
[{"id": 1, "category": "точное название из списка", "confidence": 0.0-1.0, "reason": "кратко почему"}]

Правила:
- category должна ТОЧНО совпадать с одной из доступных категорий
- Для подкатегорий используй формат "Родитель > Ребёнок" (например "Авто > Топливо")
- confidence < 0.5 если не уверен
- Если это перевод между людьми (ФИО в комментарии) — категория "Переводы"`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const text = data.content[0]?.text || '';

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id: number;
      category: string;
      confidence: number;
      reason: string;
    }>;

    return parsed.map((p) => {
      const idx = p.id - 1;
      const item = items[idx];
      if (!item) return null;
      return {
        clusterKey: item.clusterKey,
        categoryTitle: p.category,
        confidence: Math.min(p.confidence, 0.95),
        reason: p.reason,
      };
    }).filter((r): r is BatchResult => r !== null);
  } catch (error) {
    // On failure, return empty results for this batch (don't crash the whole pipeline)
    return items.map((item) => ({
      clusterKey: item.clusterKey,
      categoryTitle: '',
      confidence: 0,
      reason: `LLM ошибка: ${error instanceof Error ? error.message : 'unknown'}`,
    }));
  }
}

/**
 * Prepare batch items from clustered transactions.
 * Takes only clusters that have no category (level === 'none').
 */
export function prepareBatchItems(
  clusters: Map<string, Array<{ transaction: Transaction; displayPayee: string }>>,
  merchants: Map<string, { id: string; title: string }>
): BatchItem[] {
  const items: BatchItem[] = [];

  for (const [key, txs] of clusters) {
    // Pick representative: the one with most text signals
    const representative = txs.reduce((best, curr) => {
      const bestSignals = [best.transaction.payee, best.transaction.comment, best.transaction.originalPayee].filter(Boolean).length;
      const currSignals = [curr.transaction.payee, curr.transaction.comment, curr.transaction.originalPayee].filter(Boolean).length;
      return currSignals > bestSignals ? curr : best;
    });

    const signals = extractSignals(representative.transaction, merchants);

    items.push({
      clusterKey: key,
      representative: representative.transaction,
      transactionCount: txs.length,
      signals: {
        payee: signals.payee,
        originalPayee: signals.originalPayee,
        comment: signals.comment,
        merchantTitle: signals.merchantTitle,
        mcc: representative.transaction.mcc,
      },
    });
  }

  return items;
}
