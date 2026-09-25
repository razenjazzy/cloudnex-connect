import { describe, expect, it } from 'vitest';
import { decodeAuditCursor, encodeAuditCursor, matchesAuditLogFilters, parseAuditLogFilters } from '../src/services/audit-query';

describe('audit log query filters', () => {
  it('round-trips an opaque timestamp cursor and rejects invalid cursors', () => {
    const timestamp = '2026-09-04T12:00:00.000Z';
    expect(decodeAuditCursor(encodeAuditCursor(timestamp))).toBe(timestamp);
    expect(decodeAuditCursor('not-a-valid-cursor')).toBeUndefined();
  });

  it('normalizes supported filters and ignores invalid values', () => {
    expect(parseAuditLogFilters({
      action: ' quote_cancel ',
      outcome: 'success',
      actorUserId: ' U-admin ',
      channelId: ' sales ',
      from: '2026-09-01',
      to: 'invalid',
    })).toEqual({
      action: 'quote_cancel',
      outcome: 'success',
      actorUserId: 'U-admin',
      channelId: 'sales',
      from: '2026-09-01T00:00:00.000Z',
      to: undefined,
    });
  });

  it('matches action, actor, channel, outcome, and time bounds', () => {
    const entry = {
      action: 'quote_cancel',
      outcome: 'success',
      actorUserId: 'U-admin',
      channelId: 'sales',
      createdAt: '2026-09-04T12:00:00.000Z',
    };

    expect(matchesAuditLogFilters(entry, parseAuditLogFilters({
      action: 'quote_cancel',
      outcome: 'success',
      actorUserId: 'U-admin',
      channelId: 'sales',
      from: '2026-09-04T00:00:00.000Z',
      to: '2026-09-04T23:59:59.000Z',
    }))).toBe(true);
    expect(matchesAuditLogFilters(entry, { outcome: 'failure' })).toBe(false);
  });

  it('matches userId as actor or as target', () => {
    const asActor = { action: 'role_grant', actorUserId: 'U05594', createdAt: '2026-09-04T12:00:00.000Z' };
    const asTarget = { action: 'role_grant', actorUserId: 'U-admin', targetId: 'U05594', createdAt: '2026-09-04T12:00:00.000Z' };
    expect(matchesAuditLogFilters(asActor, parseAuditLogFilters({ userId: 'U05594' }))).toBe(true);
    expect(matchesAuditLogFilters(asTarget, parseAuditLogFilters({ userId: 'U05594' }))).toBe(true);
    expect(matchesAuditLogFilters(asTarget, parseAuditLogFilters({ userId: 'U-other' }))).toBe(false);
  });
});