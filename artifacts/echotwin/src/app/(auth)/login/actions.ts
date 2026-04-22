"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    if (error.message === "Email not confirmed") {
      return { error: "email_not_confirmed", email };
    }
    if (error.message === "Invalid login credentials") {
      return { error: "invalid_credentials" };
    }
    return { error: error.message };
  }

  redirect("/home");
}

