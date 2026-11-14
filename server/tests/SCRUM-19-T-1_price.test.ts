import { describe, it, expect, vi, afterEach } from 'vitest';
import { SanJoseRentModel, SantaCruzRentModel } from '../src/models/rentBaseline.model.js';
import {
  checkPrice,
  evaluatePrice,
  findBaseline,
} from '../src/services/checkers/averagePrice.service.js';

describe('SCRUM-19-T-1 Price outlier checker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Criterion 1
  it('SCRUM-19-T-1 flags a shared room under 50% of its baseline', () => {
    const result = evaluatePrice(
      { rent: 400, spaceType: 'shared_room', zip: '95060' },
      { rent: 1000, source: 'zip', region: 'santa_cruz' },
    );
    expect(result.status).toBe('violation');
    expect(result.severity).toBe('critical');
    expect(result.percentOfBaseline).toBe(40);
    expect(result.explanation).toContain('$400 is 40% of the average $1,000');
  });

  // Criterion 2
  it('SCRUM-19-T-1 flags a single room under 50% of its baseline', () => {
    const result = evaluatePrice(
      { rent: 900, spaceType: 'single_room' },
      { rent: 1996, source: 'county', region: 'santa_cruz' },
    );
    expect(result.status).toBe('violation');
    expect(result.baseline).toBe(1996);
    expect(result.explanation).toContain('Santa Cruz County');
  });

  // Criterion 3
  it('SCRUM-19-T-1 flags a 1BR under 50% of its baseline', () => {
    const result = evaluatePrice(
      { rent: 900, spaceType: '1br', zip: '95060' },
      { rent: 2400, source: 'zip', region: 'santa_cruz' },
    );
    expect(result.status).toBe('violation');
    expect(result.percentOfBaseline).toBe(37.5);
  });

  // Criterion 4
  it('SCRUM-19-T-1 passes a 2BR at a normal price', () => {
    const result = evaluatePrice(
      { rent: 4000, spaceType: '2br', zip: '95001' },
      { rent: 4210, source: 'zip', region: 'santa_cruz' },
    );
    expect(result.status).toBe('pass');
    expect(result.severity).toBeNull();
  });

  // Criterion 5
  it('SCRUM-19-T-1 passes rent at exactly 50% of the baseline', () => {
    const result = evaluatePrice(
      { rent: 1200, spaceType: '1br', zip: '95060' },
      { rent: 2400, source: 'zip', region: 'santa_cruz' },
    );
    expect(result.status).toBe('pass');
  });

  // Criterion 6
  it('SCRUM-19-T-1 falls back to the county-wide average when no ZIP baseline exists', async () => {
    const find = vi
      .spyOn(SantaCruzRentModel, 'find')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ price: 2994 }, { price: 2152 }] as never);

    const match = await findBaseline('santa_cruz', '1br', '95060');

    const roomType = { $in: ['1br/Duplex', '1br Apartment/Condo'] };
    expect(match).toEqual({ rent: 2152, source: 'county', region: 'santa_cruz' });
    expect(find).toHaveBeenNthCalledWith(1, { zipCode: '95060', roomType });
    expect(find).toHaveBeenNthCalledWith(2, { zipCode: { $exists: false }, roomType });
  });

  // Criterion 7
  it('SCRUM-19-T-1 returns not_evaluated when no baseline exists', async () => {
    vi.spyOn(SantaCruzRentModel, 'exists').mockResolvedValue(null as never);
    vi.spyOn(SanJoseRentModel, 'exists').mockResolvedValue(null as never);
    const santaCruzFind = vi.spyOn(SantaCruzRentModel, 'find');

    const result = await checkPrice({ rent: 900, spaceType: '2br', zip: '90210' });

    expect(result.status).toBe('not_evaluated');
    expect(result.baseline).toBeNull();
    expect(santaCruzFind).not.toHaveBeenCalled();
  });

  // Criterion 8
  it('SCRUM-19-T-1 rejects invalid input', async () => {
    await expect(checkPrice({ rent: -5, spaceType: 'castle' })).rejects.toThrow();
  });

  // Criterion 9
  it('SCRUM-19-T-1 uses San Jose data for a San Jose ZIP', async () => {
    vi.spyOn(SantaCruzRentModel, 'exists').mockResolvedValue(null as never);
    vi.spyOn(SanJoseRentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    const santaCruzFind = vi.spyOn(SantaCruzRentModel, 'find');
    vi.spyOn(SanJoseRentModel, 'find').mockResolvedValueOnce([{ price: 3000 }] as never);

    const result = await checkPrice({ rent: 1200, spaceType: '2br', zip: '95014' });

    expect(result.status).toBe('violation');
    expect(result.region).toBe('san_jose');
    expect(result.baseline).toBe(3000);
    expect(santaCruzFind).not.toHaveBeenCalled();
  });

  // Criterion 10
  it('SCRUM-19-T-1 uses the given region when there is no ZIP', async () => {
    const sanJoseFind = vi
      .spyOn(SanJoseRentModel, 'find')
      .mockResolvedValueOnce([{ price: 2718 }] as never);

    const result = await checkPrice({ rent: 1000, spaceType: '1br', region: 'san_jose' });

    expect(result.status).toBe('violation');
    expect(result.explanation).toContain('San Jose-Sunnyvale-Santa Clara area');
    expect(sanJoseFind).toHaveBeenCalledWith({
      zipCode: { $exists: false },
      roomType: { $in: ['1br'] },
    });
  });

  // Criterion 11
  it('SCRUM-19-T-1 looks up studio, 3BR and 4BR listings by their own room type', async () => {
    const find = vi.spyOn(SantaCruzRentModel, 'find').mockResolvedValue([{ price: 3000 }] as never);

    await findBaseline('santa_cruz', 'studio');
    await findBaseline('santa_cruz', '3br', '95060');
    await findBaseline('santa_cruz', '4br', '95060');

    expect(find).toHaveBeenNthCalledWith(1, {
      zipCode: { $exists: false },
      roomType: { $in: ['Studio'] },
    });
    expect(find).toHaveBeenNthCalledWith(2, { zipCode: '95060', roomType: { $in: ['3br'] } });
    expect(find).toHaveBeenNthCalledWith(3, { zipCode: '95060', roomType: { $in: ['4br'] } });
  });
});
