import type { Express, Request } from 'express';
import { graphqlSchema, type GraphqlContext } from '../graphql/schema';
import { isValidAdminToken } from '../services/admin-token-auth';
import { getOpsBearerOrHeaderToken, isValidOpsToken } from '../services/ops-token-auth';
import { isGraphqlEnabled, isGraphiqlEnabled, isDemoControlEnabled } from './env';
import { appLogger } from '../services/logger';
import { verifyIncomingDemoSession } from './demo-session';

const contextFromRequest = async (req: Request): Promise<GraphqlContext> => {
  const opsToken = getOpsBearerOrHeaderToken(req);
  const bearer = req.get('authorization')?.startsWith('Bearer ') ? req.get('authorization')!.substring(7) : '';
  let opsOk = isValidOpsToken(opsToken);
  if (!opsOk && isDemoControlEnabled && req.get('cookie')) {
    const { sessionAuthenticated } = await verifyIncomingDemoSession(req);
    opsOk = sessionAuthenticated;
  }
  return {
    opsOk,
    adminOk: isValidAdminToken(bearer),
  };
};

export const registerGraphqlRoutes = async (app: Express): Promise<void> => {
  if (!isGraphqlEnabled) return;

  const { createYoga } = await import('graphql-yoga');
  const yoga = createYoga({
    schema: graphqlSchema,
    graphqlEndpoint: '/graphql',
    graphiql: isGraphiqlEnabled,
    context: async ({ request }) => {
      const authorization = request.headers.get('authorization') || '';
      const xOps = request.headers.get('x-ops-token') || '';
      const cookie = request.headers.get('cookie') || '';
      const fakeReq = {
        get: (name: string) => {
          const lower = name.toLowerCase();
          if (lower === 'authorization') return authorization;
          if (lower === 'x-ops-token') return xOps;
          if (lower === 'cookie') return cookie;
          return undefined;
        },
      } as Request;
      return contextFromRequest(fakeReq);
    },
  });

  app.use(yoga.graphqlEndpoint, yoga);
  appLogger.info('graphql_mounted', { endpoint: yoga.graphqlEndpoint });
};
