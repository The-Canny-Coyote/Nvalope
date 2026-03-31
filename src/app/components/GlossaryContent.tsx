/**
 * Glossary: financial terms, privacy & data terms, design principles (no dark patterns), and helpful resources.
 * Shown as an optional section and openable from the footer link.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { BrandCoyoteMark } from '@/app/components/BrandCoyoteMark';

type GlossaryTerm = {
  term: string;
  def: string | ReactNode;
  category: 'financial' | 'privacy' | 'tech' | 'design' | 'security';
};

const TERMS: GlossaryTerm[] = [
  // Financial Terms
  { term: 'Allocation', category: 'financial', def: 'Assigning a portion of your income to an envelope—setting how much that envelope can spend.' },
  { term: 'Balance', category: 'financial', def: 'For an envelope: how much is left (allocation minus spending). For the whole budget: income minus total spending.' },
  { term: 'Budget', category: 'financial', def: 'Your plan for how to use income: how much goes to each envelope and what\'s left unallocated.' },
  { term: 'Envelope', category: 'financial', def: 'A category in your budget with a set amount (e.g. Groceries, Transport). You track spending against that amount.' },
  { term: 'Expense', category: 'financial', def: 'Money going out. Each expense is assigned to an envelope and a date.' },
  { term: 'Income', category: 'financial', def: 'Money coming in (paychecks, side gigs, etc.). You record it here and can allocate it to envelopes.' },
  { term: 'Over budget', category: 'financial', def: 'When spending in an envelope exceeds the amount you allocated for it.' },
  { term: 'Transaction', category: 'financial', def: 'A single income or expense entry in your history (amount, date, envelope, optional note).' },

  // Privacy & data terms
  { term: 'Backup', category: 'privacy', def: 'A copy of your data you can download or save to a folder. Used to restore or move your data.' },
  { term: 'IndexedDB', category: 'privacy', def: 'A browser storage technology that stores your budget, transactions, receipts, and app data locally on your device. It works offline and supports more data than localStorage. Clearing "cookies and other site data" in your browser will delete this data — use a backup to protect against accidental loss.' },
  { term: 'Local storage', category: 'privacy', def: 'Browser storage used for small settings (e.g. theme, layout scale). Also stays on your device.' },
  { term: 'No tracking', category: 'privacy', def: 'Nvalope does not collect analytics, track your behavior, or send your data to advertisers or other services.' },
  { term: 'On-device / Local', category: 'privacy', def: 'Data is stored only on your device (browser storage) and is not sent to our servers or third parties.' },
  { term: 'Opt-in', category: 'privacy', def: 'Optional features (e.g. AI assistant, receipt scanner) are off by default. You choose what to enable.' },
  { term: 'PWA', category: 'privacy', def: 'Progressive Web App. You can install Nvalope on your device so it runs like an app; data still stays local.' },

  // Data & tech in Nvalope
  { term: 'Autobackup', category: 'tech', def: 'After roughly three changes, Nvalope automatically saves a copy of your data on this device. Chrome and Edge also support saving to a folder you choose — see Settings → Data Management. Downloads a full backup file from Settings at any time.' },
  { term: 'CSV', category: 'tech', def: 'Comma-Separated Values — a plain text file format used by most banks for statement exports. Each row is a transaction; columns are separated by commas. Supported for bank statement import in Settings → Data Management.' },
  { term: 'Encrypted backup', category: 'tech', def: 'A backup file protected with a password using AES-256-GCM encryption. Only someone with the password can open the file. The password is never stored — there is no recovery if lost. Set in Settings → Data Management.' },
  { term: 'Export vs backup', category: 'tech', def: 'Budget-only export = envelopes, transactions, and income (no settings or app data). Full backup = budget, settings, optional upgrade flag, and app data (e.g. assistant messages, receipt scans). Use budget-only export for sharing or other tools; use full backup for restore or moving to another device.' },
  { term: 'JSON', category: 'tech', def: 'JavaScript Object Notation. A standard text format for data (e.g. your backup file). Nvalope exports and imports budget data as JSON so you can open it in a text editor, move it between devices, or use it with other tools. Backup files are named like nvalope-backup-2025-02-26.json.' },
  { term: 'OFX / QFX', category: 'tech', def: 'Open Financial Exchange format — a structured file format used by banks and financial software (QuickBooks, Quicken). More reliable than CSV for financial data because it includes explicit field labels. Supported for bank statement import.' },
  { term: 'QIF', category: 'tech', def: 'Quicken Interchange Format — an older format used by some banks and financial apps. Supported for bank statement import but less reliable than OFX for transaction classification.' },
  { term: 'Receipt categorization', category: 'tech', def: 'After you scan a receipt, the app suggests an envelope (e.g. Groceries, Gas). Receipt text is extracted with on-device OCR, and the envelope suggestion uses keyword pattern matching (regex-only). No receipt text is sent elsewhere.' },
  { term: 'WebLLM', category: 'tech', def: 'A way to run an AI language model entirely in your browser using WebGPU. In Nvalope, when you turn on "Use local AI model" in Settings, the app can download a small model (e.g. Llama) to your device. All AI Assistant chat then runs on your device — nothing is sent to the cloud. Receipt scanning always uses on-device OCR and keyword matching, regardless of whether WebLLM is enabled. The model is stored in browser cache/IndexedDB and only runs when your device supports WebGPU.' },

  // Design
  { term: 'Dark patterns', category: 'design', def: 'Design tactics that manipulate users into actions they did not intend — for example, hiding the cancel option, making unsubscribe difficult, or using guilt-based button labels ("No thanks, I hate saving money"). Nvalope is designed to avoid these.' },

  // Security
  { term: 'Encryption', category: 'security', def: 'A process that scrambles data so only someone with the correct key (password) can read it. Nvalope uses AES-256-GCM with PBKDF2 key derivation — industry-standard algorithms. Encrypted backups cannot be opened without the password; there is no recovery if the password is lost.' },
];

type ResourceItem = { label: string; href: string; description: string };

const RESOURCES: ResourceItem[] = [
  { label: 'CFPB — Budgeting', href: 'https://www.consumerfinance.gov/consumer-tools/budgeting/', description: 'Consumer Financial Protection Bureau: budgeting basics' },
  { label: 'CFPB — Managing your money', href: 'https://www.consumerfinance.gov/consumer-tools/managing-your-money/', description: 'Practical guides to spending, saving, and planning' },
  { label: 'Envelope budgeting (Wikipedia)', href: 'https://en.wikipedia.org/wiki/Envelope_system', description: 'Overview of the envelope method Nvalope is based on' },
  { label: 'FTC — Consumer Information', href: 'https://consumer.ftc.gov/', description: 'Federal Trade Commission consumer tips' },
  { label: 'FTC — Report fraud or dark patterns', href: 'https://reportfraud.ftc.gov/', description: 'Report deceptive practices, scams, or dark patterns to the FTC' },
  { label: 'Dark Patterns (darkpatterns.org)', href: 'https://www.darkpatterns.org/', description: 'Examples and definitions of dark patterns in design' },
  { label: 'NN/G — Deceptive patterns in UX', href: 'https://www.nngroup.com/articles/deceptive-patterns/', description: 'How design manipulates users: same psychology as social engineering; how it spreads even when unintentional' },
  { label: 'EFF — Electronic Frontier Foundation', href: 'https://www.eff.org/', description: 'Defending civil liberties and privacy in the digital world' },
  { label: 'Mozilla Foundation', href: 'https://foundation.mozilla.org/', description: 'Open internet, privacy, and ethical tech advocacy' },
  { label: 'Proton', href: 'https://proton.me/', description: 'Privacy-focused email, VPN, and drive; open source' },
  { label: 'Tuta', href: 'https://tuta.com', description: 'Encrypted email, calendar, and contacts; open source; privacy-first' },
  { label: 'Tactical Tech', href: 'https://tacticaltech.org/', description: 'Tools and guides for privacy, security, and digital wellbeing' },
  { label: 'GDPR & Privacy (EDPB)', href: 'https://edpb.europa.eu/our-work-tools/general-guidance/gdpr-guidelines-recommendations-best-practices_en', description: 'Guidance on privacy and data protection' },
  { label: 'Open Source Initiative', href: 'https://opensource.org/', description: 'Defines and promotes open source; maintains the OSI definition' },
];

function ResourceLink({ label, href, description }: ResourceItem) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline transition-colors"
      >
        {label}
        <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
      </a>
      <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
    </li>
  );
}

export function GlossaryContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'financial' | 'privacy' | 'tech' | 'design' | 'security'>('all');

  const filteredTerms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = (t: GlossaryTerm) => {
      if (q === '') return true;
      const defText = typeof t.def === 'string' ? t.def : '';
      return t.term.toLowerCase().includes(q) || defText.toLowerCase().includes(q);
    };
    return TERMS
      .filter((t) => (activeCategory === 'all' ? true : t.category === activeCategory))
      .filter(matchesQuery)
      .slice()
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [activeCategory, searchQuery]);

  return (
    <section className="space-y-8" role="region" aria-label="Glossary">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary shrink-0" aria-hidden />
        <h2 className="text-lg font-semibold text-primary">Glossary</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Definitions of terms used in Nvalope. Search or filter by category to find what you're looking for.
      </p>

      <div className="space-y-3">
        <input
          type="search"
          placeholder="Search terms…"
          aria-label="Search glossary terms"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />

        <div role="group" aria-label="Filter by category" className="flex flex-wrap items-center gap-2">
          {([
            { id: 'all', label: 'All' },
            { id: 'financial', label: 'Financial' },
            { id: 'privacy', label: 'Privacy' },
            { id: 'tech', label: 'Tech' },
            { id: 'design', label: 'Design' },
            { id: 'security', label: 'Security' },
          ] as const).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border-2 ${
                activeCategory === c.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
              }`}
              aria-pressed={activeCategory === c.id}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          {filteredTerms.length} term{filteredTerms.length !== 1 ? 's' : ''}
        </div>

        {filteredTerms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No terms match your search.</p>
        ) : (
          <dl className="space-y-2">
            {filteredTerms.map(({ term, def }) => (
              <div key={term} className="pl-2 border-l-2 border-primary/30">
                <dt className="font-medium text-foreground text-sm">{term}</dt>
                <dd className="text-sm text-muted-foreground mt-0.5">{def}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="space-y-3 pt-2">
        <h3 className="text-base font-semibold text-foreground">Helpful resources</h3>
        <p className="text-sm text-muted-foreground">
          External links to learn more about budgeting, consumer rights, and ethical design. We don’t control these sites; their privacy policies apply.
        </p>
        <ul className="space-y-2">
          {RESOURCES.map((r) => (
            <ResourceLink key={r.href} {...r} />
          ))}
        </ul>
      </div>

    </section>
  );
}
