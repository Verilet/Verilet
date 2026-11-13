import { z } from 'zod';

const carBoxSchema = z.object({
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
});

const carArrivalStateSchema = z.object({ carArrivalFrom: carBoxSchema });

/** Where the car was on screen when it set off. */
export type CarBox = z.infer<typeof carBoxSchema>;

/** Router state that tells the check form to morph the car into its listing link box. */
export function carArrivalState(from: CarBox) {
  return { carArrivalFrom: from };
}

/** Router state from the landing page's car drive, where there is no car left to morph. */
export const DRIVE_ARRIVAL_STATE = { carDroveThrough: true } as const;

const driveArrivalStateSchema = z.object({ carDroveThrough: z.literal(true) });

/** How the visitor got here: `from` is the car to morph, or null after a drive-through. */
export interface CarArrivalInfo {
  from: CarBox | null;
}

/** Reads the router state, which comes back from browser history and so can't be trusted. */
export function readCarArrival(state: unknown): CarArrivalInfo | null {
  const morph = carArrivalStateSchema.safeParse(state);
  if (morph.success) return { from: morph.data.carArrivalFrom };
  return driveArrivalStateSchema.safeParse(state).success ? { from: null } : null;
}
