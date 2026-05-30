import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mock error-mailer BEFORE importing the route ────────────────────────────
vi.mock('../../lib/error-mailer.js', () => ({
  sendErrorReport: vi.fn().mockResolvedValue(undefined),
}));

// Import after mock is hoisted
import errorReportRouter from '../error-report.routes.js';
import { sendErrorReport } from '../../lib/error-mailer.js';

// ─── Minimal test app ────────────────────────────────────────────────────────
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/error-report', errorReportRouter);
  return app;
}

const NORMAL_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';

describe('POST /error-report', () => {
  let app: ReturnType<typeof createApp>;
  const sendErrorReportMock = sendErrorReport as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  it('bingbot UA → 204, sendErrorReport NEM hívva', async () => {
    const res = await request(app)
      .post('/error-report')
      .set('User-Agent', BOT_UA)
      .send({ errorType: 'chunk', message: 'some error', stack: '' });

    expect(res.status).toBe(204);
    expect(sendErrorReportMock).not.toHaveBeenCalled();
  });

  it('normál UA + stale-chunk message → 204, sendErrorReport NEM hívva', async () => {
    const res = await request(app).post('/error-report').set('User-Agent', NORMAL_UA).send({
      errorType: 'chunk',
      message: 'Failed to fetch dynamically imported module',
      stack: '',
    });

    expect(res.status).toBe(204);
    expect(sendErrorReportMock).not.toHaveBeenCalled();
  });

  it('normál UA + normál message → 200, sendErrorReport HÍVVA', async () => {
    const res = await request(app).post('/error-report').set('User-Agent', NORMAL_UA).send({
      errorType: 'runtime',
      message: 'Cannot read property foo of undefined',
      stack: 'Error: ...',
      url: 'https://app.example.com/inbox',
      userId: 'user-123',
    });

    expect(res.status).toBe(200);
    expect(sendErrorReportMock).toHaveBeenCalledTimes(1);
    expect(sendErrorReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'runtime',
        message: 'Cannot read property foo of undefined',
      }),
    );
  });

  it('normál UA + üres errorType → 200, sendErrorReport hívva errorType: "unknown"-nal', async () => {
    const res = await request(app).post('/error-report').set('User-Agent', NORMAL_UA).send({
      message: 'Cannot read property bar of null',
      stack: '',
    });

    expect(res.status).toBe(200);
    expect(sendErrorReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ errorType: 'unknown' }),
    );
  });

  it('UA > 2048 karakter → 204, sendErrorReport NEM hívva', async () => {
    const longUa = 'X'.repeat(2049);
    const res = await request(app)
      .post('/error-report')
      .set('User-Agent', longUa)
      .send({ errorType: 'runtime', message: 'real error', stack: '' });

    expect(res.status).toBe(204);
    expect(sendErrorReportMock).not.toHaveBeenCalled();
  });

  it('ChunkLoadError message → 204, sendErrorReport NEM hívva', async () => {
    const res = await request(app).post('/error-report').set('User-Agent', NORMAL_UA).send({
      errorType: 'chunk',
      message: 'ChunkLoadError: Loading chunk 7 failed',
      stack: '',
    });

    expect(res.status).toBe(204);
    expect(sendErrorReportMock).not.toHaveBeenCalled();
  });
});
