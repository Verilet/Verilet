import { describe, expect, it } from 'vitest';
import { carArrivalState, DRIVE_ARRIVAL_STATE, readCarArrival } from '../src/lib/carArrival';

const box = { left: 10, top: 20, width: 34, height: 62 };

describe('readCarArrival', () => {
  it('reads a car to morph', () => {
    expect(readCarArrival(carArrivalState(box))).toEqual({ from: box });
  });

  it('reads a drive-through, which has no car to morph', () => {
    expect(readCarArrival(DRIVE_ARRIVAL_STATE)).toEqual({ from: null });
  });

  it.each([
    ['nothing', null],
    ['undefined', undefined],
    ['other router state', { somethingElse: true }],
    ['a box with missing numbers', { carArrivalFrom: { left: 1 } }],
    ['a box with the wrong types', { carArrivalFrom: { ...box, top: 'high' } }],
    ['a false drive flag', { carDroveThrough: false }],
  ])('ignores %s', (_name, state) => {
    expect(readCarArrival(state)).toBeNull();
  });
});
