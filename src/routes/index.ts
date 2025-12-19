// ═══════════════════════════════════════════════════════════════════════════
// ROUTER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import authRoutes from './auth.routes';
// import syncRoutes from './sync.routes'; // Se añadirá en Fase 2

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// MONTAR RUTAS
// ═══════════════════════════════════════════════════════════════════════════

router.use('/auth', authRoutes);
// router.use('/sync', syncRoutes); // Se añadirá en Fase 2

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Impulse API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;

