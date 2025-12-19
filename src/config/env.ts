// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// ═══════════════════════════════════════════════════════════════════════════

import dotenv from 'dotenv';

// Cargar .env en desarrollo
dotenv.config();

// ═══════════════════════════════════════════════════════════════════════════
// VALIDACIÓN Y EXPORTACIÓN DE VARIABLES
// ═══════════════════════════════════════════════════════════════════════════

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDAR VARIABLES REQUERIDAS
// ═══════════════════════════════════════════════════════════════════════════

export function validateEnv(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    
    if (env.isProduction) {
      process.exit(1);
    } else {
      console.warn('⚠️  Running in development mode with defaults');
    }
  }
}

