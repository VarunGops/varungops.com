import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const walk = d => !existsSync(d) ? [] : readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith('.md') ? [join(d, f)] : []);
const files = walk('src/content'), text = files.map(f => readFileSync(f, 'utf8')).join('\n');
const bodies = files.map(f => readFileSync(f, 'utf8').replace(/^---[\s\S]*?---/, '')).join('\n');   // dates and the DOI live in front matter
describe('content rules', () => {
  it('has all the content files', () => { expect(files.length).toBe(19); });
  it('never carries a phone number', () => { expect(bodies).not.toMatch(/\+?\d[\d ()-]{8,}\d/); });
  it('carries one email address only, the Outlook one', () => { expect([...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g))]).toEqual(['drvarungopal@outlook.com']); });
  it('describes exactly the three chosen clinical posts, briefly', () => { const ex = walk('src/content/experience').map(f => readFileSync(f, 'utf8')).map(t => ({ described: /described: true/.test(t), title: t.match(/title: (.*)/)[1], words: t.replace(/^---[\s\S]*?---/, '').trim().split(/\s+/).filter(Boolean).length })); const d = ex.filter(e => e.described); expect(d.map(e => e.title).sort()).toEqual(['Clinical Observer, Neurosurgery', 'Junior Resident Doctor, General Surgery', 'Junior Resident Doctor, Neurosurgery']); expect(d.every(e => e.words > 0 && e.words <= 45)).toBe(true); expect(ex.filter(e => !e.described).every(e => e.words === 0)).toBe(true); });
  it('never mentions visa status or sponsorship', () => { expect(text).not.toMatch(/\bvisa\b|sponsorship|right to work/i); });
  it('never calls the Walton Centre post a fellowship', () => { expect(text).not.toMatch(/fellow/i); });
  it('keeps the MRes project to its agreed description', () => { expect(text).not.toMatch(/craniosynostosis|deprivation|Alder Hey/i); });
  it('uses none of the banned phrases', () => { expect(text).not.toMatch(/\b(passionate|dedicated|genuinely|truly|delighted|leverage|robust|pivotal)\b/i); });
});
