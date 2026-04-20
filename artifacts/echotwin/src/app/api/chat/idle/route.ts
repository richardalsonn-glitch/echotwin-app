import { NextRequest } from "next/server";
import { createPersonaMessage } from "../_persona-message";

export async function POST(request: NextRequest) {
  return createPersonaMessage(request, "idle");
}
