"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { AlertCircle, FileArchive, FileText, ArrowLeft, CheckCircle2, CloudUpload, Images } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type UploadState = "idle" | "uploading" | "success" | "error";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function uploadFile(file: File) {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".txt") && !lowerName.endsWith(".zip")) {
      const message = "Yalnızca .txt veya .zip dosyası kabul edilir";
      setErrorMessage(message);
      setUploadState("error");
      toast.error(message);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      const message = "Dosya boyutu 50 MB'dan büyük olamaz";
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

    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 85));
    }, 300);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressTimer);
      setProgress(100);

      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getUploadError(data));
      }

      const payload = getObjectValue(data);
      setUploadState("success");

      setTimeout(() => {
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
      clearInterval(progressTimer);
      setUploadState("error");
      setProgress(0);
      const message = error instanceof Error ? error.message : "Yükleme hatası";
      setErrorMessage(message);
      toast.error(message);
    }
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) await uploadFile(file);
    },
    []
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await uploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    []
  );

  const selectedIsZip = selectedFile?.name.toLowerCase().endsWith(".zip") ?? false;
  const showDropzone = uploadState === "idle" || uploadState === "error";

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col ambient-bg">
      <div className="px-4 py-4 flex items-center gap-3 border-b border-white/5 bg-background/50 backdrop-blur-xl">
        <Link href="/home">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Sohbet Yükle</h1>
          <p className="text-xs text-muted-foreground">Adım 1 / 3</p>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <div className="h-0.5 flex-1 bg-primary/30 rounded-full" />
          <div className="h-1.5 w-1.5 rounded-full bg-border" />
          <div className="h-0.5 flex-1 bg-border rounded-full" />
          <div className="h-1.5 w-1.5 rounded-full bg-border" />
        </div>
      </div>

      <div className="flex-1 px-5 py-8 flex flex-col gap-7">
        <div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight">Bir Sohbet Getir</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            WhatsApp sohbetini medyalı ya da medyasız dışa aktar ve buraya yükle.
          </p>
        </div>

        <div className="bg-card/60 border border-border/40 rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-sm text-foreground/80 mb-1">Nasıl dışa aktarılır?</p>
          {[
            "WhatsApp'ta kişiyle sohbeti aç",
            "Üç nokta -> Daha fazla -> Sohbeti Dışa Aktar",
            "Medya olmadan .txt veya .zip, medyayı dahil edersen .zip yükle",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
            </div>
          ))}
          <div className="pt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 border border-white/8 p-3">
              <FileText className="h-4 w-4 text-primary mb-2" />
              <p className="text-xs font-semibold text-foreground/80">Medyasız</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">.txt veya .zip sohbet geçmişi</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/8 p-3">
              <Images className="h-4 w-4 text-primary mb-2" />
              <p className="text-xs font-semibold text-foreground/80">Medyalı</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">.zip + medya hafızası</p>
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
              className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all overflow-hidden ${
                isDragging
                  ? "border-primary bg-primary/8 glow-teal"
                  : "border-border/50 hover:border-primary/40 hover:bg-card/40"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isDragging && (
                <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
              )}
              {uploadState === "error" && errorMessage && (
                <div className="mb-5 flex w-full items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-left">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Dosya okunamadı</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{errorMessage}</p>
                  </div>
                </div>
              )}
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <CloudUpload className={`h-8 w-8 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className="font-semibold text-sm mb-1">Dosyayı buraya sürükle</p>
              <p className="text-xs text-muted-foreground mb-4">veya seçmek için tıkla</p>
              <span className="text-[11px] text-muted-foreground/60 bg-muted/30 px-3 py-1 rounded-full">
                .txt veya .zip - Maks. 50MB
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
              className="bg-card/60 border border-border/40 rounded-2xl p-6 space-y-5"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  {selectedIsZip ? (
                    <FileArchive className="h-6 w-6 text-primary" />
                  ) : (
                    <FileText className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedFile?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mesajlar ve medya referansları okunuyor...
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5 bg-muted/50" />
                <p className="text-xs text-muted-foreground text-center">
                  Katılımcılar belirleniyor - lütfen bekle
                </p>
              </div>
            </motion.div>
          )}

          {uploadState === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-10 gap-4"
            >
              <div className="h-20 w-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center glow-teal">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg">Başarıyla Yüklendi!</p>
                <p className="text-muted-foreground text-sm mt-1">Kişi seçim ekranına yönlendiriliyorsun...</p>
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

function getUploadError(value: unknown): string {
  const data = getObjectValue(value);
  return typeof data.error === "string" && data.error.trim()
    ? data.error.trim()
    : "Yükleme başarısız";
}
