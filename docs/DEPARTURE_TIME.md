# Departure-time awareness

Choose a departure date and time on the journey form, or change it in the selected route's **At your departure** panel. The value always uses Ranchi time (IST, UTC+05:30), regardless of the device timezone. It persists when selecting another route or opening its overview. Use current IST time explicitly refreshes it; this is not a live clock.

Calculations run offline in the browser using matched route evidence. Editing time does not request routes, rerun geographic analysis or change the evidence-match ranking. Mock routes have no departure-time evidence. Unsupported or failed geographic evidence does not receive Ranchi-specific time claims.

## Facility schedules and provenance

The backend adds optional `route_context.facility_hours`, schema `SHEPATH.facility_hours.v1`. Every selected business or healthcare object appears once with its OSM identity, category flags, name and unmodified `opening_hours` (null if missing). Objects in both categories count once in combined totals. Ambiguous duplicate establishments remain separate OSM objects.

The frontend checks unique IDs and reconciles each category's count with the route inventory. Old responses remain readable but show schedules unavailable. The export version and implementation hash participate in the existing analysis/source provenance and evidence identity. Pinned source artifacts remain unchanged.

## Supported opening-hours grammar

The bounded parser supports `24/7`, daily spans (`09:00-18:00`), split periods (`09:00-12:00,13:00-18:00`), `00:00-24:00`, weekday lists/ranges (`Mo,We,Fr`, `Mo-Fr`, `Fr-Mo`), and `off` / `closed`. Separate rules may select non-overlapping weekdays, for example `Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off`. A single weekly rule can contain overnight spans (`Fr-Sa 22:00-02:00`), including spill into the following morning. Opening boundaries are inclusive; closing boundaries are exclusive. Whitespace around hyphens/commas is accepted, including the snapshot's `Mo-Su 10:00- 16:00`.

This is not the complete OSM grammar. Holidays (`PH`, `SH`), calendar dates, solar-time selectors, comments, open-ended times, fallbacks, overlapping normal-rule day selections and multi-rule overnight schedules remain unknown. Invalid tags also remain unknown. Input length and rule count are bounded; no holiday calendar or online service is used.

Results separate **likely open**, **likely closed** and **hours unknown**. Unknowns distinguish missing tags from unsupported schedules. Evaluation is at departure, not when a walker passes a facility. Historical schedules do not establish current operation; holiday exceptions and subsequent changes may apply even to simple weekly tags. Expandable details show original tags and classifications for the first 50 records; totals include all records.

Reference: [OSM opening_hours](https://wiki.openstreetmap.org/wiki/Key:opening_hours).

## Daylight estimate

Uses [NOAA's General Solar Position Calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF): fractional year (366 days in leap years), equation of time, solar declination and a 90.833-degree sunrise/sunset zenith. The representative coordinate is central Ranchi, 23.3441 N, 85.3096 E, using a local-noon approximation for each day. No API, new runtime dependency or paid service is required.

Arrival is departure plus provider travel duration. Nighttime walking is the duration outside sunrise–sunset intervals across intersecting IST dates. This handles pre-dawn and midnight crossings. Supported dates are 2000–2100 and durations 0–48 hours; invalid values hide estimates. Rounded minutes are estimates, not measurements of darkness or safety. Twilight, terrain, weather, stops and actual lighting are not modeled.

Five dates spanning equinox, both solstices, October and a leap day were compared with independent Astral 3.2 values at the same coordinate. Sunrise and sunset were within three minutes. Reference values are captured in tests; Astral is used only for validation and is not required to run SHEPATH.

## Update and validation

No dependency changes. Restart the Python backend after pulling this branch, refresh the frontend and request routes again. Old responses lack facility schedules until refreshed. Test afternoon, evening and a different selected route. Sparse hours in the Ranchi snapshot are expected.

Tests cover weekly/overnight boundaries, unsupported rules, IST independence (including an America/New_York process), invalid dates, selected-route identity, legacy responses, inventory consistency, local time changes, source identity, coverage gating and night duration. Browser replay uses historical fixtures; it does not replace Windows live acceptance or fresh full-manifest validation.
