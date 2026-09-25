const flag = (value: string | undefined): boolean => /^(1|true|yes|on)$/i.test(value || '');

export const isLineGroupRoomsEnabled = (): boolean => flag(process.env.LINE_GROUP_ROOMS);
export const isLineSecondWebhookEnabled = (): boolean => flag(process.env.LINE_SECOND_WEBHOOK);
export const isGraphqlLineIngestEnabled = (): boolean => flag(process.env.GRAPHQL_LINE_INGEST);

export const describeOptionalFlags = () => ({
  LINE_GROUP_ROOMS: isLineGroupRoomsEnabled(),
  LINE_SECOND_WEBHOOK: isLineSecondWebhookEnabled(),
  MONGO_USERS: /^(1|true|yes|on)$/i.test(process.env.MONGO_USERS || ''),
  GRAPHQL_LINE_INGEST: isGraphqlLineIngestEnabled(),
});
