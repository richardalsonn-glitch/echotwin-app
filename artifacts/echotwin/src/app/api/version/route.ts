import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_APP_VERSION ??
    "local-development";

  return NextResponse.json(
    {
      app: "BendekiSen",
      version,
      built_at: process.env.VERCEL_GIT_COMMIT_SHA ? null : "local",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
