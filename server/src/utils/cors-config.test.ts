import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildAllowedOrigins, isOriginAllowed } from './cors-config.js';

describe('cors-config', () => {
  beforeEach(() => {
    // Reset env
    delete process.env.FRONTEND_URL;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.ADDITIONAL_ORIGINS;
  });

  describe('buildAllowedOrigins', () => {
    it('includes hardcoded mindenes.org origins', () => {
      const origins = buildAllowedOrigins();
      expect(origins).toContain('https://mindenes.org');
      expect(origins).toContain('https://mail.mindenes.org');
      expect(origins).toContain('http://localhost:5173');
    });

    it('includes FRONTEND_URL when set', () => {
      process.env.FRONTEND_URL = 'https://custom.example.com';
      const origins = buildAllowedOrigins();
      expect(origins).toContain('https://custom.example.com');
    });

    it('deduplicates origins', () => {
      process.env.FRONTEND_URL = 'https://mindenes.org';
      const origins = buildAllowedOrigins();
      const count = origins.filter((o) => o === 'https://mindenes.org').length;
      expect(count).toBe(1);
    });

    it('includes ALLOWED_ORIGINS env var', () => {
      process.env.ALLOWED_ORIGINS = 'https://staging.example.com,https://preview.example.com';
      const origins = buildAllowedOrigins();
      expect(origins).toContain('https://staging.example.com');
      expect(origins).toContain('https://preview.example.com');
    });

    it('handles empty FRONTEND_URL gracefully', () => {
      process.env.FRONTEND_URL = '  ';
      const origins = buildAllowedOrigins();
      expect(origins).not.toContain('');
      expect(origins).not.toContain('  ');
    });
  });

  describe('isOriginAllowed', () => {
    const allowed = ['https://mindenes.org', 'https://mail.mindenes.org', 'http://localhost:5173'];

    it('allows undefined origin (server-to-server)', () => {
      expect(isOriginAllowed(undefined, allowed)).toBe(true);
    });

    it('allows "null" origin (PWA/Capacitor)', () => {
      expect(isOriginAllowed('null', allowed)).toBe(true);
    });

    it('allows exact match', () => {
      expect(isOriginAllowed('https://mindenes.org', allowed)).toBe(true);
    });

    it('rejects non-matching origin', () => {
      expect(isOriginAllowed('https://evil.com', allowed)).toBe(false);
    });

    it('handles case-insensitive matching', () => {
      expect(isOriginAllowed('HTTPS://MINDENES.ORG', allowed)).toBe(true);
    });

    it('handles trailing slash normalization', () => {
      expect(isOriginAllowed('https://mindenes.org/', allowed)).toBe(true);
    });

    it('allows Vercel preview URLs matching pattern', () => {
      expect(
        isOriginAllowed('https://gmail-client-abc123-kosa-zoltans-projects.vercel.app', allowed),
      ).toBe(true);
    });

    it('rejects non-matching Vercel URLs', () => {
      expect(
        isOriginAllowed('https://other-project-abc123-kosa-zoltans-projects.vercel.app', allowed),
      ).toBe(false);
    });
  });
});
