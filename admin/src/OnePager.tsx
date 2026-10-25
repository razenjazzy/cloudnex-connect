import type { ReactNode } from 'react';
import { FaqItem } from './ui';

type OnePagerProps = {
  onSignIn: () => void;
  authed?: boolean;
};

const Icon = ({ d }: { d: string }) => (
  <svg className="op-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const MODULES = [
  { title: 'Sales OA', d: 'M4 19V5h16v10H8z M8 22l3-3', body: 'Verify as an Odoo Sales User, create and send quotations, confirm, invoice, and assign inbound requests from the chat tray.' },
  { title: 'Customer OA', d: 'M6 7h12v10H6z M9 21h6 M12 17v4', body: 'Browse the catalogue, Order Now, receive a quote on LINE, and Confirm. Guests can start a draft without attaching an existing contact by phone.' },
  { title: 'Odoo ERP', d: 'M4 7h16v12H4z M8 7V5h8v2 M8 12h8', body: 'Partners, products, and quotations stay in Odoo. LINE is the client; the ERP remains the system of record.' },
  { title: 'Sora', d: 'M12 4a5 5 0 015 5c0 5-5 9-5 9s-5-4-5-9a5 5 0 015-5z M12 11h.01', body: 'Guided one-field forms, quantity chips, and Flex cards. Optional conversational fallback. Not a general-purpose office agent.' },
  { title: 'Identity', d: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 20a8 8 0 0116 0', body: 'Phone verification against Odoo. A miss asks an admin to fix the Sales User contact — it does not create users. Gold session on the tray.' },
  { title: 'Admin', d: 'M4 8l8-4 8 4v8l-8 4-8-4z M12 12v8 M4 8l8 4 8-4', body: 'HQ configures EN/TH button labels, CRM, campaigns, and audit. Field sales never need this console to take an order.' },
] as const;

const JOURNEY = [
  { n: '01', title: 'Verify', body: 'Add the Sales Official Account and Verify with the Sales User phone.' },
  { n: '02', title: 'Pick the deal', body: 'Products & Quotes → Create a quote. Tap product, quantity, and customer chips.' },
  { n: '03', title: 'Write Odoo', body: 'Create now writes a real draft quotation in Odoo — not a chat note.' },
  { n: '04', title: 'Send on LINE', body: 'The buyer gets Quote Received on their Official Account, or an add-friend prompt.' },
  { n: '05', title: 'Confirm & invoice', body: 'Customer Confirm becomes a sales order. Invoice from the same Sales card when status allows.' },
] as const;

const PILOT = [
  { n: '1', title: 'Discover', body: 'Sales and Customer Official Accounts, Odoo sale and partner access.' },
  { n: '2', title: 'Design', body: 'One process, one Odoo, tray and labels for that company.' },
  { n: '3', title: 'Deliver', body: '4–6 week pilot. Success is LINE-originated quote volume and time vs re-keying.' },
  { n: '4', title: 'Drive', body: 'Cut over live HMAC when the client is ready. Same product on staging and production.' },
] as const;

const FlexCard = ({
  meta,
  title,
  body,
  actions,
  dark = false,
}: {
  meta: string;
  title: string;
  body: string;
  actions: string[];
  dark?: boolean;
}) => (
  <article className={dark ? 'op-flex-card is-dark' : 'op-flex-card'}>
    <p className="op-flex-meta">{meta}</p>
    <p className="op-flex-title">{title}</p>
    <p className="op-flex-body">{body}</p>
    <div className="op-flex-actions">
      {actions.map(label => (
        <span key={label}>{label}</span>
      ))}
    </div>
  </article>
);

const Section = ({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: string;
  lead?: string;
  children: ReactNode;
  tone?: 'dark' | 'light';
}) => {
  const head = (
    <div className="op-head op-head-banner">
      <p className="op-kicker">{kicker}</p>
      <h2>{title}</h2>
      {lead ? <p className="op-section-lead">{lead}</p> : null}
    </div>
  );
  return (
    <section className="op-section">
      {head}
      {children}
    </section>
  );
};

export const OnePager = ({ onSignIn, authed = false }: OnePagerProps) => (
  <div className="one-pager">
    <section className="op-hero">
      <div className="op-hero-copy">
        <p className="op-kicker">Nex Connect · LINE Official Account + Odoo</p>
        <h1>ERP in LINE OA. Quotes from the field in one tap.</h1>
        <p className="op-lead">
          Nex Connect puts Odoo quotations in LINE Official Accounts (Cloudnex Sales and Cloudnex Customer).
          Sora / โซระ guides English and Thai. Field sales quote, send, and convert without a laptop, PC, or mobile browser.
        </p>
        <div className="op-cta">
          {authed ? (
            <button type="button" onClick={onSignIn}>Open dashboard</button>
          ) : (
            <button type="button" onClick={onSignIn}>Operator sign in</button>
          )}
          <a className="op-cta-secondary" href="mailto:info@cloudnexsolutions.com">Request a pilot</a>
        </div>
      </div>
      <div className="op-stack" aria-hidden="true">
        <div className="op-stack-card back left">
          <FlexCard
            meta="Sora · Quotation"
            title="Draft in Odoo"
            body="Confirm | Send. Skip extra lines or add more products, then send on LINE."
            actions={['Send', 'Add more']}
          />
        </div>
        <div className="op-stack-card back right">
          <FlexCard
            meta="Sora · Quote Received"
            title="Waiting for confirm"
            body="A quotation is waiting. Confirm on this chat to turn it into a sales order."
            actions={['Confirm', 'History']}
          />
        </div>
        <div className="op-stack-card front">
          <FlexCard
            dark
            meta="Sora · Today, 8:30"
            title="Ready to quote"
            body="Three products on the tray. Draft in Odoo when you tap Create now. Send stays on LINE."
            actions={['Create quote', 'Send']}
          />
        </div>
      </div>
    </section>

    <ul className="op-proof">
      <li><Icon d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /> LINE HMAC</li>
      <li><Icon d="M4 7h16v12H4z M8 7V5h8v2" /> Real Odoo quotation</li>
      <li><Icon d="M8 8h8v8H8z M4 12h4 M16 12h4" /> Dual Official Accounts</li>
      <li><Icon d="M12 3l8 4v6c0 5-8 9-8 9s-8-4-8-9V7z M9 12l2 2 4-4" /> Fail-closed Admin</li>
      <li><Icon d="M4 8h16M4 12h10M4 16h13" /> English and Thai</li>
    </ul>

    <Section kicker="The workspace" title="Six modules, one LINE journey" lead="For sales in the field, buyers on chat, and Odoo at HQ.">
      <div className="op-modules">
        {MODULES.map(mod => (
          <article key={mod.title} className="op-card">
            <span className="op-icon-wrap"><Icon d={mod.d} /></span>
            <h3>{mod.title}</h3>
            <p>{mod.body}</p>
          </article>
        ))}
      </div>
    </Section>

    <Section
      tone="light"
      kicker="In the LINE app"
      title="No new app to learn. It lives in LINE."
      lead="Works on the phone you already carry. Little training. Readable buttons; Odoo writes in the background."
    >
      <ul className="op-live-points">
        <li className="op-card">
          <span className="op-icon-wrap"><Icon d="M5 6h14v12H5z M8 21h8" /></span>
          <div>
            <strong>On the device in your pocket</strong>
            <p>Desktop and mobile LINE. No ERP client to install for field quotes.</p>
          </div>
        </li>
        <li className="op-card">
          <span className="op-icon-wrap"><Icon d="M8 11h8M8 15h5M7 5h10v16H7z" /></span>
          <div>
            <strong>Tap, don’t type SKUs</strong>
            <p>Chips and Flex cards walk quantity, partner, and send.</p>
          </div>
        </li>
        <li className="op-card">
          <span className="op-icon-wrap"><Icon d="M4 12h16M12 4v16" /></span>
          <div>
            <strong>Faster adoption</strong>
            <p>Same tray every morning. Labels in English or Thai.</p>
          </div>
        </li>
      </ul>
      <div className="op-flex-row">
        <FlexCard
          dark
          meta="01 · Verify"
          title="Nex Connect assistant"
          body="That phone is not on a Sales User. Ask an admin to add it in Odoo, or try another phone."
          actions={['Ask admin', 'Another phone']}
        />
        <FlexCard
          dark
          meta="02 · Quote"
          title="Quotation"
          body="Draft in Odoo. Confirm | Send. Skip extra lines or add more products, then send on LINE."
          actions={['Send', 'Add more', 'Home']}
        />
        <FlexCard
          dark
          meta="03 · Confirm"
          title="Quote Received"
          body="A quotation is waiting. Confirm on this chat to turn it into a sales order."
          actions={['Confirm', 'Order History']}
        />
      </div>
    </Section>

    <Section kicker="Twelve minutes" title="From the shop floor to a sent quotation">
      <ol className="op-timeline">
        {JOURNEY.map(step => (
          <li key={step.n} className="op-card">
            <span className="op-timeline-n">{step.n}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>

    <section className="op-section">
      <div className="op-split">
        <article className="op-card">
          <span className="op-icon-wrap"><Icon d="M4 10h16v8H4z M8 10V7h8v3" /></span>
          <h2>Admin is HQ, not the van</h2>
          <p>
            Operators sign in here to bind identity, rename LINE button labels, watch live catalogue and quotes, and review audit.
            The salesperson in the field stays in Official Account chat.
          </p>
        </article>
        <article className="op-card">
          <span className="op-icon-wrap"><Icon d="M4 6h16v12H4z M8 20h8" /></span>
          <h2>What stays in a browser</h2>
          <p>
            Customer Order Details, PDF download, and optional shop Pay open Odoo HTTPS when those paths are used.
            Quote mode (the default) keeps create, send, confirm, and invoice on LINE for staff.
          </p>
        </article>
      </div>
    </section>

    <Section tone="light" kicker="Choice" title="Compared with how teams sell today">
      <div className="op-table-wrap">
        <table className="op-compare">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Typical LINE chatbot</th>
              <th>Spreadsheet / chat copy</th>
              <th>Nex Connect</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Orders</th>
              <td>Notes, then re-key</td>
              <td>Paste into ERP later</td>
              <td><span className="op-win">Writes an Odoo quotation</span></td>
            </tr>
            <tr>
              <th>Field sales</th>
              <td>Browser ERP</td>
              <td>Laptop</td>
              <td><span className="op-win">LINE Flex and tray</span></td>
            </tr>
            <tr>
              <th>Customer</th>
              <td>Broadcast only</td>
              <td>Ad-hoc</td>
              <td><span className="op-win">Confirm on their Official Account</span></td>
            </tr>
            <tr>
              <th>Identity</th>
              <td>LINE id only</td>
              <td>None</td>
              <td><span className="op-win">Verify, then fail-closed Admin</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>

    <Section kicker="Rollout" title="Pilot in weeks, one client silo">
      <ol className="op-pilot">
        {PILOT.map(step => (
          <li key={step.n} className="op-card">
            <span>{step.n}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>

    <Section tone="light" kicker="Scope" title="Honest limits">
      <div className="op-faq-list">
        <FaqItem title="Shop checkout is a second mode">
          <p>Customer shop Pay is optional and exclusive with quote mode. The default journey is quotations, not a website cart.</p>
        </FaqItem>
        <FaqItem title="Group-buy is flagged off until you enable it">
          <p>The module exists behind an operator flag. Do not present it as always-on commerce.</p>
        </FaqItem>
        <FaqItem title="Sora is guided LINE UI">
          <p>Not a workspace that runs Microsoft 365 or Salesforce. Optional Gemini is conversational fallback, not the quotation writer.</p>
        </FaqItem>
        <FaqItem title="Odoo only in this cut">
          <p>Non-Odoo ERPs are not implemented. e-Tax, carriers, and hardware POS are out of product.</p>
        </FaqItem>
      </div>
    </Section>

    <Section kicker="Questions" title="Questions about Nex Connect">
      <div className="op-faq-list">
        <FaqItem title="What is Nex Connect?">
          <p>The LINE Official Account platform that writes Odoo quotations for Sales Users and Customers. Cloudnex sells and supports it.</p>
        </FaqItem>
        <FaqItem title="Does it replace Odoo?">
          <p>No. Odoo stays the master for partners, products, and orders. LINE is how people work those records outdoors.</p>
        </FaqItem>
        <FaqItem title="Thai and English?">
          <p>Yes. Chat language follows the tray Language control. Admin chrome can be switched separately after sign-in.</p>
        </FaqItem>
        <FaqItem title="Is company data used to train public models?">
          <p>ERP masters stay in Odoo. Optional Gemini is only conversational fallback, not the quotation writer.</p>
        </FaqItem>
      </div>
    </Section>

    <footer className="op-section">
      <div className="op-contact">
        <div>
          <p className="op-kicker">Next step</p>
          <h2>Talk to Cloudnex</h2>
          <p>Start with a walkthrough of Sales and Customer Official Accounts. No commitment.</p>
          <div className="op-cta">
            <a className="op-cta-primary" href="mailto:info@cloudnexsolutions.com">info@cloudnexsolutions.com</a>
          </div>
        </div>
        <div className="op-contact-meta">
          <p>Thailand (HQ) No. 425/1 Enco Terminal Building B, 4th Fl., Kamphaeng Phet 6 Rd., Don Mueang, Bangkok 10210 · +66 96 201 5676</p>
          <p>Bangladesh UTC Building, 19th Floor, 8 Panthapath, Dhaka-1215 · +880 1711 084874</p>
          <p>Monday to Friday, 9:00 to 18:00 (Bangkok time, GMT+7)</p>
        </div>
      </div>
    </footer>
  </div>
);
