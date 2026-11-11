import { describe, expect, it } from 'vitest';
import { parseRoute, routeToHash } from '../../src/app/router';

describe('parseRoute', () => {
  it('reads the overview, lessons and the final test', () => {
    expect(parseRoute('')).toEqual({ name: 'overview' });
    expect(parseRoute('#/')).toEqual({ name: 'overview' });
    expect(parseRoute('#/lesson/3')).toEqual({ name: 'lesson', lesson: 3 });
    expect(parseRoute('#/final')).toEqual({ name: 'final' });
  });

  it('sends unknown or out-of-range routes to the overview', () => {
    expect(parseRoute('#/lesson/0')).toEqual({ name: 'overview' });
    expect(parseRoute('#/lesson/6')).toEqual({ name: 'overview' });
    expect(parseRoute('#/lesson/two')).toEqual({ name: 'overview' });
    expect(parseRoute('#/nowhere')).toEqual({ name: 'overview' });
  });

  it('round-trips every route', () => {
    for (const hash of ['#/', '#/lesson/1', '#/lesson/5', '#/final']) {
      expect(routeToHash(parseRoute(hash))).toBe(hash);
    }
  });
});
