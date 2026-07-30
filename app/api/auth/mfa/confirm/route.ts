import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { env } from "@/lib/env";
import { audit, isServiceRoleConfigured } from "@/lib/audit";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/auth/recovery-codes";

const ENROLLMENT_COOKIE = "mfa_enrollment";
const RECOVERY_CODES_COOKIE = "mfa_recovery_codes";

type EnrollmentState = { factorId: string; uri: string; secret: string };

function decode(raw: string | undefined): EnrollmentState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as EnrollmentState;
    return typeof value.factorId === "string" &&
      typeof value.uri === "string" &&
      typeof value.secret === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function requestCookies(request: Request) {
  return (request.headers.get("cookie") ?? "")
    .split(/;\s*/)
    .filter(Boolean)
    .flatMap((part) => {
      const [name, ...values] = part.split("=");
      return name ? [{ name, value: values.join("=") }] : [];
    });
}

/** Confirma TOTP por POST HTML, sem exigir JavaScript ou Server Action. */
export async function POST(request: Request) {
  const enrollment = decode(
    requestCookies(request).find(({ name }) => name === ENROLLMENT_COOKIE)?.value,
  );
  const target = new URL("/app/nucleo/mfa-enroll", request.url);
  const response = NextResponse.redirect(target, 303);
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => requestCookies(request),
        setAll: (values: { name: string; value: string; options: CookieOptions }[]) => {
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
      cookieOptions: {
        name: "sb-deskcomm-auth",
        sameSite: "strict",
        httpOnly: true,
        secure: cookieSecure(),
        path: "/",
      },
    },
  );
  const redirectWith = (error?: string, step?: string) => {
    if (error) target.searchParams.set("error", error);
    if (step) target.searchParams.set("step", step);
    response.headers.set("location", target.toString());
    return response;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/app/nucleo", request.url), 303);
  if (!enrollment) return redirectWith("expirado");

  const code = String((await request.formData()).get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return redirectWith("codigo");

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: enrollment.factorId,
  });
  if (challengeError || !challenge) return redirectWith("codigo");
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: enrollment.factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return redirectWith("codigo");

  const recoveryCodes = generateRecoveryCodes();
  const rows = recoveryCodes.map((value) => ({
    user_id: user.id,
    code_hash: hashRecoveryCode(value),
  }));
  let { error: insertError } = await supabase.from("user_recovery_codes").insert(rows);
  if (insertError && isServiceRoleConfigured()) {
    ({ error: insertError } = await createAdminClient().from("user_recovery_codes").insert(rows));
  }
  if (insertError)
    console.error("[mfa/confirm] recovery code insertion failed:", insertError.message);

  await audit({
    action: "auth.mfa_enrolled",
    actorUserId: user.id,
    metadata: { recovery_codes_generated: recoveryCodes.length },
    requestId: request.headers.get("x-request-id"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });
  response.cookies.set({
    name: RECOVERY_CODES_COOKIE,
    value: encode(recoveryCodes),
    httpOnly: true,
    sameSite: "strict",
    secure: cookieSecure(),
    path: "/",
    maxAge: 10 * 60,
  });
  return redirectWith(undefined, "recovery");
}
