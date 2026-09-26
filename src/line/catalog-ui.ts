import { DEFAULT_CHANNEL_ID } from './channels';
import { COMMAND_GRID, type CommandChannel } from './command-grid';
import { mergeCommandGridEntry } from './command-overlay';
import type { ReportLanguage } from './templates/shared';

export const isCatalogUiVisible = (id: string, channelId?: string): boolean => {
  const entry = COMMAND_GRID.find(item => item.id === id);
  if (!entry) return true;
  const merged = mergeCommandGridEntry(entry);
  if (merged.enabled === false) return false;
  if (merged.channels?.length) {
    const channel = (channelId || DEFAULT_CHANNEL_ID) as CommandChannel;
    return merged.channels.includes(channel);
  }
  return true;
};

export const catalogUiLabel = (
  id: string,
  language: ReportLanguage,
  fallback: { en: string; th: string },
): string => {
  const entry = COMMAND_GRID.find(item => item.id === id);
  const merged = entry ? mergeCommandGridEntry(entry) : null;
  if (language === 'th') return (merged?.labelTh || fallback.th).slice(0, 20);
  return (merged?.labelEn || fallback.en).slice(0, 20);
};
