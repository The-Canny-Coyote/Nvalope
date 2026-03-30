/**
 * Builds public/user-guide.html from docs/nvalope-user-guide.md (marked CLI) + heading ids for TOC anchors.
 * Run: node scripts/build-user-guide-html.mjs
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mdPath = join(root, 'docs', 'nvalope-user-guide.md');
const tmpBody = join(root, 'temp-user-guide-body.html');
const outPath = join(root, 'public', 'user-guide.html');

execSync(`npx --yes marked -i "${mdPath}" -o "${tmpBody}" --gfm`, {
  cwd: root,
  stdio: 'inherit',
});

let body = readFileSync(tmpBody, 'utf8');

const repl = {
  '<h2>Table of Contents</h2>': '<h2 id="table-of-contents">Table of Contents</h2>',
  '<h2>The basics</h2>': '<h2 id="the-basics">The basics</h2>',
  '<h2>How Nvalope is laid out</h2>': '<h2 id="how-nvalope-is-laid-out">How Nvalope is laid out</h2>',
  '<h2>Core features</h2>': '<h2 id="core-features">Core features</h2>',
  '<h3>Overview</h3>': '<h3 id="overview">Overview</h3>',
  '<h3>Income</h3>': '<h3 id="income">Income</h3>',
  '<h3>Envelopes &amp; Expenses</h3>': '<h3 id="envelopes--expenses">Envelopes &amp; Expenses</h3>',
  '<h3>Transactions</h3>': '<h3 id="transactions">Transactions</h3>',
  '<h2>Optional features</h2>': '<h2 id="optional-features">Optional features</h2>',
  '<h3>Receipt Scanner</h3>': '<h3 id="receipt-scanner">Receipt Scanner</h3>',
  '<h3>Calendar View</h3>': '<h3 id="calendar-view">Calendar View</h3>',
  '<h3>Analytics</h3>': '<h3 id="analytics">Analytics</h3>',
  '<h3>Cache the AI Assistant</h3>': '<h3 id="cache-the-ai-assistant">Cache the AI Assistant</h3>',
  '<h3>Glossary</h3>': '<h3 id="glossary">Glossary</h3>',
  '<h2>Bank statement import</h2>': '<h2 id="bank-statement-import">Bank statement import</h2>',
  '<h2>Accessibility</h2>': '<h2 id="accessibility">Accessibility</h2>',
  '<h2>Settings</h2>': '<h2 id="settings">Settings</h2>',
  '<h2>Your data and backups</h2>': '<h2 id="your-data-and-backups">Your data and backups</h2>',
  '<h2>Installing Nvalope</h2>': '<h2 id="installing-nvalope">Installing Nvalope</h2>',
  '<h2>Privacy</h2>': '<h2 id="privacy">Privacy</h2>',
};

for (const [from, to] of Object.entries(repl)) {
  if (!body.includes(from)) {
    throw new Error(`build-user-guide: expected fragment not found: ${from.slice(0, 60)}…`);
  }
  body = body.split(from).join(to);
}

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nvalope User Guide</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 42rem; margin: 0 auto; padding: 1.5rem; line-height: 1.6; color: #1a1a1a; background: #f5f2e8; }
    h1 { font-size: 1.75rem; margin-top: 0; color: #2d7a3f; }
    h2 { font-size: 1.2rem; margin-top: 1.75rem; color: #5c4a32; }
    h3 { font-size: 1.05rem; margin-top: 1.25rem; color: #3d5634; }
    p { margin: 0.75rem 0; }
    ul, ol { margin: 0.75rem 0; padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
    a { color: #2d7a3f; }
    hr { border: 0; border-top: 1px solid #c4b8a0; margin: 1.25rem 0; }
    .meta { font-size: 0.9rem; color: #555; margin-bottom: 1rem; }
    blockquote { font-size: 0.95rem; color: #444; border-left: 3px solid #8b6944; padding-left: 0.75rem; margin: 1rem 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.95rem; margin: 1rem 0; }
    th, td { border: 1px solid #c4b8a0; padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
    th { background: rgba(139, 105, 68, 0.12); }
    nav ol { padding-left: 1.25rem; }
  </style>
</head>
<body>
${body}
  <p class="meta"><a href="/install-pwa.html">Install Nvalope on your device</a> · <a href="/">← Back to Nvalope</a></p>
</body>
</html>
`;

writeFileSync(outPath, page, 'utf8');
try {
  unlinkSync(tmpBody);
} catch {
  /* ignore */
}
console.log('Wrote', outPath);
