"use client";

import { useState, useEffect } from "react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function StorageUsage() {
  const [usage, setUsage] = useState<number | null>(null);
  const [quota, setQuota] = useState<number | null>(null);

  const refresh = () => {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage.estimate().then(({ usage: u, quota: q }) => {
        setUsage(u ?? null);
        setQuota(q ?? null);
      });
    }
  };

  useEffect(() => {
    refresh();
    const onVis = () => refresh();
    window.addEventListener("focus", onVis);
    return () => window.removeEventListener("focus", onVis);
  }, []);

  if (usage === null && quota === null) return null;

  const used = usage ?? 0;
  const total = quota ?? 0;
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded text-xs text-muted-foreground bg-card"
      role="status"
      aria-live="polite"
      aria-label={`Storage: ${formatBytes(used)} used of ${formatBytes(total)}`}
    >
      <span className="font-medium tabular-nums">
        {formatBytes(used)} used
      </span>
      <span aria-hidden>/</span>
      <span className="tabular-nums">
        {total > 0 ? formatBytes(total) : "—"} left
      </span>
      {total > 0 && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{pct}%</span>
        </>
      )}
    </div>
  );
}
