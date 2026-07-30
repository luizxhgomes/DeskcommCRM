import { NextResponse } from "next/server";

const ENROLLMENT_COOKIE = "mfa_enrollment";
const RECOVERY_CODES_COOKIE = "mfa_recovery_codes";

/** Apaga o estado temporário de MFA e devolve o usuário ao cockpit. */
export async function POST(request: Request) {
  const returnTo = (request.headers.get("cookie") ?? "").match(/(?:^|; )mfa_return_to=([^;]*)/)?.[1];
  const destination = returnTo?.startsWith("/app/") ? returnTo : "/app/settings/security";
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.cookies.delete(ENROLLMENT_COOKIE);
  response.cookies.delete(RECOVERY_CODES_COOKIE);
  response.cookies.delete("mfa_return_to");
  return response;
}
