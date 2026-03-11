"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useBudget } from "@/app/store/BudgetContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/app/components/ui/sheet";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";
import { cn } from "@/app/components/ui/utils";
import { AlertTriangle, Sparkles } from "lucide-react";
import { getAdvancedAssistantReply } from "@/app/services/advancedAssistant";
import { getAssistantReply } from "@/app/services/basicAssistant";
import {
  loadWebLLMEngine,
  getWebLLMReply,
  isWebLLMEligible,
  isWebLLMEngineLoaded,
  unloadWebLLMEngine,
  clearWebLLMCache,
  type BudgetSummaryForWebLLM,
} from "@/app/services/webLLMAssistant";
import { getAnalyticsInsight } from "@/app/utils/analyticsInsight";
import { getDevicePerformanceTier } from "@/app/utils/deviceCapabilities";
import { useAppStore } from "@/app/store/appStore";
import { AppErrorBoundary } from "@/app/components/AppErrorBoundary";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";

const QUICK_QUESTIONS = [
  "How much have I spent?",
  "What's left in my budget?",
  "How much income do I have?",
  "What envelopes do I have?",
  "How do I add an expense?",
];

const BASIC_WELCOME =
  "Hi! I'm Cache the AI Assistant, your budget assistant. Ask me how much you've spent, what's left, or how to add an expense. All answers use your data from this app—nothing leaves your device.";

const ADVANCED_WELCOME =
  "Hi! I'm Cache the AI Assistant with Advanced AI—predictive insights and smarter suggestions. Ask me about your budget, spending patterns, or how to add expenses. All data stays on your device.";

const FINANCIAL_DISCLAIMER =
  "Suggestions here are for budgeting only and do not constitute financial, tax, or investment advice.";

export type ChatMessage = { role: "user" | "assistant"; content: string };

interface AIChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiMode?: "basic" | "advanced";
  onFallbackToBasic?: () => void;
  fallbackReason?: string;
  /** Restored from backup/app data */
  initialMessages?: ChatMessage[];
  /** Called when messages change (for backup persistence) */
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

const getDefaultMessages = (aiMode: "basic" | "advanced"): ChatMessage[] => [
  { role: "assistant", content: aiMode === "advanced" ? ADVANCED_WELCOME : BASIC_WELCOME },
];

