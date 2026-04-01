import { useState, useEffect, useCallback, memo } from 'react';
import { getAppData, setAppData } from '@/app/services/appDataIdb';
import type { ReceiptArchiveItem } from '@/app/services/appDataIdb';
import { getCurrencySymbol } from '@/app/utils/format';
import { formatDate } from '@/app/utils/format';
import { delayedToast } from '@/app/services/delayedToast';
import { Dialog, DialogContent, DialogTitle } from '@/app/components/ui/dialog';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';
import { Archive, Trash2, ImageOff } from 'lucide-react';

function ReceiptArchiveContentInner() {
  const [archives, setArchives] = useState<ReceiptArchiveItem[]>([]);
  const [viewing, setViewing] = useState<ReceiptArchiveItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRemoveReceiptArchiveDialog, setShowRemoveReceiptArchiveDialog] = useState(false);
  const [removeReceiptArchiveTargetId, setRemoveReceiptArchiveTargetId] = useState<string | null>(null);

  const loadArchives = useCallback(() => {
    getAppData()
      .then((data) => {
        const list = Array.isArray(data.receiptArchives) ? data.receiptArchives : [];
        setArchives(list);
      })
      .catch(() => {
        setArchives([]);
        delayedToast.error('Could not load receipt archive.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  const removeArchive = (id: string) => {
    setArchives((prev) => prev.filter((a) => a.id !== id));
    getAppData().then((data) => {
      const next = (data.receiptArchives ?? []).filter((a) => a.id !== id);
      setAppData({ ...data, receiptArchives: next.length ? next : undefined }).catch(() =>
        delayedToast.error('Could not update archive.')
      );
    });
    if (viewing?.id === id) setViewing(null);
    delayedToast.success('Receipt removed from archive.');
  };

  const deleteImageKeepData = (id: string) => {
    setArchives((prev) =>
      prev.map((a) => (a.id === id ? { ...a, imageData: undefined } : a))
    );
    getAppData().then((data) => {
      const next = (data.receiptArchives ?? []).map((a) =>
        a.id === id ? { ...a, imageData: undefined } : a
      );
      setAppData({ ...data, receiptArchives: next }).catch(() =>
        delayedToast.error('Could not update archive.')
      );
    });
    if (viewing?.id === id) setViewing((v) => (v ? { ...v, imageData: undefined } : null));
    delayedToast.success('Image removed. Receipt data kept.');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg text-primary">Receipt Archive</h3>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-primary">Receipt Archive</h3>
      <p className="text-sm text-muted-foreground">
        Saved receipts appear here. You can view the image and data, remove the image to save space (data is kept), or delete the whole entry. Deleting a receipt here removes it from the archive only; any transaction already added to your budget will remain in Transactions.
      </p>
      {archives.length === 0 ? (
        <p className="text-sm text-muted-foreground">No receipts in the archive yet. Save a receipt from Receipt Scanner to add it here.</p>
      ) : (
        <ul className="space-y-3">
          {archives.map((item) => {
            const s = item.scan;
            const currencySymbol = getCurrencySymbol(s.currency);
            const savedDateStr = formatDate(item.savedAt);
            return (
              <li
                key={item.id}
                className="p-3 bg-card border border-border rounded-lg flex flex-wrap items-center gap-3"
              >
                {item.imageData ? (
                  <button
                    type="button"
                    onClick={() => setViewing(item)}
                    className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted object-cover hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label={`View receipt ${s.description}`}
                  >
                    <img src={item.imageData} alt="" className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <div
                    className="shrink-0 w-16 h-16 rounded-lg border border-dashed border-border bg-muted flex items-center justify-center"
                    aria-hidden
                  >
                    <Archive className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.description || 'Receipt'}</p>
                  <p className="text-xs text-muted-foreground">{savedDateStr}</p>
                  {s.amount != null && (
                    <p className="text-xs text-foreground tabular-nums mt-0.5">
                      {currencySymbol}{s.amount.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setViewing(item)}
                    className="text-sm py-1 px-2 rounded border border-primary/30 hover:bg-primary/10 text-foreground"
                  >
                    View
                  </button>
                  {item.imageData && (
                    <button
                      type="button"
                      onClick={() => deleteImageKeepData(item.id)}
                      className="text-sm py-1 px-2 rounded border border-border hover:bg-muted text-foreground flex items-center gap-1"
                      title="Remove image but keep receipt data to save space"
                      aria-label="Remove image, keep data"
                    >
                      <ImageOff className="w-3.5 h-3.5" /> Remove image
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveReceiptArchiveTargetId(item.id);
                      setShowRemoveReceiptArchiveDialog(true);
                    }}
                    className="text-sm py-1 px-2 rounded border border-destructive/50 hover:bg-destructive/10 text-destructive flex items-center gap-1"
                    aria-label="Delete receipt from archive"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          {viewing && (
            <>
              <DialogTitle>{viewing.scan.description || 'Receipt'}</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Saved {formatDate(viewing.savedAt)}
                {viewing.scan.date && ` · Receipt date: ${formatDate(viewing.scan.date)}`}
              </p>
              {viewing.imageData && (
                <div className="my-3">
                  <img
                    src={viewing.imageData}
                    alt="Receipt"
                    className="w-full rounded-lg border border-border max-h-96 object-contain bg-muted"
                  />
                </div>
              )}
              <div className="text-sm space-y-2 border-t border-border pt-3">
                {viewing.scan.amount != null && (
                  <p className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Total</span>
                    <span className="tabular-nums font-medium">
                      {getCurrencySymbol(viewing.scan.currency)}{viewing.scan.amount.toFixed(2)}
                    </span>
                  </p>
                )}
                {viewing.scan.lineItems && viewing.scan.lineItems.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1">Line items</p>
                    <ul className="space-y-1 text-xs">
                      {viewing.scan.lineItems.map((li, i) => (
                        <li key={i} className="flex justify-between gap-2 items-center">
                          <span className="truncate flex items-center gap-1.5">
                            {li.description}
                            {(li as { isTax?: boolean }).isTax === true && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0" title="Tax line">Tax</span>
                            )}
                            {(li as { excludeFromBudget?: boolean }).excludeFromBudget === true && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0" title="Not added to budget">
                                Excluded
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums shrink-0">
                            {getCurrencySymbol(viewing.scan.currency)}{li.amount.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showRemoveReceiptArchiveDialog}
        onOpenChange={(open) => {
          setShowRemoveReceiptArchiveDialog(open);
          if (!open) setRemoveReceiptArchiveTargetId(null);
        }}
        title="Remove from archive?"
        description="Any transaction already added to your budget will remain in Transactions."
        confirmLabel="Remove receipt"
        onConfirm={() => {
          if (removeReceiptArchiveTargetId) removeArchive(removeReceiptArchiveTargetId);
          setRemoveReceiptArchiveTargetId(null);
        }}
      />
    </div>
  );
}

export const ReceiptArchiveContent = memo(ReceiptArchiveContentInner);
