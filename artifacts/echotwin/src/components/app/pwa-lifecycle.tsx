"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Smartphone, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const VERSION_STORAGE_KEY = "bendekisen_app_version";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return (
    "prompt" in event &&
    typeof (event as { prompt?: unknown }).prompt === "function" &&
    "userChoice" in event
  );
}

export function PwaLifecycle() {
  const [showSplash, setShowSplash] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const shouldReloadRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowSplash(false), 950);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      installPromptRef.current = event;
      setInstallReady(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let intervalId: number | null = null;

    function watchRegistration(registration: ServiceWorkerRegistration) {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorkerRef.current = worker;
            setUpdateReady(true);
          }
        });
      });
    }

    function handleControllerChange() {
      if (!shouldReloadRef.current) return;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const registerServiceWorker = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          watchRegistration(registration);
          intervalId = window.setInterval(() => {
            void registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error: unknown) => {
          console.warn("[pwa] service worker registration failed", error);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("load", registerServiceWorker);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let intervalId: number | null = null;

    async function checkVersion() {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const data: unknown = await response.json();
        const version =
          typeof data === "object" &&
          data !== null &&
          "version" in data &&
          typeof data.version === "string"
            ? data.version
            : null;
        if (!version) return;

        const current = window.localStorage.getItem(VERSION_STORAGE_KEY);
        if (!current) {
          window.localStorage.setItem(VERSION_STORAGE_KEY, version);
          return;
        }

        if (current !== version) {
          setUpdateReady(true);
        }
      } catch (error) {
        console.warn("[pwa] version check failed", error);
      }
    }

    void checkVersion();
    intervalId = window.setInterval(() => {
      void checkVersion();
    }, 15 * 60 * 1000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void checkVersion();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function handleInstall() {
    const promptEvent = installPromptRef.current;
    if (!promptEvent) return;
    await promptEvent.prompt();
    installPromptRef.current = null;
    setInstallReady(false);
  }

  function handleUpdate() {
    const worker = waitingWorkerRef.current;
    window.localStorage.removeItem(VERSION_STORAGE_KEY);
    if (!worker) {
      window.location.reload();
      return;
    }
    shouldReloadRef.current = true;
    worker.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="fixed inset-0 z-[100] grid place-items-center bg-[#071421]"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(46,232,214,0.20),transparent_34%)]" />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.48, ease: "easeOut" }}
              className="relative flex flex-col items-center"
            >
              <motion.img
                src="/icons/icon-192.png"
                alt="BendekiSen"
                className="h-20 w-20 rounded-[26px] shadow-[0_0_42px_rgba(46,232,214,0.32)]"
                animate={{ scale: [1, 1.035, 1] }}
                transition={{ duration: 1.45, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="mt-5 text-center">
                <p className="text-[22px] font-black tracking-tight text-white">BendekiSen</p>
                <p className="mt-1 text-[12px] font-medium text-primary/72">
                  Sanki hala karsindaymis gibi
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(updateReady || installReady) && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-md"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="rounded-3xl border border-primary/18 bg-[#071421]/92 p-3.5 text-white shadow-[0_20px_70px_rgba(0,0,0,0.45),0_0_34px_rgba(46,232,214,0.12)] backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/18 bg-primary/10 text-primary">
                  {updateReady ? <RefreshCw className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">
                    {updateReady ? "Yeni sürüm hazır" : "Telefona uygulama gibi ekle"}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-white/48">
                    {updateReady
                      ? "Güncel BendekiSen deneyimine geçmek için yenile."
                      : "BendekiSen ana ekranda bağımsız bir uygulama gibi açılır."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={updateReady ? handleUpdate : handleInstall}
                  className="h-9 shrink-0 rounded-2xl bg-primary px-3 text-[12px] font-bold text-primary-foreground transition-transform active:scale-[0.98]"
                >
                  {updateReady ? "Güncelle" : "Ekle"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUpdateReady(false);
                    setInstallReady(false);
                  }}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/42 transition-colors hover:bg-white/8 hover:text-white/70"
                  )}
                  aria-label="Kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
