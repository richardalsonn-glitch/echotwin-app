"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileText, ArrowLeft, CheckCircle2, CloudUpload } from "lucide-react";
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

  async function uploadFile(file: File) {
    if (!file.name.endsWith(".txt")) {
      toast.error("Yalnızca .txt dosyası kabul edilir");
      return;
    }

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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Yükleme başarısız");
      }

      const data = await res.json();
      setUploadState("success");

      setTimeout(() => {
        const url = new URL("/onboarding/select", window.location.origin);
        url.searchParams.set("export_id", data.export_id);
        url.searchParams.set("participants", JSON.stringify(data.participants));
        if (data.stats) {
          url.searchParams.set("stats", JSON.stringify(data.stats));
        }
        router.push(url.pathname + url.search);
      }, 800);
    } catch (error) {
      clearInterval(progressTimer);
      setUploadState("error");
      setProgress(0);
      const message = error instanceof Error ? error.message : "Yükleme hatası";
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
    },
    []
  );

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col ambient-bg">
      {/* Header */}
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

      {/* Step Indicator */}
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
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight">Bir Sohbet Getir</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Onunla konuştuğun WhatsApp sohbetini dışa aktar ve buraya yükle
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-card/60 border border-border/40 rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-sm text-foreground/80 mb-1">Nasıl dışa aktarılır?</p>
          {[
            "WhatsApp'ta kişiyle sohbeti aç",
            "Üç nokta → Daha fazla → Sohbeti Dışa Aktar",
            '"Medya olmadan" seç ve .txt dosyasını yükle',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
            </div>
          ))}
        </div>

        {/* Drop Zone / Status */}
        <AnimatePresence mode="wait">
          {uploadState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all overflow-hidden ${
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
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <CloudUpload className={`h-8 w-8 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className="font-semibold text-sm mb-1">Dosyayı buraya sürükle</p>
              <p className="text-xs text-muted-foreground mb-4">veya seçmek için tıkla</p>
              <span className="text-[11px] text-muted-foreground/60 bg-muted/30 px-3 py-1 rounded-full">
                Yalnızca .txt — Maks. 50MB
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
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
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedFile?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Mesajlar okunuyor...</p>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5 bg-muted/50" />
                <p className="text-xs text-muted-foreground text-center">
                  Katılımcılar belirleniyor — lütfen bekle
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
