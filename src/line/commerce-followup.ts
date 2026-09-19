import { messagingApi } from '@line/bot-sdk';
import { getServiceDefinition, getVisibleCommands, isServiceEnabledForChannel } from '../services/service-catalog';
import { createServiceActionFlexMessage, createProductCarouselFlexMessage } from './templates';
import { isQuoteStaff } from './quote-access';
import { getErpAdapter } from '../erp/registry';
import type { ChannelContext } from './channels';
import type { UserLanguage, UserProfile } from '../services/firestore';

type CommerceFollowCtx = {
  userLanguage: UserLanguage;
  channel?: ChannelContext;
  profile: UserProfile;
};

export const commerceFollowUpMessages = async (
  ctx: CommerceFollowCtx,
  room = 2,
): Promise<messagingApi.Message[]> => {
  if (room <= 0) return [];
  const { userLanguage, channel, profile } = ctx;
  const serviceDef = getServiceDefinition('commerce');
  const isAdmin = profile.role === 'admin';
  const isStaff = isQuoteStaff(profile);
  const visibleCommands = serviceDef ? getVisibleCommands(serviceDef, isAdmin, isStaff) : [];
  if (!serviceDef || !isServiceEnabledForChannel(serviceDef.key, channel) || !visibleCommands.length) return [];
  const actionMenu = createServiceActionFlexMessage(
    userLanguage === 'en' ? serviceDef.labelEn : serviceDef.labelTh,
    visibleCommands.map(c => ({ text: c.text, label: userLanguage === 'en' ? c.labelEn : c.labelTh })),
    userLanguage,
  );
  const messages: messagingApi.Message[] = [];
  if (!isStaff && room >= 2) {
    const catalog = await getErpAdapter().searchProducts('', 10);
    if (catalog.length) messages.push(createProductCarouselFlexMessage(catalog, userLanguage));
  }
  messages.push(actionMenu);
  return messages.slice(0, room);
};

export const catalogFollowUpMessages = async (
  ctx: CommerceFollowCtx,
  room = 2,
): Promise<messagingApi.Message[]> => {
  if (room <= 0) return [];
  const { userLanguage, channel, profile } = ctx;
  const serviceDef = getServiceDefinition('catalog');
  const isAdmin = profile.role === 'admin';
  const isStaff = isQuoteStaff(profile);
  const visibleCommands = serviceDef ? getVisibleCommands(serviceDef, isAdmin, isStaff) : [];
  if (!serviceDef || !isServiceEnabledForChannel(serviceDef.key, channel) || !visibleCommands.length) return [];
  const actionMenu = createServiceActionFlexMessage(
    userLanguage === 'en' ? serviceDef.labelEn : serviceDef.labelTh,
    visibleCommands.map(c => ({ text: c.text, label: userLanguage === 'en' ? c.labelEn : c.labelTh })),
    userLanguage,
  );
  const messages: messagingApi.Message[] = [];
  if (room >= 2) {
    const services = await getErpAdapter().listServices(10);
    if (services.length) {
      messages.push(createProductCarouselFlexMessage(services, userLanguage, item => `SERVICE READ ${item.sku || item.name}`));
    }
  }
  messages.push(actionMenu);
  return messages.slice(0, room);
};
