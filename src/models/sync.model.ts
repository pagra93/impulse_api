// ═══════════════════════════════════════════════════════════════════════════
// MODELO DE SINCRONIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

import { query } from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export interface UserSettings {
  themePreference: string;
  focusPillEnabled: boolean;
  quickFocusEnabled: boolean;
  passwordProtectionEnabled: boolean;
  passwordHash: string | null;
  uninstallAlertEnabled: boolean;
  uninstallAlertEmail: string | null;
}

export interface BlockingPeriodInput {
  id?: string;
  localId?: string;
  name?: string;
  enabled: boolean;
  timeFrom: string;
  timeTo: string;
  alwaysOn: boolean;
  days: string[];
  sites: string[];
  emails: string[];
  difficulty: string;
  customMessage?: string;
}

export interface ImpulseControlInput {
  id?: string;
  localId?: string;
  name: string;
  enabled: boolean;
  minutes: number;
  openings: number;
  sites: string[];
  emails: string[];
  difficulty: string;
  urlWarningEnabled: boolean;
  impulseControlEnabled: boolean;
  impulseControlTimer: number;
  usageNoticeEnabled: boolean;
  usageNoticeTimer: number;
  scrollLimitEnabled: boolean;
  scrollPixelLimit: number;
  scrollCountdownDuration: number;
  timeProgressIndicatorEnabled: boolean;
}

export interface SyncData {
  settings: UserSettings;
  blockingPeriods: BlockingPeriodInput[];
  impulseControls: ImpulseControlInput[];
}

