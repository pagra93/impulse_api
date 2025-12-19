// ═══════════════════════════════════════════════════════════════════════════
// CONTROLADOR DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// ═══════════════════════════════════════════════════════════════════════════

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, display_name } = req.body;
    
    const result = await authService.register({ 
      email, 
      password, 
      display_name 
    });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════════════════════════════════════

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;
    
    const result = await authService.login({ email, password });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/refresh
// ═══════════════════════════════════════════════════════════════════════════

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;
    
    const result = await authService.refresh(refreshToken);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ═══════════════════════════════════════════════════════════════════════════

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;
    
    await authService.logout(refreshToken);
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/auth/me
// ═══════════════════════════════════════════════════════════════════════════

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }
    
    const user = await authService.getCurrentUser(req.user.userId);
    
    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

