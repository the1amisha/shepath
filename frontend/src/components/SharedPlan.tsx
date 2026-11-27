import { useMemo } from "react";
import { readPlan, planMessage } from "@/lib/routing/plannedRoute";
import { ShePathMap } from "./ShePathMap";

export function SharedPlan({ hash }: { hash: string }) {
  const plan = useMemo(() => {
    try {
      const { info, coordinates } = readPlan(hash);
      return {
        info,
        routes: [
          {
            id: "planned",
            coordinates,
            distanceMeters: info[4],
            durationSeconds: info[5],
            startPoint: coordinates[0]!,
            endPoint: coordinates[coordinates.length - 1]!,
          },
        ],
      };
    } catch {
      return null;
    }
  }, [hash]);
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-5">
      <h1 className="text-2xl font-bold">Planned route</h1>
      {plan ? (
        <>
          <p className="whitespace-pre-line">{planMessage(plan.info)}</p>
          <ShePathMap routes={plan.routes} selected="planned" />
          <p>Snapshot shared before travel. Live location is unavailable.</p>
        </>
      ) : (
        <p>This route link is incomplete. Ask the sender to share it again.</p>
      )}
      <a href="/" className="underline">
        Open ShePath planner
      </a>
    </main>
  );
}
