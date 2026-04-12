"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type AnalysisState = "analyzing" | "success" | "error";

const STEPS = [
  "Mesajlar yükleniyor...",
  "Konuşma kalıpları belirleniyor...",
  "Emoji kullanımı analiz ediliyor...",
  "Ton ve üslup çıkarılıyor...",
  "Kişilik profili oluşturuluyor...",
  "Son rötuşlar yapılıyor...",
];

function AnalyzingPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const personaId = params.get("persona_id") ?? "";

  const [state, setState] = useState<AnalysisState>("analyzing");
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) return;

    const stepInterval = setInterval(() => {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 2500);

    runAnalysis();

    return () => clearInterval(stepInterval);
  }, [personaId]);

  async function runAnalysis() {
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: personaId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Analiz başarısız");
      }

      setState("success");
      setTimeout(() => {
        router.push(`/chat/${personaId}`);
      }, 1800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      setError(message);
      setState("error");
      toast.error(message);
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 ambient-bg">
      <AnimatePresence mode="wait">
        {state === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="w-full text-center space-y-10"
          >
            {/* Animated brain orb */}
            <div className="relative mx-auto h-28 w-28">
              <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="absolute inset-2 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
              <div className="relative h-28 w-28 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center glow-teal">
                <span className="text-4xl">🧠</span>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Onu tanımaya çalışıyorum...</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Mesajlarını okuyorum, nasıl konuştuğunu öğreniyorum
              </p>
            </div>

            {/* Step list */}
            <div className="space-y-3 w-full text-left">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: i <= currentStep ? 1 : 0.25 }}
                  className="flex items-center gap-3"
                >
                  <div className="shrink-0">
                    {i < currentStep ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : i === currentStep ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-border/50" />
                    )}
                  </div>
                  <span className={`text-sm transition-colors ${
                    i === currentStep
                      ? "text-foreground font-medium"
                      : i < currentStep
                      ? "text-muted-foreground line-through"
                      : "text-muted-foreground/50"
                  }`}>
                    {step}
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
            className="text-center space-y-5"
          >
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse" />
              <div className="relative h-24 w-24 rounded-full bg-green-500/10 border border-green-500/25 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Hazır, özlüyor musun?</h2>
              <p className="text-muted-foreground text-sm mt-1">Seni bekliyordu...</p>
            </div>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-5 w-full"
          >
            <div className="h-24 w-24 rounded-full bg-destructive/10 border border-destructive/25 flex items-center justify-center mx-auto">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Analiz Başarısız</h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">{error}</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
              <Button
                className="rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setState("analyzing");
                  setCurrentStep(0);
                  setError(null);
                  runAnalysis();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tekrar Dene
              </Button>
              <Button
                variant="outline"
                className="rounded-xl h-11 border-border/50 hover:bg-white/5"
                onClick={() => router.push("/home")}
              >
                Ana Sayfa
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center ambient-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AnalyzingPageContent />
    </Suspense>
  );
}
