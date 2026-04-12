import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { createSupabaseClient } from "../lib/supabase.js";
import { getLimits } from "../lib/limits.js";
import type { Response } from "express";

const router = Router();

// GET /api/personas
router.get("/personas", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = createSupabaseClient(req, res);

  const { data: personas, error } = await supabase
    .from("personas")
    .select("*")
    .eq("user_id", req.user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ personas });
});

// POST /api/personas
router.post("/personas", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = createSupabaseClient(req, res);

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", req.user!.id)
    .single();

  const tier = (profile?.subscription_tier as "free" | "basic" | "full") ?? "free";
  const limits = getLimits(tier);

  const { count } = await supabase
    .from("personas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", req.user!.id);

  if ((count ?? 0) >= limits.maxPersonas) {
    res.status(403).json({
      error: `Bu planda en fazla ${limits.maxPersonas} profil oluşturabilirsin.`,
      upgrade_required: true,
    });
    return;
  }

  const { export_id, target_name, requester_name, display_name } = req.body;

  if (!export_id || !target_name || !requester_name || !display_name) {
    res.status(400).json({ error: "Eksik alan" });
    return;
  }

  const { data: persona, error } = await supabase
    .from("personas")
    .insert({
      user_id: req.user!.id,
      export_id,
      target_name,
      requester_name,
      display_name,
      message_count_used: 0,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ persona });
});

// GET /api/personas/:id
router.get("/personas/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = createSupabaseClient(req, res);

  const { data: persona, error } = await supabase
    .from("personas")
    .select("*")
    .eq("id", req.params["id"])
    .eq("user_id", req.user!.id)
    .single();

  if (error || !persona) {
    res.status(404).json({ error: "Persona bulunamadı" });
    return;
  }

  res.json({ persona });
});

// PATCH /api/personas/:id
router.patch("/personas/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = createSupabaseClient(req, res);
  const { display_name, avatar_url } = req.body;

  const { data: persona, error } = await supabase
    .from("personas")
    .update({ display_name, avatar_url, updated_at: new Date().toISOString() })
    .eq("id", req.params["id"])
    .eq("user_id", req.user!.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ persona });
});

// DELETE /api/personas/:id
router.delete("/personas/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = createSupabaseClient(req, res);

  const { error } = await supabase
    .from("personas")
    .delete()
    .eq("id", req.params["id"])
    .eq("user_id", req.user!.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
});

export default router;
