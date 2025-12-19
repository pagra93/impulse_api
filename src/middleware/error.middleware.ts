// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE DE MANEJO DE ERRORES
// ═══════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

// ═══════════════════════════════════════════════════════════════════════════
// CLASE DE ERROR PERSONALIZADA
// ═══════════════════════════════════════════════════════════════════════════

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ERRORES COMUNES
// ═══════════════════════════════════════════════════════════════════════════

export const errors = {
  badRequest: (message = 'Bad request') => new ApiError(400, message),
  unauthorized: (message = 'Unauthorized') => new ApiError(401, message),
  forbidden: (message = 'Forbidden') => new ApiError(403, message),
  notFound: (message = 'Not found') => new ApiError(404, message),
  conflict: (message = 'Conflict') => new ApiError(409, message),
  internal: (message = 'Internal server error') => new ApiError(500, message, false),
};

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE DE ERROR
// ═══════════════════════════════════════════════════════════════════════════

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log del error
  console.error('❌ Error:', err.message);
  
  if (env.isDevelopment) {
    console.error(err.stack);
  }
  
  // Si es un ApiError, usar su status code
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(env.isDevelopment && { stack: err.stack }),
    });
    return;
  }
  
  // Error genérico
  res.status(500).json({
    success: false,
    error: env.isProduction ? 'Internal server error' : err.message,
    ...(env.isDevelopment && { stack: err.stack }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE PARA RUTAS NO ENCONTRADAS
// ═══════════════════════════════════════════════════════════════════════════

export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}

