import { messagingApi } from '@line/bot-sdk';
import { t } from '../../services/i18n';
import { BRAND, buttonLabel, createMessageActionButton, createTapRow, flexBubbleStyles, flexHeaderBox, truncate, type ReportLanguage } from './shared';
import { getBrandTitle } from '../channels';

export const SERVICE_ICON: Record<string, string> = {
  VERIFY: '🔐',
  commerce: '🛍️',
  directory: '👥',
  catalog: '📦',
  reporting: '📊',
  groupBuy: '🤝',
};

export const createServiceHomeFlexMessage = (
  services: { key: string; label: string }[],
  language: ReportLanguage,
  agentName: string,
  _highlightVerify = false,
  identity?: { name?: string; phone?: string },
): messagingApi.FlexMessage => {
  const identityLines = identity && (identity.name || identity.phone)
    ? [{
        type: 'box' as const,
        layout: 'vertical' as const,
        spacing: 'xs',
        paddingAll: 'md',
        backgroundColor: BRAND.paper,
        cornerRadius: BRAND.radius,
        contents: [
          { type: 'text' as const, text: identity.name || '—', size: 'sm', color: BRAND.ink, wrap: true, weight: 'bold' as const },
          ...(identity.phone
            ? [{ type: 'text' as const, text: identity.phone, size: 'xs', color: BRAND.inkSoft, wrap: true }]
            : []),
        ],
      }]
    : [];
  return {
    type: 'flex',
    altText: language === 'en' ? `${getBrandTitle('en')} menu` : `เมนู ${getBrandTitle('th')}`,
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(
        language === 'en' ? getBrandTitle('en') : getBrandTitle('th'),
        t('tapService', language),
      ),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          ...identityLines,
          ...services.slice(0, 10).map(service => createTapRow(
          `${SERVICE_ICON[service.key] || ''} ${service.label}`.trim(),
          `NAV ${service.key}`,
          BRAND.teal,
          '#FFFFFF',
          'lg',
        )),
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          { ...createTapRow(`🌐 ${t('languageToggle', language)}`, language === 'en' ? 'LANG TH' : 'LANG EN', BRAND.tealTint, BRAND.tealStrong, 'lg'), flex: 1 },
          { ...createTapRow(`📖 ${t('guide', language)}`, 'GUIDE', BRAND.tealTint, BRAND.tealStrong, 'lg'), flex: 1 },
        ],
      },
    },
  };
};

export const createServiceActionFlexMessage = (
  serviceLabel: string,
  actions: { text: string; label: string }[],
  language: ReportLanguage
): messagingApi.FlexMessage => {
  return {
    type: 'flex',
    altText: truncate(serviceLabel, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(serviceLabel, t('chooseAction', language)),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        paddingBottom: 'lg',
        contents: actions.slice(0, 10).map(action => createTapRow(action.label, action.text, BRAND.teal, '#FFFFFF', 'lg')),
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        contents: [
          createTapRow(`🏠 ${t('home', language)}`, 'NAV HOME', BRAND.goldTint, BRAND.tealStrong, 'lg'),
        ],
      },
    },
  };
};

export const createAdminConfigFlexMessage = (
  channelId: string,
  services: { key: string; label: string; enabled: boolean; nextCommand: string }[],
  language: ReportLanguage,
): messagingApi.FlexMessage => ({
  type: 'flex',
  altText: language === 'en' ? `Service configuration: ${channelId}` : `ตั้งค่าบริการ: ${channelId}`,
  contents: {
    type: 'bubble',
    styles: flexBubbleStyles,
    header: flexHeaderBox(language === 'en' ? 'Service configuration' : 'ตั้งค่าบริการ', channelId),
    body: {
      type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'lg',
      contents: services.map(service => ({
        type: 'button', style: service.enabled ? 'primary' : 'secondary', height: 'md', color: service.enabled ? BRAND.teal : BRAND.goldTint,
        action: { type: 'message', label: buttonLabel(`${service.enabled ? 'ON' : 'OFF'} ${service.label}`), text: service.nextCommand },
      })),
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: 'lg', contents: [createMessageActionButton(t('back', language), 'NAV HOME', 'secondary', BRAND.goldTint)],
    },
  },
});