export function AIChatSheet({
  open,
  onOpenChange,
  aiMode = "basic",
  onFallbackToBasic,
  fallbackReason,
  initialMessages,
  onMessagesChange,
}: AIChatSheetProps) {
  const { state, getBudgetSummaryForCurrentPeriod } = useBudget();
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages?.length ? initialMessages : getDefaultMessages(aiMode)
  );
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAppliedInitialRef = useRef(!!initialMessages?.length);
  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;

  const getSummary = useCallback(() => {
    try {
      const { summary, periodLabel } = getBudgetSummaryForCurrentPeriod();
      return {
        ...summary,
        analyticsInsight: getAnalyticsInsight(state),
        periodLabel: periodLabel || undefined,
      };
    } catch {
      return {
        totalIncome: 0,
        totalBudgeted: 0,
        totalSpent: 0,
        remaining: 0,
        envelopes: [],
        recentTransactions: [],
        analyticsInsight: undefined,
        periodLabel: undefined,
      };
    }
  }, [getBudgetSummaryForCurrentPeriod, state]);

  const performanceTier = useMemo(() => getDevicePerformanceTier(), []);
  const webLLMEnabled = useAppStore((s) => s.webLLMEnabled);
  const assistantUseLLM = useAppStore((s) => s.assistantUseLLM);
  const setAssistantUseLLM = useAppStore((s) => s.setAssistantUseLLM);
  const [webLLMStatus, setWebLLMStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle');
  const [showDeleteModelDialog, setShowDeleteModelDialog] = useState(false);
  const [webLLMLoadProgress, setWebLLMLoadProgress] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const cancelSendRef = useRef<(() => void) | null>(null);

  const webLLMAvailable = useMemo(() => isWebLLMEligible(), []);

  // Apply initialMessages when they load after mount
  useEffect(() => {
    if (initialMessages?.length && !hasAppliedInitialRef.current) {
      hasAppliedInitialRef.current = true;
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages]);

  // Persist messages for backup (only when messages change; ref avoids re-run on parent re-render)
  useEffect(() => {
    onMessagesChangeRef.current?.(messages);
  }, [messages]);

  // Sync welcome message to current aiMode when sheet opens (only if still on initial welcome)
  useEffect(() => {
    if (!open) return;
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0].role !== "assistant") return prev;
      const current = prev[0].content;
      const welcome = aiMode === "advanced" ? ADVANCED_WELCOME : BASIC_WELCOME;
      if (current === welcome) return prev;
      if (current === BASIC_WELCOME || current === ADVANCED_WELCOME) {
        return [{ role: "assistant", content: welcome }];
      }
      return prev;
    });
  }, [open, aiMode]);

  useEffect(() => {
    if (open && webLLMEnabled && !webLLMAvailable && webLLMStatus === 'idle') {
      setWebLLMStatus('unavailable');
    }
  }, [open, webLLMEnabled, webLLMAvailable, webLLMStatus]);

  // If user enabled WebLLM in Settings and the model already loaded there, mark ready so we don't show loading again.
  useEffect(() => {
    if (open && webLLMEnabled && webLLMAvailable && webLLMStatus === 'idle' && isWebLLMEngineLoaded()) {
      setWebLLMStatus('ready');
    }
  }, [open, webLLMEnabled, webLLMAvailable, webLLMStatus]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setInput("");
      const withUser = [...messages, { role: "user" as const, content: trimmed }];
      setMessages(withUser);
      flushSync(() => setIsSending(true));
      // Below, `messages` is the conversation before this user message (correct for both rule-based and WebLLM).

      const appendRuleBasedReply = () => {
        try {
          const lastAssistantContent = [...messages].reverse().find((m) => m.role === "assistant")?.content;
          const lastUserContent = [...messages].reverse().find((m) => m.role === "user")?.content;
          const reply =
            aiMode === "advanced"
              ? getAdvancedAssistantReply(messages, trimmed, getSummary, { lastAssistantContent, lastUserContent })
              : getAssistantReply(trimmed, getSummary, performanceTier);
          const safeReply = typeof reply === "string" && reply.trim() ? reply : "I'm not sure how to answer that. Try asking about your budget, spending, or how to add an expense.";
          setMessages((prev) => [...prev, { role: "assistant", content: safeReply }]);
        } catch {
          setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong on my side. Please try again or ask something else." }]);
        }
      };

      if (!webLLMEnabled || !assistantUseLLM || !webLLMAvailable || webLLMStatus === 'error' || webLLMStatus === 'unavailable') {
        appendRuleBasedReply();
        setIsSending(false);
        return;
      }

      const WEBLLM_TOAST_ID = 'webllm-download';
      const runWebLLMPath = async (): Promise<string> => {
        if (webLLMStatus !== 'ready') {
          setWebLLMStatus('loading');
          setWebLLMLoadProgress('Loading model…');
          toast.loading('Downloading local AI model…', {
            id: WEBLLM_TOAST_ID,
            description: React.createElement(Progress, { value: 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
          });
          await loadWebLLMEngine((report) => {
            setWebLLMLoadProgress(report.text || 'Loading…');
            const p = report.progress != null ? Math.round(report.progress * 100) : undefined;
            toast.loading(report.text || 'Loading…', {
              id: WEBLLM_TOAST_ID,
              description: React.createElement(Progress, { value: p ?? 0, className: 'mt-1.5 h-2.5 w-full min-w-[160px]' }),
            });
          });
          toast.success('Local AI model ready.', {
            id: WEBLLM_TOAST_ID,
            description: 'Stored in this browser on your device. You can turn it off or delete it anytime in the assistant or in Settings.',
          });
          setWebLLMLoadProgress(null);
          setWebLLMStatus('ready');
        }

        const summary = getSummary();
        const envelopes = state && typeof state === 'object' && 'envelopes' in state ? (state as { envelopes: Array<{ id: string; name: string }> }).envelopes : [];
        const summaryForWebLLM: BudgetSummaryForWebLLM = {
          totalIncome: summary.totalIncome,
          totalBudgeted: summary.totalBudgeted,
          totalSpent: summary.totalSpent,
          remaining: summary.remaining,
          envelopes: summary.envelopes.map((e) => ({ name: e.name, limit: e.limit, spent: e.spent, remaining: e.remaining })),
          analyticsInsight: summary.analyticsInsight,
          periodLabel: summary.periodLabel,
          recentTransactions: summary.recentTransactions?.map((tx) => ({
            amount: tx.amount,
            description: tx.description ?? '',
            envelopeName: tx.envelopeId ? envelopes.find((e) => e.id === tx.envelopeId)?.name : undefined,
          })),
        };
        return await getWebLLMReply(
          summaryForWebLLM,
          messages.map((m) => ({ role: m.role, content: m.content })),
          trimmed,
          aiMode
        );
      };

      const WEBLLM_TIMEOUT_MS = 120_000; // 2 min: load + reply; avoid hanging so premade clicks always get a reply
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Local AI timed out')), WEBLLM_TIMEOUT_MS);
      });
      const cancelPromise = new Promise<never>((_, reject) => {
        cancelSendRef.current = () => reject(new Error('Cancelled'));
      });

      try {
        const reply = await Promise.race([runWebLLMPath(), timeoutPromise, cancelPromise]);
        const isValidReply = typeof reply === 'string' && reply.trim().length > 0;
        if (isValidReply) {
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        } else {
          setWebLLMStatus('error');
          toast.error('The assistant couldn\'t answer right now. You can keep using the built-in replies.');
          try {
            const fallbackReply =
              aiMode === "advanced"
                ? getAdvancedAssistantReply(messages, trimmed, getSummary, {
                    lastAssistantContent: [...messages].reverse().find((m) => m.role === "assistant")?.content,
                    lastUserContent: [...messages].reverse().find((m) => m.role === "user")?.content,
                  })
                : getAssistantReply(trimmed, getSummary, performanceTier);
            const safeReply = typeof fallbackReply === "string" && fallbackReply.trim() ? fallbackReply : "I'm not sure how to answer that. Try asking about your budget or spending.";
            setMessages((prev) => [...prev, { role: "assistant", content: safeReply }]);
          } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
          }
        }
      } catch (err) {
        toast.dismiss(WEBLLM_TOAST_ID);
        const isCancel = err instanceof Error && err.message === 'Cancelled';
        if (isCancel) {
          // User cancelled; leave user message, no reply, no error state
        } else {
          setWebLLMStatus('error');
          setWebLLMLoadProgress(null);
          toast.error(webLLMStatus === 'loading' ? 'The assistant took too long or couldn\'t respond. You can keep using the built-in replies.' : 'The assistant couldn\'t load. You can keep using the built-in replies.');
          try {
            const fallbackReply =
              aiMode === "advanced"
                ? getAdvancedAssistantReply(messages, trimmed, getSummary, {
                    lastAssistantContent: [...messages].reverse().find((m) => m.role === "assistant")?.content,
                    lastUserContent: [...messages].reverse().find((m) => m.role === "user")?.content,
                  })
                : getAssistantReply(trimmed, getSummary, performanceTier);
            const safeReply = typeof fallbackReply === "string" && fallbackReply.trim() ? fallbackReply : "I'm not sure how to answer that. Try asking about your budget or spending.";
            setMessages((prev) => [...prev, { role: "assistant", content: safeReply }]);
          } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
          }
        }
      } finally {
        cancelSendRef.current = null;
        setIsSending(false);
      }
    },
    [
      messages,
      aiMode,
      getSummary,
      performanceTier,
      state,
      webLLMEnabled,
      assistantUseLLM,
      webLLMAvailable,
      webLLMStatus,
    ]
  );

  const handleTurnOffLLMInAssistant = () => {
    setShowDeleteModelDialog(true);
  };

  const handleDeleteModelChoice = useCallback(async (deleteFiles: boolean) => {
    setShowDeleteModelDialog(false);
    await unloadWebLLMEngine();
    if (deleteFiles) await clearWebLLMCache();
    setAssistantUseLLM(false);
    setWebLLMStatus('idle');
    if (deleteFiles) {
      toast.success('The downloaded assistant model has been removed from this device.', {
        description: 'You can turn it back on here or in Settings if you want to use it again.',
      });
    }
  }, [setAssistantUseLLM]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full max-w-md p-0">
        <SheetHeader className="border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none" aria-hidden>🐺</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="m-0">
                  {aiMode === "advanced"
                    ? "Cache the AI Assistant — Advanced AI"
                    : performanceTier === "high"
                      ? "Cache the AI Assistant — Basic+"
                      : "Cache the AI Assistant"}
                </SheetTitle>
                {aiMode === "advanced" && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary border border-primary/30"
                    aria-label="Advanced enabled"
                  >
                    <Sparkles className="w-3.5 h-3.5" aria-hidden />
                    Advanced
                  </span>
                )}
              </div>
              <SheetDescription>
                {aiMode === "advanced"
                  ? "Context-aware answers. All data stays on your device."
                  : performanceTier === "high"
                    ? "Extra insights on this device. All data stays on your device."
                    : "Budget help. All data stays on your device."}
              </SheetDescription>
              <p className="text-xs text-muted-foreground mt-1">{FINANCIAL_DISCLAIMER}</p>
              {webLLMEnabled && webLLMStatus === 'ready' && (
                <p className="text-xs text-primary mt-1" role="status" aria-live="polite">
                  Using local AI
                </p>
              )}
              {webLLMStatus === 'error' && (
                <p className="text-xs text-muted-foreground mt-1" role="status" aria-live="polite">
                  Local AI unavailable; using built-in replies.
                </p>
              )}
            </div>
          </div>
          {webLLMAvailable && webLLMEnabled && (
            <div className="px-4 pb-3 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">Use local LLM model</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Regular mode uses built-in replies only: it matches keywords and gives short answers. It cannot hold a long conversation or answer in natural language like the LLM.
                  </p>
                </div>
                <Checkbox
                  checked={assistantUseLLM}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setAssistantUseLLM(true);
                    } else {
                      handleTurnOffLLMInAssistant();
                    }
                  }}
                  aria-label="Use local LLM model in this assistant"
                  className="size-5 shrink-0 rounded"
                />
              </div>
            </div>
          )}
          <AlertDialog open={showDeleteModelDialog} onOpenChange={setShowDeleteModelDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete downloaded model files?</AlertDialogTitle>
                <AlertDialogDescription>
                  Do you want to remove the downloaded AI model files from this device to free space (hundreds of MB)? If you turn the LLM back on later—here or in Settings—you will need to redownload the model.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => handleDeleteModelChoice(false)}>Keep files</AlertDialogCancel>
                <Button variant="destructive" onClick={() => handleDeleteModelChoice(true)}>Delete files</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {aiMode === "advanced" && onFallbackToBasic && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={onFallbackToBasic}
              >
                Switch to Basic AI
              </Button>
            )}
        </SheetHeader>

        {performanceTier === 'high' && webLLMAvailable && webLLMEnabled && (
          <Alert
            variant="default"
            className="mx-4 mt-3 shrink-0 border-amber-500/60 bg-amber-500/10 text-amber-900 dark:border-amber-400/50 dark:bg-amber-500/15 dark:text-amber-200 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400"
            role="status"
          >
            <AlertTriangle className="size-4" aria-hidden />
            <AlertTitle className="text-amber-800 dark:text-amber-100">Known issue with local AI (Basic+)</AlertTitle>
            <AlertDescription>
              We’re aware the Basic+ assistant with the local LLM can be unreliable and we’re working to fix it. In the meantime, turn off “Use local LLM model” above to use regular mode—it’s more reliable but has fewer capabilities than the LLM.
            </AlertDescription>
          </Alert>
        )}

        {fallbackReason && (
          <div
            className="shrink-0 px-4 py-2 bg-muted/80 border-b text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {fallbackReason}
          </div>
        )}

        {(webLLMStatus === 'loading' || isSending) && webLLMEnabled && (
          <div
            className="shrink-0 px-4 py-2 bg-muted/80 border-b text-sm text-muted-foreground flex items-center justify-between gap-2"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span>{webLLMLoadProgress ?? 'Getting reply…'}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs shrink-0"
              onClick={() => cancelSendRef.current?.()}
              aria-label="Cancel and use built-in replies"
            >
              Cancel
            </Button>
          </div>
        )}

        <AppErrorBoundary
          fallback={
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center" role="alert" aria-live="assertive">
              <p className="text-sm text-muted-foreground">Chat unavailable. Try again or reload the page.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="flex flex-1 flex-col min-h-0">
            <div
              className="flex-1 overflow-y-auto px-4 py-3 min-h-0"
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
            >
              <div className="space-y-4 pb-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      m.role === "user"
                        ? "ml-8 bg-primary text-primary-foreground"
                        : "mr-8 bg-muted text-foreground"
                    )}
                  >
                    {(typeof m.content === 'string' ? m.content : '').split("\n").map((line, j) => (
                      <p key={j}>
                        {line.split(/\*\*(.*?)\*\*/g).map((part, k) =>
                          k % 2 === 1 ? <strong key={k}>{part}</strong> : part
                        )}
                      </p>
                    ))}
                  </div>
                ))}
                {isSending && (
                  <div className="mr-8 flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground" role="status" aria-live="polite" aria-label="Assistant is thinking">
                    <span className="flex gap-0.5" aria-hidden>
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '300ms' }} />
                    </span>
                    <span className="sr-only">Thinking…</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t p-4 shrink-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <Button
                    key={q}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-1.5 px-2"
                    onClick={() => send(q)}
                    disabled={webLLMStatus === 'loading' || isSending}
                  >
                    {q}
                  </Button>
                ))}
              </div>
              <form onSubmit={handleSubmit} className="flex gap-2" encType="application/x-www-form-urlencoded">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your budget..."
                  className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label="Message"
                  disabled={webLLMStatus === 'loading' || isSending}
                />
                <Button type="submit" size="sm" className="shrink-0" disabled={webLLMStatus === 'loading' || isSending}>
                  Send
                </Button>
              </form>
            </div>
          </div>
        </AppErrorBoundary>
      </SheetContent>
    </Sheet>
  );
}
