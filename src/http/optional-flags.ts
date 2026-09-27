import { getRuntime } from '../services/runtime-settings';
import { isMongoUsersEnabled } from '../services/mongo-users';

const flag = (value: string | undefined): boolean => /^(1|true|yes|on)$/i.test(value || '');

export const isLineGroupRoomsEnabled = (): boolean => flag(getRuntime('LINE_GROUP_ROOMS'));
export const isLineSecondWebhookEnabled = (): boolean => flag(getRuntime('LINE_SECOND_WEBHOOK'));
export const isGraphqlLineIngestEnabled = (): boolean => flag(getRuntime('GRAPHQL_LINE_INGEST'));

export const describeOptionalFlags = () => ({
  LINE_GROUP_ROOMS: isLineGroupRoomsEnabled(),
  LINE_SECOND_WEBHOOK: isLineSecondWebhookEnabled(),
  MONGO_USERS: isMongoUsersEnabled(),
  GRAPHQL_LINE_INGEST: isGraphqlLineIngestEnabled(),
  ENABLE_GRAPHQL: flag(getRuntime('ENABLE_GRAPHQL')),
  ENABLE_API_DOCS: flag(getRuntime('ENABLE_API_DOCS')),
  LINE_WEBHOOK_ASYNC: flag(getRuntime('LINE_WEBHOOK_ASYNC')),
});
