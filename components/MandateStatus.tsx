import type { MandateView } from "@chainwrit/sdk";

export function mandateStatus(m: Pick<MandateView, "revoked" | "expiresAt">) {
  if (m.revoked) return { label: "Revoked", tone: "text-bad border-bad/40" };
  if (Date.now() / 1000 >= m.expiresAt) return { label: "Expired", tone: "text-muted border-line" };
  return { label: "Active", tone: "text-ok border-ok/40" };
}

export default function MandateStatus({ m }: { m: Pick<MandateView, "revoked" | "expiresAt"> }) {
  const s = mandateStatus(m);
  return <span className={`rounded border px-2 py-0.5 text-xs ${s.tone}`}>{s.label}</span>;
}
