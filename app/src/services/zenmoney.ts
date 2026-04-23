import { zenmoneyApi } from 'zenmoney-api';
import type { DiffObject, Transaction, Category, Account, Instrument, Merchant } from 'zenmoney-api';
import { config } from '../config/index.js';
import {
  getSyncState,
  saveSyncState,
  getCachedEntities,
  saveCachedEntities,
  type CachedEntities,
} from '../storage/index.js';

export interface SyncResult {
  transactions: Transaction[];
  categories: Map<string, Category>;
  accounts: Map<string, Account>;
  instruments: Map<number, Instrument>;
  merchants: Map<string, Merchant>;
  serverTimestamp: number;
}

/**
 * Token-based auth — no OAuth dance needed.
 * Token is a ZenMoney personal access token.
 */
export function authenticate(): void {
  zenmoneyApi.setToken(config.zenmoney.token);
}

export async function fetchNewData(fullSync: boolean = false): Promise<SyncResult> {
  const syncState = getSyncState();
  const serverTimestamp = fullSync ? 0 : syncState.lastServerTimestamp;

  // Fetch diff since last sync. serverTimestamp=0 means full sync.
  const diff = await zenmoneyApi.diff({
    currentClientTimestamp: Math.round(Date.now() / 1000),
    serverTimestamp,
  });

  // Build entity maps
  const categories = new Map<string, Category>();
  const accounts = new Map<string, Account>();
  const instruments = new Map<number, Instrument>();
  const merchants = new Map<string, Merchant>();

  // Load cached entities first (unless full sync)
  if (!fullSync) {
    const cached = getCachedEntities();
    for (const [id, cat] of Object.entries(cached.categories)) {
      categories.set(id, cat as unknown as Category);
    }
    for (const [id, acc] of Object.entries(cached.accounts)) {
      accounts.set(id, acc as unknown as Account);
    }
    for (const [id, inst] of Object.entries(cached.instruments)) {
      instruments.set(Number(id), inst as unknown as Instrument);
    }
    for (const [id, merch] of Object.entries(cached.merchants)) {
      merchants.set(id, merch as unknown as Merchant);
    }
  }

  // Overlay new data from diff
  if (diff.tag) {
    for (const cat of diff.tag) categories.set(cat.id, cat);
  }
  if (diff.account) {
    for (const acc of diff.account) accounts.set(acc.id, acc);
  }
  if (diff.instrument) {
    for (const inst of diff.instrument) instruments.set(inst.id, inst);
  }
  if (diff.merchant) {
    for (const merch of diff.merchant) merchants.set(merch.id, merch);
  }

  // Cache all entities for future use
  const entityCache: CachedEntities = {
    categories: {},
    accounts: {},
    instruments: {},
    merchants: {},
  };
  for (const [id, cat] of categories) {
    entityCache.categories[id] = { id: cat.id, title: cat.title, parent: cat.parent };
  }
  for (const [id, acc] of accounts) {
    entityCache.accounts[id] = { id: acc.id, title: acc.title, type: acc.type, balance: acc.balance };
  }
  for (const [id, inst] of instruments) {
    entityCache.instruments[String(id)] = { id: inst.id, shortTitle: inst.shortTitle, symbol: inst.symbol };
  }
  for (const [id, merch] of merchants) {
    entityCache.merchants[id] = { id: merch.id, title: merch.title };
  }
  saveCachedEntities(entityCache);

  // Filter: non-deleted, actual money movements
  const transactions = (diff.transaction || []).filter(
    (t) => !t.deleted && (t.outcome > 0 || t.income > 0)
  );

  const ts = diff.serverTimestamp || Math.round(Date.now() / 1000);

  return { transactions, categories, accounts, instruments, merchants, serverTimestamp: ts };
}

export async function updateTransactionCategory(
  transaction: Transaction,
  categoryIds: string[]
): Promise<void> {
  const updatedTransaction: Partial<Transaction> & { id: string; changed: number } = {
    id: transaction.id,
    tag: categoryIds,
    changed: Math.round(Date.now() / 1000),
  };

  await zenmoneyApi.diff({
    currentClientTimestamp: Math.round(Date.now() / 1000),
    transaction: [updatedTransaction as Transaction],
  });
}

/**
 * Batch update multiple transactions at once (efficient for auto-categorization)
 */
export async function batchUpdateCategories(
  updates: Array<{ transaction: Transaction; categoryIds: string[] }>
): Promise<void> {
  if (updates.length === 0) return;

  const now = Math.round(Date.now() / 1000);
  const transactions = updates.map((u) => ({
    id: u.transaction.id,
    tag: u.categoryIds,
    changed: now,
  })) as Transaction[];

  await zenmoneyApi.diff({
    currentClientTimestamp: now,
    transaction: transactions,
  });
}

export function completeSyncState(serverTimestamp: number): void {
  saveSyncState({
    lastServerTimestamp: serverTimestamp,
    lastSyncDate: new Date().toISOString().split('T')[0],
  });
}
