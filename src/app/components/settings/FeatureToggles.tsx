import React, { useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  Receipt,
  Calendar,
  BarChart3,
  Bot,
  Box,
  PieChart,
  DollarSign,
  Wallet,
  History,
  Accessibility,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Settings,
  Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULE_CONFIG } from '@/app/constants/modules';
import { LOCAL_LLM_ACCURACY_NOTE } from '@/app/constants/assistantCopy';
import { BrandCoyoteMark, brandCoyoteLabelSuffix } from '@/app/components/BrandCoyoteMark';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
import { useAppStore } from '@/app/store/appStore';
import {
  getWebLLMBlockReasons,
  getWebLLMEnvironmentSnapshot,
  loadWebLLMEngine,
  unloadWebLLMEngine,
  clearWebLLMCache,
} from '@/app/services/webLLMAssistant';
import { toast } from 'sonner';
import { Progress } from '@/app/components/ui/progress';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

const MODULE_ICONS: Record<string, LucideIcon> = {
  overview: PieChart,
  income: DollarSign,
  envelopes: Wallet,
  transactions: History,
  accessibility: Accessibility,
  receiptScanner: Receipt,
  calendar: Calendar,
  analytics: BarChart3,
  cacheAssistant: Bot,
  advancedAICache: Bot,
  glossary: BookOpen,
};

export interface FeatureTogglesProps {
  enabledModules: string[];
  enableModule: (moduleId: string) => void;
  disableModule: (moduleId: string) => void;
  enableCache: () => void;
  onBeforeOpen?: () => void;
  restoreScrollAfterLayout?: () => void;
  /** Set by BackupSettings; Jump to Data calls this to open Data Management. */
  jumpToDataRef: MutableRefObject<(() => void) | null>;
  /** When set with onCoreFeaturesOpenChange, Core collapsible is controlled (e.g. lifted to App). */
  coreFeaturesOpen?: boolean;
  onCoreFeaturesOpenChange?: (open: boolean) => void;
  /** When set with onOptionalFeaturesOpenChange, Optional collapsible is controlled (e.g. lifted to App). */
  optionalFeaturesOpen?: boolean;
  onOptionalFeaturesOpenChange?: (open: boolean) => void;
}

