"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";

const BackNavigationContext = createContext<RefObject<boolean> | null>(null);

export function BackNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const canGoBack = useRef(false);

  useEffect(() => {
    if (lastPath.current === null) {
      const referrer = document.referrer;
      canGoBack.current = Boolean(referrer && new URL(referrer).origin === window.location.origin);
    } else if (lastPath.current !== pathname) {
      canGoBack.current = true;
    }
    lastPath.current = pathname;
  }, [pathname]);

  return <BackNavigationContext.Provider value={canGoBack}>{children}</BackNavigationContext.Provider>;
}

export function BackLink() {
  const router = useRouter();
  const canGoBack = useContext(BackNavigationContext);

  return <Link className="text-link" href="/" onClick={(event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (canGoBack?.current && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }}>Back</Link>;
}
