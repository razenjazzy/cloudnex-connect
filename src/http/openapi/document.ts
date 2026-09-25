import { demoSessionRotateBodySchema, errorResponseSchema, healthzResponseSchema, jobAcceptedSchema, readyzResponseSchema, toOpenApiSchema } from './schemas';

type OpenApiPath = {
  [method: string]: {
    tags: string[];
    summary: string;
    security?: Array<Record<string, string[]>>;
    parameters?: Array<Record<string, unknown>>;
    requestBody?: Record<string, unknown>;
    responses: Record<string, unknown>;
  };
};

const jsonResponse = (schema: Record<string, unknown>, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

const bearer = [{ bearerAuth: [] as string[] }];

const opsPaths: Record<string, OpenApiPath> = {
  '/healthz': {
    get: {
      tags: ['health'],
      summary: 'Liveness probe',
      responses: { '200': jsonResponse(toOpenApiSchema(healthzResponseSchema), 'Service is up') },
    },
  },
  '/readyz': {
    get: {
      tags: ['health'],
      summary: 'Readiness probe',
      responses: {
        '200': jsonResponse(toOpenApiSchema(readyzResponseSchema), 'Ready'),
        '503': jsonResponse(toOpenApiSchema(readyzResponseSchema), 'Not ready'),
      },
    },
  },
  '/ops/kpi': {
    get: {
      tags: ['ops'],
      summary: 'KPI snapshot',
      security: bearer,
      responses: {
        '200': { description: 'KPI counters since process start' },
        '401': jsonResponse(toOpenApiSchema(errorResponseSchema), 'Unauthorized'),
      },
    },
  },
  '/ops/audit-log': {
    get: {
      tags: ['ops'],
      summary: 'Recent audit events',
      security: bearer,
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
        { name: 'action', in: 'query', schema: { type: 'string' } },
        { name: 'outcome', in: 'query', schema: { type: 'string', enum: ['success', 'failure'] } },
        { name: 'actorUserId', in: 'query', schema: { type: 'string' } },
        { name: 'channelId', in: 'query', schema: { type: 'string' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
      ],
      responses: {
        '200': { description: 'Paged audit events' },
        '401': jsonResponse(toOpenApiSchema(errorResponseSchema), 'Unauthorized'),
      },
    },
  },
  '/ops/audit-log/rotate': {
    post: {
      tags: ['ops'],
      summary: 'Archive and rotate audit log',
      security: bearer,
      responses: { '200': { description: 'Rotation result' }, '401': jsonResponse(toOpenApiSchema(errorResponseSchema), 'Unauthorized') },
    },
  },
  '/ops/demo-session/rotate': {
    post: {
      tags: ['ops'],
      summary: 'Rotate demo session secret',
      security: bearer,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: toOpenApiSchema(demoSessionRotateBodySchema) } },
      },
      responses: { '200': { description: 'Rotated' }, '400': jsonResponse(toOpenApiSchema(errorResponseSchema), 'Invalid body') },
    },
  },
  '/ops/workflow-audit': {
    get: {
      tags: ['ops'],
      summary: 'Security and readiness self-check',
      security: bearer,
      responses: { '200': { description: 'Workflow audit payload' } },
    },
  },
  '/ops/platform': {
    get: {
      tags: ['ops'],
      summary: 'Full platform status (probes, flags, modules)',
      security: bearer,
      responses: { '200': { description: 'Platform status snapshot' } },
    },
  },
  '/ops/odoo-hook': {
    post: {
      tags: ['erp'],
      summary: 'Odoo picking.done or approval.stage notify (Sales OA; customer on shipped)',
      security: bearer,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['event', 'orderId'],
              properties: {
                event: { type: 'string', enum: ['picking.done', 'approval.stage'] },
                orderId: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Notified' },
        '400': jsonResponse(toOpenApiSchema(errorResponseSchema), 'Invalid body'),
        '401': jsonResponse(toOpenApiSchema(errorResponseSchema), 'Unauthorized'),
        '404': jsonResponse(toOpenApiSchema(errorResponseSchema), 'Order not found'),
      },
    },
  },
  '/jobs/daily-report': {
    post: {
      tags: ['jobs'],
      summary: 'Trigger daily report',
      security: [{ adminAuth: [] }],
      responses: { '200': jsonResponse(toOpenApiSchema(jobAcceptedSchema), 'Triggered or queued') },
    },
  },
  '/jobs/segmentation': {
    post: {
      tags: ['jobs'],
      summary: 'Trigger segmentation job',
      security: [{ adminAuth: [] }],
      responses: { '200': jsonResponse(toOpenApiSchema(jobAcceptedSchema), 'Triggered or queued') },
    },
  },
  '/jobs/seed-odoo': {
    post: {
      tags: ['jobs'],
      summary: 'Seed Odoo sample sales data',
      security: [{ adminAuth: [] }],
      responses: { '200': jsonResponse(toOpenApiSchema(jobAcceptedSchema), 'Triggered or queued') },
    },
  },
  '/webhook': {
    post: {
      tags: ['line-services'],
      summary: 'LINE HMAC webhook (default / Sales credentials)',
      responses: { '200': { description: 'Accepted' }, '401': { description: 'Invalid signature' } },
    },
  },
  '/webhook/{channelId}': {
    post: {
      tags: ['line-services'],
      summary: 'LINE HMAC webhook for sales or customer',
      parameters: [{ name: 'channelId', in: 'path', required: true, schema: { type: 'string', enum: ['sales', 'customer'] } }],
      responses: { '200': { description: 'Accepted' }, '401': { description: 'Invalid signature' } },
    },
  },
  '/admin/api/bootstrap': {
    post: {
      tags: ['install'],
      summary: 'One-shot install bootstrap (CONNECT_BOOTSTRAP_TOKEN)',
      responses: { '200': { description: 'Bootstrapped' }, '410': { description: 'Already complete' } },
    },
  },
  '/admin/api/settings': {
    get: {
      tags: ['admin'],
      summary: 'Redacted settings (secrets never returned)',
      security: bearer,
      responses: { '200': { description: 'Masked settings and webhook URL table' } },
    },
  },
  '/admin/api/session/line/start': {
    get: {
      tags: ['admin'],
      summary: 'Start LINE Login OAuth (PKCE) for super-admin cookie',
      responses: { '302': { description: 'Redirect to LINE' }, '503': { description: 'Not configured' } },
    },
  },
  '/admin/api/session/oidc/start': {
    get: {
      tags: ['admin'],
      summary: 'Start Okta OIDC authorization code + PKCE',
      responses: { '302': { description: 'Redirect to Okta' }, '503': { description: 'Not configured' } },
    },
  },
  '/admin/api/session/saml/metadata': {
    get: {
      tags: ['admin'],
      summary: 'SAML SP metadata for Okta or other IdP',
      responses: { '200': { description: 'XML metadata' } },
    },
  },
  '/admin/api/session/saml/acs': {
    post: {
      tags: ['admin'],
      summary: 'SAML HTTP-POST ACS (signed assertion, LINE user mapping)',
      responses: { '302': { description: 'Bound or denied' } },
    },
  },
  '/admin/api/session/bind': {
    post: {
      tags: ['admin'],
      summary: 'Send LINE OTP to bind super-admin actor cookie',
      security: bearer,
      responses: { '200': { description: 'OTP pushed' } },
    },
  },
  '/admin/api/secrets/reveal-token': {
    post: {
      tags: ['admin'],
      summary: 'Issue one-time reveal token (super admin cookie)',
      security: bearer,
      responses: { '200': { description: 'Token and TTL' } },
    },
  },
  '/admin/api/secrets/reveal': {
    post: {
      tags: ['admin'],
      summary: 'Consume one-time reveal token (returns secret once)',
      security: bearer,
      responses: { '200': { description: 'Secret for TTL window' }, '410': { description: 'Used or expired' } },
    },
  },
  '/admin/api/session/confirm': {
    post: {
      tags: ['admin'],
      summary: 'Confirm LINE OTP and set httpOnly actor cookie',
      security: bearer,
      responses: { '200': { description: 'Bound' } },
    },
  },
  '/admin/api/audit-log': {
    get: {
      tags: ['admin'],
      summary: 'Ops audit log; secret_reveal_* stripped; never includes secret values',
      security: bearer,
      parameters: [
        { name: 'actorUserId', in: 'query', schema: { type: 'string' } },
        { name: 'action', in: 'query', schema: { type: 'string' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
      ],
      responses: { '200': { description: 'Operational events' } },
    },
  },
};

export const buildOpenApiDocument = (): Record<string, unknown> => ({
  openapi: '3.1.0',
  info: {
    title: 'Cloudnex Connect',
    version: '1.0.0',
    description: 'LINE services, ERP adapter, ops, and Cloudnex Connect Admin. Secrets are never in response examples.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'health' },
    { name: 'install' },
    { name: 'line-services' },
    { name: 'erp' },
    { name: 'admin' },
    { name: 'ops' },
    { name: 'jobs' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'OPS_API_TOKEN' },
      adminAuth: { type: 'http', scheme: 'bearer', description: 'ADMIN_SECRET_TOKEN' },
    },
  },
  paths: opsPaths,
});
