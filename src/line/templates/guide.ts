import { messagingApi } from '@line/bot-sdk';
import { t } from '../../services/i18n';
import { BRAND, createMessageActionButton, createPrefillButton, createTapRow, flexBubbleStyles, flexHeaderBox, truncate, type ReportLanguage } from './shared';
import { SERVICE_ICON } from './navigation';
import { getBrandTitle } from '../channels';
import {
  GUIDE_CATEGORY_LABELS,
  GUIDE_CATEGORY_NOTES,
  GUIDE_CATEGORY_ORDER,
  getCommandsForCategory,
  type CommandCategoryKey,
} from '../command-guide';

const CATEGORY_ICON: Record<CommandCategoryKey, string> = {
  basics: '🏠',
  admin: '⚙️',
  account: '🙋',
  commerce: SERVICE_ICON.commerce,
  directory: SERVICE_ICON.directory,
  catalog: SERVICE_ICON.catalog,
  reporting: SERVICE_ICON.reporting,
  groupBuy: SERVICE_ICON.groupBuy,
};

/**
 * Top-level GUIDE menu — replaces the old single plain-text wall (11
 * numbered sections crammed into one bubble) with a tappable category
 * list, "smart IVR"-style. Each button sends `GUIDE <category>`, which
 * createGuideCategoryFlexMessage below renders as a drill-down card.
 */
export const createGuideCategoriesFlexMessage = (language: ReportLanguage, _agentName: string): messagingApi.FlexMessage => ({
  type: 'flex',
  altText: language === 'en' ? `${getBrandTitle('en')} guide` : `คู่มือ ${getBrandTitle('th')}`,
  contents: {
    type: 'bubble',
    styles: flexBubbleStyles,
    header: flexHeaderBox(
      getBrandTitle(language),
      language === 'en' ? 'Tap a topic to see its commands' : 'แตะหัวข้อเพื่อดูคำสั่ง',
    ),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: 'lg',
      contents: GUIDE_CATEGORY_ORDER.map(category =>
        createTapRow(`${CATEGORY_ICON[category]} ${GUIDE_CATEGORY_LABELS[category][language]}`, `GUIDE ${category}`),
      ),
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.goldTint)],
    },
  },
});

/**
 * One guide category's commands as prefill buttons — tapping opens the
 * keyboard with the real example pre-filled (editable before sending),
 * rather than either a fixed message action (wrong for commands that need
 * real values) or plain unstructured text.
 */
export const createGuideCategoryFlexMessage = (category: CommandCategoryKey, language: ReportLanguage, _agentName: string): messagingApi.FlexMessage => {
  const label = GUIDE_CATEGORY_LABELS[category][language];
  const commands = getCommandsForCategory(category);
  const note = GUIDE_CATEGORY_NOTES[category]?.[language];

  return {
    type: 'flex',
        altText: truncate(`${getBrandTitle(language)} — ${label}`, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(
        `${CATEGORY_ICON[category]} ${label}`,
        language === 'en' ? 'Tap to fill in, edit, then send' : 'แตะเพื่อกรอก แก้ไข แล้วส่งได้เลย',
      ),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          ...(note ? [{ type: 'text' as const, text: note, size: 'xs' as const, color: BRAND.inkSoft, wrap: true, margin: 'md' as const }] : []),
          ...commands.map(cmd => (
            cmd.example.trim().toUpperCase() === cmd.key.trim().toUpperCase()
              ? createMessageActionButton(cmd.key, cmd.example, 'secondary', BRAND.tealTint)
              : createPrefillButton(cmd.key, cmd.example, 'secondary', BRAND.tealTint)
          )),
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          { ...createMessageActionButton(language === 'en' ? 'Back' : 'ย้อนกลับ', 'GUIDE', 'secondary', BRAND.goldTint), flex: 1 },
          { ...createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.goldTint), flex: 1 },
        ],
      },
    },
  };
};
