'use client';

import { useSyncExternalStore } from 'react';

const BREAKPOINT = 768;
const QUERY = `(max-width: ${BREAKPOINT - 1}px)`;

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

// Read the real match synchronously on the client so the value is correct on the
// very first client render (no useState/useEffect "false then true" tick). This
// closes the race where the desktop-default `false` briefly let render-gated
// desktop-only work mount on phones (e.g. dynamically importing three.js).
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false; // assume desktop on the server (can't measure)

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
