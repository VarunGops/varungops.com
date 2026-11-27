import { describe, it, expect } from 'vitest';
import { STOPS, SIDES, CONTACT_SIDE, direction } from '../../src/lib/stops.js';

describe('the side pages', () => {
  it('alternate, About opening to the right and Now to the left', () => {
    expect(STOPS.map(s => [s.id, s.side])).toEqual([
      ['about', 'right'], ['now', 'left'], ['clinical-experience', 'right'], ['research', 'left'],
      ['teaching', 'right'], ['writing', 'left'], ['life', 'right'], ['collaborate', 'left'],
    ]);
    expect(CONTACT_SIDE).toBe('right');
  });
  it('each have their own address', () => {
    const paths = STOPS.map(s => s.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p).toMatch(/^\/[a-z-]+\/$/);
  });
  it('slide in from their own side and back out the same way', () => {
    expect(direction('/', '/about/', SIDES)).toBe('from-right');
    expect(direction('/', '/now/', SIDES)).toBe('from-left');
    expect(direction('/about/', '/', SIDES)).toBe('from-left');
    expect(direction('/now/', '/', SIDES)).toBe('from-right');
  });
  it('leave every other move to the plain cross-fade', () => {
    expect(direction('/research/', '/research/brain-abscess-bibliometric/', SIDES)).toBe(null);
    expect(direction('/', '/research/brain-abscess-bibliometric/', SIDES)).toBe(null);
    expect(direction(null, '/about/', SIDES)).toBe(null);
    expect(direction('/', '/', SIDES)).toBe(null);
  });
  it('can be copied into the page as source', () => {
    const copy = new Function(`return ${direction.toString()}`)();
    expect(copy('/', '/about/', SIDES)).toBe('from-right');
  });
});

describe('the art at the top of each page', () => {
  it('is the heart on About, the eyes on Now and the hands on Clinical Experience', () => {
    const art = Object.fromEntries(STOPS.map(s => [s.id, s.art]));
    expect(art.about).toBe('heart'); expect(art.now).toBe('eyes'); expect(art['clinical-experience']).toBe('hands'); expect(art.life).toBe('lungs'); expect(art.research).toBe('neuron'); expect(art.teaching).toBe('pair'); expect(art.writing).toBe('arcuate');
  });
});
