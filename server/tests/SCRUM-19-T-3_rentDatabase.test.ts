import { describe, it, expect, vi, afterEach } from 'vitest';
import { getRentDbName } from '../src/config/rentDatabase.js';

describe('SCRUM-19-T-3 Rent database selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // Criterion 1
  it('SCRUM-19-T-3 uses averagePrice when RENT_DB_NAME is unset', () => {
    expect(getRentDbName({})).toBe('averagePrice');
  });

  // Criterion 2
  it('SCRUM-19-T-3 uses averagePrice when RENT_DB_NAME is empty', () => {
    expect(getRentDbName({ RENT_DB_NAME: '' })).toBe('averagePrice');
    expect(getRentDbName({ RENT_DB_NAME: '   ' })).toBe('averagePrice');
  });

  // Criterion 3
  it('SCRUM-19-T-3 uses the database named in RENT_DB_NAME', () => {
    expect(getRentDbName({ RENT_DB_NAME: 'test_dataBase' })).toBe('test_dataBase');
    expect(getRentDbName({ RENT_DB_NAME: '  test_dataBase  ' })).toBe('test_dataBase');
  });

  // Criterion 4
  it('SCRUM-19-T-3 rejects an invalid database name', () => {
    expect(() => getRentDbName({ RENT_DB_NAME: 'average.Price' })).toThrow('RENT_DB_NAME');
    expect(() => getRentDbName({ RENT_DB_NAME: 'my db' })).toThrow('RENT_DB_NAME');
    expect(() => getRentDbName({ RENT_DB_NAME: 'a'.repeat(64) })).toThrow('RENT_DB_NAME');
  });

  // Criterion 5
  it('SCRUM-19-T-3 rent models read from RENT_DB_NAME', async () => {
    vi.stubEnv('RENT_DB_NAME', 'test_dataBase');
    const { SantaCruzRentModel, SanJoseRentModel } =
      await import('../src/models/rentBaseline.model.js');

    expect(SantaCruzRentModel.db.name).toBe('test_dataBase');
    expect(SanJoseRentModel.db.name).toBe('test_dataBase');
    expect(SantaCruzRentModel.collection.name).toBe('santaCruz');
    expect(SanJoseRentModel.collection.name).toBe('sanJose-sunnyVale-santaClara');
  });

  // Criterion 6
  it('SCRUM-19-T-3 rent models read from averagePrice by default', async () => {
    vi.stubEnv('RENT_DB_NAME', undefined);
    const { SantaCruzRentModel, SanJoseRentModel } =
      await import('../src/models/rentBaseline.model.js');

    expect(SantaCruzRentModel.db.name).toBe('averagePrice');
    expect(SanJoseRentModel.db.name).toBe('averagePrice');
  });
});
