import { describe, it } from 'vitest';
import { duskActs } from '../src/levels/dusk/index.ts';
import { checkAct } from './actContract.ts';

/**
 * Every Duskmere Coast act passes the full act contract: structure minimums,
 * nothing buried or bottomless, speed earned from slopes, stacked roads,
 * relief, reachability, the three bots and idle silence. This is the biome's
 * quality gate.
 */
describe('Act contract — Duskmere Coast (biome 0)', () => {
  it.each(duskActs.map((d, i) => [`${String(i + 1).padStart(2, '0')} ${d.title}`, d] as const))(
    '%s',
    (_name, def) => checkAct(def),
  );
});
