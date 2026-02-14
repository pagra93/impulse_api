// ═══════════════════════════════════════════════════════════════════════════
// CONTROLADOR DE SQUADS
// ═══════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, SquadEventInput } from '../types';
import {
  getAllSquadTemplates,
  getSquadTemplateById,
  squadTemplateExists,
  joinSquad,
  leaveSquad,
  getUserMemberships,
  createSquadEvent,
  getUserProgress,
  getSquadStats,
} from '../models/squad.model';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/squads — Listar todos los squad templates (público)
// ═══════════════════════════════════════════════════════════════════════════

export async function listTemplates(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const templates = await getAllSquadTemplates();

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/squads/me — Mis squads (requiere auth)
// ═══════════════════════════════════════════════════════════════════════════

export async function mySquads(
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

    const memberships = await getUserMemberships(userId);

    res.json({
      success: true,
      data: memberships,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/squads/events — Registrar evento de desactivación (requiere auth)
// ═══════════════════════════════════════════════════════════════════════════

export async function registerEvent(
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

    const { squadTemplateId, ruleId, type, timestamp, date } = req.body as SquadEventInput;

    // Validación básica
    if (!squadTemplateId || !ruleId || !type || !timestamp || !date) {
      res.status(400).json({ success: false, error: 'Missing required fields: squadTemplateId, ruleId, type, timestamp, date' });
      return;
    }

    await createSquadEvent(userId, squadTemplateId, ruleId, type, timestamp, date);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/squads/:id — Detalle de un template (público)
// ═══════════════════════════════════════════════════════════════════════════

export async function getTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const template = await getSquadTemplateById(id);

    if (!template) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/squads/:id/join — Unirse a un squad (requiere auth)
// ═══════════════════════════════════════════════════════════════════════════

export async function join(
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

    const { id } = req.params;

    // Verificar que el template existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    await joinSquad(userId, id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/squads/:id/leave — Salir de un squad (requiere auth)
// ═══════════════════════════════════════════════════════════════════════════

export async function leave(
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

    const { id } = req.params;

    const updated = await leaveSquad(userId, id);

    if (!updated) {
      res.status(404).json({ success: false, error: 'Active membership not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/squads/:id/progress — Progreso personal (requiere auth)
// ═══════════════════════════════════════════════════════════════════════════

export async function progress(
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

    const { id } = req.params;

    // Verificar que el template existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    const data = await getUserProgress(userId, id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/squads/:id/stats — Stats agregadas (público)
// ═══════════════════════════════════════════════════════════════════════════

export async function stats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Verificar que el template existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    const data = await getSquadStats(id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
