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

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN ÚNICO (Supabase) — buscar / enlazar / crear por auth.users.id
// ═══════════════════════════════════════════════════════════════════════════

// Buscar por el id de Supabase Auth (auth.users.id) enlazado.
export async function findUserByAuthUserId(
  authUserId: string
): Promise<User | null> {
  const result = await query(
    `SELECT * FROM users WHERE auth_user_id = $1`,
    [authUserId]
  );

  return (result.rows[0] as User) || null;
}

// Enlazar un usuario existente (encontrado por email) con su cuenta Supabase.
export async function linkAuthUser(
  userId: string,
  authUserId: string
): Promise<void> {
  await query(
    `UPDATE users SET auth_user_id = $1, updated_at = NOW() WHERE id = $2`,
    [authUserId, userId]
  );
}

// Crear un usuario de la extensión a partir de una cuenta de Supabase Auth
// (alta desde la extensión/app: la contraseña vive en Supabase, aquí NULL).
export async function createUserFromAuth(
  authUserId: string,
  email: string
): Promise<User> {
  const result = await query(
    `INSERT INTO users (email, auth_user_id, is_email_verified)
     VALUES ($1, $2, TRUE)
     RETURNING *`,
    [email.toLowerCase(), authUserId]
  );

  return result.rows[0] as User;
}

