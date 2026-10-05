import { CUSTOMER_CHANNEL_ID } from './channels';
import { getDefaultCustomerName } from './default-contact';
import { setUserSalesTier } from '../services/firestore';
import type { UserProfile } from '../services/firestore/types';
import { findOdooSalesTierByPartnerId } from '../services/odoo/admin';

type QuoteActor = Pick<UserProfile, 'role' | 'salesTier'> & { odooVerified?: boolean };
type QuoteOwner = Pick<UserProfile, 'role' | 'salesTier' | 'odooPartnerId' | 'displayName' | 'phone'>;

/** Customer OA never runs Sales User / Admin tools, even if the Odoo contact has a sales login. */
export const applyChannelPersona = (profile: UserProfile, channelId?: string): UserProfile => {
  if (channelId !== CUSTOMER_CHANNEL_ID) return profile;
  return { ...profile, salesTier: undefined, role: 'user' };
};

/** Odoo Sales User or Sales Administrator. LINE `role=admin` is extra, not required. */
export const isQuoteStaff = (profile: QuoteActor): boolean =>
  profile.salesTier === 'salesperson'
  || profile.salesTier === 'sales_manager'
  || profile.role === 'admin';

/** Edit/cancel quote lines — Odoo Sales Administrator (or LINE admin). Sales User cannot cancel. */
export const canManageQuoteLines = (profile: QuoteActor): boolean =>
  profile.salesTier === 'sales_manager' || profile.role === 'admin';

/** Flex journey-card viewer: staff (Confirm/Send) vs the customer (Approve). */
export const quoteJourneyRole = (profile: QuoteActor): 'admin' | 'customer' =>
  isQuoteStaff(profile) ? 'admin' : 'customer';

/** Name/phone for a customer self-quote — never collected as staff form fields. */
export const selfQuoteIdentity = (profile: Pick<UserProfile, 'displayName' | 'phone'>): { customerName: string; phone: string } => ({
  customerName: (profile.displayName || getDefaultCustomerName()).trim(),
  phone: (profile.phone || '').trim(),
});

/** Customer OA: verified C3 is product + qty only. Guests collect name and phone (4 steps). Staff get optional fields. */
export const customerQuoteFormStepCount = (flowKey: string, fieldCount: number, profile: QuoteActor): number => {
  if (flowKey !== 'QUOTE_CREATE' || isQuoteStaff(profile)) return fieldCount;
  return profile.odooVerified ? 2 : 4;
};

export const customerQuoteSkipsOptionalSummary = (flowKey: string, profile: QuoteActor): boolean =>
  flowKey === 'QUOTE_CREATE' && !isQuoteStaff(profile);

/** Verified Customer OA C3: product + qty only. Guests still collect name and phone. */
export const skipsCustomerQuoteIdentityFields = (profile: QuoteActor): boolean =>
  !isQuoteStaff(profile) && profile.odooVerified === true;

/**
 * Advance past name/phone when C3 says to skip them.
 * The `!skipsCustomerQuoteIdentityFields` guard means: guests and staff keep the index;
 * only a verified non-staff customer jumps those two fields.
 */
export const skipCustomerQuoteIdentityIndex = (
  flowKey: string,
  fields: ReadonlyArray<{ key: string }>,
  index: number,
  profile: QuoteActor,
): number => {
  if (flowKey !== 'QUOTE_CREATE' || !skipsCustomerQuoteIdentityFields(profile)) return index;
  let i = index;
  while (i < fields.length) {
    const key = fields[i].key;
    if (key !== 'customerName' && key !== 'phone') break;
    i += 1;
  }
  return i;
};

/** Non-staff may only see SOs for their linked Odoo partner. */
export const canViewOrderAsCustomer = (profile: QuoteOwner, orderPartnerId: number | undefined): boolean => {
  if (isQuoteStaff(profile)) return true;
  const viewer = Number(profile.odooPartnerId);
  const owner = Number(orderPartnerId);
  return Number.isFinite(viewer) && viewer > 0 && viewer === owner;
};

/**
 * Refresh Odoo login vs customer onto the Firestore profile. A linked
 * res.users is Sales staff; a contact with no login stays a customer.
 * Customer OA never stores a sales tier.
 */
const STAFF_SYNC_MS = 5 * 60 * 1000;
const staffSyncCache = new Map<string, { at: number; salesTier: UserProfile['salesTier'] }>();

export const syncStaffProfile = async (userId: string, profile: UserProfile, channelId?: string): Promise<UserProfile> => {
  if (channelId === CUSTOMER_CHANNEL_ID) {
    if (profile.salesTier) await setUserSalesTier(userId, undefined);
    return applyChannelPersona(profile, channelId);
  }
  if (!profile.odooPartnerId) return profile;
  const cached = staffSyncCache.get(userId);
  if (cached && Date.now() - cached.at < STAFF_SYNC_MS) {
    return { ...profile, salesTier: cached.salesTier };
  }
  const salesTier = await findOdooSalesTierByPartnerId(profile.odooPartnerId);
  staffSyncCache.set(userId, { at: Date.now(), salesTier });
  if (salesTier !== profile.salesTier) await setUserSalesTier(userId, salesTier);
  return { ...profile, salesTier };
};
