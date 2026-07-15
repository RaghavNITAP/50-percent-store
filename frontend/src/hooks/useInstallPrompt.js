import { useState, useEffect, useRef } from "react";

const DISMISS_KEY = "pwa_banner_dismissed_at";
const COOLDOWN_DAYS = 7;

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const promptRef = useRef(null);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) return; // still in cooldown, don't show
    }

    const handler = (e) => {
      e.preventDefault();
      promptRef.current = e;
      setCanInstall(true);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      promptRef.current = null;
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    promptRef.current = null;
    setCanInstall(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString()); // remember dismissal
    promptRef.current = null;
    setCanInstall(false);
  };

  return { canInstall: canInstall && !isInstalled, install, dismiss, isInstalled };
}
