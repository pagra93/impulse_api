// ═══════════════════════════════════════════════════════════════════════════
// RUTAS DE SQUADS
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as squadController from '../controllers/squad.controller';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS FIJAS (deben ir ANTES de las rutas con :id)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/squads/me - Mis squads (requiere auth)
router.get('/me', requireAuth, squadController.mySquads);

// POST /api/squads/events - Registrar evento de desactivación (requiere auth)
router.post('/events', requireAuth, squadController.registerEvent);

// POST /api/squads/join-by-code - Unirse por invite code (requiere auth) — Phase 2
router.post('/join-by-code', requireAuth, squadController.joinByCode);

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS BASE
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/squads - Listar todos los templates (público)
router.get('/', squadController.listTemplates);

// POST /api/squads - Crear squad (requiere auth) — Phase 2
router.post('/', requireAuth, squadController.createSquad);

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS CON :id — PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/squads/:id - Detalle de un template
router.get('/:id', squadController.getTemplate);

// GET /api/squads/:id/stats - Stats agregadas de un squad
router.get('/:id/stats', squadController.stats);

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS CON :id — PROTEGIDAS (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/squads/:id/join - Unirse a un squad
router.post('/:id/join', requireAuth, squadController.join);

// POST /api/squads/:id/leave - Salir de un squad
router.post('/:id/leave', requireAuth, squadController.leave);

// GET /api/squads/:id/progress - Progreso personal
router.get('/:id/progress', requireAuth, squadController.progress);

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS CON :id — OWNER ONLY (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

// PUT /api/squads/:id - Editar metadata del squad
router.put('/:id', requireAuth, squadController.updateSquad);

// DELETE /api/squads/:id - Eliminar squad
router.delete('/:id', requireAuth, squadController.deleteSquad);

// GET /api/squads/:id/members - Leaderboard (requiere ser miembro activo)
router.get('/:id/members', requireAuth, squadController.members);

// GET /api/squads/:id/invite-code - Obtener invite code
router.get('/:id/invite-code', requireAuth, squadController.inviteCode);

// POST /api/squads/:id/rules - Añadir regla
router.post('/:id/rules', requireAuth, squadController.addRule);

// PUT /api/squads/:id/rules/:ruleId - Editar regla
router.put('/:id/rules/:ruleId', requireAuth, squadController.updateRule);

// DELETE /api/squads/:id/rules/:ruleId - Eliminar regla
router.delete('/:id/rules/:ruleId', requireAuth, squadController.deleteRule);

export default router;
