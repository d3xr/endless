import type { Transaction, Category } from 'zenmoney-api';
import { MCC_CATEGORY_MAP } from './mcc-map.js';
import { PAYEE_PATTERNS } from './payee-patterns.js';
import { getFeedbackRules } from '../storage/index.js';

export interface CategorizationResult {
  categoryTitle: string;
  categoryId: string | null;
  confidence: number;
  reason: string;
  level: 'feedback' | 'payee-pattern' | 'mcc' | 'comment' | 'llm' | 'none';
}

/**
 * Extract ALL text signals from a transaction.
 * This is key — not just payee, but also comment, originalPayee, merchant title.
 */
export function extractSignals(
  transaction: Transaction,
  merchants: Map<string, { id: string; title: string }>
): {
  payee: string;
  originalPayee: string;
  comment: string;
  merchantTitle: string;
  allText: string; // everything combined for fuzzy matching
} {
  const payee = transaction.payee || '';
  const originalPayee = transaction.originalPayee || '';
  const comment = transaction.comment || '';
  const merchantTitle = transaction.merchant
    ? (merchants.get(transaction.merchant)?.title || '')
    : '';

  // Combined text for when we need to search everywhere
  const allText = [payee, originalPayee, comment, merchantTitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return { payee, originalPayee, comment, merchantTitle, allText };
}

/**
 * Build reverse lookup: category title → category id.
 * Handles fuzzy matching (substring containment).
 * Trims titles to handle trailing whitespace in ZenMoney data.
 */
export function buildCategoryLookup(categories: Map<string, Category>): {
  exact: Map<string, string>;
  find: (title: string) => string | null;
} {
  const exact = new Map<string, string>();
  for (const [id, cat] of categories) {
    exact.set(cat.title.trim().toLowerCase(), id);
  }

  function find(title: string): string | null {
    const lower = title.trim().toLowerCase();
    const direct = exact.get(lower);
    if (direct) return direct;
    for (const [catTitle, catId] of exact) {
      if (catTitle.includes(lower) || lower.includes(catTitle)) {
        return catId;
      }
    }
    return null;
  }

  return { exact, find };
}

/**
 * Format categories as "Parent > Child" for LLM prompts.
 * This helps LLM distinguish "Дом > Ремонт" from "Авто > Ремонт".
 */
export function formatCategoryList(categories: Map<string, Category>): string[] {
  const result: string[] = [];
  for (const [, cat] of categories) {
    if (cat.parent) {
      const parent = categories.get(cat.parent);
      result.push(parent ? `${parent.title.trim()} > ${cat.title.trim()}` : cat.title.trim());
    } else {
      result.push(cat.title.trim());
    }
  }
  return result.sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * Five-level categorizer:
 * 1. User feedback history (highest priority — user knows best)
 * 2. Payee pattern matching (known merchants)
 * 3. Comment analysis (user's own notes often reveal category)
 * 4. MCC code mapping
 * 5. None → will need LLM or manual review
 */
export function categorize(
  transaction: Transaction,
  categories: Map<string, Category>,
  merchants?: Map<string, { id: string; title: string }>
): CategorizationResult {
  const signals = extractSignals(transaction, merchants || new Map());
  const lookup = buildCategoryLookup(categories);

  // --- Level 1: Feedback history (user corrections) ---
  const feedbackRules = getFeedbackRules();
  if (signals.allText) {
    // Match against any known payee in feedback
    const feedbackMatch = feedbackRules
      .filter((r) => {
        const rPayee = r.payee.toLowerCase();
        return signals.allText.includes(rPayee) || rPayee.includes(signals.payee.toLowerCase());
      })
      .sort((a, b) => b.count - a.count)[0];

    if (feedbackMatch) {
      return {
        categoryTitle: feedbackMatch.categoryTitle,
        categoryId: feedbackMatch.assignedCategory,
        confidence: Math.min(0.97, 0.8 + feedbackMatch.count * 0.03),
        reason: `Пользователь ${feedbackMatch.count}x назначал «${feedbackMatch.categoryTitle}» для «${feedbackMatch.payee}»`,
        level: 'feedback',
      };
    }
  }

  // --- Level 2: Payee pattern matching ---
  for (const textToMatch of [signals.payee, signals.originalPayee, signals.merchantTitle]) {
    if (!textToMatch) continue;
    for (const { pattern, category } of PAYEE_PATTERNS) {
      if (pattern.test(textToMatch)) {
        return {
          categoryTitle: category,
          categoryId: lookup.find(category),
          confidence: 0.90,
          reason: `«${textToMatch}» → паттерн «${category}»`,
          level: 'payee-pattern',
        };
      }
    }
  }

  // --- Level 3: Comment analysis ---
  // Comments often contain direct clues: "обед с коллегами", "подарок маме", "ремонт ванной"
  if (signals.comment) {
    for (const { pattern, category } of PAYEE_PATTERNS) {
      if (pattern.test(signals.comment)) {
        return {
          categoryTitle: category,
          categoryId: lookup.find(category),
          confidence: 0.75,
          reason: `Комментарий «${signals.comment}» → «${category}»`,
          level: 'comment',
        };
      }
    }

    // Also check if comment directly matches a category name
    for (const [catTitle, catId] of lookup.exact) {
      if (signals.comment.toLowerCase().includes(catTitle)) {
        const cat = categories.get(catId);
        return {
          categoryTitle: cat?.title || catTitle,
          categoryId: catId,
          confidence: 0.70,
          reason: `Комментарий «${signals.comment}» содержит название категории «${cat?.title}»`,
          level: 'comment',
        };
      }
    }
  }

  // --- Level 4: MCC code ---
  const mcc = transaction.mcc;
  if (mcc && MCC_CATEGORY_MAP[mcc]) {
    const categoryTitle = MCC_CATEGORY_MAP[mcc];
    return {
      categoryTitle,
      categoryId: lookup.find(categoryTitle),
      confidence: 0.80,
      reason: `MCC ${mcc} → «${categoryTitle}»`,
      level: 'mcc',
    };
  }

  // --- Level 5: No match ---
  const description = signals.allText || 'нет данных';
  return {
    categoryTitle: '',
    categoryId: null,
    confidence: 0,
    reason: `Не удалось определить: ${description}`,
    level: 'none',
  };
}

/**
 * LLM categorization — sends transaction context to Claude for analysis.
 * Uses ALL available text: payee, originalPayee, comment, MCC description.
 */
export async function categorizeLLM(
  transaction: Transaction,
  availableCategories: string[],
  anthropicKey: string,
  merchants?: Map<string, { id: string; title: string }>
): Promise<CategorizationResult> {
  const signals = extractSignals(transaction, merchants || new Map());
  const amount = transaction.outcome > 0 ? transaction.outcome : transaction.income;
  const isExpense = transaction.outcome > 0;

  if (!anthropicKey) {
    return {
      categoryTitle: '',
      categoryId: null,
      confidence: 0,
      reason: 'Нет API ключа Anthropic',
      level: 'llm',
    };
  }

  const mccHint = transaction.mcc ? `MCC: ${transaction.mcc}` : '';

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
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Определи категорию ${isExpense ? 'расхода' : 'дохода'}.

Получатель: ${signals.payee || 'не указан'}
Оригинальное название: ${signals.originalPayee || 'не указано'}
Комментарий: ${signals.comment || 'нет'}
Мерчант: ${signals.merchantTitle || 'не указан'}
${mccHint}
Сумма: ${amount}

Доступные категории: ${availableCategories.join(', ')}

Ответь JSON: {"category": "...", "confidence": 0.0-1.0, "reason": "кратко почему"}
Если не уверен — confidence < 0.5.`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic API: ${response.status}`);

    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const text = data.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in LLM response');

    const parsed = JSON.parse(jsonMatch[0]) as {
      category: string;
      confidence: number;
      reason: string;
    };

    return {
      categoryTitle: parsed.category,
      categoryId: null, // resolved by caller
      confidence: Math.min(parsed.confidence, 0.85), // cap LLM confidence
      reason: `AI: ${parsed.reason}`,
      level: 'llm',
    };
  } catch (error) {
    return {
      categoryTitle: '',
      categoryId: null,
      confidence: 0,
      reason: `LLM ошибка: ${error instanceof Error ? error.message : 'unknown'}`,
      level: 'llm',
    };
  }
}

/**
 * Cluster uncategorized transactions by payee similarity.
 * Groups like "OZON 1234", "OZON 5678" into one cluster.
 * This enables batch categorization: "All OZON = Покупки"
 */
export function clusterByPayee(
  transactions: Array<{ transaction: Transaction; displayPayee: string }>
): Map<string, typeof transactions> {
  const clusters = new Map<string, typeof transactions>();

  for (const item of transactions) {
    const payee = item.transaction.payee || item.transaction.originalPayee || '';
    if (!payee) {
      // No payee — each is its own cluster
      clusters.set(`__unknown_${item.transaction.id}`, [item]);
      continue;
    }

    // Normalize: remove trailing numbers, trim, lowercase
    const normalized = payee
      .replace(/\d{3,}/g, '') // remove long numbers (card digits, order IDs)
      .replace(/[#№]\S+/g, '') // remove # references
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Find existing cluster by fuzzy match
    let matched = false;
    for (const [key, items] of clusters) {
      if (key.includes(normalized) || normalized.includes(key)) {
        items.push(item);
        matched = true;
        break;
      }
    }

    if (!matched) {
      clusters.set(normalized, [item]);
    }
  }

  return clusters;
}
