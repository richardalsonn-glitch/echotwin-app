"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Crown,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useI18n } from "@/context/language-context";
import {
  areBrowserNotificationsEnabled,
  requestNotificationPermission,
  setBrowserNotificationsEnabled,
} from "@/lib/notifications";
import { createClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";

type AppMenuProps = {
  initialAuthenticated?: boolean;
  className?: string;
  triggerClassName?: string;
  floating?: boolean;
};

type MenuItem = {
  href: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: LucideIcon;
};

const MENU_ITEMS: MenuItem[] = [
  {
    href: "/hakkimizda",
    labelKey: "menu.about",
    descriptionKey: "menu.aboutDesc",
    icon: BookOpen,
  },
  {
    href: "/ne-ise-yariyor",
    labelKey: "menu.how",
    descriptionKey: "menu.howDesc",
    icon: Sparkles,
  },
  {
    href: "/merak-edilenler",
    labelKey: "menu.faq",
    descriptionKey: "menu.faqDesc",
    icon: CircleHelp,
  },
  {
    href: "/upgrade",
    labelKey: "menu.pricing",
    descriptionKey: "menu.pricingDesc",
    icon: Crown,
  },
  {
    href: "/destek",
    labelKey: "menu.support",
    descriptionKey: "menu.supportDesc",
    icon: LifeBuoy,
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
  const { t } = useI18n();
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
      toast.error(t("menu.authServiceMissing"));
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
      toast.success(t("toast.notificationsOff"));
      return;
    }

    const granted = await requestNotificationPermission();
    setNotificationsOn(granted);

    if (granted) {
      toast.success(t("toast.notificationsOn"));
    } else {
      toast.error(t("toast.notificationsDenied"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div
        className={cn(floating && "fixed z-40", className)}
        style={
          floating
            ? {
                left: "calc(env(safe-area-inset-left, 0px) + 1rem)",
                top: "calc(env(safe-area-inset-top, 0px) + 0.875rem)",
              }
            : undefined
        }
      >
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={t("menu.open")}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/80 shadow-[0_0_22px_rgba(20,184,166,0.12)] backdrop-blur-xl transition-all hover:border-primary/35 hover:bg-primary/10 hover:text-primary active:scale-95",
              triggerClassName
            )}
          >
            <Menu className="h-4 w-4" />
          </button>
        </SheetTrigger>
      </div>

      <SheetContent
        side="left"
        className="w-[86vw] max-w-[360px] overflow-hidden border-r border-primary/15 bg-[#07101f]/95 p-0 text-white shadow-[24px_0_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl [&>button]:hidden"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_22%_10%,rgba(20,184,166,0.22),transparent_58%)]" />
        <SheetClose asChild>
          <button
            type="button"
            aria-label={t("common.close")}
            className="absolute right-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/65 shadow-[0_0_22px_rgba(20,184,166,0.10)] backdrop-blur-xl transition-all hover:border-primary/30 hover:text-primary active:scale-95"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.875rem)" }}
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </SheetClose>

        <div className="relative flex h-full flex-col">
          <SheetHeader
            className="space-y-4 px-5 pb-5 text-left"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.75rem)" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.12] shadow-[0_0_28px_rgba(20,184,166,0.18)]">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-[17px] font-bold tracking-tight text-white">
                  {t("common.appName")}
                </SheetTitle>
                <SheetDescription className="text-xs text-white/45">
                  {t("menu.personalExperience")}
                </SheetDescription>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <p className="text-xs font-medium leading-relaxed text-white/58">
                {t("menu.tagline")}
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
                    <span className="block text-sm font-semibold text-white/88">
                      {t(item.labelKey)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-white/40">
                      {t(item.descriptionKey)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-primary/70" />
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/8 bg-black/18 p-4">
            <LanguageSwitcher compact className="mb-3" />

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
                  {notificationsOn ? t("menu.notificationsOn") : t("menu.notificationsOff")}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-white/42">
                  {notificationsSupported
                    ? t("menu.notificationsDesc")
                    : t("menu.notificationsUnsupported")}
                </span>
              </span>
            </button>

            {isAuthenticated && (
              <div className="mb-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                <p className="text-sm font-semibold text-white/86">{t("menu.authOpen")}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/42">
                  {t("menu.authOpenDesc")}
                </p>
              </div>
            )}

            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/15"
              >
                <LogOut className="h-4 w-4" />
                {t("menu.logout")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo("/login")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_0_24px_rgba(20,184,166,0.24)] transition-opacity hover:opacity-90"
              >
                <LogIn className="h-4 w-4" />
                {t("auth.login")}
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
