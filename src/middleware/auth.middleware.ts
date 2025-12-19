// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { errors } from './error.middleware';
import { AuthenticatedRequest } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: REQUIERE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // 1. Obtener token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw errors.unauthorized('No authorization header');
    }
    
    // 2. Verificar formato "Bearer <token>"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw errors.unauthorized('Invalid authorization format. Use: Bearer <token>');
    }
    
    const token = parts[1];
    
    // 3. Verificar y decodificar token
    const payload = verifyAccessToken(token);
    
    if (!payload) {
      throw errors.unauthorized('Invalid or expired token');
    }
    
    // 4. Añadir usuario al request
    req.user = payload;
    
    next();
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: AUTENTICACIÓN OPCIONAL
// ═══════════════════════════════════════════════════════════════════════════

export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // No hay token, pero está bien (es opcional)
      return next();
    }
    
    const parts = authHeader.split(' ');
    
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const payload = verifyAccessToken(parts[1]);
      
      if (payload) {
        req.user = payload;
      }
    }
    
    next();
  } catch (error) {
    // Ignorar errores en auth opcional
    next();
  }
}

