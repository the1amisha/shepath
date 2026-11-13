import { createFileRoute } from "@tanstack/react-router";
import { PreferenceExperiment } from "@/components/PreferenceExperiment";

export const Route = createFileRoute("/preference-lab")({
  head: () => ({ meta: [{ title: "SHEPATH — Preference experiment" }] }),
  component: PreferenceExperiment,
});
