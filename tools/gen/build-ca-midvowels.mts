/**
 * Build the vernacula Catalan mid-vowel-height lexicon `src/languages/catalan/mid-vowels.tsv` from the mature
 * espeak-ng 1.52 Central-Catalan shim (the convergence reference; the height ⟨e⟩=ɛ/e, ⟨o⟩=ɔ/o is LEXICAL, not
 * spelling-derivable — dona/dóna, os/ós). Only the CONVENTION-INDEPENDENT abstract feature is taken: for each
 * corpus word, is the STRESSED mid vowel CLOSE (e/o) or OPEN (ɛ/ɔ)? The engine defaults to open, so we emit a
 * flag only for the CLOSE deviations. Restricted to the 50k frequency corpus.
 *
 * Not a runtime step — run once against the espeak-ng shim + corpus, commit the TSV:
 *   1. cd $ESPEAK_PORTABLE
 *   2. awk '{print $0"\n"}' <(grep -iE '^[a-zàèéíòóúüïç·]+$' tools/qa-compare/words-50000.ca.txt) > /tmp/ca-para.txt
 *   3. ./tools/espeak-ng -v ca -q --ipa -f /tmp/ca-para.txt > /tmp/ca.ipa   # one output LINE per word
 *   4. npx tsx tools/gen/build-ca-midvowels.mts /tmp/ca-para.txt /tmp/ca.ipa   (paths: words file, ipa file)
 * Output: word<TAB>e  (stressed ⟨e⟩ is close /e/)  or  word<TAB>o  (stressed ⟨o⟩ is close /o/).
 */
import { readFileSync, writeFileSync } from "node:fs";

const WORDS = process.argv[2]!;
const IPA = process.argv[3]!;
const OUT = "src/languages/catalan/mid-vowels.tsv";

const words = readFileSync(WORDS, "utf8").split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean);
const lines = readFileSync(IPA, "utf8").split("\n").map((l) => l.trim()).filter((l) => l !== "");
if (words.length !== lines.length) throw new Error(`misaligned: ${words.length} words vs ${lines.length} ipa lines`);

const out: string[] = [];
const seen = new Set<string>();
let ec = 0, oc = 0;
for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w.length < 2 || seen.has(w)) continue; // drop single letters (espeak reads letter-names) + dups
    seen.add(w);
    const ipa = lines[i]!;
    const m = ipa.indexOf("ˈ");
    if (m < 0) continue;
    const v = ipa[m + 1] ?? ""; // espeak places ˈ immediately before the stressed vowel
    if (v === "e") { out.push(`${w}\te`); ec++; } // stressed ⟨e⟩ is CLOSE (engine default is open ɛ)
    else if (v === "o") { out.push(`${w}\to`); oc++; } // stressed ⟨o⟩ is CLOSE (engine default is open ɔ)
}
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`${OUT}: ${out.length} close-mid overrides (${ec} close-e, ${oc} close-o)`);
