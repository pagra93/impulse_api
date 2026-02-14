// ═══════════════════════════════════════════════════════════════════════════
// MODELO DE SQUADS
// ═══════════════════════════════════════════════════════════════════════════

import { query } from '../config/database';
import {
  SquadTemplate,
  RuleTemplate,
  SquadStats,
  SquadMembership,
  SquadProgress,
  SquadMember,
  WeeklyMedal,
  CreateSquadInput,
  CreateRuleInput,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Devuelve la fecha de hoy en formato YYYY-MM-DD (UTC) */
function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Devuelve la fecha de ayer en formato YYYY-MM-DD (UTC) */
function getYesterdayDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Mapea una row de rule_templates a RuleTemplate (camelCase) */
function mapRuleRow(row: any): RuleTemplate {
  return {
    id: row.id,
    squadTemplateId: row.squad_template_id,
    type: row.type,
    name: row.name,
    schedule: row.schedule,
    appliesTo: row.applies_to,
    apps: row.apps,
    limitConfig: row.limit_config,
    enforcementLevel: row.enforcement_level,
    difficulty: row.difficulty,
    exceptions: row.exceptions,
  };
}

/** Mapea una row de squad_templates a SquadTemplate (camelCase) */
function mapTemplateRow(row: any, rules: RuleTemplate[], stats: SquadStats): SquadTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    category: row.category,
    createdBy: row.created_by,
    createdAt: row.created_at,
    rules,
    mockStats: stats,
    ownerId: row.owner_id,
    ownerDisplayName: row.owner_display_name || null,
    visibility: row.visibility || 'public',
    inviteCode: row.invite_code,
  };
}

/**
 * Genera un slug a partir de un nombre.
 * Ej: "My Focus Squad" → "my-focus-squad"
 * Si el slug ya existe, añade un sufijo numérico.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

/**
 * Genera un invite code único de 8 caracteres (formato XXXX-XXXX).
 * Usa letras mayúsculas sin vocales + números para evitar palabras accidentales.
 */
const INVITE_CHARS = 'BCDFGHJKLMNPQRSTVWXYZ23456789';

function generateInviteCodeString(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += INVITE_CHARS.charAt(Math.floor(Math.random() * INVITE_CHARS.length));
  }
  return code.substring(0, 4) + '-' + code.substring(4);
}

/** Genera un invite code único (verifica unicidad en la BBDD) */
async function generateUniqueInviteCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateInviteCodeString();
    const result = await query(
      `SELECT 1 FROM squad_templates WHERE invite_code = $1`,
      [code]
    );
    if (result.rows.length === 0) {
      return code;
    }
    attempts++;
  }
  // Fallback: UUID-based
  const fallback = Math.random().toString(36).substring(2, 10).toUpperCase();
  return fallback.substring(0, 4) + '-' + fallback.substring(4, 8);
}

/** Genera un ID único para un squad basado en slug */
async function generateSquadId(name: string): Promise<string> {
  const baseSlug = generateSlug(name);
  if (!baseSlug) {
    return `squad-${Date.now()}`;
  }

  // Comprobar si el slug ya existe
  const result = await query(
    `SELECT 1 FROM squad_templates WHERE id = $1`,
    [baseSlug]
  );

  if (result.rows.length === 0) {
    return baseSlug;
  }

  // Añadir sufijo numérico
  return `${baseSlug}-${Date.now().toString(36)}`;
}

