import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isStandalone) return;

    // Check if user previously dismissed
    // (Disabled completely so it always shows up on PC/Mobile during testing)
    // const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
    // if (wasDismissed) {
    //   setDismissed(true);
    //   return;
    // }

    // Android / Chrome — listen for beforeinstallprompt
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS detection (Safari, no beforeinstallprompt support)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setShowIOSPrompt(true);
    }

    // Hide after app is installed
    function handleAppInstalled() {
      setShowInstall(false);
      setShowIOSPrompt(false);
      setDeferredPrompt(null);
    }
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShowInstall(false);
    setShowIOSPrompt(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  }

  if (dismissed) return null;

  // Android / Chrome install banner
  if (showInstall) {
    return (
      <div className="fixed bottom-20 left-3 right-3 md:left-auto md:right-4 md:bottom-4 md:max-w-sm z-[100] animate-slide-up">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-accent)] text-white shadow-lg border border-white/10">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/pwa-192x192.png" alt="Jobsy" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium m-0 leading-tight">Install Jobsy</p>
            <p className="text-xs opacity-75 m-0 mt-0.5">Add to home screen for the best experience</p>
          </div>
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[var(--color-accent)] text-xs font-medium border-0 cursor-pointer hover:bg-white/90 transition-default shrink-0"
          >
            <Download size={14} />
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full bg-transparent border-0 text-white/60 hover:text-white cursor-pointer transition-default shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari instructions
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-20 left-3 right-3 md:left-auto md:right-4 md:bottom-4 md:max-w-sm z-[100] animate-slide-up">
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--color-accent)] text-white shadow-lg border border-white/10">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/pwa-192x192.png" alt="Jobsy" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium m-0 leading-tight">Install Jobsy</p>
            <p className="text-xs opacity-75 m-0 mt-1 leading-relaxed">
              Tap <Share size={12} className="inline -mt-0.5" /> then <strong>"Add to Home Screen"</strong>
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full bg-transparent border-0 text-white/60 hover:text-white cursor-pointer transition-default shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
