import type { messagingApi } from '@line/bot-sdk';
import { getAgentSpeakPrefix } from './channels';
import { createBotTextFlexMessage } from './templates';
import { t, tFill } from '../services/i18n';
import type { UserLanguage } from '../services/firestore';

export type CustomerBindKind = 'order' | 'history' | 'message' | 'services';

const BODY_KEY: Record<CustomerBindKind, 'customerBindToOrder' | 'customerBindToHistory' | 'customerBindToMessage' | 'customerBindToServices'> = {
  order: 'customerBindToOrder',
  history: 'customerBindToHistory',
  message: 'customerBindToMessage',
  services: 'customerBindToServices',
};

export const customerBindActions = (language: UserLanguage): Array<{ label: string; text: string; style: 'primary' | 'secondary' }> => [
  { label: t('newCustomer', language), text: 'FORM CUSTOMER REGISTER', style: 'primary' },
  { label: t('iHaveAPhone', language), text: 'FORM VERIFY MANUAL', style: 'secondary' },
];

export const customerBindBody = (language: UserLanguage, kind: CustomerBindKind, using = ''): string =>
  `${using}${tFill(BODY_KEY[kind], language, { prefix: getAgentSpeakPrefix(language) })}`;

export const customerBindMessages = (
  language: UserLanguage,
  kind: CustomerBindKind,
  using = '',
): messagingApi.Message[] => [
  createBotTextFlexMessage({
    title: t('salesVerifyAgain', language),
    body: customerBindBody(language, kind, using),
    language,
    tone: 'warning',
    actions: customerBindActions(language),
  }),
];
