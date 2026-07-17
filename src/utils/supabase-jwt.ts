// ═══════════════════════════════════════════════════════════════════════════
// VERIFICACIÓN DEL JWT DE SUPABASE (login único)
// ═══════════════════════════════════════════════════════════════════════════
// La extensión y la app se autentican con Supabase Auth. Sus access tokens van
// firmados con ES256 y se validan contra el JWKS público del proyecto. De aquí
// sacamos `sub` (= auth.users.id) y el email para mapearlos a public.users.
// El JWKS se descarga una vez y jose lo cachea/rota solo.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env';

const ISSUER = `${env.SUPABASE_URL}/auth/v1`;
const JWKS = createRemoteJWKSet(
  new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

export interface SupabaseIdentity {
  sub: string; // auth.users.id
  email: string | null;
}

// Devuelve la identidad si el token es un JWT de Supabase válido; si no, null.
export async function verifySupabaseToken(
  token: string
): Promise<SupabaseIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: 'authenticated',
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  } catch {
    return null;
  }
}
