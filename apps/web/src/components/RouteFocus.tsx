import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    let frame: number | undefined;
    const focusRouteTarget = () => {
      const initialControl = document.querySelector<HTMLElement>('[data-route-initial-focus]');
      const routeHeading = document.querySelector<HTMLElement>('[data-route-heading]');
      const target = initialControl ?? routeHeading;
      if (target === null) return false;
      frame = window.requestAnimationFrame(() => target.focus());
      return true;
    };

    const observer = new MutationObserver(() => {
      if (focusRouteTarget()) observer.disconnect();
    });
    if (!focusRouteTarget()) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    const timeout = window.setTimeout(() => observer.disconnect(), 2_000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);
  return null;
}
