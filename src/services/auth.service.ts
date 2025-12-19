// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

import { 
  createUser, 
  findUserByEmail, 
  findUserById,
  updateLastLogin, 
  toPublicUser, 
  emailExists 
} from '../models/user.model';
import { 
  createSession, 
  findSessionByRefreshToken,
  updateSessionLastUsed,
  revokeSessionByRefreshToken 
} from '../models/session.model';
import { generateTokens, generateAccessToken } from '../utils/jwt';
import { verifyPassword } from '../utils/hash';
import { errors } from '../middleware/error.middleware';
import { RegisterInput, LoginInput, AuthTokens, UserPublic } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRO
// ═══════════════════════════════════════════════════════════════════════════

export interface RegisterResult {
  user: UserPublic;
  tokens: AuthTokens;
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  // 1. Validar input
  if (!input.email || !input.password) {
    throw errors.badRequest('Email and password are required');
  }
  
  if (input.password.length < 6) {
    throw errors.badRequest('Password must be at least 6 characters');
  }
  
  // Validar formato de email simple
  if (!input.email.includes('@')) {
    throw errors.badRequest('Invalid email format');
  }
  
  // 2. Verificar si el email ya existe
  const exists = await emailExists(input.email);
  
  if (exists) {
    throw errors.conflict('Email already registered');
  }
  
  // 3. Crear usuario
  const user = await createUser(input);
  
  // 4. Generar tokens
  const tokens = generateTokens({ userId: user.id, email: user.email });
  
  // 5. Crear sesión
  await createSession(user.id, tokens.refreshToken);
  
  // 6. Actualizar último login
  await updateLastLogin(user.id);
  
  return {
    user: toPublicUser(user),
    tokens,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════

export interface LoginResult {
  user: UserPublic;
  tokens: AuthTokens;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  // 1. Validar input
  if (!input.email || !input.password) {
    throw errors.badRequest('Email and password are required');
  }
  
  // 2. Buscar usuario
  const user = await findUserByEmail(input.email);
  
  if (!user) {
    throw errors.unauthorized('Invalid email or password');
  }
  
  // 3. Verificar contraseña
  const isValid = await verifyPassword(input.password, user.password_hash);
  
  if (!isValid) {
    throw errors.unauthorized('Invalid email or password');
  }
  
  // 4. Verificar que la cuenta está activa
  if (!user.is_active) {
    throw errors.forbidden('Account is disabled');
  }
  
  // 5. Generar tokens
  const tokens = generateTokens({ userId: user.id, email: user.email });
  
  // 6. Crear sesión
  await createSession(user.id, tokens.refreshToken);
  
  // 7. Actualizar último login
  await updateLastLogin(user.id);
  
  return {
    user: toPublicUser(user),
    tokens,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════

export interface RefreshResult {
  accessToken: string;
}

export async function refresh(refreshToken: string): Promise<RefreshResult> {
  // 1. Validar input
  if (!refreshToken) {
    throw errors.badRequest('Refresh token is required');
  }
  
  // 2. Buscar sesión válida
  const session = await findSessionByRefreshToken(refreshToken);
  
  if (!session) {
    throw errors.unauthorized('Invalid or expired refresh token');
  }
  
  // 3. Buscar usuario
  const user = await findUserById(session.user_id);
  
  if (!user || !user.is_active) {
    throw errors.unauthorized('User not found or disabled');
  }
  
  // 4. Actualizar última utilización de la sesión
  await updateSessionLastUsed(session.id);
  
  // 5. Generar nuevo access token
  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  
  return { accessToken };
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════

export async function logout(refreshToken: string): Promise<void> {
  if (refreshToken) {
    await revokeSessionByRefreshToken(refreshToken);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OBTENER USUARIO ACTUAL
// ═══════════════════════════════════════════════════════════════════════════

export async function getCurrentUser(userId: string): Promise<UserPublic> {
  const user = await findUserById(userId);
  
  if (!user) {
    throw errors.notFound('User not found');
  }
  
  return toPublicUser(user);
}

