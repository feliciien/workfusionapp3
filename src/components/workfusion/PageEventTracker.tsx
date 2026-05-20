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

    const startedAt = performance.now();
    let sent = false;
    const sendTimeOnPage = () => {
      if (sent) return;
      const durationMs = Math.round(performance.now() - startedAt);
      if (durationMs < 3000) return;
      sent = true;
      const payload = {
        eventType: "time_on_page",
        feature: "page_engagement",
        page: currentPath,
        referrer: document.referrer,
        url: window.location.href,
        sourceTag: attribution.sourceTag,
        conversionPath: attribution.conversionPath,
        metadata: {
          durationMs,
          durationSeconds: Math.round(durationMs / 1000),
        },
      };
      fetch("/api/analytics/usage", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", "x-workfusion-guest-id": guestId() },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendTimeOnPage();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", sendTimeOnPage);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", sendTimeOnPage);
      sendTimeOnPage();
    };
  }, [path]);

  return null;
}
