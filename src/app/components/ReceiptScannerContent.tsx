import { memo, useState } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { Progress } from '@/app/components/ui/progress';
import { ScanCard, ScanCardSkeleton } from '@/app/components/ScanCard';
import { useReceiptScanner } from '@/app/hooks/useReceiptScanner';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { STORAGE_KEYS } from '@/app/constants/storageKeys';
import { ChevronDown, ChevronUp, HelpCircle, X } from 'lucide-react';

export type { ReceiptLineItem, ReceiptScanResult } from '@/app/components/ScanCard';
export { ScanCard, ScanCardSkeleton, generateId, LINE_ITEMS_VISIBLE_HEIGHT } from '@/app/components/ScanCard';
export { roundTo2 } from '@/app/utils/format';

function ReceiptScannerContentInner() {
  const {
    scans,
    scanning,
    scanProgress,
    error,
    glossary,
    savingScanId,
    fileInputRef,
    cameraInputRef,
    handleFileChange,
    handleRemoveScan,
    handleSaveReceipt,
    handleSaveAll,
    clearGlossary,
    loadGlossaryFile,
    updateScan,
  } = useReceiptScanner();
  const { state, api } = useBudget();
  const hasEnvelopes = state.envelopes.length > 0;

  // 1.1 — help popover (replaces always-visible intro paragraph)
  const [helpOpen, setHelpOpen] = useState(false);

  // 1.2 / 3.4 — glossary options disclosure
  const [showGlossaryOptions, setShowGlossaryOptions] = useState(false);

  // 3.1 — first-use guide, shown once then dismissed to localStorage
  const [introDismissed, setIntroDismissed] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.RECEIPT_SCANNER_INTRO_SEEN) === 'true'
  );
  const dismissIntro = () => {
    localStorage.setItem(STORAGE_KEYS.RECEIPT_SCANNER_INTRO_SEEN, 'true');
    setIntroDismissed(true);
  };

  const glossaryCount = Object.keys(glossary).length;
  const unsavedWithAmount = scans.filter((s) => !s.addedToEnvelope && s.amount != null && s.amount !== 0);

  return (
    <div className="space-y-4">

      {/* Header row with title + help icon */}
      <div className="flex items-center gap-2">
        <h3 className="text-lg text-primary">Receipt Scanner</h3>
        {/* 1.1 — help popover instead of always-visible paragraph */}
        <Popover open={helpOpen} onOpenChange={setHelpOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="How does receipt scanning work?"
              title="How it works"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How receipt scanning works</p>
            <p>
              Upload a photo or image of your receipt (JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC) to
              extract the total, merchant, and line items automatically.
            </p>
            <p>
              Results are editable — correct the store name, amounts, and categories before saving.
              You can also load a glossary (JSON) to translate abbreviated item names (e.g. store
              codes) into readable descriptions.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {/* 3.1 — First-use guide (shown once, dismissible) */}
      {!introDismissed && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col gap-2 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-foreground">Getting started</p>
            <button
              type="button"
              onClick={dismissIntro}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Dismiss guide"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ol className="space-y-1 text-muted-foreground list-none">
            <li className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0 mt-0.5">1</span>
              <span><strong className="text-foreground">Scan</strong> — take a photo or upload an image of your receipt.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0 mt-0.5">2</span>
              <span><strong className="text-foreground">Assign</strong> — pick an envelope (budget category) for each line item you want to track.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0 mt-0.5">3</span>
              <span><strong className="text-foreground">Save</strong> — tap Save receipt to add the expenses to your budget and archive the receipt.</span>
            </li>
          </ol>
        </div>
      )}

      {!hasEnvelopes && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm text-foreground" role="status">
          <p className="font-medium mb-1">Create envelopes first</p>
          <p className="text-muted-foreground">
            Create envelopes in Envelopes &amp; Expenses to assign categories to receipt lines. You
            can still save receipts now — they will appear in Receipt Archive and Transaction history
            as uncategorized.
          </p>
        </div>
      )}

      {/* Upload buttons */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="p-6 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/60 hover:bg-primary/5 transition-all disabled:opacity-60 w-full"
          >
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-medium text-foreground">
                {scanning ? 'Scanning…' : 'Upload image'}
              </span>
              <span className="text-xs text-muted-foreground">Choose a file from your device</span>
            </div>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,image/x-portable-pixmap,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic,.ppm"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Choose receipt image from device"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={scanning}
            className="p-6 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/60 hover:bg-primary/5 transition-all disabled:opacity-60 flex flex-col items-center justify-center gap-2 w-full"
          >
            <svg className="w-10 h-10 text-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            <span className="text-sm font-medium text-foreground">
              {scanning ? 'Scanning…' : 'Take photo'}
            </span>
            <span className="text-xs text-muted-foreground">Use your camera</span>
          </button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Take photo of receipt with camera"
        />
      </div>

      {/* 1.2 / 3.4 — Glossary in collapsible "Advanced options" with persistent chip */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowGlossaryOptions((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
            aria-expanded={showGlossaryOptions}
          >
            {showGlossaryOptions ? <ChevronUp className="w-3 h-3" aria-hidden /> : <ChevronDown className="w-3 h-3" aria-hidden />}
            <span>Advanced options</span>
          </button>
          {/* 3.4 — Persistent glossary chip when loaded */}
          {glossaryCount > 0 && !showGlossaryOptions && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Glossary: {glossaryCount} {glossaryCount === 1 ? 'entry' : 'entries'}
              <button
                type="button"
                onClick={clearGlossary}
                className="ml-0.5 hover:text-destructive transition-colors focus:outline-none"
                aria-label="Clear glossary"
                title="Clear glossary"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
        </div>
        {showGlossaryOptions && (
          <div className="flex flex-wrap items-center gap-3 pl-4 text-sm">
            <span className="text-muted-foreground text-xs">Item name glossary:</span>
            <label className="flex items-center gap-1 cursor-pointer text-primary hover:underline text-xs">
              <input type="file" accept=".json,application/json" className="sr-only" onChange={loadGlossaryFile} aria-label="Load glossary file" />
              Load JSON
            </label>
            <a href="/data/receipt-glossary-sample.json" download className="text-primary hover:underline text-xs">
              Download sample
            </a>
            {glossaryCount > 0 && (
              <>
                <span className="text-muted-foreground text-xs">{glossaryCount} {glossaryCount === 1 ? 'entry' : 'entries'} loaded</span>
                <button
                  type="button"
                  onClick={clearGlossary}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {scanning && (
        <div className="space-y-1.5 pt-2" role="status" aria-live="polite" aria-label="Receipt scan in progress">
          <Progress value={scanProgress} className="h-2.5 w-full" />
          <p className="text-xs text-muted-foreground">Scanning receipt… {scanProgress}%</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="pt-4 border-t border-border">
        {/* 1.3 — Count badge in heading + 3.3 — Save all button */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <h4 className="text-sm font-medium text-foreground">
            Recent scans{scans.length > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({scans.length})</span>}
          </h4>
          {unsavedWithAmount.length > 1 && !scanning && (
            <button
              type="button"
              onClick={handleSaveAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Save all ({unsavedWithAmount.length})
            </button>
          )}
        </div>

        {scans.length === 0 && !scanning ? (
          <p className="text-xs text-muted-foreground">No receipts scanned yet. Upload an image above.</p>
        ) : (
          <ul className="space-y-3">
            {scanning && <ScanCardSkeleton />}
            {scans.map((scan) => (
              <ScanCard
                key={scan.id}
                scan={scan}
                hasEnvelopes={hasEnvelopes}
                envelopes={state.envelopes}
                isSaving={savingScanId === scan.id}
                onUpdate={(updates) => updateScan(scan.id, updates)}
                onSave={handleSaveReceipt}
                onRemoveScan={handleRemoveScan}
                onAddEnvelope={(name, limit) => {
                  const env = api.addEnvelope(name, limit);
                  return { id: env.id, name: env.name };
                }}
                glossary={glossary}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export const ReceiptScannerContent = memo(ReceiptScannerContentInner);
