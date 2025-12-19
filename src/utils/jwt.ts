// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES DE JWT
// ═══════════════════════════════════════════════════════════════════════════

import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload, AuthTokens } from '../types';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════
// GENERAR ACCESS TOKEN
// ═══════════════════════════════════════════════════════════════════════════

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(
    { userId: payload.userId, email: payload.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERAR REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════

export function generateRefreshToken(): string {
  // Refresh token es un UUID random, no un JWT
  // Se almacena hasheado en la BD
  return uuidv4();
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERAR AMBOS TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export function generateTokens(payload: JwtPayload): AuthTokens {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICAR ACCESS TOKEN
// ═══════════════════════════════════════════════════════════════════════════

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DECODIFICAR SIN VERIFICAR (para debug)
// ═══════════════════════════════════════════════════════════════════════════

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCULAR FECHA DE EXPIRACIÓN DEL REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════

export function getRefreshTokenExpiry(): Date {
  const now = new Date();
  
  // Parsear JWT_REFRESH_EXPIRES_IN (ej: '7d', '30d')
  const match = env.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  
  if (!match) {
    // Default: 7 días
    now.setDate(now.getDate() + 7);
    return now;
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd':
      now.setDate(now.getDate() + value);
      break;
    case 'h':
      now.setHours(now.getHours() + value);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() + value);
      break;
    case 's':
      now.setSeconds(now.getSeconds() + value);
      break;
  }
  
  return now;
}

