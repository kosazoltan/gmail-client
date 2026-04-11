/**
 * OpenAPI / Swagger configuration for ZMail API.
 * Generates spec from JSDoc annotations in route files.
 */
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ZMail API',
      version: '1.0.0',
      description:
        'ZMail (mindenes.org) — Gmail kliens API. Levelezés, naptár, AI funkciók, automatizáció.',
      contact: {
        name: 'Kósa Zoltán',
        email: 'kosa.zoltan.ebc@gmail.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development',
      },
      {
        url: 'https://mail.mindenes.org',
        description: 'Production',
      },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Express session cookie — Google OAuth 2.0 login szükséges',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Hibaüzenet' },
          },
        },
        Email: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Gmail message ID' },
            threadId: { type: 'string' },
            subject: { type: 'string' },
            from: { type: 'string' },
            fromName: { type: 'string', nullable: true },
            to: { type: 'string' },
            date: { type: 'integer', format: 'int64', description: 'Unix timestamp (ms)' },
            snippet: { type: 'string' },
            isRead: { type: 'boolean' },
            isStarred: { type: 'boolean' },
            labels: { type: 'array', items: { type: 'string' } },
            hasAttachments: { type: 'boolean' },
          },
        },
        Account: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            displayName: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            isDefault: { type: 'boolean' },
            syncStatus: {
              type: 'string',
              enum: ['idle', 'syncing', 'error'],
            },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            color: { type: 'string', nullable: true },
            isSystem: { type: 'boolean' },
            emailCount: { type: 'integer' },
          },
        },
        Template: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
            variables: { type: 'array', items: { type: 'string' } },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            uptime: { type: 'number', description: 'Process uptime (seconds)' },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string' },
            database: { type: 'string', enum: ['connected', 'disconnected'] },
          },
        },
      },
    },
    security: [{ sessionAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Google OAuth hitelesítés' },
      { name: 'Emails', description: 'Levelek CRUD + szinkronizálás' },
      { name: 'Accounts', description: 'Email fiókok kezelése' },
      { name: 'Categories', description: 'Kategóriák / címkék' },
      { name: 'Templates', description: 'Email sablonok' },
      { name: 'Search', description: 'Keresés' },
      { name: 'Calendar', description: 'Naptár események' },
      { name: 'AI', description: 'AI chat és intelligens funkciók' },
      { name: 'Automation', description: 'Workflow, szabályok, feladatok' },
      { name: 'System', description: 'Health check, audit, settings' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'ZMail API Docs',
    }),
  );

  // JSON endpoint for programmatic access
  app.get('/api-docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });

  console.log('[ZMail] Swagger UI available at /api-docs');
}
