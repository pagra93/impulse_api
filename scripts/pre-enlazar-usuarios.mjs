// ═══════════════════════════════════════════════════════════════════════════
// PRE-ENLACE DE USUARIOS A SUPABASE (login único) — migración una sola vez
// ═══════════════════════════════════════════════════════════════════════════
// Para los usuarios de la extensión CON DATOS (reglas) que aún no tienen su
// cuenta enlazada: busca su cuenta de Supabase Auth por email y, si no existe,
// la crea; luego enlaza public.users.auth_user_id. Así, cuando entren por
// código con su email, caen en SUS reglas. Los que no casen (email raro / sin
// email) salen en un informe para revisarlos a mano.
//
// SEGURO: por defecto es DRY RUN (no escribe nada). Añade --apply para aplicar.
// Idempotente: solo procesa usuarios sin enlazar y con datos.
//
// Variables de entorno:
//   SUPABASE_URL               (default: https://qsuzixmislcfmraskuzs.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY  (SECRETO — Dashboard → Settings → API → service_role)
//   DATABASE_URL               (el mismo Postgres de la API / Supabase)
//
// Uso:
//   node scripts/pre-enlazar-usuarios.mjs            # dry run: solo informa
//   node scripts/pre-enlazar-usuarios.mjs --apply    # aplica (crea/enlaza)

import pg from 'pg';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://qsuzixmislcfmraskuzs.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const APPLY = process.argv.includes('--apply');

if (!SERVICE_ROLE || !DATABASE_URL) {
  console.error(
    'Faltan variables: SUPABASE_SERVICE_ROLE_KEY y/o DATABASE_URL.'
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

// auth.users vive en el mismo Postgres → lectura directa (no escribimos ahí).
async function findAuthUserByEmail(email) {
  const r = await pool.query(
    `select id, email from auth.users where lower(email) = lower($1) limit 1`,
    [email]
  );
  return r.rows[0] || null;
}

// Crear usuario de Supabase Auth vía la Admin REST API (email ya verificado).
async function createAuthUser(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (!res.ok) {
    throw new Error(`admin createUser ${res.status}: ${await res.text()}`);
  }
  const j = await res.json();
  const id = j.id || j.user?.id;
  if (!id) throw new Error('respuesta sin id de usuario');
  return id;
}

async function link(publicUserId, authUserId) {
  await pool.query(
    `update public.users set auth_user_id = $1, updated_at = now() where id = $2`,
    [authUserId, publicUserId]
  );
}

const report = {
  total: 0,
  enlazados_a_existente: 0,
  creados_y_enlazados: 0,
  sin_email: [],
  fallidos: [],
};

const { rows: users } = await pool.query(`
  select u.id, u.email
  from public.users u
  where u.auth_user_id is null
    and (
      exists (select 1 from public.blocking_periods bp where bp.user_id = u.id)
      or exists (select 1 from public.impulse_controls ic where ic.user_id = u.id)
    )
  order by u.email
`);

report.total = users.length;
console.log(
  `${APPLY ? '🟢 APLICAR' : '🔎 DRY RUN'} — ${users.length} usuarios con datos sin enlazar\n`
);

for (const u of users) {
  const email = (u.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    report.sin_email.push({ id: u.id, email: u.email });
    console.warn(`SIN EMAIL VÁLIDO: ${u.id} (${u.email})`);
    continue;
  }
  try {
    const existing = await findAuthUserByEmail(email);
    if (existing) {
      report.enlazados_a_existente++;
      if (APPLY) await link(u.id, existing.id);
      console.log(`${APPLY ? 'OK  ' : 'plan'} ${email} → enlaza a cuenta existente`);
    } else {
      report.creados_y_enlazados++;
      if (APPLY) {
        const authId = await createAuthUser(email);
        await link(u.id, authId);
        console.log(`OK   ${email} → cuenta creada y enlazada`);
      } else {
        console.log(`plan ${email} → se crearía cuenta y se enlazaría`);
      }
    }
  } catch (e) {
    report.fallidos.push({ email, error: String(e.message || e) });
    console.warn(`FALLO ${email}: ${e.message || e}`);
  }
}

console.log('\n===== INFORME =====');
console.log(
  JSON.stringify(
    {
      modo: APPLY ? 'apply' : 'dry-run',
      total: report.total,
      enlazados_a_existente: report.enlazados_a_existente,
      creados_y_enlazados: report.creados_y_enlazados,
      a_revisar_sin_email: report.sin_email.length,
      a_revisar_fallidos: report.fallidos.length,
    },
    null,
    2
  )
);
if (report.sin_email.length)
  console.log('\nSIN EMAIL VÁLIDO:', JSON.stringify(report.sin_email, null, 2));
if (report.fallidos.length)
  console.log('\nFALLIDOS:', JSON.stringify(report.fallidos, null, 2));
if (!APPLY)
  console.log('\n(DRY RUN — no se escribió nada. Repite con --apply para aplicar.)');

await pool.end();
