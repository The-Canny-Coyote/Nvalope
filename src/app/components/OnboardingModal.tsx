"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Sparkles, Database, Scale, ListOrdered, Settings2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { cn } from "@/app/components/ui/utils";

const ONBOARDING_STORAGE_KEY = "nvalope-onboarding-done";

export type UiMode = "normal";

export type OnboardingSettings = {
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderMode: boolean;
  mode: "standard" | "focus" | "calm" | "clear" | "contrast" | "tactile";
  uiMode: UiMode;
};

export function getOnboardingDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // ignore
  }
}

export function resetOnboardingForTesting(): void {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // ignore
  }
}

type OnboardingModalProps = {
  open: boolean;
  onComplete: (settings: OnboardingSettings) => void;
  initialSettings?: Partial<OnboardingSettings>;
};

export function OnboardingModal({
  open,
  onComplete,
  initialSettings = {},
}: OnboardingModalProps) {
  const [step, setStep] = React.useState(0);
  const [settings, setSettings] = React.useState<OnboardingSettings>({
    reducedMotion: false,
    highContrast: false,
    screenReaderMode: false,
    mode: "standard",
    uiMode: "normal",
    ...initialSettings,
  });

  const cards = React.useMemo(() => buildCards(settings, setSettings), [settings]);
  const totalSteps = cards.length;
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;
  const currentCard = cards[step];

  const goNext = () => {
    if (isLast) {
      setOnboardingDone();
      onComplete(settings);
      return;
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const goPrev = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSkip = () => {
    setOnboardingDone();
    onComplete(settings);
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="z-[101] sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 [&>button]:hidden"
        overlayClassName="z-[100]"
        aria-describedby={undefined}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Welcome to Nvalope</DialogTitle>
          <DialogDescription>Onboarding: step {step + 1} of {totalSteps}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[60vh] px-6 pt-6 overflow-auto">
          <div className="pr-4 pb-4">
            <div className="flex items-center gap-2 text-primary mb-2">
              {currentCard.icon && <currentCard.icon className="size-5 shrink-0" aria-hidden />}
              <h2 id="onboarding-card-title" className="text-lg font-semibold text-foreground">
                {currentCard.title}
              </h2>
            </div>
            {currentCard.shortDescription && (
              <p className="text-sm text-muted-foreground mb-4">{currentCard.shortDescription}</p>
            )}
            <div className="text-sm text-foreground space-y-3">{currentCard.content}</div>
          </div>
        </ScrollArea>

        <div className="relative z-10 shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t bg-muted/30 rounded-b-lg pointer-events-auto">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={isFirst}
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Button>
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1"
              aria-label="Skip and use the app now"
            >
              Skip
            </button>
          </div>
          <div className="flex items-center gap-1" role="tablist" aria-label="Onboarding steps">
            {cards.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1}`}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i === step ? "bg-primary scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                onClick={() => setStep(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium h-8 px-3 has-[>svg]:px-2.5",
              "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none cursor-pointer pointer-events-auto"
            )}
            onClick={() => goNext()}
            onPointerDown={() => goNext()}
            aria-label={isLast ? "Begin using the app" : "Next"}
          >
            {isLast ? (
              <>
                Begin
                <Check className="size-4" aria-hidden />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="size-4" aria-hidden />
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildCards(
  settings: OnboardingSettings,
  setSettings: React.Dispatch<React.SetStateAction<OnboardingSettings>>
): Array<{
  id: string;
  title: string;
  shortDescription?: string;
  icon: React.ElementType;
  content: React.ReactNode;
}> {
  return [
    {
      id: "intro",
      title: "Welcome to Nvalope",
      shortDescription: "Privacy-respecting, customizable, and accessible envelope budgeting.",
      icon: Sparkles,
      content: (
        <>
          <p>
            <strong>Nvalope</strong> is a privacy-respecting, customizable, and accessible envelope budgeting app. Your data never leaves your device.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Envelope-based budgeting: allocate income to categories and track spending.</li>
            <li>Fully offline after first load: the app caches so you can use it without internet.</li>
            <li>No accounts, no cloud: everything stays on your device.</li>
            <li>Optional features: AI assistant, receipt scanner, calendar, and more—enable only what you need.</li>
          </ul>
          <p className="font-medium text-foreground pt-3">
            How you can verify we hold to our word
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li><strong>Try it offline.</strong> After this first load, turn off Wi‑Fi or unplug from the internet. Open the app again—your budget, envelopes, and transactions will still work. We don’t need the network to run.</li>
            <li><strong>No account, no server.</strong> There’s no sign-in. Your data is stored only in this browser (and in a backup folder if you set one in Chrome/Edge). We have no server that receives your budget or spending.</li>
            <li><strong>You’re in control.</strong> Your data lives only in this browser. In Settings → Data Management you can export or back up anytime; we don’t have access to it.</li>
          </ul>
        </>
      ),
    },
    {
      id: "data",
      title: "Data storage & loss",
      shortDescription: "Understand where your data lives and how to protect it.",
      icon: Database,
      content: (
        <>
          <p>
            All budget data, settings, and history are stored <strong>on your device only</strong> (browser storage). We do not have access to your data.
          </p>
          <p className="text-amber-600 dark:text-amber-500 font-medium">
            Clearing your browser cache, site data, or using private/incognito sessions can result in permanent loss of your data.
          </p>
          <p>
            A backup copy is saved <strong>on this device</strong> every 3 changes you make (all browsers). For a copy outside the app—e.g. if you clear storage—use <strong>Download full backup</strong> in Settings → Data Management, or in Chrome/Edge set a <strong>backup folder</strong> so a file is written there every 3 changes.
          </p>
          <p>
            You can optionally <strong>encrypt backup files with a password</strong> in Settings → Data Management so only you can open them. If you forget the password, encrypted backups cannot be opened—there is no recovery. We recommend keeping backups on an external storage device (e.g. USB drive or external disk) and storing your password safely.
          </p>
        </>
      ),
    },
    {
      id: "legal",
      title: "Legal disclaimer",
      shortDescription: "Your responsibility.",
      icon: Scale,
      content: (
        <>
          <p className="font-medium text-foreground">
            We are not responsible for any financial data, decisions, or mishaps of any kind. Use of this app is at your own risk.
          </p>
          <p className="text-muted-foreground">
            You are solely responsible for your budgeting decisions, the accuracy of data you enter, and any loss of data due to device or browser behavior. This app is provided &quot;as is&quot; without warranty. Always keep your own backups and verify important figures elsewhere if needed.
          </p>
          <p className="text-muted-foreground text-sm pt-1">
            For full Privacy Policy and Terms of Use, see the <strong>Glossary</strong> section in the app.
          </p>
        </>
      ),
    },
    {
      id: "workflow",
      title: "Sample workflow",
      shortDescription: "Get started in a few steps.",
      icon: ListOrdered,
      content: (
        <>
          <ol className="list-decimal pl-5 space-y-2">
            <li><strong>Overview</strong> — Check your budget summary and health.</li>
            <li><strong>Income</strong> — Add income and allocate it to envelopes.</li>
            <li><strong>Envelopes &amp; Expenses</strong> — Create envelopes (e.g. Groceries, Rent) and log expenses.</li>
            <li><strong>Transactions</strong> — Review and edit transaction history.</li>
            <li><strong>Settings</strong> — Enable optional features, export/import data, and set up backup.</li>
          </ol>
          <p className="text-muted-foreground pt-2">
            Use the wheel (or list on small screens) to open each section. When you&apos;re ready, click <strong>Begin</strong> to start.
          </p>
        </>
      ),
    },
    {
      id: "advanced",
      title: "Optional extras",
      shortDescription: "Extra features when available.",
      icon: Sparkles,
      content: (
        <>
          <p>
            Optional features may be added later. Core budgeting—overview, income, envelopes, transactions—is free. Extra power-ups will be optional when available.
          </p>
        </>
      ),
    },
    {
      id: "settings",
      title: "Initial settings",
      shortDescription: "Accessibility and preferences.",
      icon: Settings2,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Choose options below. You can change these anytime in <strong>Accessibility</strong> and <strong>Settings</strong>.
          </p>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card">
              <span className="text-sm font-medium">Reduced motion</span>
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, reducedMotion: !s.reducedMotion }))}
                className={cn(
                  "px-3 py-1 rounded text-xs transition-colors",
                  settings.reducedMotion ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
                aria-pressed={settings.reducedMotion}
              >
                {settings.reducedMotion ? "On" : "Off"}
              </button>
            </label>
            <label className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card">
              <span className="text-sm font-medium">High contrast</span>
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, highContrast: !s.highContrast }))}
                className={cn(
                  "px-3 py-1 rounded text-xs transition-colors",
                  settings.highContrast ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
                aria-pressed={settings.highContrast}
              >
                {settings.highContrast ? "On" : "Off"}
              </button>
            </label>
            <label className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card">
              <span className="text-sm font-medium">Screen reader mode</span>
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, screenReaderMode: !s.screenReaderMode }))}
                className={cn(
                  "px-3 py-1 rounded text-xs transition-colors",
                  settings.screenReaderMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
                aria-pressed={settings.screenReaderMode}
              >
                {settings.screenReaderMode ? "On" : "Off"}
              </button>
            </label>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Preset mode</p>
            <div className="flex flex-wrap gap-2">
              {(["standard", "focus", "calm", "clear", "contrast", "tactile"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, mode }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    settings.mode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  aria-pressed={settings.mode === mode}
                >
                  {mode === "standard" ? "Standard" : mode === "focus" ? "Focus" : mode === "calm" ? "Calm" : mode === "clear" ? "Clear" : mode === "contrast" ? "Max contrast" : "Tactile"}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "begin",
      title: "You're all set",
      shortDescription: "Start using Nvalope.",
      icon: Check,
      content: (
        <p>
          Default core functions will load and you can use the wheel or list to open Overview, Income, Envelopes, Transactions, Accessibility, and Settings. A backup copy is saved on this device every 3 changes. To keep a copy elsewhere, use Download full backup or set a backup folder (Chrome/Edge) in Settings → Data Management.
        </p>
      ),
    },
  ];
}
