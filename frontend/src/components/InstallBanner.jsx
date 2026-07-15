import { Download, X } from "lucide-react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

export default function InstallBanner() {
  const { canInstall, install, dismiss } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 flex items-center gap-2 bg-white border border-zinc-200 rounded-full shadow-lg shadow-zinc-200/50 px-3 py-2 animate-slide-up">
      <img src="/pwa-192.png" alt="" className="w-5 h-5 rounded-md flex-shrink-0" />
      <button
        onClick={install}
        className="text-xs font-semibold text-zinc-800 hover:text-blue-600 transition whitespace-nowrap"
      >
        Install App
      </button>
      <button
        onClick={dismiss}
        className="text-zinc-300 hover:text-zinc-500 transition ml-1"
      >
        <X size={13} />
      </button>
    </div>
  );
}
