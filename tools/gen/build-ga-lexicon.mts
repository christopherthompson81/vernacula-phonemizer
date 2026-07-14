/**
 * Build the vernacula Irish (ga) Connacht pronunciation lexicon (Run 3) — src/languages/irish/lexicon.tsv.
 *
 * SOURCE: the espeak-ng-portable ga engine (the canonical oracle) run over the 50k frequency corpus. Regenerate
 * the intermediate oracle TSV (word<TAB>IPA) from inside that repo with:
 *
 *   // gen_ga.mts, run with `npx tsx` inside ~/Programming/espeak-ng-portable
 *   import { phonemize } from "./src/index.ts"; import { loadLanguage } from "./src/loadData.ts";
 *   const l = await loadLanguage("ga");
 *   for (const w of corpusWords) if (/^[a-záéíóú]+$/.test(w)) print(w + "\t" + phonemize(w, l));
 *
 * The oracle is a strong reference for CONSONANTS and structure but carries espeak vowel ARTEFACTS (it keeps the
 * underlying unstressed short i as ɪ, breaks long iː with a spurious svarabhakti ə, uses Munster vˠ for broad
 * bh/mh). We therefore Connacht-normalize (see `norm`) against the INDEPENDENT wikipron gle referee, then keep
 * ONLY entries whose consonant skeleton matches our rule-based g2p — so the lexicon pins the genuinely
 * semi-lexical VOWEL-QUALITY detail the rules defer (io/oi/eo splits) — NOT glide placement, which stays the rule
 * engine's job (an oracle form differing only by a glide is a skeleton mismatch) — and never
 * imports an oracle CONSONANT quirk (teanga ŋɡ→ŋ, eile l̪ˠ, grapheme leaks). Output: word<TAB>canonical-IPA.
 *
 * Usage: npx tsx tools/gen/build-ga-lexicon.mts --oracle <oracle.tsv>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { g2pWord } from "../../src/languages/irish/irish.ts"; // the PURE rule-based g2p (no lexicon feedback)
import { CONFIG } from "../referee-eval/config.ts";
import { makeFold } from "../referee-eval/eval.ts";

function arg(name: string, fallback: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const ORACLE = arg("oracle", "");
const OUT = "src/languages/irish/lexicon.tsv";
if (!ORACLE) throw new Error("pass --oracle <word\\tIPA tsv> (see header for how to regenerate it)");

const V = "aɛɪɔʊəiɑoeu";
/** Reduce the oracle's unstressed short i (ɪ → ə): espeak keeps the underlying letter, but the independent
 *  referee shows ə (féidir → …dʲəɾʲ, milis → mʲɪlʲəʃ). Keep ɪ only as the stressed nucleus or inside a diphthong
 *  (əɪ); an ɪ right after a long vowel (the gaeilge eːɪ artefact) also reduces. */
function reduceI(s: string): string {
    const m = s.match(/ˈ[^aɛɪɔʊəiɑoeu]*([aɛɪɔʊəiɑoeuːⁱᶷᶦ]+)/u);
    const vs = m ? m[1]! : "", start = m ? m.index! + m[0].length - vs.length : -1;
    let out = "";
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (c === "ɪ") {
            const prev = s[i - 1] || "";
            const inStress = start >= 0 && i >= start && i < start + vs.length;
            if ((!inStress || prev === "ː") && !V.includes(prev)) { out += "ə"; continue; }
        }
        out += c;
    }
    return out;
}
/** Oracle → Connacht canonical: broad bh/mh vˠ→w; the spurious long-vowel break iːə→iː (níos → nʲiːsˠ, referee-
 *  backed); unstressed final -e ɛ→ə; then the ɪ reduction. */
function norm(s: string): string {
    let x = s.replace(/vˠvˠ/g, "w").replace(/vˠ/g, "w").replace(/iːə/g, "iː");
    const nuc = (x.match(/[aɛɪɔʊəiɑoeu]/g) || []).length;
    if (nuc >= 2 && /ɛ$/.test(x)) x = x.replace(/ɛ$/, "ə");
    return reduceI(x);
}
/** Skeleton = everything the lexicon may NOT override: consonants AND glides. Strip only vowel QUALITY (plain
 *  vowels, length, stress) — NOT the vocalic offglides ⁱ/ᶷ/ᶦ/ŭ. A matching skeleton then means the oracle differs
 *  purely in vowel quality (io/oi/eo splits — the safe semi-lexical detail); an oracle form that merely ADDS or
 *  DROPS a glide is a skeleton MISMATCH and is excluded. Glide placement is the rule engine's sole territory
 *  (offglide() restricts it to ɑː/oː; the oracle over-glides uː/iː and short vowels). */
const skel = (x: string): string => x.replace(/[aɛɪɔʊəiɑoeuːˈˌ]/g, "");

// Independent-referee gate: where the wikipron gle referee covers a word, keep the oracle override ONLY if its
// folded form matches a referee pronunciation — so the lexicon can never pull a referee-checkable word AWAY from
// ground truth (it caught the oracle's Munster ɪ / iːə / before-nn diphthong artefacts). Words the referee does
// not cover fall back to the skeleton-safe normalized detail (best available, no ground truth to gate on).
const fold = makeFold(CONFIG.ga!);
const refFolded = new Map<string, Set<string>>();
const REFEREE = join(dirname(fileURLToPath(import.meta.url)), "../referee-eval/referees/ga.wikipron-gle-broad.tsv");
for (const l of readFileSync(REFEREE, "utf8").trim().split("\n")) {
    const [w, r] = l.split("\t");
    if (!w || !r) continue;
    (refFolded.get(w) ?? refFolded.set(w, new Set()).get(w)!).add(fold(r.replace(/\s+/g, "")));
}

const rows = readFileSync(ORACLE, "utf8").trim().split("\n").map((l) => l.split("\t"));
const out: [string, string][] = [];
let gated = 0;
for (const [w, ipa] of rows) {
    if (!w || !ipa) continue;
    const o = norm(ipa), m = g2pWord(w);
    if (skel(o) !== skel(m) || o === m) continue; // consonant-safe, vowel-differing only
    const ref = refFolded.get(w);
    if (ref && !ref.has(fold(o))) { // referee covers it but the oracle detail contradicts ground truth → drop
        if (ref.has(fold(m))) gated++; // our g2p already matched; the override would have regressed it
        continue;
    }
    out.push([w, o]);
}
out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
console.log(`referee-gated out ${gated} entries that would have regressed a referee-confirmed g2p form`);

const hdr =
    "# Irish (ga) Connacht pronunciation lexicon — generated by tools/gen/build-ga-lexicon.mts (do not hand-edit).\n" +
    "# Oracle-distilled (espeak-ng-portable ga over the 50k corpus), Connacht-normalized vs the wikipron gle\n" +
    "# referee: broad bh/mh vˠ→w, unstressed final -e ɛ→ə, unstressed short i ɪ→ə, spurious break iːə→iː. Only\n" +
    "# consonant+glide-skeleton-matching entries are kept (pins semi-lexical VOWEL QUALITY — io/oi/eo splits —\n" +
    "# without importing a consonant quirk OR an oracle glide the rules omit), THEN referee-gated: any entry the\n" +
    "# wikipron gle referee covers is kept only if it folds to a referee pronunciation, so the lexicon never pulls\n" +
    "# a checkable word away from Connacht ground truth. word<TAB>IPA.\n";
writeFileSync(OUT, hdr + out.map(([w, i]) => w + "\t" + i).join("\n") + "\n");
console.log(`wrote ${OUT}: ${out.length} entries`);
