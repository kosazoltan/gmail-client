import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { securityHeaders } from './security-headers.js';

describe('securityHeaders middleware', () => {
  it('sets all required security headers', () => {
    const req = {} as Request;
    const headers: Record<string, string> = {};
    const res = {
      setHeader: vi.fn((key: string, value: string) => {
        headers[key] = value;
      }),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    securityHeaders(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '0');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Referrer-Policy',
      'strict-origin-when-cross-origin',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('CSP includes self and Google OAuth domains', () => {
    const req = {} as Request;
    let cspValue = '';
    const res = {
      setHeader: vi.fn((key: string, value: string) => {
        if (key === 'Content-Security-Policy') cspValue = value;
      }),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    securityHeaders(req, res, next);

    expect(cspValue).toContain("'self'");
    expect(cspValue).toContain('https://accounts.google.com');
    expect(cspValue).toContain('https://www.googleapis.com');
    expect(cspValue).toContain("frame-src 'none'");
  });
});
