// ═══════════════════════════════════════════════════════════════════════════
// RUTAS DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS PÚBLICAS (no requieren autenticación)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/auth/register - Crear cuenta
router.post('/register', authController.register);

// POST /api/auth/login - Iniciar sesión
router.post('/login', authController.login);

// POST /api/auth/refresh - Renovar access token
router.post('/refresh', authController.refresh);

// POST /api/auth/logout - Cerrar sesión
router.post('/logout', authController.logout);

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS PROTEGIDAS (requieren autenticación)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/auth/me - Obtener usuario actual
router.get('/me', requireAuth, authController.me);

export default router;

