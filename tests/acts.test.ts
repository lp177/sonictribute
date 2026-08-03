import { describe, it } from 'vitest';
import { LEVELS } from '../src/levels/index.ts';
import { checkAct } from './actContract.ts';

/**
 * Every act in the campaign passes the full quality gate. This suite scales
 * automatically as acts are added to the roster.
 */
describe('Act contract — every act in the campaign', () => {
  it.each(LEVELS.map((d, i) => [`${String(i + 1).padStart(2, '0')} ${d.title}`, d] as const))(
    '%s',
    (_name, def) => checkAct(def),
  );
});
