import { executeKwRead, getOdooConfig, loginRead } from './client';
import type { ErpDeliveryStatus } from '../../erp/adapter';

const manyName = (value: unknown): string | undefined => {
  if (Array.isArray(value) && typeof value[1] === 'string' && value[1].trim()) return value[1].trim();
  return undefined;
};

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const mapPickingRow = (row: Record<string, unknown>): ErpDeliveryStatus => {
  const scheduled = str(row.scheduled_date) || undefined;
  const done = str(row.date_done) || undefined;
  return {
    pickingName: str(row.name) || 'WH/OUT',
    state: str(row.state) || 'unknown',
    ...(scheduled ? { scheduledDate: scheduled } : {}),
    ...(done ? { doneDate: done } : {}),
    ...(manyName(row.carrier_id) ? { carrier: manyName(row.carrier_id) } : {}),
    ...(str(row.carrier_tracking_ref) ? { trackingRef: str(row.carrier_tracking_ref) } : {}),
    ...(manyName(row.user_id) ? { responsible: manyName(row.user_id) } : {}),
  };
};

export const getOutgoingPickingForOrder = async (orderName: string): Promise<ErpDeliveryStatus | null> => {
  const config = getOdooConfig();
  if (!config || !orderName.trim()) return null;
  const uid = await loginRead(config);
  if (!uid) return null;
  const rows = await executeKwRead<Array<Record<string, unknown>>>(
    config,
    uid,
    'stock.picking',
    'search_read',
    [[['origin', '=', orderName.trim()], ['picking_type_code', '=', 'outgoing']]],
    {
      fields: ['name', 'state', 'scheduled_date', 'date_done', 'carrier_id', 'carrier_tracking_ref', 'user_id'],
      limit: 1,
      order: 'id desc',
    },
  );
  const row = rows[0];
  return row ? mapPickingRow(row) : null;
};
