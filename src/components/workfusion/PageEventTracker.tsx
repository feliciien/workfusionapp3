"use client";

import { useEffect } from "react";
import { attributionFrom } from "@/lib/workfusion/source-attribution";

function guestId() {
  const key = "workfusion_guest_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = `guest_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  window.localStorage.setItem(key, value);
  return value;
}

export function PageEventTracker({ path }: { path?: string }) {
  useEffect(() => {
    const currentPath = path || window.location.pathname;
    const attribution = attributionFrom({
      referrer: document.referrer,
      url: window.location.href,
      path: currentPath,
    });
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workfusion-guest-id": guestId() },
      body: JSON.stringify({
        path: currentPath,
        referrer: document.referrer,
        url: window.location.href,
        sourceTag: attribution.sourceTag,
        conversionPath: attribution.conversionPath,
      }),
    }).catch(() => undefined);
  }, [path]);

  return null;
}
