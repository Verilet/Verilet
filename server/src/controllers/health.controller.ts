import { Request, Response } from 'express';
import mongoose from 'mongoose';

/** Handles system health checks and reports database connectivity state. */
export function getHealth(req: Request, res: Response): void {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
}
