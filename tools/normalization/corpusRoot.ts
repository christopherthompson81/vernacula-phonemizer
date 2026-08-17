/**
 * WHERE THE FLEURS TRANSCRIPTS ARE — resolved once, for every tool that reads them.
 *
 * ⚠ THE SAME DEFECT AS `espeak.ts`, AND IT COSTS MORE HERE. `$FLEURS` is a per-shell variable that nothing
 * sets and nothing defaults, and a fresh shell is what every tool run, every background command and every
 * subagent starts with — so the corpus tier was silently off in every session, and a `hy` investigation
 * doc from an earlier round records `FLEURS=unset` as the reason it fell back to `--corpus mined:hy`.
 *
 * For the 66 languages that ALSO have a mined artifact that fallback is a smaller ruler, not a wall. For
 * the five that do not — `umb`, `luo`, `kam`, `kea`, `bs` — there is no artifact to fall back to, so an
 * unset variable is not a degraded measurement, it is no measurement at all. That is the difference that
 * made this worth fixing before dispatching work rather than after.
 *
 * ⚠ DISCOVERY STILL DOES NOT COLLAPSE THE THREE STATES, for the reason `sources.ts` spells out at length
 * (trap 57): "not probed" and "probed and absent" must never read the same, and the message must name the
 * thing the reader can change. An explicit `$FLEURS` that points somewhere wrong stays its own state with
 * its own message rather than falling through to the probe — otherwise a typo in the variable is invisible.
 *
 * ⚠ ON THE HARDCODED PATH. Unlike espeak-ng there is no layout convention to lean on: FLEURS is downloaded
 * data, not a checkout, and it can live anywhere. The candidate below is the root the corpora on this
 * project's machine live under, nominated by the maintainer as the place missing corpora get put. It is a
 * mount path and nothing more — no credential, no personal data — and `$FLEURS` overrides it, so a
 * different machine is unaffected. The alternative (leave it unset and document it) is exactly what has
 * been failing.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Conventional locations, in order. An explicit `$FLEURS` is consulted before any of them. */
const CANDIDATES: readonly string[] = [
    "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data",
    join(process.env["HOME"] ?? "", "fleurs", "data"),
    join(process.env["HOME"] ?? "", "corpora", "fleurs", "data"),
];

export type FleursHow = "env" | "found" | "none";

export interface FleursRoot {
    /** The directory holding one folder per language (`bs_ba/`, `de_de/`…), or "" when nothing was found. */
    root: string;
    how: FleursHow;
    /** One line for a report: what was consulted, or what the reader must change. */
    note: string;
}

/** A directory only counts if it actually holds language folders — an empty or wrong directory is a
 *  DIFFERENT failure from a missing one, and reporting it as "found" would hide a half-finished download. */
function looksLikeFleurs(dir: string): boolean {
    if (!existsSync(dir)) return false;
    try {
        return readdirSync(dir).some((d) => /^[a-z]{2,3}(_|$)/u.test(d) && existsSync(join(dir, d, "train.tsv")));
    } catch { return false; }
}

let cached: FleursRoot | undefined;

/** Resolve the FLEURS transcript root. Cached, so two tools in one process cannot disagree about whether
 *  the corpus tier was consulted. */
export function fleursRoot(): FleursRoot {
    if (cached !== undefined) return cached;

    const env = process.env["FLEURS"] ?? "";
    if (env !== "") {
        cached = looksLikeFleurs(env)
            ? { root: env, how: "env", note: `FLEURS: $FLEURS (${env})` }
            : { root: "", how: "none", note: `⚠ $FLEURS IS SET BUT HOLDS NO LANGUAGE FOLDERS (${env}) — the FLEURS tier was not consulted at all` };
        return cached;
    }

    for (const c of CANDIDATES) {
        if (looksLikeFleurs(c)) {
            cached = { root: c, how: "found", note: `FLEURS: found at ${c} (set $FLEURS to override)` };
            return cached;
        }
    }

    cached = {
        root: "", how: "none",
        note: "⚠ NO FLEURS TRANSCRIPTS FOUND — the FLEURS tier was not consulted at all. "
            + "Set $FLEURS to a directory of per-language folders, or use `--corpus mined:<lang>`.",
    };
    return cached;
}
