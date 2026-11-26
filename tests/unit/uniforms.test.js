import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// every uniform a page's own shaders declare is set in its code (not only mentioned in a comment): an unset uniform
// stays 0 and silently breaks what it controls
const SHARED = ['uFit', 'uYaw', 'uRes', 'uText', 'uNav'];   // set through cortex's camera helper or the layer's words box
for (const file of ['src/stage/pair.js', 'src/stage/bg/stream.js', 'src/stage/neuron.js', 'src/stage/bg/field.js']) {
  test(`${file} sets every uniform it declares`, () => {
    const src = readFileSync(file, 'utf8');
    const code = src.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');           // comments out
    const declared = [...src.matchAll(/uniform\s+\w+\s+([^;]+);/g)].flatMap(m => m[1].split(',').map(s => s.trim().replace(/\[.*\]/, '')));
    for (const name of declared) {
      if (SHARED.includes(name)) continue;
      expect(code, `${name} is never set`).toMatch(new RegExp(`\\bu\\.${name}\\b`));
    }
  });
}
