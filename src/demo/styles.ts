export const DEMO_PAGE_STYLES = `
    :root {
      --bg: #f4f7f6;
      --panel: #fff;
      --ink: #102a27;
      --muted: #3d5551;
      --accent: #0f6e62;
      --accent-strong: #102a27;
      --alert: #a33;
      --line: #c5d5d1;
      --shadow: 0 1px 3px rgb(16 42 39 / 8%);
      --radius: 12px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, sans-serif;
      color: var(--ink);
      background: var(--bg);
      padding: 0;
    }

    .demo-top {
      display: flex;
      align-items: center;
      gap: 1rem 1.25rem;
      margin: 0;
      padding: 0.65rem 1.5rem;
      background: #102a27;
      color: #fff;
      position: sticky;
      top: 0;
      z-index: 40;
      border-bottom: 1px solid rgb(255 255 255 / 8%);
    }
    .demo-top .brand {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      color: #fff;
      text-decoration: none;
      font-weight: 650;
      letter-spacing: -0.02em;
      flex: 0 0 auto;
    }
    .demo-top nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.15rem;
      margin-left: auto;
      justify-content: flex-end;
    }
    .demo-top nav a {
      color: #b7d4ce;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 500;
      padding: 0.38rem 0.55rem;
      border-radius: 7px;
      min-height: 40px;
      display: inline-flex;
      align-items: center;
    }
    .demo-top nav a:hover { color: #fff; background: rgb(255 255 255 / 8%); }
    .demo-top .tag { font-size: 0.8rem; color: #b7d4ce; flex: 0 0 auto; }

    .shell { max-width: 1400px; margin: 0 auto; padding: 28px 18px 48px; }

    .hero {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 24px;
      margin: 0 0 28px;
      scroll-margin-top: 72px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid rgba(217, 226, 236, 0.9);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      backdrop-filter: blur(14px);
    }

    .hero-copy { padding: 28px; }

    .eyebrow {
      font-size: 12px;
      letter-spacing: 0.16em;
      font-weight: 700;
      color: var(--accent-strong);
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    h1 {
      margin: 0 0 10px;
      font-size: clamp(30px, 4vw, 52px);
      line-height: 1;
    }

    .hero-copy p { margin: 0; color: var(--muted); max-width: 70ch; }

    .hero-side {
      padding: 22px;
      display: grid;
      gap: 10px;
      align-content: center;
      background: linear-gradient(180deg, rgba(15, 118, 110, 0.1), rgba(194, 65, 12, 0.1));
    }

    .chip {
      border-radius: 999px;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.72);
      color: var(--accent-strong);
      font-size: 13px;
      font-weight: 700;
      width: fit-content;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 24px;
    }

    .module-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }

    .module-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.7);
    }

    .module-card h3 {
      margin: 0 0 4px;
      font-size: 14px;
    }

    .module-card p, .module-card code {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
    }

    .store-note {
      font-size: 13px;
      color: var(--muted);
      margin: 8px 0 0;
    }

    .card { padding: 24px; scroll-margin-top: 72px; }
    .span-6 { grid-column: span 6; }
    .span-12 { grid-column: span 12; }

    h2 { margin: 0 0 10px; font-size: 22px; }
    h3 { margin: 12px 0 8px; font-size: 16px; }
    p { margin: 0 0 10px; color: var(--muted); }

    form { display: grid; gap: 10px; }

    .three-up {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .two-up {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    label {
      display: grid;
      gap: 5px;
      font-size: 13px;
      color: var(--muted);
      font-weight: 700;
    }

    input {
      border-radius: 12px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.94);
      color: var(--ink);
      padding: 10px 12px;
      font-size: 14px;
      outline: none;
    }

    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
    }

    .actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .token-row {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr auto;
      align-items: end;
      margin-bottom: 12px;
    }

    button {
      border: 0;
      border-radius: 8px;
      padding: 10px 14px;
      color: white;
      font-weight: 650;
      cursor: pointer;
      min-height: 2.5rem;
      background: #0f6e62;
    }

    button.secondary { background: #5c6f6c; }
    button.ghost { background: #1d4a44; }

    pre {
      margin: 0;
      min-height: 150px;
      max-height: 400px;
      overflow: auto;
      border-radius: 8px;
      background: #eef1f0;
      color: #102a27;
      padding: 14px;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }

    .timeline li {
      border: 1px dashed #bfd1df;
      border-radius: 12px;
      padding: 8px 10px;
      font-size: 13px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.66);
    }

    .warn { color: var(--alert); font-weight: 700; }

    .chat-card {
      padding: 18px;
    }

    .chat-display {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 360px;
      overflow: auto;
      padding: 12px;
      border-radius: 14px;
      background: #eef4f1;
    }

    .msg-row { display: flex; flex-direction: column; }

    .msg-user,
    .msg-bot {
      padding: 10px 13px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .msg-user {
      align-self: flex-end;
      background: var(--accent-strong);
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }

    .msg-bot {
      align-self: flex-start;
      background: #ffffff;
      color: var(--ink);
      border: 1px solid rgba(217, 226, 236, 0.9);
      border-bottom-left-radius: 4px;
    }

    .msg-bot.card {
      align-self: flex-start;
      background: #ffffff;
      color: var(--ink);
      border: 1px solid var(--line);
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
    }

    .chat-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }

    .chat-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .nav-chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 8px 12px;
      background: #ffffff;
      color: var(--accent-strong);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .chat-input-row {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr auto;
      align-items: end;
      margin-top: 12px;
    }

    .chat-input-row textarea {
      border-radius: 12px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.96);
      color: var(--ink);
      padding: 11px 12px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 52px;
    }

    .chat-input-row textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
    }

    button.chat-send { padding: 11px 18px; }

    .chat-menu-panel {
      display: none;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .chat-menu-panel .nav-chip { background: var(--accent); color: #fff; border: 0; }

    @media (max-width: 1080px) {
      .hero { grid-template-columns: 1fr; }
      .span-6, .span-12 { grid-column: span 12; }
      .three-up { grid-template-columns: 1fr; }
      .two-up { grid-template-columns: 1fr; }
      .module-grid { grid-template-columns: 1fr; }
      .demo-top { flex-wrap: wrap; }
      .demo-top nav { width: 100%; margin-left: 0; justify-content: flex-start; }
    }
`;
