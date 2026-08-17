/**
 * WHERE espeak-ng's `dictsource/` IS — resolved once, for every tool that reads the tier.
 *
 * ⚠ THIS EXISTS BECAUSE "THE VARIABLE IS UNSET" KEPT BEING REPORTED AS A FINDING INSTEAD OF FIXED. The
 * dictsource tier is one of four evidence sources the sourcing gate consults, and it answers the two
 * classes that block rounds most often — `letter-names` (the commonest deferral in this sweep, 20 of 25
 * PRs) and `decimal-point`. It was disconnected in every session, because `$ESPEAK_NG` is a per-shell
 * variable that nothing sets and nothing defaults, and a fresh shell is what every tool run, every
 * background command and every subagent starts with.
 *
 * The evidence that this was a known, unfixed problem is in the tree. `tools/pashto/build_espeak_silver.py`
 * opens by recording it — "`tools/normalization/sources.ts` gates its espeak tier on $ESPEAK_NG, which was
 * unset, so it reported …" — and then solves it FOR ITSELF, with
 * `default=os.environ.get("ESPEAK_NG", "/home/chris/…/espeak-ng")`. One script, one hardcoded path, while
 * the shared tier two directories away kept returning a confident negative. The fix belonged here.
 *
 * ⚠ DISCOVERY DOES NOT MEAN GUESSING, AND IT MUST NOT COLLAPSE THE THREE STATES. `sources.ts` carries a
 * long comment (trap 57's exact shape) about why "not probed" and "probed and absent" must never read the
 * same, and why the message has to name the VARIABLE, because that is the thing a reader can change. That
 * reasoning survives intact: this resolver reports WHICH path it used and by what route, so a reader is
 * never told a fact about espeak's coverage that is really a fact about their shell. What changes is only
 * that the common case now resolves without being told.
 *
 * ⚠ AND THE PROBE LIST CARRIES NO PERSONAL PATH. espeak-ng is a SIBLING CHECKOUT of this repo on the
 * machine where this was written, which is a layout convention rather than a location — so the list is
 * relative to this file, then the usual user and system prefixes. An explicit `$ESPEAK_NG` always wins, so
 * anyone with a checkout somewhere else is unaffected.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(import.meta.url), "../../..");

/** Conventional locations, in order. An explicit `$ESPEAK_NG` is consulted before any of them. */
const CANDIDATES: readonly string[] = [
    join(REPO, "..", "espeak-ng"),
    join(process.env["HOME"] ?? "", "espeak-ng"),
    "/usr/share/espeak-ng",
    "/usr/local/share/espeak-ng",
];

/** How the root was resolved. `env` and `found` both mean the tier is live; `none` means it is not. */
export type EspeakHow = "env" | "found" | "none";

export interface EspeakRoot {
    /** The checkout root, or "" when nothing was found. */
    root: string;
    /** `<root>/dictsource`, or "" when nothing was found. Test THIS, not `root`. */
    dict: string;
    how: EspeakHow;
    /** One line for a report: what was consulted, or what the reader must change. Never a claim about
     *  espeak's language coverage — that is a different question and a different message. */
    note: string;
}

let cached: EspeakRoot | undefined;

/** Resolve espeak-ng's `dictsource/`. Cached: every caller in a process gets the same answer and the same
 *  note, so two tools can never disagree about whether the tier was consulted. */
export function espeakRoot(): EspeakRoot {
    if (cached !== undefined) return cached;

    const env = process.env["ESPEAK_NG"] ?? "";
    if (env !== "") {
        const dict = join(env, "dictsource");
        // ⚠ AN EXPLICIT VARIABLE THAT POINTS SOMEWHERE WRONG IS ITS OWN STATE, and the reader who set it
        // needs to be told THAT rather than told to set it. This is the distinction `sources.ts` already
        // makes between its two "off" messages; discovery must not blur it by silently falling through to
        // a probe, or a typo in the variable becomes invisible.
        cached = existsSync(dict)
            ? { root: env, dict, how: "env", note: `espeak dictsource: $ESPEAK_NG (${env})` }
            : { root: "", dict: "", how: "none", note: `⚠ $ESPEAK_NG IS SET BUT HAS NO dictsource/ (${env}) — the espeak tier was not consulted at all` };
        return cached;
    }

    for (const c of CANDIDATES) {
        const dict = join(c, "dictsource");
        if (existsSync(dict)) {
            cached = { root: c, dict, how: "found", note: `espeak dictsource: found at ${c} (set $ESPEAK_NG to override)` };
            return cached;
        }
    }

    cached = {
        root: "", dict: "", how: "none",
        note: "⚠ NO espeak-ng dictsource/ FOUND — the espeak tier was not consulted at all. "
            + "Set $ESPEAK_NG to a checkout, or place one beside this repo.",
    };
    return cached;
}
