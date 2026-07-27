/**
 * Quechua (qu) — reproducible epitran secondary cross-check.
 *
 * The primary referee is the kaikki Quechua human set (floored in referee-eval.test.ts). epitran `quy-Latn`
 * (Ayacucho Quechua) is an INDEPENDENT programmatic G2P, but it is fold-heavy (it emits English-ish lax vowels
 * [æ ɪ ʊ], writes q~χ, applies uvular vowel-lowering /i u/→[e o], and does NOT collapse the aspirate/ejective
 * notation the way we do), so it is NOT floored — it is a corroboration cross-check only. This script commits the
 * number the maturity/floor docs cite (~88% SKELETON agreement) so it is re-derivable from the repo (the
 * hmn-heldout-cv.ts precedent). Requires epitran installed (`pip install epitran`).
 *
 * Run: npx tsx tools/referee-eval/qu-epitran-crosscheck.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { phonemizeWord } from "../../src/languages/quechua/quechua.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const TSV = join(HERE, "referees", "qu.kaikki-quechua.tsv");

// Only compare on STANDARD-spelling words (lowercase Quechua letters) — the nonstandard/loan spellings (⟨c g z⟩,
// carro→karru) are noise for both engines and out of scope for a segmental cross-check.
const words: string[] = [];
for (const line of readFileSync(TSV, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const w = line.split("\t")[0]!.trim();
    if (/^[a-zñ']+$/u.test(w.toLowerCase()) && w.toLowerCase() === w) words.push(w);
}

// Batch through epitran once (spawning per word is slow).
const epi: Record<string, string> = JSON.parse(
    execFileSync(
        "python3",
        ["-c", "import epitran,json,sys\ne=epitran.Epitran('quy-Latn')\nprint(json.dumps({w:e.transliterate(w) for w in json.loads(sys.stdin.read())}))"],
        { input: JSON.stringify(words) },
    ).toString(),
);

// Fair SKELETON fold applied to BOTH sides: neutralise the aspiration/ejective axis (phonemic, but notated
// differently — our ʰ/ʼ vs epitran's digraph h / apostrophe), tie bars, stress, syllable dots, the tap r~ɾ, the
// q~χ allophone, and the lax/uvular-lowered vowels. What remains is the segmental place-of-articulation skeleton.
const fold = (s: string): string =>
    s
        .normalize("NFC")
        .replace(/[ˈˌ.ːˑ ͡]/gu, "")
        .replace(/ʼ/gu, "")
        .replace(/'/gu, "")
        .replace(/([ptkqʃ])h/gu, "$1")
        .replace(/ʰ/gu, "")
        .replace(/r/gu, "ɾ")
        .replace(/χ/gu, "q")
        .replace(/[æɑ]/gu, "a")
        .replace(/ɪ/gu, "i")
        .replace(/[ʊɔ]/gu, "u")
        .replace(/ɛ/gu, "e");

let agree = 0;
const diffs: string[] = [];
for (const w of words) {
    const mine = fold(phonemizeWord(w));
    const other = fold(epi[w] ?? "");
    if (mine === other) agree++;
    else if (diffs.length < 20) diffs.push(`  ${w}: ours=${mine}  epitran=${other}`);
}

const pct = ((100 * agree) / words.length).toFixed(1);
console.log(`Quechua epitran quy-Latn skeleton cross-check: ${agree}/${words.length} (${pct}%)`);
console.log("(fold neutralises aspiration/ejective, tap r~ɾ, q~χ, lax/lowered vowels — both sides)");
console.log("residual diffs (epitran limitations: no sh→ʃ, leaves ⟨c g z⟩, j→glide; + its uvular vowel-lowering):");
diffs.forEach((d) => console.log(d));
