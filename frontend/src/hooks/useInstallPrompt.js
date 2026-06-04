import { useState, useEffect, useRef } from "react";

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const promptRef = useRef(null); // useRef keeps the event stable across renders

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault(); // Suppress native mini-infobar
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

  // Call this when user dismisses the banner without installing
  const dismiss = () => {
    promptRef.current = null; // Release the event — stops Chrome warning
    setCanInstall(false);
  };

  return { canInstall: canInstall && !isInstalled, install, dismiss, isInstalled };
}
