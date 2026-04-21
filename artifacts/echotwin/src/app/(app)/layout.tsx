import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let userId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch (error) {
    console.error("[auth] protected layout user lookup failed", error);
  }

  if (!userId) {
    redirect("/login");
  }

  return (
    <div className="min-h-[100svh] bg-background">
      {children}
    </div>
  );
}
