import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { env } from "@/lib/env";
import { cookieSecure } from "@/lib/supabase/cookie-secure";

const ENROLLMENT_COOKIE = "mfa_enrollment";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function resolveReturnTo(value: FormDataEntryValue | null): string {
  const candidate = typeof value === "string" ? value : "";
  return candidate.startsWith("/app/") && !candidate.startsWith("//")
    ? candidate
    : "/app/settings/security";
}

/**
 * Native form endpoint for MFA enrollment.
 *
 * This path deliberately does not depend on React hydration, so an admin can
 * always start the mandatory MFA flow from a normal browser form submission.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const returnTo = resolveReturnTo(formData.get("return_to"));
  const url = new URL("/app/nucleo/mfa-enroll", request.url);
  const response = NextResponse.redirect(url, 303);
  const cookies = request.headers.get("cookie") ?? "";
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () =>
          cookies
            .split(/;\s*/)
            .filter(Boolean)
            .flatMap((part) => {
              const [name, ...values] = part.split("=");
              return name ? [{ name, value: values.join("=") }] : [];
            }),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(returnTo)}`, request.url), 303);
  }

  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const factor of existing?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `DeskcommCRM ${new Date().toISOString().slice(0, 10)}`,
  });

  if (error || !data) {
    url.searchParams.set("error", "inicio");
    return NextResponse.redirect(url, 303);
  }

  response.cookies.set({
    name: ENROLLMENT_COOKIE,
    value: encode({ factorId: data.id, uri: data.totp.uri, secret: data.totp.secret, returnTo }),
    httpOnly: true,
    sameSite: "strict",
    secure: cookieSecure(),
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
