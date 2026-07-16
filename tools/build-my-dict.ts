/**
 * Build the Burmese pronunciation lexicon (src/languages/burmese/dictionary.tsv) — the 🟡→✅ layer. The rule g2p is
 * correct for the derivable bulk; the residual is a per-word LEXICAL tail (rime variation ည→i~ɛ / ေ→e~i, colloquial
 * forms, Pali gemination, loanword ⟨ရ⟩→ɹ). This mines the kaikki gold for the words our g2p gets wrong and stores
 * the CORRECT pronunciation IN OUR CONVENTION as a per-word override (the Thai dictionary.tsv pattern).
 *
 * Conversion: kaikki marks tone with a combining diacritic on the vowel (à low / á high / a̰ creaky; a checked ʔ
 * syllable carries none) — exactly where our Chao letter goes — so NFD → replace the diacritic in place with the
 * Chao letter → NFC yields our format (mjàɴmà → mja˨ɴma˨). We store a word only when its FOLDED converted-gold
 * differs from our g2p (a real segmental correction, not notation), skipping single-letter rows (Pali letter-name
 * noise). Source: kaikki mya (Wiktionary, CC-BY-SA) — the derived TSV inherits it. Corroborate on the INDEPENDENT
 * wikipron (build/eval separation): npx tsx tools/referee-eval/eval.ts my.
 *
 *   npx tsx tools/build-my-dict.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWord as my } from "../src/languages/burmese/burmese.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PERSO = /^[က-႟꧰-꧹]+$/u;
// kaikki tone diacritic → our Chao letter (inserted in place — same position we render it).
const toOurs = (kaikki: string): string =>
    kaikki.normalize("NFD").replace(/̀/gu, "˨").replace(/́/gu, "˥˩").replace(/̰/gu, "˥ˀ").normalize("NFC");
// Fold to the segmental backbone (same as the referee eval) to decide whether it's a REAL correction.
const fold = (x: string): string =>
    x.normalize("NFD").replace(/[˥˦˧˨˩ˀ]/gu, "").replace(/[̀-ͯ]/gu, "").replace(/ɴ/gu, "n").replace(/\s/gu, "").normalize("NFC");

const first = new Map<string, string>(); // word → first kaikki pronunciation
for (const line of readFileSync(join(HERE, "referee-eval/referees/my.kaikki-mya.tsv"), "utf8").split("\n")) {
    const [w, ipa] = line.split("\t");
    if (w && ipa && !first.has(w)) first.set(w, ipa.replace(/\s/gu, ""));
}

const rows: string[] = [];
let corrections = 0, agree = 0;
for (const [w, ipa] of first) {
    if ([...w].length < 2 || !PERSO.test(w.normalize("NFC"))) continue; // skip letter-name / non-pure rows
    const gold = toOurs(ipa);
    if (fold(my(w)) === fold(gold)) { agree++; continue; }               // rule g2p already right → no entry
    rows.push(`${w.normalize("NFC")}\t${gold}`);
    corrections++;
}

rows.sort();
const header =
    "# Burmese pronunciation lexicon (the 🟡→✅ lexical layer) — undiacritized word ⇥ canonical IPA, for words the\n" +
    "# rule g2p gets wrong (lexical rime, colloquial, Pali gemination, loanword ⟨ရ⟩→ɹ). Mined from the kaikki gold\n" +
    "# (Wiktionary, CC-BY-SA) by tools/build-my-dict.ts; tone diacritics converted to our Chao letters. Applied in\n" +
    "# burmese.ts (an exact-word override before the g2p rules); OOV words keep the rule reading.\n";
writeFileSync(join(HERE, "..", "src", "languages", "burmese", "dictionary.tsv"), header + rows.join("\n") + "\n");
console.log(`kaikki words: rule-g2p already right ${agree} · corrections stored ${corrections} → dictionary.tsv`);
