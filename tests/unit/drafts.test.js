import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

// Builds without SHOW_DRAFTS, as Vercel does at launch, and checks no drafted wording reaches the page.
describe('drafts stay off the live site', () => {
  execSync('npx astro build', { env: { ...process.env, SHOW_DRAFTS: '' }, stdio: 'ignore' });
  const html = readFileSync('dist/index.html', 'utf8').replace(/&#39;|&rsquo;/g, '’');
  const drafts = readdirSync('src/content').filter(f => f.endsWith('.md')).map(f => readFileSync(`src/content/${f}`, 'utf8')).filter(t => /^draft: true$/m.test(t));
  it('has drafts to check', () => { expect(drafts.length).toBe(2); });
  it('ships no drafted heading or sentence', () => {
    for (const t of drafts) {
      const heading = t.match(/^heading: (.*)$/m)[1].trim(), body = t.replace(/^---[\s\S]*?---/, '');
      expect(html).not.toContain(heading);
      for (const s of body.split(/(?<=\.)\s+/).map(x => x.trim()).filter(x => x.length > 30)) expect(html).not.toContain(s.slice(0, 40));
    }
  });
}, 120000);
