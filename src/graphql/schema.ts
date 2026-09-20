import { GraphQLError, GraphQLObjectType, GraphQLSchema, GraphQLString, GraphQLInt, GraphQLBoolean, GraphQLNonNull, GraphQLScalarType, Kind } from 'graphql';
import { getKpiSnapshot } from '../services/kpi';
import { listRecentAuditEventsPage } from '../services/firestore';
import { parseAuditLogFilters, decodeAuditCursor } from '../services/audit-query';
import { runAuditRotationJob } from '../jobs/audit-rotation';
import { runDailyReport } from '../jobs/daily-report';
import { seedOdooSampleSalesDataWithAudit } from '../services/seed-odoo';
import { ensureDemoSessionStateLoaded, rotateDemoSessionSecret } from '../http/demo-session';
import { buildWorkflowAudit } from '../http/workflow-audit';
import { demoSessionRotateGraceDefaultMinutes, isOpsJobsAsync, appEnv } from '../http/env';
import { enqueueOpsJob } from '../jobs/queue';
import { getDemoPlatformPayload } from '../platform/service-modules';
import { getPlatformStatus } from '../platform/status';
import { getErpAdapter } from '../erp/registry';
import { recordAuditEvent } from '../services/firestore';
import { isOdooConfigured } from '../services/odoo';

const GraphQLJSON = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  parseValue: (value) => value,
  serialize: (value) => value,
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? ast.value : null),
});

export type GraphqlContext = {
  opsOk: boolean;
  adminOk: boolean;
};

const requireOps = (ctx: GraphqlContext): void => {
  if (!ctx.opsOk) {
    throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
  }
};

const requireAdmin = (ctx: GraphqlContext): void => {
  if (!ctx.adminOk) {
    throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
  }
};

const runOrEnqueueJob = async (name: 'daily-report' | 'segmentation' | 'seed-odoo' | 'audit-rotate', run: () => Promise<unknown>): Promise<unknown> => {
  if (isOpsJobsAsync) {
    const jobId = await enqueueOpsJob(name);
    return { ok: true, accepted: true, jobId };
  }
  return run();
};

