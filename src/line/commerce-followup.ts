import { messagingApi } from '@line/bot-sdk';
import { getServiceDefinition, getVisibleCommands, isServiceEnabledForChannel, serviceMenuLabel } from '../services/service-catalog';
import { createServiceActionFlexMessage, createProductCarouselFlexMessage, createBotTextFlexMessage } from './templates';
import { isQuoteStaff } from './quote-access';
import { getErpAdapter } from '../erp/registry';
import { sendTargetedFlexMessage } from './messaging';
import { DEFAULT_CHANNEL_ID, type ChannelContext } from './channels';
import type { UserLanguage, UserProfile } from '../services/firestore';
import { appLogger } from '../services/logger';
import { overlayLabelForText } from './command-overlay';

type CommerceFollowCtx = {
  userId?: string;
  userLanguage: UserLanguage;
  channel?: ChannelContext;
  profile: UserProfile;
  requestId?: string;
  pendingCatalogPush?: boolean;
};

const trayGenerationByUser = new Map<string, string>();

export const noteTrayGeneration = (userId: string, generation: string): void => {
  trayGenerationByUser.set(userId, generation);
};

export const currentTrayGeneration = (userId: string): string | undefined => trayGenerationByUser.get(userId);

const commerceActionMenu = (ctx: CommerceFollowCtx) => {
  const { userLanguage, channel, profile } = ctx;
  const serviceDef = getServiceDefinition('commerce');
  const isAdmin = profile.role === 'admin';
  const isStaff = isQuoteStaff(profile);
  const visibleCommands = serviceDef ? getVisibleCommands(serviceDef, isAdmin, isStaff) : [];
  if (!serviceDef || !isServiceEnabledForChannel(serviceDef.key, channel) || !visibleCommands.length) return null;
  return createServiceActionFlexMessage(
    overlayLabelForText(`NAV COMMERCE`, userLanguage, serviceMenuLabel(serviceDef, userLanguage, channel?.channelId)),
    visibleCommands.map(c => ({
      text: c.text,
      label: overlayLabelForText(c.text, userLanguage, userLanguage === 'en' ? c.labelEn : c.labelTh),
    })),
    userLanguage,
  );
};

const catalogUnavailableMessage = (language: UserLanguage) => createBotTextFlexMessage({
  title: language === 'en' ? 'Catalog unavailable' : 'สินค้าไม่พร้อม',
  body: language === 'en'
    ? 'Could not load products from Odoo. Try again in a moment.'
    : 'โหลดสินค้าจาก Odoo ไม่สำเร็จ กรุณาลองใหม่',
  language,
  tone: 'warning',
  actions: [{ label: language === 'en' ? 'Try again' : 'ลองอีกครั้ง', text: 'NAV commerce' }],
});

export const commerceFollowUpMessages = async (
  ctx: CommerceFollowCtx,
  room = 2,
  options: { deferCatalogMiss?: boolean } = {},
): Promise<messagingApi.Message[]> => {
  if (room <= 0) return [];
  const { userLanguage, profile, channel } = ctx;
  const actionMenu = commerceActionMenu(ctx);
  if (!actionMenu) return [];
  const isStaff = isQuoteStaff(profile);
  const messages: messagingApi.Message[] = [];
  if (!isStaff && room >= 2) {
    const cached = getErpAdapter().peekCachedProducts?.(10) || [];
    if (cached.length) {
      messages.push(createProductCarouselFlexMessage(cached, userLanguage, undefined, channel?.channelId));
    } else if (options.deferCatalogMiss) {
      ctx.pendingCatalogPush = true;
    } else {
      try {
        const catalog = await getErpAdapter().searchProducts('', 10);
        if (catalog.length) messages.push(createProductCarouselFlexMessage(catalog, userLanguage, undefined, channel?.channelId));
        else {
          messages.push(createServiceActionFlexMessage(
            userLanguage === 'en' ? 'Catalog' : 'สินค้า',
            [{ text: 'FORM PRODUCT FIND', label: userLanguage === 'en' ? 'Search products' : 'ค้นหาสินค้า' }],
            userLanguage,
          ));
        }
      } catch {
        messages.push(catalogUnavailableMessage(userLanguage));
      }
    }
  }
  messages.push(actionMenu);
  return messages.slice(0, room);
};

export const pushDeferredCommerceCatalog = async (input: {
  userId: string;
  generation: string;
  userLanguage: UserLanguage;
  channelId?: string;
}): Promise<void> => {
  if (currentTrayGeneration(input.userId) !== input.generation) return;
  try {
    const catalog = await getErpAdapter().searchProducts('', 10);
    if (currentTrayGeneration(input.userId) !== input.generation) return;
    const channelId = input.channelId || DEFAULT_CHANNEL_ID;
    if (!catalog.length) {
      const empty = createBotTextFlexMessage({
        title: input.userLanguage === 'en' ? 'Catalog' : 'สินค้า',
        body: input.userLanguage === 'en'
          ? 'No products to show yet. Search by name.'
          : 'ยังไม่มีสินค้าให้แสดง กรุณาค้นหาด้วยชื่อสินค้า',
        language: input.userLanguage,
        tone: 'info',
        actions: [{ label: input.userLanguage === 'en' ? 'Search products' : 'ค้นหาสินค้า', text: 'FORM PRODUCT FIND' }],
      });
      await sendTargetedFlexMessage([input.userId], empty, channelId);
      return;
    }
    const carousel = createProductCarouselFlexMessage(catalog, input.userLanguage, undefined, input.channelId);
    await sendTargetedFlexMessage([input.userId], carousel, channelId);
  } catch (error) {
    appLogger.warn('commerce_catalog_push_failed', { error: String(error), userId: input.userId });
    if (currentTrayGeneration(input.userId) !== input.generation) return;
    await sendTargetedFlexMessage(
      [input.userId],
      catalogUnavailableMessage(input.userLanguage),
      input.channelId || DEFAULT_CHANNEL_ID,
    );
  }
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
    visibleCommands.map(c => ({
      text: c.text,
      label: overlayLabelForText(c.text, userLanguage, userLanguage === 'en' ? c.labelEn : c.labelTh),
    })),
    userLanguage,
  );
  const messages: messagingApi.Message[] = [];
  if (room >= 2) {
    const services = await getErpAdapter().listServices(10);
    if (services.length) {
      messages.push(createProductCarouselFlexMessage(services, userLanguage, item => `SERVICE READ ${item.sku || item.name}`, channel?.channelId));
    }
  }
  messages.push(actionMenu);
  return messages.slice(0, room);
};
