"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  FileArchive,
  FileText,
  Images,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/context/language-context";
import type { TranslationKey } from "@/lib/i18n";

type UploadState = "idle" | "uploading" | "success" | "error";

const EXPORT_STEPS: TranslationKey[] = [
  "upload.step1",
  "upload.step2",
  "upload.step3",
];

export default function UploadPage() {
  const router = useRouter();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith(".txt") && !lowerName.endsWith(".zip")) {
        const message = t("upload.onlyTxtZip");
        setErrorMessage(message);
        setUploadState("error");
        toast.error(message);
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        const message = t("upload.maxSize");
        setErrorMessage(message);
        setUploadState("error");
        toast.error(message);
        return;
      }

      setErrorMessage(null);
      setSelectedFile(file);
      setUploadState("uploading");
      setProgress(20);

      const formData = new FormData();
      formData.append("file", file);

      const progressTimer = window.setInterval(() => {
        setProgress((p) => Math.min(p + 10, 85));
      }, 300);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        window.clearInterval(progressTimer);
        setProgress(100);

        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(getUploadError(data, t("upload.failed")));
        }

        const payload = getObjectValue(data);
        setUploadState("success");

        window.setTimeout(() => {
          const url = new URL("/onboarding/select", window.location.origin);
          if (typeof payload.export_id === "string") {
            url.searchParams.set("export_id", payload.export_id);
          }
          if (Array.isArray(payload.participants)) {
            url.searchParams.set("participants", JSON.stringify(payload.participants));
          }
          if (payload.stats) {
            url.searchParams.set("stats", JSON.stringify(payload.stats));
          }
          router.push(url.pathname + url.search);
        }, 800);
      } catch (error) {
        window.clearInterval(progressTimer);
        setUploadState("error");
        setProgress(0);
        const message = error instanceof Error ? error.message : t("upload.failed");
        setErrorMessage(message);
        toast.error(message);
      }
    },
    [router, t]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) await uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) await uploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadFile]
  );

  const selectedIsZip = selectedFile?.name.toLowerCase().endsWith(".zip") ?? false;
  const showDropzone = uploadState === "idle" || uploadState === "error";

  return (
    <div className="ambient-bg mx-auto flex min-h-screen max-w-md flex-col">
      <div className="flex items-center gap-3 border-b border-white/5 bg-background/50 px-4 py-4 backdrop-blur-xl">
        <Link href="/home">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">{t("upload.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("upload.step")}</p>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <div className="h-0.5 flex-1 rounded-full bg-primary/30" />
          <div className="h-1.5 w-1.5 rounded-full bg-border" />
          <div className="h-0.5 flex-1 rounded-full bg-border" />
          <div className="h-1.5 w-1.5 rounded-full bg-border" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-7 px-5 py-8">
        <div>
          <h2 className="mb-2 text-2xl font-bold tracking-tight">{t("upload.hero")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("upload.heroDesc")}
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/40 bg-card/60 p-5">
          <p className="mb-1 text-sm font-semibold text-foreground/80">
            {t("upload.howTitle")}
          </p>
          {EXPORT_STEPS.map((stepKey, index) => (
            <div key={stepKey} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                {t(stepKey)}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <FileText className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-foreground/80">{t("upload.noMedia")}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                {t("upload.noMediaDesc")}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <Images className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-foreground/80">{t("upload.withMedia")}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                {t("upload.withMediaDesc")}
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showDropzone && (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={`relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? "glow-teal border-primary bg-primary/8"
                  : "border-border/50 hover:border-primary/40 hover:bg-card/40"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isDragging && <div className="pointer-events-none absolute inset-0 bg-primary/5" />}
              {uploadState === "error" && errorMessage && (
                <div className="mb-5 flex w-full items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-left">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{t("upload.readFailed")}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <CloudUpload className={`h-8 w-8 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className="mb-1 text-sm font-semibold">{t("upload.drag")}</p>
              <p className="mb-4 text-xs text-muted-foreground">{t("upload.click")}</p>
              <span className="rounded-full bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground/60">
                {t("upload.accept")}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.zip"
                className="hidden"
                onChange={handleFileChange}
              />
            </motion.div>
          )}

          {uploadState === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5 rounded-2xl border border-border/40 bg-card/60 p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                  {selectedIsZip ? (
                    <FileArchive className="h-6 w-6 text-primary" />
                  ) : (
                    <FileText className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selectedFile?.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("upload.reading")}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5 bg-muted/50" />
                <p className="text-center text-xs text-muted-foreground">
                  {t("upload.progress")}
                </p>
              </div>
            </motion.div>
          )}

          {uploadState === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-10"
            >
              <div className="glow-teal flex h-20 w-20 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{t("upload.success")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("upload.redirect")}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function getObjectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getUploadError(value: unknown, fallback: string): string {
  const data = getObjectValue(value);
  return typeof data.error === "string" && data.error.trim()
    ? data.error.trim()
    : fallback;
}

