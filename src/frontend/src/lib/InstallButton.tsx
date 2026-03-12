'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/frontend/pages/ui_components/button';
import { Download } from 'lucide-react';

/** Standard PWA install prompt event (Chrome, Edge, etc.) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallButtonProps {
  className?: string;
}

export default function InstallButton({ className }: InstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already installed / running as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }

    // Fallback when native prompt isn't available (dev mode, Safari, etc.)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    if (isIOS || isSafari) {
      alert('To install: tap the Share button, then "Add to Home Screen".');
    } else {
      alert('Install from your browser menu (⋮ or ⋯) → "Install app" or "Add to Home Screen".');
    }
  };

  // Hide when already running as installed PWA
  if (isStandalone) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleInstallClick}
      className={`gap-2 ${className ?? ''}`}
    >
      <Download className="w-4 h-4" />
      Install App
    </Button>
  );
}