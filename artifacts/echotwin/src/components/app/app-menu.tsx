"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Bell,
  BellOff,
  ChevronRight,
  CircleHelp,
  Crown,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/client";
import {
  areBrowserNotificationsEnabled,
  requestNotificationPermission,
  setBrowserNotificationsEnabled,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

type AppMenuProps = {
  initialAuthenticated?: boolean;
  className?: string;
  triggerClassName?: string;
  floating?: boolean;
};

const MENU_ITEMS = [
  {
    href: "/hakkimizda",
    label: "Hakkımızda",
    description: "Ürünün hikayesi ve amacı",
    icon: BookOpen,
  },
  {
    href: "/merak-edilenler",
    label: "Merak Edilenler",
    description: "Sık sorulan sorular",
    icon: CircleHelp,
  },
  {
    href: "/ne-ise-yariyor",
    label: "Bu uygulama ne işe yarıyor?",
    description: "Çalışma mantığını keşfet",
    icon: Sparkles,
  },
  {
    href: "/upgrade",
    label: "Üyelik Paketleri",
    description: "Planları ve özellikleri gör",
    icon: Crown,
  },
];

export function AppMenu({
  initialAuthenticated = false,
  className,
  triggerClassName,
  floating = false,
}: AppMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuthenticated);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [notificationsSupported, setNotificationsSupported] = useState(true);

  useEffect(() => {
    let mounted = true;

    setNotificationsSupported(typeof window !== "undefined" && "Notification" in window);
    setNotificationsOn(areBrowserNotificationsEnabled());

    if (!hasSupabaseBrowserConfig()) {
      setIsAuthenticated(false);
      return () => {
        mounted = false;
      };
    }

    const supabase = createClient();

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setIsAuthenticated(Boolean(data.session));
      })
      .catch((error: unknown) => {
        console.error("App menu auth session check failed:", error);
        if (mounted) setIsAuthenticated(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function navigateTo(path: string) {
    setOpen(false);
    router.push(path);
  }

  async function handleLogout() {
    if (!hasSupabaseBrowserConfig()) {
      toast.error("Oturum servisi su an yapilandirilmamis.");
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  async function handleToggleNotifications() {
    if (notificationsOn) {
      setBrowserNotificationsEnabled(false);
      setNotificationsOn(false);
      toast.success("Bildirimler kapalı");
      return;
    }

    const granted = await requestNotificationPermission();
    setNotificationsOn(granted);

    if (granted) {
      toast.success("Bildirimler açık");
    } else {
      toast.error("Bildirim izni verilmedi. Tarayıcı ayarlarından açabilirsin.");
    }
  }

  const authTitle = isAuthenticated ? "Hesabın açık" : "Hesabınla devam et";
  const authDescription = isAuthenticated
    ? "Oturumunu buradan güvenle kapatabilirsin."
    : "Sohbetlerini ve personanı kaydetmek için giriş yap.";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className={cn(floating && "fixed left-4 top-4 z-40", className)}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Menüyü aç"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/80 shadow-[0_0_22px_rgba(20,184,166,0.12)] backdrop-blur-xl transition-all hover:border-primary/35 hover:bg-primary/10 hover:text-primary active:scale-95",
              triggerClassName
            )}
          >
            <Menu className="h-4 w-4" />
          </button>
        </SheetTrigger>
      </div>

      <SheetContent
        side="left"
        className="w-[86vw] max-w-[360px] overflow-hidden border-r border-primary/15 bg-[#07101f]/95 p-0 text-white shadow-[24px_0_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:border [&>button]:border-white/10 [&>button]:bg-white/[0.07] [&>button]:p-2 [&>button]:text-white/55 [&>button]:opacity-100 [&>button]:hover:text-primary"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_22%_10%,rgba(20,184,166,0.22),transparent_58%)]" />

        <div className="relative flex h-full flex-col">
          <SheetHeader className="space-y-4 px-5 pb-5 pt-7 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.12] shadow-[0_0_28px_rgba(20,184,166,0.18)]">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-[17px] font-bold tracking-tight text-white">
                  Bendeki Sen
                </SheetTitle>
                <SheetDescription className="text-xs text-white/45">
                  Kişisel sohbet deneyimin
                </SheetDescription>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <p className="text-xs font-medium leading-relaxed text-white/58">
                Geçmiş konuşmalarından daha kişisel, daha bağlamsal ve daha tanıdık bir sohbet alanı.
              </p>
            </div>
          </SheetHeader>

          <nav className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => navigateTo(item.href)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all",
                    active
                      ? "border-primary/35 bg-primary/[0.12] shadow-[0_0_24px_rgba(20,184,166,0.12)]"
                      : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.05]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                      active
                        ? "border-primary/30 bg-primary/15 text-primary"
                        : "border-white/8 bg-white/[0.04] text-white/55 group-hover:text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white/88">{item.label}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-white/40">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-primary/70" />
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/8 bg-black/18 p-4">
            <button
              type="button"
              onClick={handleToggleNotifications}
              disabled={!notificationsSupported}
              className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:border-primary/20 hover:bg-primary/[0.07] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-primary">
                {notificationsOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white/86">
                  {notificationsOn ? "Bildirimler Açık" : "Bildirimler Kapalı"}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-white/42">
                  {notificationsSupported
                    ? "Yeni mesaj uyarılarını buradan yönet."
                    : "Bu tarayıcı bildirimleri desteklemiyor."}
                </span>
              </span>
            </button>

            <div className="mb-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <p className="text-sm font-semibold text-white/86">{authTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/42">{authDescription}</p>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/15"
              >
                <LogOut className="h-4 w-4" />
                Çıkış Yap
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo("/login")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_0_24px_rgba(20,184,166,0.24)] transition-opacity hover:opacity-90"
              >
                <LogIn className="h-4 w-4" />
                Giriş Yap
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
