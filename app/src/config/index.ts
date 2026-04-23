import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenvConfig({ path: resolve(__dirname, '../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function lazy<T>(fn: () => T): { readonly value: T } {
  let cached: T | undefined;
  return {
    get value() {
      if (cached === undefined) cached = fn();
      return cached;
    },
  };
}

const zmConfig = lazy(() => ({
  token: required('ZM_TOKEN'),
}));

export const config = {
  get zenmoney() {
    return zmConfig.value;
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  paths: {
    data: resolve(__dirname, '../../data'),
  },
} as const;
