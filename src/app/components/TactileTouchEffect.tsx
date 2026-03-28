import { useEffect } from 'react';

const TACTILE_GIVE_CLASS = 'tactile-touch-give';

/**
 * When Tactile mode is active, adds delegated touch listeners for:
 * - Visual "give": brief scale(1.02) on touchstart (respects prefers-reduced-motion).
 * - Haptic: navigator.vibrate(50) on touchend when supported.
 * Listener is attached to document; only handles targets inside the app (role="application").
 */
export function TactileTouchEffect({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;

    const app = document.querySelector('[role="application"]');
    if (!app) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (!target || !app.contains(target)) return;
      const interactive = target.closest('button, a[href], [role="button"]');
      if (!interactive || !(interactive instanceof HTMLElement)) return;
      if (!reducedMotion) {
        interactive.classList.add(TACTILE_GIVE_CLASS);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (!target || !app.contains(target)) return;
      const interactive = target.closest('button, a[href], [role="button"]');
      if (!interactive || !(interactive instanceof HTMLElement)) return;
      interactive.classList.remove(TACTILE_GIVE_CLASS);
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(50);
      }
    };

    const handleTouchCancel = (e: TouchEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (!target || !app.contains(target)) return;
      const interactive = target.closest('button, a[href], [role="button"]');
      if (interactive instanceof HTMLElement) {
        interactive.classList.remove(TACTILE_GIVE_CLASS);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
      app.querySelectorAll(`.${TACTILE_GIVE_CLASS}`).forEach((el) => el.classList.remove(TACTILE_GIVE_CLASS));
    };
  }, [active]);

  return null;
}
