// ═══════════════════════════════════════════════════════════════════════════
// TIPOS PRINCIPALES DE LA API
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// USUARIO
// ═══════════════════════════════════════════════════════════════════════════
export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  plan: 'free' | 'premium';
  plan_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface UserPublic {
  id: string;
  email: string;
  display_name: string | null;
  plan: 'free' | 'premium';
  created_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════
export interface RegisterInput {
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SESIONES
// ═══════════════════════════════════════════════════════════════════════════
export interface Session {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_info: Record<string, any> | null;
  extension_version: string | null;
  created_at: Date;
  expires_at: Date;
  last_used_at: Date;
  is_revoked: boolean;
  ip_address: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
export interface UserSettings {
  id: string;
  user_id: string;
  theme_preference: 'light' | 'dark' | 'system';
  focus_pill_enabled: boolean;
  quick_focus_enabled: boolean;
  quick_focus_default_url: string | null;
  password_protection_enabled: boolean;
  uninstall_alert_enabled: boolean;
  uninstall_alert_email: string | null;
  language: string;
  created_at: Date;
  updated_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKING PERIODS
// ═══════════════════════════════════════════════════════════════════════════
export interface BlockingPeriod {
  id: string;
  user_id: string;
  local_id: string | null;
  name: string | null;
  enabled: boolean;
  time_from: string; // 'HH:MM:SS'
  time_to: string;
  always_on: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  custom_message: string | null;
  created_at: Date;
  updated_at: Date;
  // Relaciones
  sites?: string[];
  days?: string[];
  emails?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPULSE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════
export interface ImpulseControl {
  id: string;
  user_id: string;
  local_id: string | null;
  name: string | null;
  enabled: boolean;
  minutes_limit: number | null;
  openings_limit: number | null;
  difficulty: 'easy' | 'medium' | 'hard';
  url_warning_enabled: boolean;
  impulse_control_enabled: boolean;
  impulse_control_timer: number;
  usage_notice_enabled: boolean;
  usage_notice_timer: number;
  scroll_limit_enabled: boolean;
  scroll_pixel_limit: number;
  scroll_countdown_duration: number;
  time_progress_indicator_enabled: boolean;
  created_at: Date;
  updated_at: Date;
  // Relaciones
  sites?: string[];
  emails?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// API RESPONSES
// ═══════════════════════════════════════════════════════════════════════════
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPRESS EXTENSIONS
// ═══════════════════════════════════════════════════════════════════════════
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

