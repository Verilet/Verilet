import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { AreaCodeModel } from '../models/areaCode.model.js';

/** State area codes used for phone-region classification. */
const areaCodeData = [
  {
    state: 'CA',
    codes: [
      '209',
      '213',
      '279',
      '310',
      '323',
      '341',
      '350',
      '369',
      '408',
      '415',
      '424',
      '442',
      '510',
      '530',
      '559',
      '562',
      '619',
      '626',
      '628',
      '650',
      '657',
      '661',
      '669',
      '707',
      '714',
      '738',
      '747',
      '760',
      '805',
      '818',
      '820',
      '831',
      '840',
      '858',
      '909',
      '916',
      '925',
      '949',
      '951',
    ],
  },
  {
    state: 'AZ',
    codes: ['480', '520', '602', '623', '928'],
  },
  {
    state: 'FL',
    codes: [
      '239',
      '305',
      '321',
      '352',
      '386',
      '407',
      '561',
      '727',
      '772',
      '786',
      '813',
      '850',
      '863',
      '904',
      '941',
      '954',
    ],
  },
  {
    state: 'IL',
    codes: [
      '217',
      '224',
      '309',
      '312',
      '331',
      '447',
      '464',
      '618',
      '630',
      '708',
      '773',
      '779',
      '815',
      '847',
      '872',
    ],
  },
  {
    state: 'NY',
    codes: [
      '212',
      '315',
      '332',
      '347',
      '516',
      '518',
      '585',
      '607',
      '631',
      '646',
      '680',
      '716',
      '718',
      '838',
      '845',
      '914',
      '917',
      '929',
      '934',
    ],
  },
  {
    state: 'TX',
    codes: [
      '210',
      '214',
      '254',
      '281',
      '325',
      '346',
      '361',
      '409',
      '430',
      '432',
      '469',
      '512',
      '682',
      '713',
      '726',
      '737',
      '806',
      '817',
      '830',
      '832',
      '903',
      '915',
      '936',
      '940',
      '956',
      '972',
      '979',
    ],
  },
  {
    state: 'WA',
    codes: ['206', '253', '360', '425', '509', '564'],
  },
];

/** Inserts or updates state area-code mappings. */
async function seedAreaCodes(): Promise<void> {
  try {
    await connectDatabase();
    for (const entry of areaCodeData) {
      await AreaCodeModel.updateOne(
        { state: entry.state },
        { $set: { codes: entry.codes } },
        { upsert: true },
      );
      console.log(`Seeded area codes for ${entry.state}`);
    }
    console.log('Area-code seeding completed successfully');
  } catch (error) {
    console.error('Failed to seed area codes:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

await seedAreaCodes();
