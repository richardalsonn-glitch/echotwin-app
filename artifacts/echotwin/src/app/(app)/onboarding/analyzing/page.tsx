"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/language-context";
import type { TranslationKey } from "@/lib/i18n";

type AnalysisState = "analyzing" | "retrying" | "success" | "error";

const STEP_KEYS: TranslationKey[] = [
  "analyze.steps.0",
  "analyze.steps.1",
  "analyze.steps.2",
  "analyze.steps.3",
  "analyze.steps.4",
  "analyze.steps.5",
];

function AnalyzingPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const personaId = params?.get("persona_id") ?? "";
  const { t } = useI18n();

  const [state, setState] = useState<AnalysisState>("analyzing");
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) return;

    const stepInterval = window.setInterval(() => {
      setCurrentStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
    }, 2500);
    const retryHintTimer = window.setTimeout(() => {
      setState((current) => (current === "analyzing" ? "retrying" : current));
    }, 9000);

    void runAnalysis();

    return () => {
      window.clearInterval(stepInterval);
      window.clearTimeout(retryHintTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId]);

  async function runAnalysis() {
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: personaId }),
      });

      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getApiError(data) ?? t("analyze.errorTitle"));
      }

      if (getStatus(data) === "completed_basic") {
        toast.info(t("analyze.basicFallback"));
      }

      setState("success");
      window.setTimeout(() => {
        router.push(`/chat/${personaId}`);
      }, 1800);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("analyze.errorTitle");
      setError(message);
      setState("error");
      toast.error(message);
    }
  }

  return (
    <div
      className="ambient-bg mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
      }}
    >
      <AnimatePresence mode="wait">
        {(state === "analyzing" || state === "retrying") && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="w-full space-y-10 text-center"
          >
            <div className="relative mx-auto h-28 w-28">
              <div
                className="absolute inset-0 animate-ping rounded-full bg-primary/15"
                style={{ animationDuration: "2s" }}
              />
              <div
                className="absolute inset-2 animate-ping rounded-full bg-primary/10"
                style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
              />
              <div className="glow-teal relative flex h-28 w-28 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
                <Brain className="h-12 w-12 text-primary" />
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-2xl font-bold tracking-tight">
                {t("analyze.title")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {state === "retrying" ? t("analyze.retryingDesc") : t("analyze.desc")}
              </p>
            </div>

            <div className="w-full space-y-3 text-left">
              {STEP_KEYS.map((stepKey, index) => (
                <motion.div
                  key={stepKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: index <= currentStep ? 1 : 0.25 }}
                  className="flex items-center gap-3"
                >
                  <div className="shrink-0">
                    {index < currentStep ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : index === currentStep ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-border/50" />
                    )}
                  </div>
                  <span
                    className={`text-sm transition-colors ${
                      index === currentStep
                        ? "font-medium text-foreground"
                        : index < currentStep
                          ? "text-muted-foreground line-through"
                          : "text-muted-foreground/50"
                    }`}
                  >
                    {t(stepKey)}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {state === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.4 }}
            className="space-y-5 text-center"
          >
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 animate-pulse rounded-full bg-green-500/20" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-green-500/25 bg-green-500/10">
                <CheckCircle2 className="h-12 w-12 text-green-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {t("analyze.successTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("analyze.successDesc")}
              </p>
            </div>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full space-y-5 text-center"
          >
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t("analyze.errorTitle")}</h2>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {error}
              </p>
            </div>
            <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
              <Button
                className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setState("analyzing");
                  setCurrentStep(0);
                  setError(null);
                  void runAnalysis();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("common.retry")}
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl border-border/50 hover:bg-white/5"
                onClick={() => router.push("/home")}
              >
                {t("common.home")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AnalyzingPage() {
  return (
    <Suspense
      fallback={
        <div className="ambient-bg flex min-h-[100dvh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AnalyzingPageContent />
    </Suspense>
  );
}

function getApiError(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" && error.trim() ? error : null;
}

function getStatus(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const status = (value as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}
