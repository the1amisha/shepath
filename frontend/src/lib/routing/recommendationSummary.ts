import type { EvidenceState } from "@/hooks/useRouteEvidence";
import type { RouteData } from "./types";
import { attributes } from "./liveRecommendation";
import { learnedPriorities, type HybridResult, type Priorities } from "./hybridRecommendation";

export function walkingTime(seconds: number) {
  return seconds < 60 ? "Less than 1 min" : `${Math.round(seconds / 60)} min`;
}

/** Explain the actual active model inputs separately from contextual map comparisons. */
export function recommendationSummary(
  routes: RouteData[],
  result: HybridResult,
  states: Record<string, EvidenceState>,
  priorities: Priorities = learnedPriorities,
) {
  const route = routes.find((r) => r.id === result.recommendedId);
  const row = result.rows.find((r) => r.id === route?.id);
  if (!route || !row || row.score === undefined || !row.eligible) return null;
  const fastest = [...routes].sort((a, b) => a.durationSeconds - b.durationSeconds)[0]!;
  const reference =
    route.id !== fastest.id
      ? fastest
      : [...routes]
          .filter((r) => r.id !== route.id)
          .sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
  const other = result.rows.find((r) => r.id === reference?.id);
  const custom = attributes.some(
    (key) => Math.abs(priorities[key] - learnedPriorities[key]) > 1e-8,
  );
  const labels = {
    lighting: "lighting",
    footpath: "footpath",
    shops: "business opening-hours",
    pedestrians: "pedestrian",
  };
  const positive = other
    ? attributes
        .map((key) => ({
          key,
          delta:
            (priorities[key] *
              (row.values[key].low +
                row.values[key].high -
                (other.values[key].low + other.values[key].high))) /
            2,
        }))
        .filter((x) => x.delta > 1e-8)
        .sort((a, b) => b.delta - a.delta)
    : [];
  const onlyEligible = result.rows.filter((r) => r.eligible).length === 1;
  const strongest = positive[0]?.key;
  const mappedReasons = {
    lighting: "a higher share of nearby roads is tagged as lit",
    footpath: "a higher share of nearby roads has positive footpath tags",
    shops: "a higher share of mapped businesses is scheduled open at departure",
    pedestrians: "your pedestrian description improves its preference fit",
  };
  const reason = onlyEligible
    ? "Only this route fits your extra-time limit."
    : strongest && other
      ? row.values[strongest].source.startsWith("Your") ||
        other.values[strongest].source.startsWith("Your")
        ? `Your ${labels[strongest]} descriptions make the biggest difference versus Route ${routes.indexOf(reference!) + 1}.`
        : row.values[strongest].low > other.values[strongest].low
          ? `Compared with Route ${routes.indexOf(reference!) + 1}, ${mappedReasons[strongest]}.`
          : "Ranks higher using neutral estimates for missing information."
      : "Highest score with the current inputs and priorities.";
  const facts: string[] = [];
  const a = states[route.id],
    b = reference && states[reference.id];
  if (a?.status === "complete" && b?.status === "complete") {
    const x = a.evidence,
      y = b.evidence;
    const sameSource =
      x.source_provenance.manifest_sha256 === y.source_provenance.manifest_sha256 &&
      x.source_provenance.source_pbf_sha256 === y.source_provenance.source_pbf_sha256 &&
      x.source_provenance.source_snapshot_timestamp ===
        y.source_provenance.source_snapshot_timestamp;
    if (
      x.route.id === route.id &&
      y.route.id === reference?.id &&
      x.status === "available" &&
      y.status === "available" &&
      x.coverage.full_buffer_covered &&
      y.coverage.full_buffer_covered &&
      sameSource &&
      x.route_context &&
      y.route_context
    ) {
      const businessDelta =
        x.route_context.categories.shops_and_businesses.count -
        y.route_context.categories.shops_and_businesses.count;
      if (businessDelta)
        facts.push(
          `${Math.abs(businessDelta)} ${businessDelta > 0 ? "more" : "fewer"} mapped businesses nearby`,
        );
      const gapA = x.route_context.segment_evidence?.longest_facility_gap.length_metres;
      const gapB = y.route_context.segment_evidence?.longest_facility_gap.length_metres;
      if (gapA !== undefined && gapB !== undefined && Math.abs(gapA - gapB) >= 1)
        facts.push(
          `${Math.round(Math.abs(gapA - gapB))} m ${gapA < gapB ? "shorter" : "longer"} gap without mapped shops or healthcare`,
        );
    }
  }
  const extra = route.durationSeconds - fastest.durationSeconds;
  return {
    route,
    row,
    custom,
    onlyEligible,
    reason,
    facts,
    reference,
    extra:
      extra <= 0
        ? "Fastest estimate"
        : extra < 60
          ? "Under 1 min extra"
          : `${Math.round(extra / 60)} min extra`,
    limited: row.coverage < 99.999 || (!!other && row.low <= other.high),
  };
}

/** Keep missing evidence distinct from an actual score tie. */
export function recommendationFallback(result: HybridResult) {
  if (!result.rows.length) return "ML comparison unavailable";
  const scored = result.rows.filter((row) => row.eligible && row.score !== undefined);
  if (!scored.length) return "Insufficient data for ML comparison";
  return "Equal top preference scores · compare routes";
}

/** A unique midpoint leader is not necessarily separated across missing-input bounds. */
export function preferenceIsSeparated(result: HybridResult) {
  const eligible = result.rows.filter((row) => row.eligible);
  const winner = eligible.find((row) => row.id === result.recommendedId && row.score !== undefined);
  return (
    !!winner &&
    eligible.length > 1 &&
    eligible.every((row) => row.id === winner.id || winner.low > row.high + 1e-8)
  );
}

/** Describe time fallback without implying that missing inputs produced an ML match. */
export function timeFallbackSummary(route: RouteData, routes: RouteData[], result: HybridResult) {
  const row = result.rows.find((item) => item.id === route.id);
  const peers = routes.filter((candidate) => {
    const other = result.rows.find((item) => item.id === candidate.id);
    return other?.score === undefined && other?.eligible === row?.eligible;
  });
  const fastest =
    [...peers].sort(
      (a, b) => a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters,
    )[0] ?? route;
  const extra = route.durationSeconds - fastest.durationSeconds;
  const hasScoredPeers = result.rows.some(
    (item) => item.score !== undefined && item.eligible === row?.eligible,
  );
  const prefix =
    row?.eligible === false
      ? "Outside your extra-time limit. "
      : hasScoredPeers
        ? "Placed after routes with a preference match. "
        : "";
  if (routes.length === 1) return "Only route returned for this journey.";
  if (peers.length === 1 && hasScoredPeers) return prefix + "Travel time is shown for comparison.";
  const scope = hasScoredPeers || row?.eligible === false ? " in this group" : "";
  if (extra > 0) {
    const delay =
      extra < 60
        ? "Less than 1 minute"
        : `About ${Math.round(extra / 60)} ${Math.round(extra / 60) === 1 ? "minute" : "minutes"}`;
    return prefix + `${delay} longer than the fastest${scope}; ordered by estimated walking time.`;
  }
  const tied = peers.filter((item) => item.durationSeconds === route.durationSeconds);
  if (tied.length > 1) {
    const distanceDiffers = tied.some((item) => item.distanceMeters !== route.distanceMeters);
    return (
      prefix +
      (distanceDiffers
        ? "Same estimated walking time; shorter routes are listed first."
        : "Same estimated time and distance; original route order retained.")
    );
  }
  return prefix + `Fastest estimated walk${scope}; ranked by travel time.`;
}
