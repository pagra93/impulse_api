// ═══════════════════════════════════════════════════════════════════════════
// CONTROLADOR DE SQUADS
// ═══════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, SquadEventInput, CreateSquadInput, CreateRuleInput } from '../types';
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
  // Phase 2
  verifySquadOwner,
  createSquadTemplate,
  updateSquadTemplate,
  deleteSquadTemplate,
  addRuleTemplate,
  updateRuleTemplate,
  deleteRuleTemplate,
  getSquadMembers,
  findSquadByInviteCode,
  isActiveMember,
  getInviteCode,
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
// POST /api/squads/join-by-code — Unirse por invite code (requiere auth)
// ═══════════════════════════════════════════════════════════════════════════

export async function joinByCode(
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

    const { code } = req.body;

    if (!code) {
      res.status(400).json({ success: false, error: 'Missing required field: code' });
      return;
    }

    // Buscar squad por código
    const squadId = await findSquadByInviteCode(code);

    if (!squadId) {
      res.status(404).json({ success: false, error: 'Squad not found' });
      return;
    }

    // Si ya es miembro activo, devolver el ID directamente
    const alreadyMember = await isActiveMember(userId, squadId);

    if (!alreadyMember) {
      // Unirse (el upsert maneja el caso de status='left' → reactivar)
      await joinSquad(userId, squadId, 'member');
    }

    res.json({
      success: true,
      data: { squadTemplateId: squadId },
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/squads — Crear squad (requiere auth) — Phase 2
// ═══════════════════════════════════════════════════════════════════════════

export async function createSquad(
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

    const input = req.body as CreateSquadInput;

    // Validación básica
    if (!input.name) {
      res.status(400).json({ success: false, error: 'Missing required field: name' });
      return;
    }

    if (!input.rules || !Array.isArray(input.rules) || input.rules.length === 0) {
      res.status(400).json({ success: false, error: 'At least one rule is required' });
      return;
    }

    // Validar cada regla
    for (const rule of input.rules) {
      if (!rule.type || !rule.name) {
        res.status(400).json({ success: false, error: 'Each rule must have type and name' });
        return;
      }
    }

    const template = await createSquadTemplate(userId, input);

    res.status(201).json({
      success: true,
      data: template,
    });
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
// PUT /api/squads/:id — Editar metadata (auth, owner only) — Phase 2
// ═══════════════════════════════════════════════════════════════════════════

export async function updateSquad(
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

    // Verificar que existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    // Verificar owner
    const isOwner = await verifySquadOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Only the squad owner can edit this squad' });
      return;
    }

    const { name, description, emoji, category, visibility } = req.body;

    await updateSquadTemplate(id, { name, description, emoji, category, visibility });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/squads/:id — Eliminar squad (auth, owner only) — Phase 2
// ═══════════════════════════════════════════════════════════════════════════

export async function deleteSquad(
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

    // Verificar que existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    // Verificar owner
    const isOwner = await verifySquadOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Only the squad owner can delete this squad' });
      return;
    }

    await deleteSquadTemplate(id);

    res.json({ success: true });
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

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/squads/:id/rules — Añadir regla (auth, owner only) — Phase 2
// ═══════════════════════════════════════════════════════════════════════════

export async function addRule(
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

    // Verificar que existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    // Verificar owner
    const isOwner = await verifySquadOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Only the squad owner can add rules' });
      return;
    }

    const input = req.body as CreateRuleInput;

    if (!input.type || !input.name) {
      res.status(400).json({ success: false, error: 'Missing required fields: type, name' });
      return;
    }

    const rule = await addRuleTemplate(id, input);

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/squads/:id/rules/:ruleId — Editar regla (auth, owner only) — Phase 2
// ═══════════════════════════════════════════════════════════════════════════

export async function updateRule(
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

    const { id, ruleId } = req.params;

    // Verificar que existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    // Verificar owner
    const isOwner = await verifySquadOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Only the squad owner can edit rules' });
      return;
    }

    const updates = req.body as Partial<CreateRuleInput>;

    const updated = await updateRuleTemplate(ruleId, id, updates);

    if (!updated) {
      res.status(404).json({ success: false, error: 'Rule not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/squads/:id/rules/:ruleId — Eliminar regla (auth, owner only) — Phase 2
// ═══════════════════════════════════════════════════════════════════════════

export async function deleteRule(
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

    const { id, ruleId } = req.params;

    // Verificar que existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    // Verificar owner
    const isOwner = await verifySquadOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Only the squad owner can delete rules' });
      return;
    }

    const deleted = await deleteRuleTemplate(ruleId, id);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Rule not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/squads/:id/members — Leaderboard (requiere auth) — Phase 2
// ═══════════════════════════════════════════════════════════════════════════

export async function members(
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

    // Verificar que el squad existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    // Verificar que el usuario es miembro activo
    const isMember = await isActiveMember(userId, id);
    if (!isMember) {
      res.status(403).json({ success: false, error: 'You must be an active member to view the leaderboard' });
      return;
    }

    const data = await getSquadMembers(id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/squads/:id/invite-code — Obtener invite code (auth, owner only) — Phase 2
// ═══════════════════════════════════════════════════════════════════════════

export async function inviteCode(
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

    // Verificar que existe
    const exists = await squadTemplateExists(id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Squad template not found' });
      return;
    }

    // Verificar owner
    const isOwner = await verifySquadOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Only the squad owner can view the invite code' });
      return;
    }

    const code = await getInviteCode(id);

    res.json({
      success: true,
      data: { inviteCode: code },
    });
  } catch (error) {
    next(error);
  }
}
