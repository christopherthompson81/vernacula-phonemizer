/**
 * Independent validation of the Japanese reading front-end (kanji→kana + は/へ particles) against OpenJTalk
 * (pyopenjtalk, naist-jdic — a DIFFERENT source than our JMdict-derived readings.tsv). Both readings go through
 * our OWN kanaToIpa (normalises katakana/long-vowel notation to the length mark ː, so our ゅう and OpenJTalk's
 * ー both surface as ɯᵝː), so the difference is purely the reading. Reports per-CHARACTER accuracy (fair — a single
 * homograph error doesn't fail a whole sentence) and whole-sentence exact. Number-bearing sentences are excluded
 * (counters are the separate readCounter subsystem).
 *
 * REGENERATE the gold (run in a venv with `pip install pyopenjtalk`):
 *   Tatoeba jpn: curl -sL https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2 | bunzip2 > jpn.tsv
 *   python: for a random sample, "".join(f["pron"] for f in pyopenjtalk.run_frontend(sent)) → katakana→hiragana → sent<TAB>reading
 * Usage: npx tsx tools/ja-openjtalk-validate.mts --gold <sent-TAB-ojtreading.tsv>
 */
import { readFileSync } from "node:fs";
import { applyReadings, segmentText } from "../src/languages/japanese/kanji.ts";
import { kanaToIpa } from "../src/languages/japanese/kana.ts";
const i = process.argv.indexOf("--gold");
if (i < 0 || !process.argv[i + 1]) throw new Error("pass --gold <tsv> (see header to regenerate)");
const rows = readFileSync(process.argv[i + 1]!, "utf8").split("\n").map((l) => l.split("\t"));
const stripP = /[。、，,.！!？?・「」『』（）\s]/gu;
const collapse = (s: string): string => s.replace(/(([aeiou]|ɯᵝ|o̞|e̞|ä))\1/gu, "$1ː");
function lev(a: string[], b: string[]): number {
    const d = Array(b.length + 1).fill(0).map((_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = d[0]!; d[0] = i;
        for (let j = 1; j <= b.length; j++) { const t = d[j]!; d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
    }
    return d[b.length]!;
}
let totChar = 0, totErr = 0, n = 0, exact = 0, numSents = 0;
for (const [sent, ojt] of rows) {
    if (!sent || !ojt) continue;
    if (/[0-9０-９]/.test(sent)) { numSents++; continue; }
    const a = collapse(kanaToIpa(applyReadings(segmentText(sent)).replace(stripP, "")) ?? "");
    const b = collapse(kanaToIpa(ojt.replace(stripP, "")) ?? "");
    const dd = lev([...a], [...b]); totChar += [...b].length; totErr += dd; n++; if (dd === 0) exact++;
}
console.log(`ja reading vs OpenJTalk (${n} non-number sentences, long-vowel-folded):`);
console.log(`  per-CHARACTER accuracy: ${(100 * (1 - totErr / totChar)).toFixed(1)}%`);
console.log(`  whole-sentence exact:  ${(100 * exact / n).toFixed(1)}%  (${numSents} number sentences excluded)`);
