"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { confirmMfaEnroll } from "@/app/actions/auth/confirmMfaEnroll";
import { enrollMfa } from "@/app/actions/auth/enrollMfa";

const ENROLLMENT_COOKIE = "mfa_enrollment";
const RECOVERY_CODES_COOKIE = "mfa_recovery_codes";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: cookieSecure(),
  path: "/",
  maxAge: 10 * 60,
};

type EnrollmentState = { factorId: string; uri: string; secret: string };

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function readEnrollment(raw: string | undefined): EnrollmentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as EnrollmentState;
    return typeof parsed.factorId === "string" &&
      typeof parsed.uri === "string" &&
      typeof parsed.secret === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * Inicia MFA por Server Action para funcionar antes da hidratação do React.
 * O segredo só fica em cookie HttpOnly, de vida curta, até a tela segura de QR.
 */
export async function beginMfaEnrollment(): Promise<never> {
  const result = await enrollMfa();
  if (!result.ok) redirect("/app/nucleo/mfa-enroll?error=inicio");

  const store = await cookies();
  store.set(
    ENROLLMENT_COOKIE,
    encode({ factorId: result.factor_id, uri: result.uri, secret: result.secret }),
    COOKIE_OPTIONS,
  );
  redirect("/app/nucleo/mfa-enroll");
}

/** Confirma o código TOTP sem depender de handler client-side. */
export async function confirmMfaEnrollmentFromForm(formData: FormData): Promise<never> {
  const store = await cookies();
  const state = readEnrollment(store.get(ENROLLMENT_COOKIE)?.value);
  if (!state) redirect("/app/nucleo/mfa-enroll?error=expirado");

  const code = String(formData.get("code") ?? "").trim();
  const result = await confirmMfaEnroll(code, state.factorId);
  if (!result.ok) redirect("/app/nucleo/mfa-enroll?error=codigo");

  store.set(RECOVERY_CODES_COOKIE, encode(result.recovery_codes), COOKIE_OPTIONS);
  redirect("/app/nucleo/mfa-enroll?step=recovery");
}

/** Finaliza o fluxo, apaga os dados temporários e reabre o cockpit. */
export async function completeMfaEnrollment(): Promise<never> {
  const store = await cookies();
  store.delete(ENROLLMENT_COOKIE);
  store.delete(RECOVERY_CODES_COOKIE);
  redirect("/app/nucleo");
}

export async function getMfaEnrollmentState(): Promise<{
  enrollment: EnrollmentState | null;
  recoveryCodes: string[] | null;
}> {
  const store = await cookies();
  const rawCodes = store.get(RECOVERY_CODES_COOKIE)?.value;
  let recoveryCodes: string[] | null = null;
  if (rawCodes) {
    try {
      const parsed = JSON.parse(Buffer.from(rawCodes, "base64url").toString("utf8"));
      recoveryCodes =
        Array.isArray(parsed) && parsed.every((code) => typeof code === "string") ? parsed : null;
    } catch {
      recoveryCodes = null;
    }
  }
  return { enrollment: readEnrollment(store.get(ENROLLMENT_COOKIE)?.value), recoveryCodes };
}
