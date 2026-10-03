import { messagingApi } from '@line/bot-sdk';
import type { CommandHandler } from './index';
import { homeReplyFromContext } from '../command-router';
import { getServiceDefinition, getVisibleCommands, isServiceEnabledForChannel, serviceMenuLabel } from '../../services/service-catalog';
import { createServiceActionFlexMessage } from '../templates';
import { isQuoteStaff } from '../quote-access';
import { SALES_CHANNEL_ID } from '../channels';
import { commerceFollowUpMessages, catalogFollowUpMessages } from '../commerce-followup';
import { overlayLabelForText } from '../command-overlay';
import { isCustomerShopEffective } from '../../platform/customer-commerce';

const tr = (language: string, th: string, en: string): string => (language === 'en' ? en : th);

// NAV HOME / NAV / BACK — go back to service home menu
const navHomeHandler: CommandHandler = {
  name: 'nav-home',
  match: (u) => u === 'NAV HOME' || u === 'NAV' || u === 'BACK',
  handle: async (ctx) => homeReplyFromContext(ctx),
};

// NAV <serviceKey> — show service-specific action panel
const navServiceHandler: CommandHandler = {
  name: 'nav-service',
  match: (u) => u.startsWith('NAV ') && u !== 'NAV HOME',
  handle: async (ctx) => {
    const { userLanguage, agentName, channel, profile } = ctx;
    const key = ctx.text.trim().replace(/^NAV\s*/i, '').trim().toLowerCase();

    if (key.toUpperCase() === 'VERIFY') {
      // Redirect to guided verify form
      const { resolveCommandReply } = await import('../command-router');
      return resolveCommandReply({ ...ctx, text: 'FORM VERIFY' });
    }

    const serviceDef = getServiceDefinition(key);
    const isAdmin = profile.role === 'admin';
    const isStaff = isQuoteStaff(profile) || channel?.channelId === SALES_CHANNEL_ID;
    const shopMode = !isStaff && await isCustomerShopEffective();
    const visibleCommands = serviceDef ? getVisibleCommands(serviceDef, isAdmin, isStaff, { shopMode }) : [];

    if (!serviceDef || !isServiceEnabledForChannel(serviceDef.key, channel) || !visibleCommands.length) {
      return [{ type: 'text', text: tr(userLanguage, `${agentName} ไม่พบบริการนี้`, `${agentName} service not found.`) } as messagingApi.TextMessage];
    }

    const actionMenu = createServiceActionFlexMessage(
      overlayLabelForText(
        `NAV ${serviceDef.key.toUpperCase()}`,
        userLanguage,
        serviceMenuLabel(serviceDef, userLanguage, channel?.channelId),
        channel?.channelId,
      ),
      visibleCommands.map(c => ({
        text: c.text,
        label: overlayLabelForText(c.text, userLanguage, userLanguage === 'en' ? c.labelEn : c.labelTh, channel?.channelId),
      })),
      userLanguage,
    );
    if (key === 'commerce') {
      const follow = await commerceFollowUpMessages(ctx, 2, { deferCatalogMiss: true });
      if (follow.length) return follow;
    }
    if (key === 'catalog') {
      const follow = await catalogFollowUpMessages(ctx, 2);
      if (follow.length) return follow;
    }
    return [actionMenu];
  },
};

export const navigationHandlers: CommandHandler[] = [navHomeHandler, navServiceHandler];
