"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function registerAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() },
    },
  });

  if (error) {
    if (
      error.message.includes("already registered") ||
      error.message.includes("already been registered")
    ) {
      return { error: "Bu e-posta zaten kayıtlı. Giriş yapmayı dene." };
    }
    return { error: error.message };
  }

  if (data.session) {
    redirect("/home");
  }

  // E-posta doğrulaması gerekiyor
  return { emailSent: true, email };
}
