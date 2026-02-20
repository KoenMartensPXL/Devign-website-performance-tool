import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function validateMagicToken(token: string) {
  const sb = supabaseAdmin();
  const tokenHash = sha256(token);

  const { data, error } = await sb
    .from("magic_link_tokens")
    .select("customer_id, expires_at, revoked_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(`Token lookup failed: ${error.message}`);
  if (!data) return { ok: false as const, reason: "not_found" as const };

  const now = new Date();
  if (data.revoked_at)
    return { ok: false as const, reason: "revoked" as const };
  if (new Date(data.expires_at) <= now)
    return { ok: false as const, reason: "expired" as const };

  return { ok: true as const, customerId: data.customer_id as string };
}
