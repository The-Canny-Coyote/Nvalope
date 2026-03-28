/**
 * Returns true when the viewport is at or below the mobile breakpoint (768px).
 * Used to show the bottom card bar instead of the wheel on small screens.
 */

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT_PX = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
