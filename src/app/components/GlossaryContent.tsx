/**
 * Glossary: financial terms, privacy & data terms, design principles (no dark patterns), and helpful resources.
 * Shown as an optional section and openable from the footer link.
 */

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const CATEGORIES = [
  {
    id: 'financial',
    title: 'Financial terms',
    icon: '💰',
    terms: [
      { term: 'Envelope', def: 'A category in your budget with a set amount (e.g. Groceries, Transport). You track spending against that amount.' },
      { term: 'Budget', def: 'Your plan for how to use income: how much goes to each envelope and what\'s left unallocated.' },
      { term: 'Income', def: 'Money coming in (paychecks, side gigs, etc.). You record it here and can allocate it to envelopes.' },
      { term: 'Expense', def: 'Money going out. Each expense is assigned to an envelope and a date.' },
      { term: 'Transaction', def: 'A single income or expense entry in your history (amount, date, envelope, optional note).' },
      { term: 'Allocation', def: 'Assigning a portion of your income to an envelope—setting how much that envelope can spend.' },
      { term: 'Balance', def: 'For an envelope: how much is left (allocation minus spending). For the whole budget: income minus total spending.' },
      { term: 'Over budget', def: 'When spending in an envelope exceeds the amount you allocated for it.' },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & data terms',
    icon: '🔒',
    terms: [
      { term: 'On-device / Local', def: 'Data is stored only on your device (browser storage) and is not sent to our servers or third parties.' },
      { term: 'IndexedDB', def: 'A browser storage technology we use to keep your budget, transactions, receipts, and app data. It allows larger amounts of data than local storage and works offline; everything stays on your device. If you clear "cookies and other site data" in your browser for this site, IndexedDB (and the local backup copy) may be deleted. You can use a backup folder or download a full backup in Settings → Data Management if you want a copy that survives.' },
      { term: 'Local storage', def: 'Browser storage used for small settings (e.g. theme, layout scale). Also stays on your device.' },
      { term: 'Backup', def: 'A copy of your data you can download or save to a folder. Used to restore or move your data.' },
      { term: 'PWA', def: 'Progressive Web App. You can install Nvalope on your device so it runs like an app; data still stays local.' },
      { term: 'No tracking', def: 'Nvalope does not collect analytics, track your behavior, or send your data to advertisers or other services.' },
      { term: 'Opt-in', def: 'Optional features (e.g. AI assistant, receipt scanner) are off by default. You choose what to enable.' },
    ],
  },
  {
    id: 'data-tech',
    title: 'Data & tech in Nvalope',
    icon: '📦',
    terms: [
      { term: 'JSON', def: 'JavaScript Object Notation. A standard text format for data (e.g. your backup file). Nvalope exports and imports budget data as JSON so you can open it in a text editor, move it between devices, or use it with other tools. Backup files are named like nvalope-backup-2025-02-26.json.' },
      { term: 'WebLLM', def: 'A way to run an AI language model entirely in your browser using WebGPU. In Nvalope, when you turn on “Use local AI model” in Settings, the app can download a small model (e.g. Llama) to your device. All chat and receipt categorization then runs on your device—nothing is sent to the cloud. The model is stored in browser cache/IndexedDB. It only runs when your device supports it (e.g. WebGPU) and you have enabled it.' },
      { term: 'Autobackup', def: 'Every 3 changes you make (e.g. editing budget, settings, or receipts), Nvalope saves a backup copy. On all browsers a copy is saved on this device (in IndexedDB). Clearing "cookies and other site data" in your browser deletes that copy. In Chrome and Edge you can choose a backup folder—one file there is overwritten every 3 changes; the files in that folder are on your disk and are not deleted when you clear site data (you will need to choose the folder again after clearing). You see “Backup saved.” when a save succeeds. If saving to a folder fails (e.g. access lost), you may see an error; the on-device copy may still have been saved.' },
      { term: 'Export vs backup', def: 'Budget-only export = envelopes, transactions, and income (no settings or app data). Full backup = budget, settings, optional upgrade flag, and app data (e.g. assistant messages, receipt scans). Use budget-only export for sharing or other tools; use full backup for restore or moving to another device.' },
      { term: 'Encrypted backup', def: 'When "Encrypt backups" is on in Settings → Data Management, full backups (saved to a folder or downloaded) are encrypted with a password. Only someone with that password can open the file. The password is not stored; set it each session or when exporting. If you forget the password, encrypted backups cannot be opened—there is no recovery. Store backup files on an external storage device (e.g. USB drive or external disk) and keep your password in a safe place.' },
      { term: 'Receipt categorization', def: 'After you scan a receipt, the app suggests an envelope (e.g. Groceries, Gas) from the receipt text. It uses, in order: WebLLM (if enabled and model loaded), then Transformers.js (browser-based AI), then keyword patterns. All run on your device; no receipt text is sent elsewhere.' },
    ],
  },
  {
    id: 'design',
    title: 'Our design principles',
    icon: '✨',
    terms: [
      { term: 'Clarity and consent', def: 'We use neutral, clear wording for every choice so you can decide yes or no without pressure.' },
      { term: 'Honest presentation', def: 'We aim to show you accurate information and real options, and to avoid artificial scarcity, countdowns, or misleading urgency.' },
      { term: 'Explicit options', def: 'Optional features and how we use data are clearly described and easy to find. We aim not to add anything without your awareness.' },
      { term: 'Your control', def: "You can turn off any feature in Settings at any time. Your data stays yours, and you retain full control over it." },
      { term: 'Conservative defaults', def: 'Sensitive or optional actions are opt-in. We choose defaults that aim to protect your privacy and your control over spending.' },
      { term: 'Social engineering', def: 'Using psychology, trust, or authority to influence someone to act in a way that benefits the influencer—e.g. fake urgency, emotional pressure, or hiding the real choice. In design, similar tactics can nudge users without their full awareness; we aim to avoid these practices.' },
    ],
  },
  {
    id: 'ethos',
    title: 'Our philosophy',
    icon: '🐺',
    terms: [
      { term: 'Privacy-first', def: 'Data stays on your device unless you choose to export it. Your data is not extracted or used for surveillance.' },
      { term: 'Surveillance capitalism', def: 'A business model where user data is used for tracking and advertising. Nvalope is designed as an alternative that keeps your data on your device.' },
      { term: 'Ethical capitalism', def: 'An alternative approach: ethics over extraction, service over surveillance, sustainability over waste. The Canny Coyote 🐺 aims to uphold these ideals and a high standard of ethics.' },
      { term: 'User-owned data', def: 'Your budget and transactions belong to you. You can export, import, or delete your data at any time; we do not retain or sell it.' },
      { term: 'Voluntary support', def: 'Core features remain free. Donations (e.g. Buy Me a Coffee) are optional, with no pressure to contribute.' },
      { term: 'Ethical design', def: 'Design that prioritizes your well-being and control. We aim to avoid dark patterns and forced interactions.' },
    ],
  },
];

type ResourceItem = { label: string; href: string; description: string };

/** Shown by default (before "Show more"). */
const RESOURCES_TOP: ResourceItem[] = [
  { label: 'CFPB — Budgeting', href: 'https://www.consumerfinance.gov/consumer-tools/budgeting/', description: 'Consumer Financial Protection Bureau: budgeting basics' },
  { label: 'FTC — Consumer Information', href: 'https://consumer.ftc.gov/', description: 'Federal Trade Commission consumer tips' },
  { label: 'FTC — Report fraud or dark patterns', href: 'https://reportfraud.ftc.gov/', description: 'Report deceptive practices, scams, or dark patterns to the FTC' },
  { label: 'Dark Patterns (darkpatterns.org)', href: 'https://www.darkpatterns.org/', description: 'Examples and definitions of dark patterns in design' },
  { label: 'NN/G — Deceptive patterns in UX', href: 'https://www.nngroup.com/articles/deceptive-patterns/', description: 'How design manipulates users: same psychology as social engineering; how it spreads even when unintentional' },
  { label: 'GDPR & Privacy (EDPB)', href: 'https://edpb.europa.eu/our-work-tools/general-guidance/gdpr-guidelines-recommendations-best-practices_en', description: 'Guidance on privacy and data protection' },
];

/** Shown after "Show more". */
const RESOURCES_MORE: ResourceItem[] = [
  { label: 'EFF — Electronic Frontier Foundation', href: 'https://www.eff.org/', description: 'Defending civil liberties and privacy in the digital world' },
  { label: 'Mozilla Foundation', href: 'https://foundation.mozilla.org/', description: 'Open internet, privacy, and ethical tech advocacy' },
  { label: 'Signal Foundation', href: 'https://signal.org/about/', description: 'Private messaging; privacy-first communication' },
  { label: 'DuckDuckGo — Privacy', href: 'https://duckduckgo.com/privacy', description: 'Privacy-focused search and browser; no tracking' },
  { label: 'Privacy International', href: 'https://privacyinternational.org/', description: 'Challenges data exploitation and surveillance' },
];

/** Related links (budgeting, envelope method, financial literacy) shown only when expanded. */
const RESOURCES_RELATED: ResourceItem[] = [
  { label: 'CFPB — Managing your money', href: 'https://www.consumerfinance.gov/consumer-tools/managing-your-money/', description: 'Practical guides to spending, saving, and planning' },
  { label: 'Envelope budgeting (Wikipedia)', href: 'https://en.wikipedia.org/wiki/Envelope_system', description: 'Overview of the envelope method Nvalope is based on' },
  { label: 'MyMoney.gov', href: 'https://www.mymoney.gov/', description: 'U.S. financial literacy and education resources' },
];

/** Privacy and open source links shown only when expanded. */
const RESOURCES_PRIVACY_OPEN: ResourceItem[] = [
  { label: 'FSF — Free Software Foundation', href: 'https://www.fsf.org/', description: 'Advocacy for free software and user freedom; steward of the GNU Project' },
  { label: 'Tor Project', href: 'https://www.torproject.org/', description: 'Free software for anonymity and resisting surveillance' },
  { label: 'Proton', href: 'https://proton.me/', description: 'Privacy-focused email, VPN, and drive; open source' },
  { label: 'Tuta', href: 'https://tuta.com', description: 'Encrypted email, calendar, and contacts; open source; privacy-first' },
  { label: 'FSFE — Free Software Foundation Europe', href: 'https://fsfe.org/', description: 'Advocacy for free software and open standards in Europe' },
  { label: 'Framasoft', href: 'https://framasoft.org/en/', description: 'Free software, decentralization, and digital sovereignty' },
  { label: 'Open Source Initiative', href: 'https://opensource.org/', description: 'Defines and promotes open source; maintains the OSI definition' },
  { label: 'Tactical Tech', href: 'https://tacticaltech.org/', description: 'Tools and guides for privacy, security, and digital wellbeing' },
  { label: 'F-Droid', href: 'https://f-droid.org/', description: 'Catalog of free and open source Android apps' },
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
  const [resourcesExpanded, setResourcesExpanded] = useState(false);

  return (
    <section className="space-y-8" role="region" aria-label="Glossary">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary shrink-0" aria-hidden />
        <h2 className="text-lg font-semibold text-primary">Glossary</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Definitions of terms we use in Nvalope, how we handle your data, and how we design the app to be fair and transparent.
      </p>

      {CATEGORIES.map((cat) => (
        <div key={cat.id} className="space-y-3">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span aria-hidden>{cat.icon}</span>
            {cat.title}
          </h3>
          <dl className="space-y-2">
            {cat.terms.map(({ term, def }) => (
              <div key={term} className="pl-2 border-l-2 border-primary/30">
                <dt className="font-medium text-foreground text-sm">{term}</dt>
                <dd className="text-sm text-muted-foreground mt-0.5">{def}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      <div className="space-y-3 pt-2">
        <h3 className="text-base font-semibold text-foreground">Helpful resources</h3>
        <p className="text-sm text-muted-foreground">
          External links to learn more about budgeting, consumer rights, and ethical design. We don’t control these sites; their privacy policies apply.
        </p>
        <ul className="space-y-2">
          {RESOURCES_TOP.map((r) => (
            <ResourceLink key={r.href} {...r} />
          ))}
          {resourcesExpanded && (
            <>
              {RESOURCES_MORE.map((r) => (
                <ResourceLink key={r.href} {...r} />
              ))}
              {RESOURCES_RELATED.length > 0 && (
                <>
                  <li className="pt-2 mt-2 border-t border-border">
                    <span className="text-xs font-medium text-muted-foreground">Related — budgeting & financial literacy</span>
                  </li>
                  {RESOURCES_RELATED.map((r) => (
                    <ResourceLink key={r.href} {...r} />
                  ))}
                </>
              )}
              {RESOURCES_PRIVACY_OPEN.length > 0 && (
                <>
                  <li className="pt-2 mt-2 border-t border-border">
                    <span className="text-xs font-medium text-muted-foreground">Privacy & open source</span>
                  </li>
                  {RESOURCES_PRIVACY_OPEN.map((r) => (
                    <ResourceLink key={r.href} {...r} />
                  ))}
                </>
              )}
            </>
          )}
        </ul>
        <button
          type="button"
          onClick={() => setResourcesExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={resourcesExpanded}
        >
          {resourcesExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 shrink-0" aria-hidden />
              Show fewer resources
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 shrink-0" aria-hidden />
              Show more resources
            </>
          )}
        </button>
      </div>

    </section>
  );
}
