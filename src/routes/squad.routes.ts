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

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/squads - Listar todos los templates
router.get('/', squadController.listTemplates);

// GET /api/squads/:id - Detalle de un template
router.get('/:id', squadController.getTemplate);

// GET /api/squads/:id/stats - Stats agregadas de un squad
router.get('/:id/stats', squadController.stats);

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS PROTEGIDAS (con :id)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/squads/:id/join - Unirse a un squad
router.post('/:id/join', requireAuth, squadController.join);

// POST /api/squads/:id/leave - Salir de un squad
router.post('/:id/leave', requireAuth, squadController.leave);

// GET /api/squads/:id/progress - Progreso personal
router.get('/:id/progress', requireAuth, squadController.progress);

export default router;
