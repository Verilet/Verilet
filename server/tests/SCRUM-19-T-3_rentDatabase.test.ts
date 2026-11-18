import { describe, it, expect, vi, afterEach } from 'vitest';
import { getRentDbName } from '../src/config/rentDatabase.js';

describe('SCRUM-19-T-3: getRentDbName and rent model database selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('SCRUM-19-T-3 [Criterion 1] returns averagePrice when RENT_DB_NAME is unset', () => {
    vi.stubEnv('RENT_DB_NAME', undefined);

    expect(getRentDbName({})).toBe('averagePrice');
    expect(getRentDbName()).toBe('averagePrice');
  });

  it('SCRUM-19-T-3 [Criterion 2] returns averagePrice when RENT_DB_NAME is empty or whitespace', () => {
    expect(getRentDbName({ RENT_DB_NAME: '' })).toBe('averagePrice');
    expect(getRentDbName({ RENT_DB_NAME: '   ' })).toBe('averagePrice');
  });

  it('SCRUM-19-T-3 [Criterion 3] returns the trimmed database name from RENT_DB_NAME', () => {
    expect(getRentDbName({ RENT_DB_NAME: 'test_dataBase' })).toBe('test_dataBase');
    expect(getRentDbName({ RENT_DB_NAME: '  test_dataBase  ' })).toBe('test_dataBase');
  });

  it('SCRUM-19-T-3 [Criterion 4] throws for a RENT_DB_NAME that is not a valid database name', () => {
    const invalidNames = [
      'average.Price',
      'my db',
      'a'.repeat(64),
      'test\0DB',
      'test/DB',
      'test\\DB',
      'test"DB',
      'test$DB',
      'test\tDB',
      'test\nDB',
    ];

    for (const name of invalidNames) {
      expect(() => getRentDbName({ RENT_DB_NAME: name })).toThrow('RENT_DB_NAME');
    }
  });

  it('SCRUM-19-T-3 [Criterion 5] connects the rent models to the database named in RENT_DB_NAME', async () => {
    vi.stubEnv('RENT_DB_NAME', 'test_dataBase');
    const { SantaCruzRentModel, SanJoseRentModel } =
      await import('../src/models/rentBaseline.model.js');

    expect(SantaCruzRentModel.db.name).toBe('test_dataBase');
    expect(SanJoseRentModel.db.name).toBe('test_dataBase');
    expect(SantaCruzRentModel.collection.name).toBe('santaCruz');
    expect(SanJoseRentModel.collection.name).toBe('sanJose-sunnyVale-santaClara');
  });

  it('SCRUM-19-T-3 [Criterion 6] connects the rent models to averagePrice when RENT_DB_NAME is unset', async () => {
    vi.stubEnv('RENT_DB_NAME', undefined);
    const { SantaCruzRentModel, SanJoseRentModel } =
      await import('../src/models/rentBaseline.model.js');

    expect(SantaCruzRentModel.db.name).toBe('averagePrice');
    expect(SanJoseRentModel.db.name).toBe('averagePrice');
  });
});
