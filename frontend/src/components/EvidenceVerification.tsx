import { useEffect, useRef, useState } from "react";
import { fetchRouteEvidence, type RouteEvidence } from "@/lib/routing/routeEvidence";
import type { RouteData } from "@/lib/routing/types";

import { evidenceFingerprint } from "@/lib/routing/evidenceFingerprint";

export function EvidenceVerification({
  evidence,
  route,
}: {
  evidence: RouteEvidence;
  route?: RouteData | undefined;
}) {
  // Remount on changed evidence/geometry so an old check cannot describe a new route.
  return (
    <VerificationSession
      key={evidenceFingerprint({ evidence, route })}
      evidence={evidence}
      route={route}
    />
  );
}

function VerificationSession({
  evidence,
  route,
}: {
  evidence: RouteEvidence;
  route?: RouteData | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function recheck() {
    if (!route || route.id !== evidence.route.id || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setResult("Rechecking this route with the evidence service… This may wait for other analyses.");
    try {
      const next = await fetchRouteEvidence(route, request.signal);
      if (request.signal.aborted) return;
      const stamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      setResult(
        evidenceFingerprint(next) === evidenceFingerprint(evidence)
          ? `Recheck matched at ${stamp} IST. The source identifiers, route identity and displayed evidence fields match the new response.`
          : `Evidence changed at ${stamp} IST. The new response differs from the displayed evidence. The page still shows the original response; start a new route search to load current evidence for all alternatives.`,
      );
    } catch (error) {
      if (!request.signal.aborted)
        setResult(
          `Recheck could not be completed. ${error instanceof Error ? error.message : "Please try again."} The displayed evidence has not been replaced.`,
        );
    } finally {
      if (!request.signal.aborted) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  const fields = [
    ["Source snapshot", evidence.source_provenance.source_snapshot_timestamp],
    ["Route ID", evidence.route.id],
    ["Geometry SHA-256", evidence.route.geometry_sha256],
    ["Evidence identity SHA-256", evidence.evidence_identity_sha256],
    ["Manifest SHA-256", evidence.source_provenance.manifest_sha256],
    ["Source PBF SHA-256", evidence.source_provenance.source_pbf_sha256],
    ["Analysis buffer", `${evidence.analysis.buffer_metres} m`],
    [
      "Coverage",
      evidence.coverage.full_buffer_covered ? "Full route buffer covered" : "Coverage unavailable",
    ],
  ];
  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-xl border border-border bg-card px-4 py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? "Hide verification details" : "Verify this evidence"}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p>
            These identifiers describe the historical source and route used for this analysis. The
            geometry hash identifies the route coordinates; the evidence identity also includes
            analysis settings and source provenance.
          </p>
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl bg-card p-3">
                <dt className="font-semibold">{label}</dt>
                <dd className="mt-1 break-all text-xs leading-5">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Rechecking sends the same route to the evidence service and validates its returned
            coordinates and coverage. It compares the retained evidence fields, including counts and
            stretches. This is a consistency check against the same service, not an independent
            file-hash audit or a check of current street conditions.
          </p>
          {route?.id === evidence.route.id ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void recheck()}
              className="rounded-xl border border-border bg-card px-4 py-2 font-semibold disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {busy ? "Rechecking…" : "Recheck evidence"}
            </button>
          ) : (
            <p>
              The original route geometry is unavailable here, so a recheck cannot be requested.
            </p>
          )}
          <p role="status" aria-live="polite" aria-atomic="true">
            {result}
          </p>
        </div>
      )}
    </div>
  );
}