// ═══════════════════════════════════════════════════════════════════════════
// USER SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const result = await query(
    `SELECT 
      theme_preference,
      focus_pill_enabled,
      quick_focus_enabled,
      password_protection_enabled,
      password_hash,
      uninstall_alert_enabled,
      uninstall_alert_email
    FROM user_settings 
    WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    themePreference: row.theme_preference,
    focusPillEnabled: row.focus_pill_enabled,
    quickFocusEnabled: row.quick_focus_enabled,
    passwordProtectionEnabled: row.password_protection_enabled,
    passwordHash: row.password_hash,
    uninstallAlertEnabled: row.uninstall_alert_enabled,
    uninstallAlertEmail: row.uninstall_alert_email,
  };
}

export async function upsertUserSettings(userId: string, settings: UserSettings): Promise<void> {
  await query(
    `INSERT INTO user_settings (
      user_id, 
      theme_preference, 
      focus_pill_enabled,
      quick_focus_enabled,
      password_protection_enabled,
      password_hash,
      uninstall_alert_enabled,
      uninstall_alert_email,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      theme_preference = EXCLUDED.theme_preference,
      focus_pill_enabled = EXCLUDED.focus_pill_enabled,
      quick_focus_enabled = EXCLUDED.quick_focus_enabled,
      password_protection_enabled = EXCLUDED.password_protection_enabled,
      password_hash = EXCLUDED.password_hash,
      uninstall_alert_enabled = EXCLUDED.uninstall_alert_enabled,
      uninstall_alert_email = EXCLUDED.uninstall_alert_email,
      updated_at = NOW()`,
    [
      userId,
      settings.themePreference,
      settings.focusPillEnabled,
      settings.quickFocusEnabled,
      settings.passwordProtectionEnabled,
      settings.passwordHash,
      settings.uninstallAlertEnabled,
      settings.uninstallAlertEmail,
    ]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKING PERIODS
// ═══════════════════════════════════════════════════════════════════════════

export async function getBlockingPeriods(userId: string): Promise<BlockingPeriodInput[]> {
  // Obtener los blocking periods
  const periodsResult = await query(
    `SELECT 
      id, local_id, name, enabled, time_from, time_to, 
      always_on, difficulty, custom_message
    FROM blocking_periods 
    WHERE user_id = $1
    ORDER BY created_at`,
    [userId]
  );

  const periods: BlockingPeriodInput[] = [];

  for (const row of periodsResult.rows) {
    // Obtener sites para este period
    const sitesResult = await query(
      `SELECT site_pattern FROM blocking_period_sites WHERE blocking_period_id = $1`,
      [row.id]
    );
    
    // Obtener days para este period
    const daysResult = await query(
      `SELECT day_name FROM blocking_period_days WHERE blocking_period_id = $1`,
      [row.id]
    );
    
    // Obtener emails para este period
    const emailsResult = await query(
      `SELECT email FROM blocking_period_emails WHERE blocking_period_id = $1`,
      [row.id]
    );

    periods.push({
      id: row.local_id || row.id, // Usar local_id si existe, sino el UUID
      localId: row.local_id,
      name: row.name,
      enabled: row.enabled,
      timeFrom: row.time_from?.substring(0, 5) || '00:00', // HH:MM
      timeTo: row.time_to?.substring(0, 5) || '00:00',
      alwaysOn: row.always_on,
      days: daysResult.rows.map((r: any) => r.day_name),
      sites: sitesResult.rows.map((r: any) => r.site_pattern),
      emails: emailsResult.rows.map((r: any) => r.email),
      difficulty: row.difficulty,
      customMessage: row.custom_message,
    });
  }

  return periods;
}

export async function saveBlockingPeriods(userId: string, periods: BlockingPeriodInput[]): Promise<void> {
  // 1. Eliminar todos los blocking periods existentes del usuario
  await query(`DELETE FROM blocking_periods WHERE user_id = $1`, [userId]);

  // 2. Insertar los nuevos
  for (const period of periods) {
    // Insertar el blocking period
    const result = await query(
      `INSERT INTO blocking_periods (
        user_id, local_id, name, enabled, time_from, time_to,
        always_on, difficulty, custom_message, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id`,
      [
        userId,
        period.id || period.localId,
        period.name,
        period.enabled,
        period.timeFrom,
        period.timeTo,
        period.alwaysOn,
        period.difficulty || 'medium',
        period.customMessage,
      ]
    );

    const periodId = result.rows[0].id;

    // Insertar sites
    for (const site of period.sites || []) {
      await query(
        `INSERT INTO blocking_period_sites (blocking_period_id, site_pattern) VALUES ($1, $2)`,
        [periodId, site]
      );
    }

    // Insertar days
    for (const day of period.days || []) {
      await query(
        `INSERT INTO blocking_period_days (blocking_period_id, day_name) VALUES ($1, $2)`,
        [periodId, day]
      );
    }

    // Insertar emails
    for (const email of period.emails || []) {
      await query(
        `INSERT INTO blocking_period_emails (blocking_period_id, email) VALUES ($1, $2)`,
        [periodId, email]
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPULSE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

export async function getImpulseControls(userId: string): Promise<ImpulseControlInput[]> {
  const controlsResult = await query(
    `SELECT 
      id, local_id, name, enabled, minutes_limit, openings_limit,
      difficulty, url_warning_enabled, impulse_control_enabled,
      impulse_control_timer, usage_notice_enabled, usage_notice_timer,
      scroll_limit_enabled, scroll_pixel_limit, scroll_countdown_duration,
      time_progress_indicator_enabled
    FROM impulse_controls 
    WHERE user_id = $1
    ORDER BY created_at`,
    [userId]
  );

  const controls: ImpulseControlInput[] = [];

  for (const row of controlsResult.rows) {
    // Obtener sites
    const sitesResult = await query(
      `SELECT site_pattern FROM impulse_control_sites WHERE impulse_control_id = $1`,
      [row.id]
    );
    
    // Obtener emails
    const emailsResult = await query(
      `SELECT email FROM impulse_control_emails WHERE impulse_control_id = $1`,
      [row.id]
    );

    controls.push({
      id: row.local_id || row.id,
      localId: row.local_id,
      name: row.name,
      enabled: row.enabled,
      minutes: row.minutes_limit || 0,
      openings: row.openings_limit || 0,
      sites: sitesResult.rows.map((r: any) => r.site_pattern),
      emails: emailsResult.rows.map((r: any) => r.email),
      difficulty: row.difficulty,
      urlWarningEnabled: row.url_warning_enabled,
      impulseControlEnabled: row.impulse_control_enabled,
      impulseControlTimer: row.impulse_control_timer,
      usageNoticeEnabled: row.usage_notice_enabled,
      usageNoticeTimer: row.usage_notice_timer,
      scrollLimitEnabled: row.scroll_limit_enabled,
      scrollPixelLimit: row.scroll_pixel_limit,
      scrollCountdownDuration: row.scroll_countdown_duration,
      timeProgressIndicatorEnabled: row.time_progress_indicator_enabled,
    });
  }

  return controls;
}

export async function saveImpulseControls(userId: string, controls: ImpulseControlInput[]): Promise<void> {
  // 1. Eliminar todos los impulse controls existentes del usuario
  await query(`DELETE FROM impulse_controls WHERE user_id = $1`, [userId]);

  // 2. Insertar los nuevos
  for (const control of controls) {
    const result = await query(
      `INSERT INTO impulse_controls (
        user_id, local_id, name, enabled, minutes_limit, openings_limit,
        difficulty, url_warning_enabled, impulse_control_enabled,
        impulse_control_timer, usage_notice_enabled, usage_notice_timer,
        scroll_limit_enabled, scroll_pixel_limit, scroll_countdown_duration,
        time_progress_indicator_enabled, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      RETURNING id`,
      [
        userId,
        control.id || control.localId,
        control.name,
        control.enabled,
        control.minutes,
        control.openings,
        control.difficulty || 'medium',
        control.urlWarningEnabled,
        control.impulseControlEnabled,
        control.impulseControlTimer,
        control.usageNoticeEnabled,
        control.usageNoticeTimer,
        control.scrollLimitEnabled,
        control.scrollPixelLimit,
        control.scrollCountdownDuration,
        control.timeProgressIndicatorEnabled,
      ]
    );

    const controlId = result.rows[0].id;

    // Insertar sites
    for (const site of control.sites || []) {
      await query(
        `INSERT INTO impulse_control_sites (impulse_control_id, site_pattern) VALUES ($1, $2)`,
        [controlId, site]
      );
    }

    // Insertar emails
    for (const email of control.emails || []) {
      await query(
        `INSERT INTO impulse_control_emails (impulse_control_id, email) VALUES ($1, $2)`,
        [controlId, email]
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES DE SYNC
// ═══════════════════════════════════════════════════════════════════════════

export async function pullUserData(userId: string): Promise<SyncData> {
  const settings = await getUserSettings(userId);
  const blockingPeriods = await getBlockingPeriods(userId);
  const impulseControls = await getImpulseControls(userId);

  return {
    settings: settings || {
      themePreference: 'light',
      focusPillEnabled: true,
      quickFocusEnabled: false,
      passwordProtectionEnabled: false,
      passwordHash: null,
      uninstallAlertEnabled: false,
      uninstallAlertEmail: null,
    },
    blockingPeriods,
    impulseControls,
  };
}

export async function pushUserData(userId: string, data: SyncData): Promise<void> {
  // Guardar settings
  if (data.settings) {
    await upsertUserSettings(userId, data.settings);
  }

  // Guardar blocking periods
  if (data.blockingPeriods) {
    await saveBlockingPeriods(userId, data.blockingPeriods);
  }

  // Guardar impulse controls
  if (data.impulseControls) {
    await saveImpulseControls(userId, data.impulseControls);
  }
}

