import { CUSTOMER_CHANNEL_ID } from './channels';
import { setUserSalesTier } from '../services/firestore';
import type { UserProfile } from '../services/firestore/types';
import { findOdooSalesTierByPartnerId } from '../services/odoo/admin';

type QuoteActor = Pick<UserProfile, 'role' | 'salesTier'>;
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
  customerName: (profile.displayName || 'LINE Customer').trim(),
  phone: (profile.phone || '').trim(),
});

/** Customer OA quote form is product + qty only (C3). Staff still get optional fields. */
export const customerQuoteFormStepCount = (flowKey: string, fieldCount: number, profile: QuoteActor): number =>
  flowKey === 'QUOTE_CREATE' && !isQuoteStaff(profile) ? 2 : fieldCount;

export const customerQuoteSkipsOptionalSummary = (flowKey: string, profile: QuoteActor): boolean =>
  flowKey === 'QUOTE_CREATE' && !isQuoteStaff(profile);

/** Non-staff may only see SOs for their linked Odoo partner. */
export const canViewOrderAsCustomer = (profile: QuoteOwner, orderPartnerId: number | undefined): boolean => {
  if (isQuoteStaff(profile)) return true;
  return Boolean(profile.odooPartnerId && orderPartnerId && profile.odooPartnerId === orderPartnerId);
};

/**
 * Refresh Odoo login vs customer onto the Firestore profile. A linked
 * res.users is Sales staff; a contact with no login stays a customer.
 * Customer OA never stores a sales tier.
 */
export const syncStaffProfile = async (userId: string, profile: UserProfile, channelId?: string): Promise<UserProfile> => {
  if (channelId === CUSTOMER_CHANNEL_ID) {
    if (profile.salesTier) await setUserSalesTier(userId, undefined);
    return applyChannelPersona(profile, channelId);
  }
  if (!profile.odooPartnerId) return profile;
  const salesTier = await findOdooSalesTierByPartnerId(profile.odooPartnerId);
  if (salesTier !== profile.salesTier) await setUserSalesTier(userId, salesTier);
  return { ...profile, salesTier };
};
