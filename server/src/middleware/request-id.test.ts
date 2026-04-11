import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from './request-id.js';

function createMocks(incomingId?: string) {
  const headers: Record<string, string | undefined> = {};
  if (incomingId) headers['x-request-id'] = incomingId;

  const req = { headers } as unknown as Request;
  const resHeaders: Record<string, string> = {};
  const res = {
    setHeader: vi.fn((key: string, value: string) => {
      resHeaders[key] = value;
    }),
    _resHeaders: resHeaders,
  } as unknown as Response & { _resHeaders: Record<string, string> };
  const next = vi.fn() as NextFunction;

  return { req, res, next, resHeaders };
}

describe('requestIdMiddleware', () => {
  it('generates UUID when no X-Request-ID is present', () => {
    const { req, res, next, resHeaders } = createMocks();
    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.headers['x-request-id']).toBeDefined();
    expect(typeof req.headers['x-request-id']).toBe('string');
    expect((req.headers['x-request-id'] as string).length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.headers['x-request-id']);
  });

  it('uses incoming X-Request-ID when present', () => {
    const { req, res, next } = createMocks('my-custom-id');
    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.headers['x-request-id']).toBe('my-custom-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'my-custom-id');
  });

  it('generates new ID when incoming header is empty string', () => {
    const { req, res, next } = createMocks('');
    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    // Should have generated a UUID, not kept empty string
    expect((req.headers['x-request-id'] as string).length).toBeGreaterThan(0);
    expect(req.headers['x-request-id']).not.toBe('');
  });
});
