"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/context/auth-context";
import { ROUTES } from "@/app/pages/config/routes";
import { logger } from "@/lib/logger";
import { captureIDB } from "../services/capture-idb";
import {
  CAPTURE_RECOVERY_ACTION_KEY,
  type CaptureRecoveryAction,
} from "../services/capture-recovery-bridge";

const PUBLIC_PREFIXES = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.selectOrg,
  ROUTES.orgPassword,
  "/",
];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((route) => route !== "/" && pathname.startsWith(route));
}

export function CaptureRecoveryGate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [hasPendingUpload, setHasPendingUpload] = useState(false);
  const [sessionIdForDiscard, setSessionIdForDiscard] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setOpen(false);
      return;
    }
    if (isPublicPath(pathname)) return;
    if (pathname?.startsWith(ROUTES.captureSession)) {
      setOpen(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const recovered = await captureIDB.getRecoverableSession();
        if (cancelled || !recovered) return;
        const { session, photos } = recovered;
        setSessionIdForDiscard(session.sessionId);
        setPhotoCount(photos.length);
        setHasPendingUpload(!!session.projectId);
        setOpen(true);
      } catch (e) {
        logger.warn("Capture recovery gate: IDB check failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, pathname]);

  const closeAndNavigate = useCallback(
    (action: CaptureRecoveryAction) => {
      try {
        sessionStorage.setItem(CAPTURE_RECOVERY_ACTION_KEY, action);
      } catch {
        /* ignore quota / private mode */
      }
      setOpen(false);
      router.push(ROUTES.captureSession);
    },
    [router]
  );

  const handleDiscard = useCallback(async () => {
    if (sessionIdForDiscard) {
      await captureIDB.clearSession(sessionIdForDiscard).catch(() => {});
    }
    setOpen(false);
    setSessionIdForDiscard(null);
  }, [sessionIdForDiscard]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/95 p-6">
      <Camera className="mb-4 h-12 w-12 text-theme-primary" />
      <h2 className="mb-2 text-lg font-semibold text-white">Session Recovery</h2>
      <p className="mb-6 max-w-md text-center text-slate-300">
        {photoCount === 0 ? (
          <>
            You have an unfinished capture session
            {hasPendingUpload
              ? " (upload was interrupted)."
              : "."}{" "}
            Continue where you left off or discard it.
          </>
        ) : (
          <>
            We found{" "}
            <span className="font-medium text-white">
              {photoCount} photo{photoCount !== 1 ? "s" : ""}
            </span>{" "}
            from your last capture session.
            {hasPendingUpload
              ? " Your upload was interrupted — you can retry it now."
              : " You can continue where you left off."}
          </>
        )}
      </p>
      <div className="flex w-full max-w-xs gap-3">
        <Button
          variant="outline"
          className="flex-1 rounded-lg border-slate-600 text-slate-300 hover:bg-slate-800"
          onClick={handleDiscard}
        >
          Discard
        </Button>
        <Button
          className="flex-1 rounded-lg bg-theme-action-primary"
          onClick={() =>
            hasPendingUpload ? closeAndNavigate("retry-upload") : closeAndNavigate("resume")
          }
        >
          {hasPendingUpload ? "Retry Upload" : "Resume"}
        </Button>
      </div>
    </div>
  );
}
