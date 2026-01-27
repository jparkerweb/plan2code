import { createHash } from 'crypto';

export function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function hashesMatch(a: string, b: string): boolean {
  return a === b;
}
