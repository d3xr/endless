/**
 * Прямой POST на ZenMoney v8/diff, минуя zenmoney-api (в ней баг:
 * diff() отправляет только timestamps, не передаёт transaction/tag/etc).
 */
import { config } from '../config/index.js';

export async function directDiff(payload: {
  currentClientTimestamp: number;
  serverTimestamp?: number;
  transaction?: any[];
  tag?: any[];
  account?: any[];
}): Promise<any> {
  const body = {
    currentClientTimestamp: payload.currentClientTimestamp,
    serverTimestamp: payload.serverTimestamp ?? 0,
    ...(payload.transaction && { transaction: payload.transaction }),
    ...(payload.tag && { tag: payload.tag }),
    ...(payload.account && { account: payload.account }),
  };
  const resp = await fetch('https://api.zenmoney.ru/v8/diff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.zenmoney.token}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`ZenMoney diff HTTP ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}
