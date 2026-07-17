// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { verifySupabaseToken } from '../utils/supabase-jwt';
import {
  findUserByAuthUserId,
  findUserByEmail,
  linkAuthUser,
  createUserFromAuth,
} from '../models/user.model';
import { errors } from './error.middleware';
import { AuthenticatedRequest, JwtPayload } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN ÚNICO — resolver un token de Supabase a nuestro public.users
// ═══════════════════════════════════════════════════════════════════════════
// Valida el JWT de Supabase y devuelve el JwtPayload propio { userId, email }.
// Migración perezosa: si el usuario no está enlazado, lo enlaza por email; si
// no existe (alta desde la extensión/app), crea su fila. Devuelve null si el
// token no es un JWT de Supabase válido.
async function resolveSupabaseUser(token: string): Promise<JwtPayload | null> {
  const identity = await verifySupabaseToken(token);
  if (!identity) return null;

  // 1) ¿ya enlazado?
  let user = await findUserByAuthUserId(identity.sub);

  // 2) ¿existe por email pero sin enlazar? → enlazar (migración perezosa).
  if (!user && identity.email) {
    const byEmail = await findUserByEmail(identity.email);
    if (byEmail) {
      await linkAuthUser(byEmail.id, identity.sub);
      user = byEmail;
    }
  }

  // 3) usuario nuevo → crear su fila en public.users.
  if (!user && identity.email) {
    user = await createUserFromAuth(identity.sub, identity.email);
  }

  if (!user) return null;
  return { userId: user.id, email: user.email };
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: REQUIERE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Obtener token del header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw errors.unauthorized('No authorization header');
    }

    // 2. Verificar formato "Bearer <token>"
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw errors.unauthorized(
        'Invalid authorization format. Use: Bearer <token>'
      );
    }

    const token = parts[1];

    // 3a. Token propio (legacy) — rápido y sin red. Se mantiene durante la
    //     transición para no romper sesiones antiguas.
    const own = verifyAccessToken(token);
    if (own) {
      req.user = own;
      return next();
    }

    // 3b. Token de Supabase (login único) — ES256 vía JWKS, mapeado a
    //     public.users (enlazando o creando si hace falta).
    const mapped = await resolveSupabaseUser(token);
    if (mapped) {
      req.user = mapped;
      return next();
    }

    throw errors.unauthorized('Invalid or expired token');
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

