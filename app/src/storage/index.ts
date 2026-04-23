import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { config } from '../config/index.js';

const DATA_DIR = config.paths.data;

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(name: string): string {
  return resolve(DATA_DIR, `${name}.json`);
}

function load<T>(name: string, fallback: T): T {
  const path = filePath(name);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return fallback;
  }
}

function save<T>(name: string, data: T): void {
  ensureDir();
  writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

// --- Sync State ---

export interface SyncState {
  lastServerTimestamp: number;
  lastSyncDate: string | null;
}

export function getSyncState(): SyncState {
  return load<SyncState>('sync-state', {
    lastServerTimestamp: 0,
    lastSyncDate: null,
  });
}

export function saveSyncState(state: SyncState): void {
  save('sync-state', state);
}

// --- Category Feedback (learning from user corrections) ---

export interface CategoryFeedback {
  payee: string;
  originalPayee: string | null;
  mcc: number | null;
  assignedCategory: string; // category ID
  categoryTitle: string;
  count: number; // how many times this mapping was confirmed
  lastUsed: string;
}

export function getFeedbackRules(): CategoryFeedback[] {
  return load<CategoryFeedback[]>('feedback-rules', []);
}

export function saveFeedbackRule(feedback: CategoryFeedback): void {
  const rules = getFeedbackRules();
  const existing = rules.find(
    (r) => r.payee === feedback.payee && r.assignedCategory === feedback.assignedCategory
  );
  if (existing) {
    existing.count += 1;
    existing.lastUsed = feedback.lastUsed;
  } else {
    rules.push(feedback);
  }
  save('feedback-rules', rules);
}

// --- Cached ZenMoney entities ---

export interface CachedEntities {
  categories: Record<string, { id: string; title: string; parent: string | null }>;
  accounts: Record<string, { id: string; title: string; type: string; balance: number | null }>;
  instruments: Record<string, { id: number; shortTitle: string; symbol: string }>;
  merchants: Record<string, { id: string; title: string }>;
}

export function getCachedEntities(): CachedEntities {
  return load<CachedEntities>('entities', {
    categories: {},
    accounts: {},
    instruments: {},
    merchants: {},
  });
}

export function saveCachedEntities(entities: CachedEntities): void {
  save('entities', entities);
}

// --- Stats ---

export interface DailyStats {
  date: string;
  totalTransactions: number;
  autoCategories: number;
  manualCategories: number;
  skipped: number;
  totalSpent: number;
  totalIncome: number;
}

export function getStats(): DailyStats[] {
  return load<DailyStats[]>('stats', []);
}

export function saveStats(stats: DailyStats[]): void {
  save('stats', stats);
}

export function addDailyStats(day: DailyStats): void {
  const stats = getStats();
  const existing = stats.findIndex((s) => s.date === day.date);
  if (existing >= 0) {
    stats[existing] = day;
  } else {
    stats.push(day);
  }
  save('stats', stats);
}

// --- Categorization Staging ---

export type Zone = 'green' | 'yellow' | 'orange' | 'red';

export interface StagedDecision {
  transactionId: string;
  clusterKey: string;
  zone: Zone;
  categoryId: string | null;
  categoryTitle: string;
  confidence: number;
  reason: string;
  status: 'pending' | 'approved' | 'skipped';
  userOverride?: { categoryId: string; categoryTitle: string };
}

export interface CachedTransaction {
  id: string;
  date: string;
  payee: string | null;
  originalPayee: string | null;
  comment: string | null;
  outcome: number;
  income: number;
  mcc: number | null;
  outcomeAccount: string;
  incomeAccount: string;
  outcomeInstrument: number;
  incomeInstrument: number;
}

export interface StagingFile {
  version: 1;
  createdAt: string;
  totalTransactions: number;
  zones: Record<Zone, number>;
  decisions: StagedDecision[];
  transactionCache: Record<string, CachedTransaction>;
}

export function getStagingFile(): StagingFile | null {
  const data = load<StagingFile | null>('categorize-staging', null);
  if (data && data.version === 1) return data;
  return null;
}

export function saveStagingFile(staging: StagingFile): void {
  save('categorize-staging', staging);
}

export function clearStagingFile(): void {
  const path = filePath('categorize-staging');
  if (existsSync(path)) {
    writeFileSync(path, '{}', 'utf-8');
  }
}
