import { useState } from "react";
import { Download, X } from "lucide-react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

export default function InstallBanner() {
  const { canInstall, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl shadow-zinc-200/60 p-4 flex items-center gap-3 animate-slide-up">
        <img src="/pwa-192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900">Add to Home Screen</p>
          <p className="text-xs text-zinc-400 mt-0.5">Install 50% Store for quick access</p>
        </div>
        <button
          onClick={install}
          className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-blue-700 transition"
        >
          <Download size={13} />
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-zinc-300 hover:text-zinc-500 transition"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
