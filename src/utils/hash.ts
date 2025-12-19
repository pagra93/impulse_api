// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES DE HASH (BCRYPT)
// ═══════════════════════════════════════════════════════════════════════════

import bcrypt from 'bcryptjs';

// Número de rondas de salt (10-12 es un buen balance seguridad/velocidad)
const SALT_ROUNDS = 12;

// ═══════════════════════════════════════════════════════════════════════════
// HASH DE CONTRASEÑA
// ═══════════════════════════════════════════════════════════════════════════

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICAR CONTRASEÑA
// ═══════════════════════════════════════════════════════════════════════════

export async function verifyPassword(
  password: string, 
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ═══════════════════════════════════════════════════════════════════════════
// HASH SIMPLE (para refresh tokens)
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

