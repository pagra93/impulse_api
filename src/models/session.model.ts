// ═══════════════════════════════════════════════════════════════════════════
// MODELO DE SESIONES
// ═══════════════════════════════════════════════════════════════════════════

import { query } from '../config/database';
import { Session } from '../types';
import { hashToken } from '../utils/hash';
import { getRefreshTokenExpiry } from '../utils/jwt';

// ═══════════════════════════════════════════════════════════════════════════
// CREAR SESIÓN
// ═══════════════════════════════════════════════════════════════════════════

export async function createSession(
  userId: string,
  refreshToken: string,
  deviceInfo?: Record<string, any>,
  extensionVersion?: string,
  ipAddress?: string
): Promise<Session> {
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = getRefreshTokenExpiry();
  
  const result = await query(
    `INSERT INTO user_sessions 
     (user_id, refresh_token_hash, device_info, extension_version, expires_at, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      refreshTokenHash,
      deviceInfo ? JSON.stringify(deviceInfo) : null,
      extensionVersion || null,
      expiresAt,
      ipAddress || null
    ]
  );
  
  return result.rows[0] as Session;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSCAR SESIÓN POR REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════

export async function findSessionByRefreshToken(
  refreshToken: string
): Promise<Session | null> {
  const refreshTokenHash = hashToken(refreshToken);
  
  const result = await query(
    `SELECT * FROM user_sessions 
     WHERE refresh_token_hash = $1 
     AND is_revoked = FALSE 
     AND expires_at > NOW()`,
    [refreshTokenHash]
  );
  
  return (result.rows[0] as Session) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTUALIZAR ÚLTIMA UTILIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

export async function updateSessionLastUsed(sessionId: string): Promise<void> {
  await query(
    `UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REVOCAR SESIÓN
// ═══════════════════════════════════════════════════════════════════════════

export async function revokeSession(sessionId: string): Promise<void> {
  await query(
    `UPDATE user_sessions SET is_revoked = TRUE WHERE id = $1`,
    [sessionId]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REVOCAR SESIÓN POR REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════

export async function revokeSessionByRefreshToken(
  refreshToken: string
): Promise<void> {
  const refreshTokenHash = hashToken(refreshToken);
  
  await query(
    `UPDATE user_sessions SET is_revoked = TRUE WHERE refresh_token_hash = $1`,
    [refreshTokenHash]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REVOCAR TODAS LAS SESIONES DE UN USUARIO
// ═══════════════════════════════════════════════════════════════════════════

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await query(
    `UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`,
    [userId]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIMPIAR SESIONES EXPIRADAS (ejecutar periódicamente)
// ═══════════════════════════════════════════════════════════════════════════

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query(
    `DELETE FROM user_sessions WHERE expires_at < NOW() OR is_revoked = TRUE`
  );
  
  return result.rowCount || 0;
}

