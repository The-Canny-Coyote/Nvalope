import { memo } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { Progress } from '@/app/components/ui/progress';
import { ScanCard } from '@/app/components/ScanCard';
import { useReceiptScanner } from '@/app/hooks/useReceiptScanner';

export type { ReceiptLineItem, ReceiptScanResult } from '@/app/components/ScanCard';
export { ScanCard, roundTo2, generateId, LINE_ITEMS_VISIBLE_HEIGHT } from '@/app/components/ScanCard';

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
    loadGlossaryFile,
    updateScan,
  } = useReceiptScanner();
  const { state, api } = useBudget();
  const hasEnvelopes = state.envelopes.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-lg text-primary">Receipt Scanner</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Upload a photo or image of your receipt (JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC) to extract the total, merchant, and line items. You can edit results and load a glossary to translate item names (e.g. store abbreviations).
      </p>

      {!hasEnvelopes && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm text-foreground" role="status">
          <p className="font-medium mb-1">Create envelopes first</p>
          <p className="text-muted-foreground">
            Create envelopes in Envelopes &amp; Expenses to assign categories to receipt lines. You can still save receipts now—they will appear in Receipt Archive and in Transaction history as uncategorized. After creating envelopes, edit those transactions to assign categories and envelopes will update for that month.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Item names:</span>
        <label className="flex items-center gap-1 cursor-pointer text-primary hover:underline">
          <input type="file" accept=".json,application/json" className="sr-only" onChange={loadGlossaryFile} aria-label="Load glossary file" />
          Load glossary (JSON)
        </label>
        <a href="/data/receipt-glossary-sample.json" download className="text-primary hover:underline">
          Download sample
        </a>
        {Object.keys(glossary).length > 0 && (
          <span className="text-muted-foreground text-xs">({Object.keys(glossary).length} entries)</span>
        )}
      </div>

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
            <span className="text-xs text-muted-foreground">Use your camera or choose an existing image</span>
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
        <h4 className="text-sm font-medium text-foreground mb-2">Recent scans</h4>
        {scans.length === 0 ? (
          <p className="text-xs text-muted-foreground">No receipts scanned yet. Upload an image above.</p>
        ) : (
          <ul className="space-y-3">
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
