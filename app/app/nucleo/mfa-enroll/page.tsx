import QRCode from "qrcode";
import { redirect } from "next/navigation";

import { getMfaEnrollmentState } from "@/app/actions/auth/mfaEnrollmentFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Configurar verificação em duas etapas" };
export const dynamic = "force-dynamic";

export default async function MfaEnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string }>;
}) {
  const [params, state] = await Promise.all([searchParams, getMfaEnrollmentState()]);
  if (params.step === "recovery" && state.recoveryCodes) {
    return (
      <main className="mx-auto max-w-xl py-12">
        <section className="space-y-5 rounded-lg border bg-card p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold">Códigos de recuperação</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Guarde estes códigos em local seguro. Cada um só funciona uma vez.
            </p>
          </div>
          <pre className="grid grid-cols-2 gap-2 rounded-md bg-muted p-4 text-center text-sm">
            {state.recoveryCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </pre>
          <form method="post" action="/api/auth/mfa/complete">
            <Button type="submit" className="w-full">
              Guardei os códigos e quero acessar o Núcleo
            </Button>
          </form>
        </section>
      </main>
    );
  }

  if (!state.enrollment) redirect("/app/nucleo");
  const qrDataUrl = await QRCode.toDataURL(state.enrollment.uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
  const error =
    params.error === "codigo"
      ? "Código inválido. Confira o autenticador e tente novamente."
      : params.error
        ? "A configuração expirou. Inicie novamente."
        : null;

  return (
    <main className="mx-auto max-w-xl py-12">
      <section className="space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold">Escaneie o QR code</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione esta conta ao Google Authenticator, 1Password, Authy ou Bitwarden e informe o
            código de seis dígitos.
          </p>
        </div>
        <div className="flex justify-center">
          <img
            src={qrDataUrl}
            alt="QR code para configurar autenticador"
            width={240}
            height={240}
            className="rounded border bg-white p-2"
          />
        </div>
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">
            Não consegue escanear? Digite a chave manualmente
          </summary>
          <code className="mt-2 block break-all rounded bg-muted p-2 font-mono text-foreground">
            {state.enrollment.secret}
          </code>
        </details>
        {error && (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 rounded-md border p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <form method="post" action="/api/auth/mfa/confirm" className="space-y-3">
          <label htmlFor="code" className="text-sm font-medium">
            Código de 6 dígitos
          </label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
          />
          <Button type="submit" className="w-full">
            Confirmar verificação
          </Button>
        </form>
      </section>
    </main>
  );
}
