"use client";

import { useEffect } from "react";

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
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workfusion-guest-id": guestId() },
      body: JSON.stringify({ path: path || window.location.pathname, referrer: document.referrer }),
    }).catch(() => undefined);
  }, [path]);

  return null;
}