/** Genera un ID para una regla */
function generateRuleId(squadId: string, index: number): string {
  return `${squadId}-rule-${index + 1}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// OWNER VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/** Verifica que el usuario es el owner del squad. Devuelve true si lo es. */
export async function verifySquadOwner(squadId: string, userId: string): Promise<boolean> {
  const result = await query(
    `SELECT owner_id FROM squad_templates WHERE id = $1`,
    [squadId]
  );

  if (result.rows.length === 0) return false;
  return result.rows[0].owner_id === userId;
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD TEMPLATES — QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/** Obtener todos los squad templates (system + user public) con sus rules y stats */
export async function getAllSquadTemplates(): Promise<SquadTemplate[]> {
  const templatesResult = await query(
    `SELECT st.*, u.display_name AS owner_display_name
     FROM squad_templates st
     LEFT JOIN users u ON st.owner_id = u.id
     WHERE st.created_by = 'system' 
        OR (st.created_by = 'user' AND st.visibility = 'public')
     ORDER BY st.created_at`
  );

  const templates: SquadTemplate[] = [];

  for (const row of templatesResult.rows) {
    const rulesResult = await query(
      `SELECT * FROM rule_templates WHERE squad_template_id = $1`,
      [row.id]
    );

    const stats = await getSquadStats(row.id);

    templates.push(mapTemplateRow(row, rulesResult.rows.map(mapRuleRow), stats));
  }

  return templates;
}

/** Obtener un squad template por ID con sus rules y stats */
export async function getSquadTemplateById(id: string): Promise<SquadTemplate | null> {
  const templateResult = await query(
    `SELECT st.*, u.display_name AS owner_display_name
     FROM squad_templates st
     LEFT JOIN users u ON st.owner_id = u.id
     WHERE st.id = $1`,
    [id]
  );

  if (templateResult.rows.length === 0) {
    return null;
  }

  const row = templateResult.rows[0];

  const rulesResult = await query(
    `SELECT * FROM rule_templates WHERE squad_template_id = $1`,
    [row.id]
  );

  const stats = await getSquadStats(row.id);

  return mapTemplateRow(row, rulesResult.rows.map(mapRuleRow), stats);
}

/** Verificar si un squad template existe */
export async function squadTemplateExists(id: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM squad_templates WHERE id = $1`,
    [id]
  );
  return result.rows.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD TEMPLATES — CRUD (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

/** Crear un squad template con sus reglas */
export async function createSquadTemplate(
  ownerId: string,
  input: CreateSquadInput
): Promise<SquadTemplate> {
  const squadId = await generateSquadId(input.name);
  const inviteCode = await generateUniqueInviteCode();

  // 1. Insertar squad_template
  await query(
    `INSERT INTO squad_templates (id, name, description, emoji, category, created_by, created_at, owner_id, visibility, invite_code)
     VALUES ($1, $2, $3, $4, $5, 'user', NOW(), $6, $7, $8)`,
    [
      squadId,
      input.name,
      input.description || null,
      input.emoji || null,
      input.category || null,
      ownerId,
      input.visibility || 'public',
      inviteCode,
    ]
  );

  // 2. Insertar reglas
  for (let i = 0; i < input.rules.length; i++) {
    const rule = input.rules[i];
    const ruleId = generateRuleId(squadId, i);

    await query(
      `INSERT INTO rule_templates (id, squad_template_id, type, name, schedule, applies_to, apps, limit_config, enforcement_level, difficulty, exceptions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        ruleId,
        squadId,
        rule.type,
        rule.name,
        rule.schedule ? JSON.stringify(rule.schedule) : null,
        rule.appliesTo || null,
        rule.apps ? JSON.stringify(rule.apps) : null,
        rule.limitConfig ? JSON.stringify(rule.limitConfig) : null,
        rule.enforcementLevel || null,
        rule.difficulty || null,
        rule.exceptions ? JSON.stringify(rule.exceptions) : null,
      ]
    );
  }

  // 3. Crear membership con role='owner'
  const now = Date.now();
  await query(
    `INSERT INTO squad_memberships (user_id, squad_template_id, joined_at, status, role, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', 'owner', NOW(), NOW())
     ON CONFLICT (user_id, squad_template_id) DO UPDATE SET
       status = 'active',
       role = 'owner',
       joined_at = $3,
       updated_at = NOW()`,
    [ownerId, squadId, now]
  );

  // 4. Devolver el squad completo
  const template = await getSquadTemplateById(squadId);
  return template!;
}

/** Actualizar metadata de un squad template (solo campos proporcionados) */
export async function updateSquadTemplate(
  squadId: string,
  updates: { name?: string; description?: string; emoji?: string; category?: string; visibility?: string }
): Promise<void> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.emoji !== undefined) {
    setClauses.push(`emoji = $${paramIndex++}`);
    values.push(updates.emoji);
  }
  if (updates.category !== undefined) {
    setClauses.push(`category = $${paramIndex++}`);
    values.push(updates.category);
  }
  if (updates.visibility !== undefined) {
    setClauses.push(`visibility = $${paramIndex++}`);
    values.push(updates.visibility);
  }

  if (setClauses.length === 0) return;

  values.push(squadId);
  await query(
    `UPDATE squad_templates SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}

/** Eliminar un squad template y sus datos asociados */
export async function deleteSquadTemplate(squadId: string): Promise<void> {
  // 1. Eliminar rule_templates
  await query(`DELETE FROM rule_templates WHERE squad_template_id = $1`, [squadId]);

  // 2. Eliminar squad_events
  await query(`DELETE FROM squad_events WHERE squad_template_id = $1`, [squadId]);

  // 3. Marcar memberships como 'left'
  await query(
    `UPDATE squad_memberships SET status = 'left', updated_at = NOW() WHERE squad_template_id = $1`,
    [squadId]
  );

  // 4. Eliminar el squad_template
  await query(`DELETE FROM squad_templates WHERE id = $1`, [squadId]);
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE TEMPLATES — CRUD (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

/** Añadir una regla a un squad */
export async function addRuleTemplate(
  squadId: string,
  input: CreateRuleInput
): Promise<RuleTemplate> {
  // Generar ID basado en el número de reglas existentes
  const countResult = await query(
    `SELECT COUNT(*) as count FROM rule_templates WHERE squad_template_id = $1`,
    [squadId]
  );
  const count = parseInt(countResult.rows[0].count, 10);
  const ruleId = generateRuleId(squadId, count);

  await query(
    `INSERT INTO rule_templates (id, squad_template_id, type, name, schedule, applies_to, apps, limit_config, enforcement_level, difficulty, exceptions)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      ruleId,
      squadId,
      input.type,
      input.name,
      input.schedule ? JSON.stringify(input.schedule) : null,
      input.appliesTo || null,
      input.apps ? JSON.stringify(input.apps) : null,
      input.limitConfig ? JSON.stringify(input.limitConfig) : null,
      input.enforcementLevel || null,
      input.difficulty || null,
      input.exceptions ? JSON.stringify(input.exceptions) : null,
    ]
  );

  return {
    id: ruleId,
    squadTemplateId: squadId,
    type: input.type,
    name: input.name,
    schedule: input.schedule || null,
    appliesTo: input.appliesTo || null,
    apps: input.apps || null,
    limitConfig: input.limitConfig || null,
    enforcementLevel: input.enforcementLevel || null,
    difficulty: input.difficulty || null,
    exceptions: input.exceptions || null,
  };
}

/** Actualizar una regla (campos parciales) */
export async function updateRuleTemplate(
  ruleId: string,
  squadId: string,
  updates: Partial<CreateRuleInput>
): Promise<boolean> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.type !== undefined) {
    setClauses.push(`type = $${paramIndex++}`);
    values.push(updates.type);
  }
  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.schedule !== undefined) {
    setClauses.push(`schedule = $${paramIndex++}`);
    values.push(JSON.stringify(updates.schedule));
  }
  if (updates.appliesTo !== undefined) {
    setClauses.push(`applies_to = $${paramIndex++}`);
    values.push(updates.appliesTo);
  }
  if (updates.apps !== undefined) {
    setClauses.push(`apps = $${paramIndex++}`);
    values.push(JSON.stringify(updates.apps));
  }
  if (updates.limitConfig !== undefined) {
    setClauses.push(`limit_config = $${paramIndex++}`);
    values.push(JSON.stringify(updates.limitConfig));
  }
  if (updates.enforcementLevel !== undefined) {
    setClauses.push(`enforcement_level = $${paramIndex++}`);
    values.push(updates.enforcementLevel);
  }
  if (updates.difficulty !== undefined) {
    setClauses.push(`difficulty = $${paramIndex++}`);
    values.push(updates.difficulty);
  }
  if (updates.exceptions !== undefined) {
    setClauses.push(`exceptions = $${paramIndex++}`);
    values.push(JSON.stringify(updates.exceptions));
  }

  if (setClauses.length === 0) return true;

  values.push(ruleId);
  values.push(squadId);

  const result = await query(
    `UPDATE rule_templates SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND squad_template_id = $${paramIndex + 1}`,
    values
  );

  return (result.rowCount ?? 0) > 0;
}

/** Eliminar una regla */
export async function deleteRuleTemplate(ruleId: string, squadId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM rule_templates WHERE id = $1 AND squad_template_id = $2`,
    [ruleId, squadId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD STATS
// ═══════════════════════════════════════════════════════════════════════════

/** Calcular stats agregadas para un squad */
export async function getSquadStats(squadTemplateId: string): Promise<SquadStats> {
  // 1. memberCount: miembros activos
  const memberResult = await query(
    `SELECT COUNT(*) as count FROM squad_memberships 
     WHERE squad_template_id = $1 AND status = 'active'`,
    [squadTemplateId]
  );
  const memberCount = parseInt(memberResult.rows[0].count, 10);

  if (memberCount === 0) {
    return { memberCount: 0, cleanDayPercentage: 0, averageStreak: 0 };
  }

  // 2. cleanDayPercentage: % de miembros activos sin eventos DISABLED ayer
  const yesterday = getYesterdayDate();

  const dirtyMembersResult = await query(
    `SELECT COUNT(DISTINCT se.user_id) as count
     FROM squad_events se
     JOIN squad_memberships sm 
       ON se.user_id = sm.user_id AND se.squad_template_id = sm.squad_template_id
     WHERE se.squad_template_id = $1 
       AND se.date = $2 
       AND se.type = 'DISABLED'
       AND sm.status = 'active'`,
    [squadTemplateId, yesterday]
  );
  const dirtyCount = parseInt(dirtyMembersResult.rows[0].count, 10);
  const cleanDayPercentage = Math.round(((memberCount - dirtyCount) / memberCount) * 100);

  // 3. averageStreak: media de rachas actuales de miembros activos
  const activeMembersResult = await query(
    `SELECT user_id FROM squad_memberships 
     WHERE squad_template_id = $1 AND status = 'active'`,
    [squadTemplateId]
  );

  let totalStreak = 0;
  for (const member of activeMembersResult.rows) {
    const streak = await calculateCurrentStreak(member.user_id, squadTemplateId);
    totalStreak += streak;
  }
  const averageStreak = memberCount > 0 ? Math.round((totalStreak / memberCount) * 10) / 10 : 0;

  return { memberCount, cleanDayPercentage, averageStreak };
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD MEMBERSHIPS
// ═══════════════════════════════════════════════════════════════════════════

/** Unirse a un squad (upsert) */
export async function joinSquad(userId: string, squadTemplateId: string, role: 'owner' | 'member' = 'member'): Promise<void> {
  const now = Date.now();

  await query(
    `INSERT INTO squad_memberships (user_id, squad_template_id, joined_at, status, role, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', $4, NOW(), NOW())
     ON CONFLICT (user_id, squad_template_id) DO UPDATE SET
       status = 'active',
       joined_at = $3,
       updated_at = NOW()`,
    [userId, squadTemplateId, now, role]
  );
}

/** Salir de un squad */
export async function leaveSquad(userId: string, squadTemplateId: string): Promise<boolean> {
  const result = await query(
    `UPDATE squad_memberships 
     SET status = 'left', updated_at = NOW()
     WHERE user_id = $1 AND squad_template_id = $2 AND status = 'active'`,
    [userId, squadTemplateId]
  );

  return (result.rowCount ?? 0) > 0;
}

/** Obtener todas las memberships de un usuario */
export async function getUserMemberships(userId: string): Promise<SquadMembership[]> {
  const result = await query(
    `SELECT squad_template_id, joined_at, status, role 
     FROM squad_memberships 
     WHERE user_id = $1
     ORDER BY created_at`,
    [userId]
  );

  return result.rows.map((row: any) => ({
    squadTemplateId: row.squad_template_id,
    joinedAt: parseInt(row.joined_at, 10),
    status: row.status,
    role: row.role || 'member',
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// JOIN BY CODE (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

/** Buscar un squad por invite code y unirse */
export async function findSquadByInviteCode(code: string): Promise<string | null> {
  const result = await query(
    `SELECT id FROM squad_templates WHERE invite_code = $1`,
    [code]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0].id;
}

/** Verificar si un usuario ya es miembro activo de un squad */
export async function isActiveMember(userId: string, squadTemplateId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM squad_memberships 
     WHERE user_id = $1 AND squad_template_id = $2 AND status = 'active'`,
    [userId, squadTemplateId]
  );
  return result.rows.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// INVITE CODE (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

/** Obtener el invite code de un squad */
export async function getInviteCode(squadId: string): Promise<string | null> {
  const result = await query(
    `SELECT invite_code FROM squad_templates WHERE id = $1`,
    [squadId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].invite_code;
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD MEMBERS / LEADERBOARD (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

/** Obtener todos los miembros activos de un squad con su progreso */
export async function getSquadMembers(squadTemplateId: string): Promise<SquadMember[]> {
  const membersResult = await query(
    `SELECT sm.user_id, sm.role, u.display_name
     FROM squad_memberships sm
     JOIN users u ON sm.user_id = u.id
     WHERE sm.squad_template_id = $1 AND sm.status = 'active'
     ORDER BY sm.created_at`,
    [squadTemplateId]
  );

  const members: SquadMember[] = [];

  for (const row of membersResult.rows) {
    const progress = await getUserProgress(row.user_id, squadTemplateId);

    members.push({
      userId: row.user_id,
      displayName: row.display_name || 'Anonymous',
      role: row.role || 'member',
      progress,
    });
  }

  // Ordenar por currentStreak descendente
  members.sort((a, b) => b.progress.currentStreak - a.progress.currentStreak);

  return members;
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/** Registrar un evento de desactivación */
export async function createSquadEvent(
  userId: string,
  squadTemplateId: string,
  ruleId: string,
  type: string,
  timestamp: number,
  date: string
): Promise<void> {
  await query(
    `INSERT INTO squad_events (user_id, squad_template_id, rule_id, type, timestamp, date, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [userId, squadTemplateId, ruleId, type, timestamp, date]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD PROGRESS
// ═══════════════════════════════════════════════════════════════════════════

/** Calcular la racha actual (días consecutivos sin eventos hacia atrás desde hoy) */
async function calculateCurrentStreak(userId: string, squadTemplateId: string): Promise<number> {
  const today = getTodayDate();

  // Obtener las fechas con eventos DISABLED para este usuario y squad
  const eventsResult = await query(
    `SELECT DISTINCT date FROM squad_events 
     WHERE user_id = $1 AND squad_template_id = $2 AND type = 'DISABLED'
     ORDER BY date DESC`,
    [userId, squadTemplateId]
  );

  const dirtyDates = new Set(eventsResult.rows.map((r: any) => r.date));

  // Obtener joined_at para no contar días antes de unirse
  const membershipResult = await query(
    `SELECT joined_at FROM squad_memberships 
     WHERE user_id = $1 AND squad_template_id = $2`,
    [userId, squadTemplateId]
  );

  if (membershipResult.rows.length === 0) return 0;

  const joinedAt = parseInt(membershipResult.rows[0].joined_at, 10);
  const joinedDate = new Date(joinedAt).toISOString().slice(0, 10);

  let streak = 0;
  const d = new Date(today + 'T00:00:00Z');

  while (true) {
    const dateStr = d.toISOString().slice(0, 10);

    // No contar antes de la fecha de unión
    if (dateStr < joinedDate) break;

    if (dirtyDates.has(dateStr)) {
      break; // La racha se rompe
    }

    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }

  return streak;
}

/** Calcular la racha más larga desde joined_at */
async function calculateLongestStreak(userId: string, squadTemplateId: string): Promise<number> {
  const today = getTodayDate();

  // Obtener joined_at
  const membershipResult = await query(
    `SELECT joined_at FROM squad_memberships 
     WHERE user_id = $1 AND squad_template_id = $2`,
    [userId, squadTemplateId]
  );

  if (membershipResult.rows.length === 0) return 0;

  const joinedAt = parseInt(membershipResult.rows[0].joined_at, 10);
  const joinedDate = new Date(joinedAt).toISOString().slice(0, 10);

  // Obtener todas las fechas con eventos
  const eventsResult = await query(
    `SELECT DISTINCT date FROM squad_events 
     WHERE user_id = $1 AND squad_template_id = $2 AND type = 'DISABLED'
     ORDER BY date ASC`,
    [userId, squadTemplateId]
  );

  const dirtyDates = new Set(eventsResult.rows.map((r: any) => r.date));

  let longestStreak = 0;
  let currentStreak = 0;
  const d = new Date(joinedDate + 'T00:00:00Z');
  const todayDate = new Date(today + 'T00:00:00Z');

  while (d <= todayDate) {
    const dateStr = d.toISOString().slice(0, 10);

    if (dirtyDates.has(dateStr)) {
      currentStreak = 0;
    } else {
      currentStreak++;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    }

    d.setUTCDate(d.getUTCDate() + 1);
  }

  return longestStreak;
}

/** Obtener progreso del usuario para un squad */
export async function getUserProgress(userId: string, squadTemplateId: string): Promise<SquadProgress> {
  const today = getTodayDate();

  // 1. todayUnlocks: eventos de hoy
  const todayResult = await query(
    `SELECT COUNT(*) as count FROM squad_events 
     WHERE user_id = $1 AND squad_template_id = $2 AND date = $3 AND type = 'DISABLED'`,
    [userId, squadTemplateId, today]
  );
  const todayUnlocks = parseInt(todayResult.rows[0].count, 10);

  // 2. isCleanToday
  const isCleanToday = todayUnlocks === 0;

  // 3. currentStreak
  const currentStreak = await calculateCurrentStreak(userId, squadTemplateId);

  // 4. longestStreak
  const longestStreak = await calculateLongestStreak(userId, squadTemplateId);

  // 5. weeklyMedals: lun→dom de la semana actual
  const weeklyMedals = await calculateWeeklyMedals(userId, squadTemplateId);

  return {
    todayUnlocks,
    isCleanToday,
    currentStreak,
    longestStreak,
    weeklyMedals,
  };
}

/** Calcular las medallas semanales (lun→dom de la semana actual) */
async function calculateWeeklyMedals(userId: string, squadTemplateId: string): Promise<WeeklyMedal[]> {
  const today = new Date();
  const todayStr = getTodayDate();

  // Obtener joined_at
  const membershipResult = await query(
    `SELECT joined_at FROM squad_memberships 
     WHERE user_id = $1 AND squad_template_id = $2`,
    [userId, squadTemplateId]
  );

  const joinedDate = membershipResult.rows.length > 0
    ? new Date(parseInt(membershipResult.rows[0].joined_at, 10)).toISOString().slice(0, 10)
    : todayStr;

  // Calcular el lunes de esta semana (UTC)
  const dayOfWeek = today.getUTCDay(); // 0=dom, 1=lun, ..., 6=sab
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);

  const dayNames: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = [
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  ];

  // Obtener eventos de esta semana
  const sundayDate = new Date(monday);
  sundayDate.setUTCDate(monday.getUTCDate() + 6);
  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sundayDate.toISOString().slice(0, 10);

  const eventsResult = await query(
    `SELECT DISTINCT date FROM squad_events 
     WHERE user_id = $1 AND squad_template_id = $2 
       AND date >= $3 AND date <= $4 AND type = 'DISABLED'`,
    [userId, squadTemplateId, mondayStr, sundayStr]
  );

  const dirtyDates = new Set(eventsResult.rows.map((r: any) => r.date));

  const medals: WeeklyMedal[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    let status: 'clean' | 'broken' | 'future';

    if (dateStr > todayStr || dateStr < joinedDate) {
      status = 'future';
    } else if (dirtyDates.has(dateStr)) {
      status = 'broken';
    } else {
      status = 'clean';
    }

    medals.push({
      day: dayNames[i],
      date: dateStr,
      status,
    });
  }

  return medals;
}
