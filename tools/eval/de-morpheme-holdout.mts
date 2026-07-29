/**
 * German morpheme-keyed HOLDOUT experiment (docs/investigations/de_morpheme_keyed_investigation.md).
 * For compound referee words that ARE in the whole-word dicts (in-corpus, known answer), compare three ways of
 * phonemizing them AS IF the whole-word entry were absent (OOV simulation):
 *   (c) whole-word  = current phonemizeWord (uses the whole-word dict) — the in-corpus ceiling
 *   (a) fallback    = compose morphemes with NO corrections (what a truly-OOV compound gets today)
 *   (b) morphKeyed  = compose morphemes, each with its OWN morpheme-keyed dict entry + LOCAL ordinals
 * If (b) ≫ (a), morpheme-keying recovers corrections the current fallback loses → it generalizes to OOV compounds.
 */
import { readFileSync } from "node:fs";
import { CONFIG } from "../referee-eval/config.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { phonemizeWord, _internal as G } from "../../src/languages/german/german.ts";
import { decompose, PREFIX_IPA, SUFFIX_IPA } from "../../src/languages/german/morphology.ts";
import { toSegments } from "../../src/languages/german/g2p.ts";
import { MANIFEST } from "../../src/languages/german/manifest.ts";

const VINIT = new Set(MANIFEST.morphology.vowelInitialSuffixes);

/** Merge vowel-initial suffixes back into the preceding stem (mirrors phonemizeWord). */
function mergeParts(parts: string[], kinds: string[]): { text: string; kind: string }[] {
    const merged: { text: string; kind: string }[] = [];
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!, k = kinds[i]!, last = merged[merged.length - 1];
        if (k === "suffix" && VINIT.has(p) && last?.kind === "stem") last.text += p;
        else merged.push({ text: p, kind: k });
    }
    return merged;
}

const g2pOf = (m: string): string => toSegments(m).map((s) => s.ph).join("");

/** (a) compose morphemes with NO corrections (raw g2p + affix IPA), one primary stress at the stress part. */
function composeFallback(w: string): string {
    const d = decompose(w);
    const merged = mergeParts(d.parts, d.kinds);
    if (merged.length <= 1) return phonemizeWord(w);
    const pieces = merged.map((m) =>
        m.kind === "prefix" && PREFIX_IPA[m.text] ? PREFIX_IPA[m.text]!
        : m.kind === "suffix" && SUFFIX_IPA[m.text] ? SUFFIX_IPA[m.text]!
        : g2pOf(m.text));
    const full = pieces.join("");
    const ord = G.countNuclei(pieces.slice(0, d.stressPart).join(""));
    return G.restoreStressedEr(G.restoreStressedIe(G.fixStressedSchwa(G.placeStress(full, ord))));
}

/** (b) the SHIPPED morpheme-keyed OOV path (german.ts composeMorphemeKeyed), forced onto in-dict compounds. */
function composeMorphKeyed(w: string): string {
    const d = decompose(w);
    const merged = mergeParts(d.parts, d.kinds);
    if (merged.length <= 1) return phonemizeWord(w);
    return G.composeMorphemeKeyed(merged, d.stressPart);
}

const cfg = CONFIG["de"]!;
const ref = cfg.referees.find((r) => r.role === "primary")!;
const fold = makeFold(cfg, ref.folds);
const rows = readFileSync("tools/referee-eval/referees/" + ref.file, "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"))
    .filter((a) => a.length >= 2 && a[0] && a[1]);

let n = 0, okC = 0, okA = 0, okB = 0, bBeatsA = 0, aBeatsB = 0;
const inStress = G.stressDict();
for (const [w, ipa] of rows) {
    const lw = w!.toLowerCase();
    const d = decompose(lw);
    // in-corpus COMPOUNDS: ≥2 stems and the whole word is in the stress dict (known answer to hold out)
    const stems = d.kinds.filter((k) => k === "stem").length;
    if (stems < 2 || !inStress.has(lw)) continue;
    n++;
    const tgt = fold(ipa!);
    const c = fold(phonemizeWord(lw)), a = fold(composeFallback(lw)), b = fold(composeMorphKeyed(lw));
    if (c === tgt) okC++;
    if (a === tgt) okA++;
    if (b === tgt) okB++;
    if (b === tgt && a !== tgt) bBeatsA++;
    if (a === tgt && b !== tgt) aBeatsB++;
}
console.log(`in-corpus compounds (held out): ${n}`);
console.log(`  (c) whole-word ceiling: ${okC} (${(100 * okC / n).toFixed(1)}%)`);
console.log(`  (a) OOV fallback (today): ${okA} (${(100 * okA / n).toFixed(1)}%)`);
console.log(`  (b) morpheme-keyed:       ${okB} (${(100 * okB / n).toFixed(1)}%)`);
console.log(`  b beats a: ${bBeatsA}   a beats b: ${aBeatsB}   net (b−a): ${okB - okA}`);
