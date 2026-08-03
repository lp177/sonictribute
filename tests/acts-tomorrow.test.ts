import { describe, it } from 'vitest';
import { tomorrowActs } from '../src/levels/tomorrow/index.ts';
import { checkAct } from './actContract.ts';

/**
 * Biome 3 — NOON TOMORROW. Every act passes the full campaign quality gate
 * (structure, nothing buried, three routes, reachability, flow, idle
 * silence) before the roster is integrated into levels/index.ts.
 */
describe('Act contract — NOON TOMORROW (biome 3)', () => {
  it.each(tomorrowActs.map((d) => [`${d.act} ${d.title}`, d] as const))(
    '%s',
    (_name, def) => checkAct(def),
  );
});
