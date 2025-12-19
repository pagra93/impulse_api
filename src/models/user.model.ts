// ═══════════════════════════════════════════════════════════════════════════
// MODELO DE USUARIO
// ═══════════════════════════════════════════════════════════════════════════

import { query } from '../config/database';
import { User, UserPublic, RegisterInput } from '../types';
import { hashPassword } from '../utils/hash';

// ═══════════════════════════════════════════════════════════════════════════
// CREAR USUARIO
// ═══════════════════════════════════════════════════════════════════════════

export async function createUser(input: RegisterInput): Promise<User> {
  const { email, password, display_name } = input;
  
  // Hash de la contraseña
  const password_hash = await hashPassword(password);
  
  const result = await query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email.toLowerCase(), password_hash, display_name || null]
  );
  
  return result.rows[0] as User;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSCAR POR EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await query(
    `SELECT * FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  
  return (result.rows[0] as User) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSCAR POR ID
// ═══════════════════════════════════════════════════════════════════════════

export async function findUserById(id: string): Promise<User | null> {
  const result = await query(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );
  
  return (result.rows[0] as User) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTUALIZAR ÚLTIMO LOGIN
// ═══════════════════════════════════════════════════════════════════════════

export async function updateLastLogin(userId: string): Promise<void> {
  await query(
    `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERTIR A DATOS PÚBLICOS (sin password_hash)
// ═══════════════════════════════════════════════════════════════════════════

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    plan: user.plan,
    created_at: user.created_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICAR SI EMAIL EXISTE
// ═══════════════════════════════════════════════════════════════════════════

export async function emailExists(email: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );
  
  return result.rowCount !== null && result.rowCount > 0;
}