const Query = new GraphQLObjectType({
  name: 'Query',
  fields: {
    healthz: {
      type: GraphQLJSON,
      resolve: () => ({
        ok: true,
        service: 'cloudnex-connect',
        environment: appEnv,
        appEnv,
        nodeEnv: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      }),
    },
    kpi: {
      type: GraphQLJSON,
      resolve: (_src, _args, ctx: GraphqlContext) => {
        requireOps(ctx);
        return getKpiSnapshot();
      },
    },
    workflowAudit: {
      type: GraphQLJSON,
      resolve: async (_src, _args, ctx: GraphqlContext) => {
        requireOps(ctx);
        await ensureDemoSessionStateLoaded();
        return buildWorkflowAudit();
      },
    },
    auditLog: {
      type: GraphQLJSON,
      args: { limit: { type: GraphQLInt }, cursor: { type: GraphQLString } },
      resolve: async (_src, args: { limit?: number; cursor?: string }, ctx: GraphqlContext) => {
        requireOps(ctx);
        const page = await listRecentAuditEventsPage(
          args.limit || 50,
          parseAuditLogFilters({}),
          decodeAuditCursor(args.cursor),
        );
        return { ...page, count: page.events.length };
      },
    },
    platformModules: {
      type: GraphQLJSON,
      resolve: (_src, _args, ctx: GraphqlContext) => {
        requireOps(ctx);
        return getDemoPlatformPayload();
      },
    },
    platformStatus: {
      type: GraphQLJSON,
      resolve: async (_src, _args, ctx: GraphqlContext) => {
        requireOps(ctx);
        return getPlatformStatus();
      },
    },
    crmQuotes: {
      type: GraphQLJSON,
      args: {
        state: { type: GraphQLString },
        unassigned: { type: GraphQLBoolean },
        limit: { type: GraphQLInt },
      },
      resolve: async (_src, args: { state?: string; unassigned?: boolean; limit?: number }, ctx: GraphqlContext) => {
        requireOps(ctx);
        if (!isOdooConfigured()) {
          throw new GraphQLError('Odoo is unavailable', { extensions: { code: 'UNAVAILABLE' } });
        }
        const list = getErpAdapter().listQuotations;
        if (!list) {
          throw new GraphQLError('CRM quotations are not supported', { extensions: { code: 'UNAVAILABLE' } });
        }
        const quotes = await list({
          state: args.state,
          unassigned: args.unassigned,
          limit: args.limit,
        });
        return { quotes, count: quotes.length };
      },
    },
  },
});

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    rotateAuditLog: {
      type: GraphQLJSON,
      resolve: async (_src, _args, ctx: GraphqlContext) => {
        requireOps(ctx);
        return runOrEnqueueJob('audit-rotate', () => runAuditRotationJob('graphql'));
      },
    },
    rotateDemoSession: {
      type: GraphQLJSON,
      args: {
        newSecret: { type: new GraphQLNonNull(GraphQLString) },
        graceMinutes: { type: GraphQLInt },
      },
      resolve: async (_src, args: { newSecret: string; graceMinutes?: number }, ctx: GraphqlContext) => {
        requireOps(ctx);
        await ensureDemoSessionStateLoaded();
        return rotateDemoSessionSecret(args.newSecret, args.graceMinutes ?? demoSessionRotateGraceDefaultMinutes);
      },
    },
    triggerDailyReport: {
      type: GraphQLJSON,
      resolve: async (_src, _args, ctx: GraphqlContext) => {
        requireAdmin(ctx);
        return runOrEnqueueJob('daily-report', async () => {
          await runDailyReport();
          return { ok: true, message: 'Daily report triggered successfully' };
        });
      },
    },
    triggerSegmentation: {
      type: GraphQLJSON,
      resolve: async (_src, _args, ctx: GraphqlContext) => {
        requireAdmin(ctx);
        return runOrEnqueueJob('segmentation', async () => {
          const { runSegmentationJob } = await import('../jobs/segmentation');
          await runSegmentationJob();
          return { ok: true, message: 'Segmentation job triggered successfully' };
        });
      },
    },
    triggerSeedOdoo: {
      type: GraphQLJSON,
      resolve: async (_src, _args, ctx: GraphqlContext) => {
        requireAdmin(ctx);
        return runOrEnqueueJob('seed-odoo', async () => {
          const status = await seedOdooSampleSalesDataWithAudit('graphql');
          return { ok: true, message: status };
        });
      },
    },
    assignCrmQuote: {
      type: GraphQLJSON,
      args: {
        id: { type: new GraphQLNonNull(GraphQLInt) },
        salespersonUserId: { type: GraphQLInt },
      },
      resolve: async (_src, args: { id: number; salespersonUserId?: number | null }, ctx: GraphqlContext) => {
        requireOps(ctx);
        const assign = getErpAdapter().assignQuotationSalesperson;
        if (!assign) {
          throw new GraphQLError('CRM assign is not supported', { extensions: { code: 'UNAVAILABLE' } });
        }
        const salespersonUserId = args.salespersonUserId == null ? null : args.salespersonUserId;
        const ok = await assign(args.id, salespersonUserId);
        recordAuditEvent({
          action: 'crm_quote_assign',
          outcome: ok ? 'success' : 'failure',
          actorUserId: 'ops',
          targetId: String(args.id),
          detail: salespersonUserId == null ? 'unassign' : 'assign',
        });
        if (!ok) {
          throw new GraphQLError('Assign failed', { extensions: { code: 'UNAVAILABLE' } });
        }
        return { ok: true, id: args.id, salespersonUserId };
      },
    },
  },
});

export const graphqlSchema = new GraphQLSchema({ query: Query, mutation: Mutation });
