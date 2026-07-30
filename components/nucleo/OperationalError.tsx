"use client";

/** Alerta de erro operacional do Núcleo — falha nunca some silenciosamente. */
export function OperationalError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/10 rounded-md border p-3 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
