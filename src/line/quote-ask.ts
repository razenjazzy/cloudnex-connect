export const QUOTE_ASK_MARK = 'QUOTE_ASK';
export const QUOTE_REPLY_MARK = 'QUOTE_REPLY';

export type PartnerNote = {
  id?: number;
  body: string;
  date: string;
};

export type QuoteAskThread = {
  ask: string;
  reply?: string;
  date: string;
  productId?: string;
  status: 'pending' | 'replied';
};

export const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

export const formatQuoteAskNote = (body: string, productToken?: string): string => {
  const extra = productToken && /^\d+$/.test(productToken)
    ? `productId=${productToken}`
    : (productToken || '');
  return [QUOTE_ASK_MARK, extra, body].filter(Boolean).join('\n');
};

export const formatQuoteReplyNote = (body: string): string => `${QUOTE_REPLY_MARK}\n${body}`;

const parseAskBody = (text: string): { ask: string; productId?: string } => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const withoutMark = lines[0] === QUOTE_ASK_MARK ? lines.slice(1) : lines;
  let productId: string | undefined;
  const rest: string[] = [];
  for (const line of withoutMark) {
    const match = /^productId=(\d+)$/i.exec(line);
    if (match && !productId) {
      productId = match[1];
      continue;
    }
    rest.push(line);
  }
  return { ask: rest.join('\n').trim() || text, ...(productId ? { productId } : {}) };
};

const isReplyNote = (text: string): boolean =>
  text === QUOTE_REPLY_MARK || text.startsWith(`${QUOTE_REPLY_MARK}\n`) || text.startsWith(`${QUOTE_REPLY_MARK} `);

export const pairQuoteAskThreads = (notes: PartnerNote[]): QuoteAskThread[] => {
  const sorted = [...notes].sort((a, b) => a.date.localeCompare(b.date));
  const threads: QuoteAskThread[] = [];
  for (const note of sorted) {
    const text = stripHtml(note.body);
    if (!text) continue;
    if (isReplyNote(text)) {
      const reply = text.replace(new RegExp(`^${QUOTE_REPLY_MARK}\\s*`), '').trim();
      const open = [...threads].reverse().find(thread => thread.status === 'pending');
      if (open && reply) {
        open.reply = reply;
        open.status = 'replied';
      }
      continue;
    }
    const parsed = parseAskBody(text);
    if (!parsed.ask) continue;
    threads.push({
      ask: parsed.ask,
      date: note.date,
      status: 'pending',
      ...(parsed.productId ? { productId: parsed.productId } : {}),
    });
  }
  return threads.reverse();
};
