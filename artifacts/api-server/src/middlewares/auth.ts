import type { Request, Response, NextFunction } from "express";
import { createSupabaseClient } from "../lib/supabase.js";

export interface AuthRequest extends Request {
  user?: { id: string; email?: string };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const supabase = createSupabaseClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    res.status(401).json({ error: "Auth hatası" });
  }
}
