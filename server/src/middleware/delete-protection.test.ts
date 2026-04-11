import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { deleteProtection } from './delete-protection.js';

// Minimal mock factory
function createMockReq(method: string, path: string): Request {
  return {
    method,
    path,
    body: {},
    headers: {},
  } as unknown as Request;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    getHeader: vi.fn().mockReturnValue(undefined),
    setHeader: vi.fn(),
  };
  return res as unknown as Response;
}

describe('deleteProtection middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('passes through non-DELETE requests', () => {
    const req = createMockReq('GET', '/api/emails');
    const res = createMockRes();
    deleteProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through POST requests', () => {
    const req = createMockReq('POST', '/api/emails/batch-delete');
    const res = createMockRes();
    deleteProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows DELETE on trash routes (single email)', () => {
    const req = createMockReq('DELETE', '/api/emails/abc123');
    const res = createMockRes();
    deleteProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows DELETE on batch trash route', () => {
    const req = createMockReq('DELETE', '/api/emails/batch');
    const res = createMockRes();
    deleteProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows DELETE on safe metadata routes (categories)', () => {
    const req = createMockReq('DELETE', '/api/categories/123');
    const res = createMockRes();
    deleteProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows DELETE on local DB cleanup routes', () => {
    const req = createMockReq('DELETE', '/api/database/emails');
    const res = createMockRes();
    deleteProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows DELETE on template routes', () => {
    const req = createMockReq('DELETE', '/api/templates/t-456');
    const res = createMockRes();
    deleteProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows unknown DELETE routes (logs warning but does not block)', () => {
    const req = createMockReq('DELETE', '/api/unknown/resource');
    const res = createMockRes();
    deleteProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
