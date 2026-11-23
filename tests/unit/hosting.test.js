import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
describe('hosting', () => {
  it('lets returning visitors pick up rebuilt anatomy data', () => {
    const data = v.headers.find(h => h.source.startsWith('/data/'));
    const cc = data.headers.find(h => h.key === 'Cache-Control').value;
    expect(cc).not.toMatch(/immutable/);
    expect(cc).toMatch(/must-revalidate|no-cache/);
  });
});
