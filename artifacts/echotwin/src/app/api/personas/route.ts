import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLimits } from "@/lib/subscription/limits";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: personas, error } = await supabase
    .from("personas")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ personas });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check tier limits
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = (profile?.subscription_tier as "free" | "basic" | "full") ?? "free";
  const limits = getLimits(tier);

  const { count } = await supabase
    .from("personas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= limits.maxPersonas) {
    return NextResponse.json(
      { error: `Bu planda en fazla ${limits.maxPersonas} profil oluşturabilirsin.`, upgrade_required: true },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { export_id, target_name, requester_name, display_name } = body;

  if (!export_id || !target_name || !requester_name || !display_name) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const { data: persona, error } = await supabase
    .from("personas")
    .insert({
      user_id: user.id,
      export_id,
      target_name,
      requester_name,
      display_name,
      message_count_used: 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ persona }, { status: 201 });
}
