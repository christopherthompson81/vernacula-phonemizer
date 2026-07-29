/**
 * Swedish PITCH-ACCENT (tonal word accent 1 vs 2) validation against wikipron — an INDEPENDENT source (English
 * Wiktionary pronunciations) of our NST-derived accent lexicon. wikipron marks the accent before the stressed
 * syllable: ² = accent 2 (grave/compound), ¹ = accent 1 (acute/simplex). We render accent 2 as a combining grave
 * on the primary-stressed vowel (tanken→tˈànkɛn) and accent 1 as plain ˈ (telefon→tɛlɛfˈoːn); this eval reads our
 * accent off that grave and compares to wikipron's marker.
 *
 * HOMOGRAPHS (words wikipron lists with BOTH ¹ and ², e.g. anden 'the duck'/'the spirit', buren 'carried'/'the
 * cage') are excluded: our single lexicon reading can't match both, so they'd measure reading choice, not accent.
 * Only wikipron-accent-marked words are scorable (~1300); accent-2 is the reliably-marked class (Wiktionary marks
 * ¹ mostly to disambiguate, so the accent-1 referee subset is small + adversarial). Like Japanese pitch, Swedish
 * accent is an inherent ~95% task where two independent lexica disagree on the contested tail. See
 * docs/sv_bringup_investigation.md.
 *
 *   npx tsx tools/eval/sv-accent-eval.mts            # score
 *   npx tsx tools/eval/sv-accent-eval.mts --list     # + list accent disagreements
 */
import { readFileSync } from "node:fs";
import { phonemizeWord } from "../../src/languages/swedish/swedish.ts";

const REF = new URL(
    "../referee-eval/referees/sv.wikipron-swe.tsv",
    import.meta.url,
).pathname;

export interface AccentEvalResult {
    compared: number;
    agree: number;
    a1: number;
    a1ok: number;
    a2: number;
    a2ok: number;
    homographsExcluded: number;
    monoSkipped: number;
    diffs: Array<{ w: string; ours: number; ref: number; out: string }>;
}

/** Score OUR tonal accent (1/2) against wikipron's ¹/² markers, excluding homographs and monosyllables. */
export function evaluateAccent(): AccentEvalResult {
    const lines = readFileSync(REF, "utf8").split("\n");
    // A word is a homograph if wikipron lists it with both ¹ and ².
    const seen = new Map<string, Set<number>>();
    for (const l of lines) {
        const [w, phon] = l.split("\t");
        if (!w || !phon) continue;
        const s = seen.get(w) ?? new Set<number>();
        for (const t of phon.split(" ")) {
            if (t === "²") s.add(2);
            else if (t === "¹") s.add(1);
        }
        if (s.size) seen.set(w, s);
    }
    const homograph = new Set(
        [...seen].filter(([, s]) => s.size > 1).map(([w]) => w),
    );

    let compared = 0,
        agree = 0,
        a1 = 0,
        a1ok = 0,
        a2 = 0,
        a2ok = 0,
        homographsExcluded = 0,
        monoSkipped = 0;
    const diffs: AccentEvalResult["diffs"] = [];
    const done = new Set<string>();
    for (const l of lines) {
        const [w, phon] = l.split("\t");
        if (!w || !phon || done.has(w)) continue;
        const toks = phon.split(" ");
        const mi = toks.findIndex((t) => t === "¹" || t === "²");
        if (mi < 0) continue; // only accent-marked referee words are scorable
        done.add(w);
        if (homograph.has(w)) {
            homographsExcluded++;
            continue;
        }
        const refAcc = toks[mi] === "²" ? 2 : 1;
        const out = phonemizeWord(w);
        if (!out.includes("ˈ")) {
            monoSkipped++;
            continue;
        } // monosyllable / no stress → no accent contrast
        const ourAcc = out.normalize("NFD").includes("̀") ? 2 : 1;
        compared++;
        if (refAcc === 2) {
            a2++;
            if (ourAcc === 2) a2ok++;
        } else {
            a1++;
            if (ourAcc === 1) a1ok++;
        }
        if (ourAcc === refAcc) agree++;
        else diffs.push({ w, ours: ourAcc, ref: refAcc, out });
    }
    return {
        compared,
        agree,
        a1,
        a1ok,
        a2,
        a2ok,
        homographsExcluded,
        monoSkipped,
        diffs,
    };
}

const invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
    const r = evaluateAccent();
    const pct = (a: number, b: number): string => ((100 * a) / b).toFixed(1);
    console.log(`\n=== sv tonal accent (1/2) vs wikipron (independent) ===`);
    console.log(`accent AGREE (non-homograph, marked): ${r.agree}/${r.compared} (${pct(r.agree, r.compared)}%)`);
    console.log(`  accent-2 recall (reliably marked): ${r.a2ok}/${r.a2} (${pct(r.a2ok, r.a2)}%)`);
    console.log(`  accent-1 recall (small adversarial subset): ${r.a1ok}/${r.a1} (${pct(r.a1ok, r.a1)}%)`);
    console.log(`  homographs excluded: ${r.homographsExcluded}   monosyllables skipped: ${r.monoSkipped}\n`);
    if (process.argv.includes("--list"))
        for (const d of r.diffs) console.log(`  ${d.w}: ours=${d.ours} ref=${d.ref} (${d.out})`);
}
