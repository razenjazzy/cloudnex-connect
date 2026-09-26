import { afterEach, describe, expect, it } from 'vitest';
import {
  recordChannelInbound,
  resetChannelTrafficForTests,
  snapshotChannelTraffic,
} from '../src/services/channel-traffic';
import { resetRuntimeSettingsForTests } from '../src/services/runtime-settings';

describe('channel traffic snapshot', () => {
  afterEach(() => {
    resetChannelTrafficForTests();
    resetRuntimeSettingsForTests({});
  });

  it('counts unique active users and inbound volume by Official Account', () => {
    const prev = process.env.LINE_IDLE_HOME_SECONDS;
    process.env.LINE_IDLE_HOME_SECONDS = '3600';
    const t0 = Date.parse('2026-09-26T10:00:00.000Z');
    recordChannelInbound('sales', 'Ua', t0);
    recordChannelInbound('sales', 'Ua', t0 + 1000);
    recordChannelInbound('customer', 'Ub', t0 + 2000);
    recordChannelInbound('default', 'Uc', t0 + 3000);
    const snap = snapshotChannelTraffic(t0 + 4000);
    expect(snap.activeUsers.sales).toBe(1);
    expect(snap.activeUsers.customer).toBe(2);
    expect(snap.activeUsers.total).toBe(3);
    expect(snap.messages.sales).toBe(2);
    expect(snap.messages.customer).toBe(2);
    expect(snap.messages.total).toBe(4);
    expect(snap.hourly.some(row => row.total > 0)).toBe(true);
    if (prev === undefined) delete process.env.LINE_IDLE_HOME_SECONDS;
    else process.env.LINE_IDLE_HOME_SECONDS = prev;
  });

  it('drops users outside the idle window', () => {
    const prev = process.env.LINE_IDLE_HOME_SECONDS;
    process.env.LINE_IDLE_HOME_SECONDS = '60';
    const t0 = Date.parse('2026-09-26T10:00:00.000Z');
    recordChannelInbound('sales', 'Ua', t0);
    const later = snapshotChannelTraffic(t0 + 61_000);
    expect(later.activeUsers.total).toBe(0);
    expect(later.messages.sales).toBe(1);
    if (prev === undefined) delete process.env.LINE_IDLE_HOME_SECONDS;
    else process.env.LINE_IDLE_HOME_SECONDS = prev;
  });
});
