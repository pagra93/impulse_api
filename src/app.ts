// ═══════════════════════════════════════════════════════════════════════════
// IMPULSE API - APLICACIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import { env, validateEnv } from './config/env';
import { testConnection, closePool } from './config/database';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// ═══════════════════════════════════════════════════════════════════════════
// VALIDAR VARIABLES DE ENTORNO
// ═══════════════════════════════════════════════════════════════════════════

validateEnv();

// ═══════════════════════════════════════════════════════════════════════════
// CREAR APLICACIÓN EXPRESS
// ═══════════════════════════════════════════════════════════════════════════

const app = express();

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBALES
// ═══════════════════════════════════════════════════════════════════════════

// CORS - Permitir peticiones desde la extensión
app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (como las de extensiones)
    if (!origin) {
      return callback(null, true);
    }
    
    // Permitir extensiones de Chrome
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Permitir orígenes configurados
    const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parsear JSON
app.use(express.json({ limit: '10mb' }));

// Parsear URL-encoded
app.use(express.urlencoded({ extended: true }));

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING DE REQUESTS (solo en desarrollo)
// ═══════════════════════════════════════════════════════════════════════════

if (env.isDevelopment) {
  app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTAR RUTAS
// ═══════════════════════════════════════════════════════════════════════════

app.use('/api', routes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    name: 'Impulse API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/health',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MANEJO DE ERRORES
// ═══════════════════════════════════════════════════════════════════════════

// Rutas no encontradas
app.use(notFoundHandler);

// Errores globales
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════

async function startServer(): Promise<void> {
  try {
    // 1. Probar conexión a la base de datos
    console.log('🔌 Connecting to database...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Could not connect to database');
      process.exit(1);
    }
    
    // 2. Iniciar servidor HTTP
    app.listen(env.PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  🚀 IMPULSE API STARTED');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`  📍 URL:         http://localhost:${env.PORT}`);
      console.log(`  🌍 Environment: ${env.NODE_ENV}`);
      console.log(`  📦 Database:    Connected`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down...');
  await closePool();
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// ARRANCAR
// ═══════════════════════════════════════════════════════════════════════════

startServer();

