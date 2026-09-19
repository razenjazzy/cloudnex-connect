import { messagingApi } from '@line/bot-sdk';
import { BRAND, createMessageActionButton, flexBubbleStyles, flexHeaderBox, truncate, type ReportLanguage } from './shared';
import { getBrandTitle } from '../channels';
import type { FeatureToggleDescription } from '../../services/feature-toggles';

const tr = (language: ReportLanguage, th: string, en: string): string => (language === 'en' ? en : th);

export const createSalesFeatureTogglesFlexMessage = (params: {
  rows: Array<FeatureToggleDescription & { label: string }>;
  language: ReportLanguage;
  notice?: string;
}): messagingApi.FlexMessage => {
  const { rows, language, notice } = params;
  const title = tr(language, 'สวิตช์บริการ LINE', 'LINE feature toggles');

  return {
    type: 'flex',
    altText: truncate(`${getBrandTitle(language)}: ${title}`, 380),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(getBrandTitle(language), title),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          ...(notice ? [{
            type: 'box' as const,
            layout: 'vertical' as const,
            backgroundColor: BRAND.goldTint,
            cornerRadius: BRAND.radius,
            paddingAll: 'md',
            contents: [
              { type: 'text' as const, text: notice, size: 'sm' as const, color: BRAND.ink, wrap: true },
            ],
          }] : []),
          ...rows.map((row) => {
            const status = row.source === 'env-forced'
              ? tr(language, 'ปิดโดย env', 'Off (env)')
              : row.effective
                ? tr(language, 'เปิด', 'On')
                : tr(language, 'ปิด', 'Off');
            const contents: messagingApi.FlexComponent[] = [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: row.label, size: 'md', color: BRAND.ink, wrap: true, flex: 3 },
                  { type: 'text', text: status, size: 'sm', color: BRAND.inkSoft, align: 'end', flex: 2 },
                ],
              },
            ];
            if (row.source !== 'env-forced') {
              const next = row.effective ? 'OFF' : 'ON';
              contents.push(createMessageActionButton(
                row.effective ? tr(language, 'ปิดบริการ', 'Turn off') : tr(language, 'เปิดบริการ', 'Turn on'),
                `SALES FEATURE ${row.key} ${next}`,
                row.effective ? 'secondary' : 'primary',
                row.effective ? BRAND.goldTint : BRAND.teal,
              ));
            }
            return {
              type: 'box' as const,
              layout: 'vertical' as const,
              backgroundColor: row.source === 'env-forced' ? BRAND.paper : BRAND.tealTint,
              cornerRadius: BRAND.radius,
              paddingAll: 'md',
              spacing: 'sm' as const,
              contents,
            };
          }),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        contents: [
          createMessageActionButton(tr(language, 'หน้าหลัก', 'Home'), 'NAV HOME', 'secondary', BRAND.goldTint),
        ],
      },
    },
  };
};
