// ═══════════════════════════════════════════════════════════════════════════
// CONTROLADOR DE SINCRONIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { pullUserData, pushUserData, SyncData } from '../models/sync.model';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/sync/pull - Obtener datos del usuario
// ═══════════════════════════════════════════════════════════════════════════

export async function pull(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const data = await pullUserData(userId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/sync/push - Guardar datos del usuario
// ═══════════════════════════════════════════════════════════════════════════

export async function push(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const data: SyncData = req.body;

    // Validación básica
    if (!data) {
      res.status(400).json({ success: false, error: 'No data provided' });
      return;
    }

    await pushUserData(userId, data);

    res.json({
      success: true,
      message: 'Data synchronized successfully',
    });
  } catch (error) {
    next(error);
  }
}