export function FeatureToggles({
  enabledModules,
  enableModule,
  disableModule,
  enableCache,
  onBeforeOpen,
  restoreScrollAfterLayout,
  jumpToDataRef,
  coreFeaturesOpen: coreFeaturesOpenProp,
  onCoreFeaturesOpenChange,
  optionalFeaturesOpen: optionalFeaturesOpenProp,
  onOptionalFeaturesOpenChange,
}: FeatureTogglesProps) {
  const webLLMEnabled = useAppStore((s) => s.webLLMEnabled);
  const setWebLLMEnabled = useAppStore((s) => s.setWebLLMEnabled);
  /** E2E: headless often has no WebGPU; allow premium-gate UI test without loading WebLLM. */
  const webLLMBlockReasons =
    typeof window !== 'undefined' &&
    (window as Window & { __NVALOPE_TEST_FORCE_WEBLLM_ELIGIBLE?: boolean }).__NVALOPE_TEST_FORCE_WEBLLM_ELIGIBLE === true
      ? []
      : getWebLLMBlockReasons();
  const webLLMEligible = webLLMBlockReasons.length === 0;
  const webLLMEnvSnapshot = getWebLLMEnvironmentSnapshot();

  const [defaultCoreOpen, setDefaultCoreOpen] = useState(false);
  const [defaultOptionalOpen, setDefaultOptionalOpen] = useState(false);
  const coreOpen = coreFeaturesOpenProp ?? defaultCoreOpen;
  const optionalOpen = optionalFeaturesOpenProp ?? defaultOptionalOpen;
  const [showWebLLMDeleteDialog, setShowWebLLMDeleteDialog] = useState(false);

  const handleOptionalOpenChange = (open: boolean) => {
    if (open) onBeforeOpen?.();
    if (onOptionalFeaturesOpenChange) onOptionalFeaturesOpenChange(open);
    else setDefaultOptionalOpen(open);
    if (open && restoreScrollAfterLayout) {
      requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
    }
  };
  const handleCoreOpenChange = (open: boolean) => {
    if (open) onBeforeOpen?.();
    if (onCoreFeaturesOpenChange) onCoreFeaturesOpenChange(open);
    else setDefaultCoreOpen(open);
    if (open && restoreScrollAfterLayout) {
      requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
    }
  };

  const scrollToSection = (sectionId: string, open: () => void) => {
    open();
    const scrollToEl = () => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(scrollToEl, 150);
      });
    });
  };

  return (
    <>
      <h3 className="text-lg text-primary">Settings & Features</h3>
      <p className="text-xs text-muted-foreground">
        Everything in this app today is free forever. Future optional features, when added, will be optional extras.
      </p>
      <nav className="flex flex-wrap items-center gap-2" aria-label="Jump to section">
        <span className="text-xs text-muted-foreground mr-1">Jump to:</span>
        {[
          { id: 'settings-core', label: 'Core features', open: () => handleCoreOpenChange(true) },
          { id: 'settings-optional', label: 'Optional features', open: () => handleOptionalOpenChange(true) },
          { id: 'settings-data', label: 'Data', open: () => jumpToDataRef.current?.() },
        ].map(({ id, label, open }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollToSection(id, open)}
            className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium border border-primary/25 bg-primary/5 text-foreground transition-colors hover:bg-primary/10 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {label}
          </button>
        ))}
      </nav>

      <div id="settings-core">
        <Collapsible open={coreOpen} onOpenChange={handleCoreOpenChange} className="pt-2 border-t border-border">
          <CollapsibleTrigger
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer glass-card shadow-sm"
            aria-expanded={coreOpen}
            onPointerDownCapture={() => onBeforeOpen?.()}
            onKeyDownCapture={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onBeforeOpen?.();
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
                <Settings className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Core Features</span>
                <span className="block text-xs text-muted-foreground">Overview, Income, Envelopes, Transactions, Accessibility</span>
              </div>
            </div>
            {coreOpen ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Enabled by default. Turn off any section you don&apos;t need — Settings is always accessible.
            </p>
            <p className="text-xs text-primary font-medium">
              Turning a feature off only removes it from the menu. Your data is not deleted—turn it back on anytime to see it again.
            </p>
            <div className="space-y-2 mt-2">
              {MODULE_CONFIG.filter((m) => m.core).map((config) => {
                const isEnabled = enabledModules.includes(config.id);
                const Icon = MODULE_ICONS[config.id] ?? Box;
                return (
                  <div
                    key={config.id}
                    data-testid={`module-${config.id}`}
                    className={`p-3 border rounded-lg flex items-center justify-between gap-3 transition-colors ${isEnabled ? 'bg-primary/5 border-primary/20' : 'border-border opacity-60'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-primary/10 text-primary" aria-hidden>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">{config.label}</span>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </div>
                    </div>
                    <Checkbox
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        if (checked) enableModule(config.id);
                        else disableModule(config.id);
                      }}
                      aria-label={`${config.label} ${isEnabled ? 'enabled' : 'disabled'}`}
                      className="size-5 shrink-0 rounded"
                    />
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div id="settings-optional">
        <Collapsible open={optionalOpen} onOpenChange={handleOptionalOpenChange} className="pt-2 border-t border-border">
          <CollapsibleTrigger
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer glass-card shadow-sm"
            aria-expanded={optionalOpen}
            onPointerDownCapture={() => onBeforeOpen?.()}
            onKeyDownCapture={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onBeforeOpen?.();
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Optional features</span>
                <span className="block text-xs text-muted-foreground">Receipt Scanner, Calendar, AI & more</span>
              </div>
            </div>
            {optionalOpen ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-medium text-foreground">Added Features</h4>
              </div>
              <p className="text-xs text-muted-foreground">Optional extras — enable what you need.</p>
              <p className="text-xs text-primary font-medium">
                Disabling a feature only hides it from view. Your data (receipts, calendar, etc.) is not deleted.
              </p>
              <div className="space-y-1.5 mt-2">
                {MODULE_CONFIG.filter((m) => !m.core && !m.premiumOnly).filter((m) => m.id !== 'cacheAssistant' && m.id !== 'advancedAICache').map((config) => {
                  const isEnabled = enabledModules.includes(config.id);
                  const isCache = config.id === 'cacheAssistant';
                  const Icon = MODULE_ICONS[config.id] ?? Box;
                  return (
                    <div
                      key={config.id}
                      data-testid={`module-${config.id}`}
                      title={config.description}
                      className={`px-3 py-2 border rounded-lg flex items-center gap-3 transition-colors ${isEnabled ? 'bg-primary/5 border-primary/20' : 'border-border'}`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-primary/10 text-primary text-xl leading-none" aria-hidden>
                        {config.id === 'cacheAssistant' || config.id === 'advancedAICache' ? (
                          <BrandCoyoteMark decorativeOnly className="text-xl leading-none" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground min-w-0 flex-1">{config.label}</span>
                      <Checkbox
                        checked={isEnabled}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            if (isCache) enableCache();
                            else enableModule(config.id);
                          } else {
                            disableModule(config.id);
                          }
                        }}
                        aria-label={`${config.label} ${isEnabled ? 'enabled' : 'disabled'}${config.emoji === '🐺' ? brandCoyoteLabelSuffix() : ''}`}
                        className="size-5 shrink-0 rounded"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

          </CollapsibleContent>
        </Collapsible>
      </div>
    </>
  );
}
