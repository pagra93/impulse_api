// ═══════════════════════════════════════════════════════════════════════════
// RUTAS DE SINCRONIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as syncController from '../controllers/sync.controller';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS (todas requieren autenticación)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/sync/pull - Obtener configuración del servidor
router.get('/pull', requireAuth, syncController.pull);

// POST /api/sync/push - Subir configuración al servidor
router.post('/push', requireAuth, syncController.push);

export default router;

