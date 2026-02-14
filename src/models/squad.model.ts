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
  WeeklyMedal,
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

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

/** Obtener todos los squad templates con sus rules y stats */
export async function getAllSquadTemplates(): Promise<SquadTemplate[]> {
  const templatesResult = await query(
    `SELECT * FROM squad_templates ORDER BY created_at`
  );

  const templates: SquadTemplate[] = [];

  for (const row of templatesResult.rows) {
    const rulesResult = await query(
      `SELECT * FROM rule_templates WHERE squad_template_id = $1`,
      [row.id]
    );

    const stats = await getSquadStats(row.id);

    templates.push({
      id: row.id,
      name: row.name,
      description: row.description,
      emoji: row.emoji,
      category: row.category,
      createdBy: row.created_by,
      createdAt: row.created_at,
      rules: rulesResult.rows.map(mapRuleRow),
      mockStats: stats,
    });
  }

  return templates;
}

/** Obtener un squad template por ID con sus rules y stats */
export async function getSquadTemplateById(id: string): Promise<SquadTemplate | null> {
  const templateResult = await query(
    `SELECT * FROM squad_templates WHERE id = $1`,
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

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    category: row.category,
    createdBy: row.created_by,
    createdAt: row.created_at,
    rules: rulesResult.rows.map(mapRuleRow),
    mockStats: stats,
  };
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
  // Obtener todos los miembros activos
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
export async function joinSquad(userId: string, squadTemplateId: string): Promise<void> {
  const now = Date.now();

  await query(
    `INSERT INTO squad_memberships (user_id, squad_template_id, joined_at, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', NOW(), NOW())
     ON CONFLICT (user_id, squad_template_id) DO UPDATE SET
       status = 'active',
       joined_at = $3,
       updated_at = NOW()`,
    [userId, squadTemplateId, now]
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
    `SELECT squad_template_id, joined_at, status 
     FROM squad_memberships 
     WHERE user_id = $1
     ORDER BY created_at`,
    [userId]
  );

  return result.rows.map((row: any) => ({
    squadTemplateId: row.squad_template_id,
    joinedAt: parseInt(row.joined_at, 10),
    status: row.status,
  }));
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
