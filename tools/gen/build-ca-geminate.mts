/**
 * Build the vernacula Catalan bl/gl-gemination lexicon `src/languages/catalan/bl-gl-geminate.tsv` from the
 * espeak-ng 1.52 Central shim. Whether intervocalic ⟨bl⟩/⟨gl⟩ GEMINATES (poble → pɔbːlə) or SPIRANTIZES
 * (problema → pɾuβlə, obligar → uβliɣə) is LEXICAL — popular/inherited words geminate, learned words don't, and
 * it is not derivable from the surface form. espeak marks the geminate as a doubled stop (bbl / ɡɡl), so we
 * flag the words whose IPA contains one. Restricted to the 50k frequency corpus.
 *
 * Reuses the same espeak run as build-ca-midvowels.mts:
 *   awk '{print $0"\n"}' <(grep -iE '^[a-zàèéíòóúüïç·]+$' tools/qa-compare/words-50000.ca.txt) > /tmp/ca-para.txt
 *   ./tools/espeak-ng -v ca -q --ipa -f /tmp/ca-para.txt > /tmp/ca.ipa
 *   npx tsx tools/gen/build-ca-geminate.mts /tmp/ca-para.txt /tmp/ca.ipa
 * Output: word<TAB>g  (the word's intervocalic ⟨bl⟩/⟨gl⟩ geminates).
 */
import { readFileSync, writeFileSync } from "node:fs";

const WORDS = process.argv[2]!;
const IPA = process.argv[3]!;
const OUT = "src/languages/catalan/bl-gl-geminate.tsv";

const words = readFileSync(WORDS, "utf8").split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean);
const lines = readFileSync(IPA, "utf8").split("\n").map((l) => l.trim()).filter((l) => l !== "");
if (words.length !== lines.length) throw new Error(`misaligned: ${words.length} words vs ${lines.length} ipa lines`);

const out: string[] = [];
const seen = new Set<string>();
for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w.length < 2 || seen.has(w)) continue;
    seen.add(w);
    const ipa = lines[i]!;
    if (/bbl|ɡɡl|ggl/.test(ipa)) out.push(`${w}\tg`); // espeak doubled stop before l = geminate
}
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`${OUT}: ${out.length} bl/gl-geminating words`);
