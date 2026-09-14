import { describe, expect, it } from 'vitest';
import { mapPickingRow } from '../src/services/odoo/delivery';
import { parseOdooHookBody } from '../src/http/odoo-hook';

describe('mapPickingRow', () => {
  it('maps outgoing picking fields without inventing a carrier API', () => {
    expect(mapPickingRow({
      name: 'WH/OUT/0001',
      state: 'done',
      scheduled_date: '2026-09-20 08:00:00',
      date_done: '2026-09-20 10:00:00',
      carrier_id: [3, 'Company vehicle'],
      carrier_tracking_ref: 'FREE-TEXT-1',
      user_id: [9, 'Driver A'],
    })).toEqual({
      pickingName: 'WH/OUT/0001',
      state: 'done',
      scheduledDate: '2026-09-20 08:00:00',
      doneDate: '2026-09-20 10:00:00',
      carrier: 'Company vehicle',
      trackingRef: 'FREE-TEXT-1',
      responsible: 'Driver A',
    });
  });
});

describe('parseOdooHookBody', () => {
  it('accepts picking.done and approval.stage with orderId', () => {
    expect(parseOdooHookBody({ event: 'picking.done', orderId: 17 })).toEqual({ event: 'picking.done', orderId: 17 });
    expect(parseOdooHookBody({ event: 'approval.stage', orderId: 17 })).toEqual({ event: 'approval.stage', orderId: 17 });
  });

  it('rejects unknown events and missing orderId', () => {
    expect(parseOdooHookBody({ event: 'invoice.create', orderId: 17 })).toBeNull();
    expect(parseOdooHookBody({ event: 'picking.done' })).toBeNull();
    expect(parseOdooHookBody({})).toBeNull();
  });
});
