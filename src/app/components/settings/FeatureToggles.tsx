import React, { useEffect, useState } from 'react';
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
  optionalFeaturesOpen?: boolean;
  onOptionalFeaturesOpenChange?: (open: boolean) => void;
  coreFeaturesOpen?: boolean;
  onCoreFeaturesOpenChange?: (open: boolean) => void;
  saveScrollForRestore?: () => void;
  restoreScrollAfterLayout?: () => void;
  /** Set by BackupSettings; Jump to Data calls this to open Data Management. */
  jumpToDataRef: MutableRefObject<(() => void) | null>;
}

export function FeatureToggles({
  enabledModules,
  enableModule,
  disableModule,
  enableCache,
  optionalFeaturesOpen = false,
  onOptionalFeaturesOpenChange,
  coreFeaturesOpen = false,
  onCoreFeaturesOpenChange,
  saveScrollForRestore,
  restoreScrollAfterLayout,
  jumpToDataRef,
}: FeatureTogglesProps) {
  const webLLMEnabled = useAppStore((s) => s.webLLMEnabled);
  const setWebLLMEnabled = useAppStore((s) => s.setWebLLMEnabled);
  const webLLMBlockReasons = getWebLLMBlockReasons();
  const webLLMEligible = webLLMBlockReasons.length === 0;
  const webLLMEnvSnapshot = getWebLLMEnvironmentSnapshot();
  const receiptCategoryPreferRegex = useAppStore((s) => s.receiptCategoryPreferRegex);
  const setReceiptCategoryPreferRegex = useAppStore((s) => s.setReceiptCategoryPreferRegex);

  const [optionalOpen, setOptionalOpen] = useState(optionalFeaturesOpen);
  const [coreOpen, setCoreOpen] = useState(coreFeaturesOpen);
  const [showWebLLMDeleteDialog, setShowWebLLMDeleteDialog] = useState(false);

  useEffect(() => {
    setOptionalOpen(optionalFeaturesOpen);
  }, [optionalFeaturesOpen]);
  useEffect(() => {
    setCoreOpen(coreFeaturesOpen);
  }, [coreFeaturesOpen]);

  const handleOptionalOpenChange = (open: boolean) => {
    if (open) {
      saveScrollForRestore?.();
    }
    setOptionalOpen(open);
    onOptionalFeaturesOpenChange?.(open);
    if (open && restoreScrollAfterLayout) {
      requestAnimationFrame(() => requestAnimationFrame(restoreScrollAfterLayout));
    }
  };
  const handleCoreOpenChange = (open: boolean) => {
    if (open) saveScrollForRestore?.();
    setCoreOpen(open);
    onCoreFeaturesOpenChange?.(open);
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
          { id: 'settings-core', label: 'Core features', open: () => setCoreOpen(true) },
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
            onPointerDownCapture={() => saveScrollForRestore?.()}
            onKeyDownCapture={(e) => {
              if (e.key === 'Enter' || e.key === ' ') saveScrollForRestore?.();
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
            onPointerDownCapture={() => saveScrollForRestore?.()}
            onKeyDownCapture={(e) => {
              if (e.key === 'Enter' || e.key === ' ') saveScrollForRestore?.();
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
                {MODULE_CONFIG.filter((m) => !m.core && !m.premiumOnly).map((config) => {
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

            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-sm font-medium text-foreground">Local AI (WebLLM)</h4>
              {webLLMEligible ? (
                <div className="p-3 border border-primary/20 rounded-lg flex flex-col gap-2 bg-primary/5 transition-colors">
                  <p className="text-xs text-muted-foreground" aria-label="Local AI environment on this device">
                    This browser: secure page {webLLMEnvSnapshot.secureContext ? 'yes' : 'no'}, WebGPU{' '}
                    {webLLMEnvSnapshot.webGpuPresent ? 'yes' : 'no'}, cross-origin isolated{' '}
                    {webLLMEnvSnapshot.crossOriginIsolated ? 'yes' : 'no'}
                    {!webLLMEnvSnapshot.crossOriginIsolated && (
                      <span>
                        {' '}
                        (If the model loads but chat never answers, see <span className="font-medium text-foreground">docs/troubleshooting.md</span>{' '}
                        — WebLLM.)
                      </span>
                    )}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">Use local AI model</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Run a small language model in your browser. Checking this downloads the model (hundreds of MB). All data stays on your device.
                      </p>
                    </div>
                    <Checkbox
                      checked={webLLMEnabled}
                      onCheckedChange={async (checked) => {
                        if (checked) {
                          setWebLLMEnabled(true);
                          const toastId = 'webllm-download-settings';
                          toast.loading('Downloading local AI model…', {
                            id: toastId,
                            description: React.createElement(Progress, { value: 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
                          });
                          try {
                            await loadWebLLMEngine((report) => {
                              const p = report.progress != null ? Math.round(report.progress * 100) : undefined;
                              toast.loading(report.text || 'Loading…', {
                                id: toastId,
                                description: React.createElement(Progress, { value: p ?? 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
                              });
                            });
                            toast.success('Local AI model ready.', {
                              id: toastId,
                              description: 'Stored in this browser on your device. You can turn it off or delete it in Settings or in the assistant.',
                            });
                          } catch {
                            toast.dismiss(toastId);
                            toast.error('The assistant couldn\'t load. You can try again from the AI Assistant.');
                            setWebLLMEnabled(false);
                          }
                        } else {
                          setShowWebLLMDeleteDialog(true);
                        }
                      }}
                      aria-label="Use local AI model (WebLLM)"
                      className="size-5 shrink-0 rounded"
                    />
                  </div>
                  {webLLMEnabled ? (
                    <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2.5 py-0.5">{LOCAL_LLM_ACCURACY_NOTE}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Local AI isn’t available on this device or page yet:</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                    {webLLMBlockReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <AlertDialog open={showWebLLMDeleteDialog} onOpenChange={setShowWebLLMDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete downloaded model files?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you want to remove the downloaded AI model files from this device to free space (hundreds of MB)? If you turn the local AI model back on later—here or in the assistant—you will need to redownload the model.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={async () => {
                      setShowWebLLMDeleteDialog(false);
                      await unloadWebLLMEngine();
                      setWebLLMEnabled(false);
                    }}
                  >
                    Keep files
                  </AlertDialogCancel>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4"
                    onClick={async () => {
                      setShowWebLLMDeleteDialog(false);
                      await unloadWebLLMEngine();
                      await clearWebLLMCache();
                      setWebLLMEnabled(false);
                      toast.success('Model deleted. The downloaded AI model has been removed from this device.', {
                        description: 'If you turn the LLM back on (here or in the assistant), it will be redownloaded.',
                      });
                    }}
                  >
                    Delete files
                  </button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {enabledModules.includes('receiptScanner') && (
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-sm font-medium text-foreground">Receipt category</h4>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm text-foreground">Use keyword matching only</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When checked, category is suggested from store names and keywords only (no AI). Can work better for some receipts.
                    </p>
                  </div>
                  <Checkbox
                    checked={receiptCategoryPreferRegex}
                    onCheckedChange={setReceiptCategoryPreferRegex}
                    aria-label="Use keyword matching only for receipt category"
                    className="size-5 shrink-0 rounded"
                  />
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </>
  );
}
