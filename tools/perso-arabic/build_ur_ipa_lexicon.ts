/**
 * Build the Urdu IPA COVERAGE lexicon — `skeleton ⇥ canonical IPA` (unstressed; weight-stress is applied at
 * lookup). Replaces the harakat lexicon for Urdu: harakat cannot encode majhūl (ی=iː~eː, و=oː~uː) — the g2p only
 * fakes it with adapted-word diacritics — whereas the cross-script Hindi gold carries it natively (Devanagari
 * writes ई vs ए, ऊ vs ओ). Three sources, precedence in this order:
 *   1. silver.kaikki-urd.tsv — Urdu Wiktionary IPA (correct Arabic-template short vowels). SAME source family as the
 *      wikipron referee (both parse Wiktionary; verified 91% raw-string identical) → NOT non-circular vs wikipron.
 *   2. silver.hindiurdu.tsv — real Urdu spellings, gold IPA from the hi g2p (independent of Wiktionary → the
 *      non-circular backbone), carries short vowels AND majhūl. Fills kaikki gaps.
 *   3. the existing harakat lexicon (src/languages/urdu/lexicon.tsv), converted to IPA via our g2p, for the tail.
 * Canonical-convention normalisation: strip stress; drop the redundant vowel-nasalisation our Hindi source emits
 * before a full nasal consonant (ə̃nd̪→ənd̪), matching our own g2p (which nasalises via the n→ŋ/m rule, not the vowel)
 * and wikipron; g→ɡ. See docs/investigations/ur_tagger_investigation.md.
 *   npx tsx tools/perso-arabic/build_ur_ipa_lexicon.ts   # → src/languages/urdu/lexicon-ipa.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeWord as g2p } from "../../src/languages/urdu/g2p.ts";
import { finalizeUrduIpa } from "../../src/languages/urdu/urdu.ts";

const HERE = import.meta.dirname;
const OUT = `${HERE}/../../src/languages/urdu/lexicon-ipa.tsv`;

/** Normalise a raw IPA string to our canonical convention (unstressed). */
function canon(ipa: string): string {
    return ipa
        .replace(/[ˈˌ]/gu, "")
        .normalize("NFD")
        .replace(/̃(?=[nmŋɳɲ])/gu, "") // redundant vowel-nasalisation before a full nasal consonant → drop
        .normalize("NFC")
        .replace(/g/gu, "ɡ"); // ASCII g → IPA ɡ
}

/** Urdu convention: a word-final ہ (heh goal) after a consonant is the SHORT [ɑ] vowel (بارہ bɑːɾɑ, آئینہ ɑːiːnɑ),
 *  but the cross-script Hindi cognate ends in long -ɑː. Shorten a final ɑː back to ɑ for ہ-final skeletons. */
function finalHe(skel: string, ipa: string): string {
    return skel.endsWith("ہ") && ipa.endsWith("ɑː") ? ipa.slice(0, -2) + "ɑ" : ipa;
}

/** Word-initial آ (alef madda) is ALWAYS long ɑː (the g2p enforces this); the cross-script Hindi cognate sometimes
 *  reads a short/other vowel (آذربائیجان→əz…, آسٹریا→ɔːs…). Force a leading non-ɑː vowel to ɑː for آ-initial skeletons. */
function initialMadda(skel: string, ipa: string): string {
    return skel.startsWith("آ") ? ipa.replace(/^(?:ɑ(?!ː)|ə|ɔː?|ɛː?|[aeiouɪʊ]ː?)/u, "ɑː") : ipa;
}

/** Post-g2p canonicalisation before storing: enforce the آ→ɑː and final-ہ→ɑ invariants, strip the ̲ protection mark
 *  and assimilate nasals (n→m/ŋ). `full` also runs deleteMedialSchwa (via finalizeUrduIpa) — for the harakat branch,
 *  whose raw g2p output still carries default schwas + ̲ marks; the Hindi gold is already schwa-resolved, so it gets
 *  only the ̲-strip (a no-op) + nasal assimilation to avoid over-deleting a phonemic schwa. */
function finalize(skel: string, ipa: string, full: boolean): string {
    const v = finalHe(skel, initialMadda(skel, canon(ipa)));
    return full ? finalizeUrduIpa(v) : v.replace(/̲/gu, "").replace(/n(?=[bp])/gu, "m").replace(/n(?=[kɡ])/gu, "ŋ");
}

const lex = new Map<string, string>();
let fromKaikki = 0, fromHindi = 0, fromHarakat = 0;

// 1. kaikki-urd (Urdu Wiktionary) — highest-quality Urdu-native readings (correct Arabic-template short vowels).
//    SAME source family as the wikipron referee (both scrape Wiktionary) → these entries are NOT non-circular vs
//    wikipron; the honest non-circular number comes from the Hindi-sourced entries (independent of Wiktionary).
for (const line of readFileSync(`${HERE}/silver.kaikki-urd.tsv`, "utf8").split("\n")) {
    const p = line.split("\t");
    if (p.length < 3 || p[1] !== "urd" || !p[0] || !p[2]) continue;
    const skel = p[0].normalize("NFC");
    const ipa = finalize(skel, p[2], false); // human IPA, schwa-resolved → no deleteMedialSchwa
    if ([...skel].length < 2 || !ipa || ipa.includes(" ") || lex.has(skel)) continue;
    lex.set(skel, ipa); fromKaikki++;
}

// 2. Hindi-derived IPA — cross-script, INDEPENDENT of Wiktionary (the non-circular backbone); fills kaikki gaps + majhūl.
for (const line of readFileSync(`${HERE}/silver.hindiurdu.tsv`, "utf8").split("\n")) {
    const p = line.split("\t");
    if (p.length < 3 || p[1] !== "urd" || !p[0] || !p[2]) continue;
    const skel = p[0].normalize("NFC");
    const ipa = finalize(skel, p[2], false); // Hindi gold: schwa already resolved → no deleteMedialSchwa
    if ([...skel].length < 2 || !ipa || ipa.includes(" ") || lex.has(skel)) continue;
    lex.set(skel, ipa); fromHindi++;
}

// 3. existing harakat lexicon → IPA via g2p (fills the Urdu-native tail the above two lack)
for (const line of readFileSync(`${HERE}/../../src/languages/urdu/lexicon.tsv`, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.includes("\t")) continue;
    const [skelRaw, voc] = line.split("\t");
    if (!skelRaw || !voc) continue;
    const skel = skelRaw.normalize("NFC");
    if (lex.has(skel)) continue;
    const ipa = finalize(skel, g2p(voc.normalize("NFC")), true); // raw g2p output: full finalize (schwa + ̲ + nasal)
    if (!ipa || ipa.includes(" ")) continue;
    lex.set(skel, ipa); fromHarakat++;
}

const rows = [...lex.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const header = [
    "# Urdu IPA COVERAGE lexicon — undiacritized skeleton ⇥ canonical IPA (UNSTRESSED; weight-stress applied at lookup).",
    "# Replaces the harakat lexicon for Urdu: harakat can't encode majhūl (ی=iː~eː, و=oː~uː). Precedence: kaikki-urd",
    "# (Urdu Wiktionary, Urdu-native short vowels) → silver.hindiurdu.tsv (cross-script, independent of Wiktionary,",
    "# majhūl) → g2p-converted harakat lexicon. Regenerate: tools/perso-arabic/build_ur_ipa_lexicon.ts.",
];
writeFileSync(OUT, header.join("\n") + "\n" + rows.map(([k, v]) => `${k}\t${v}`).join("\n") + "\n");
process.stderr.write(`wrote ${rows.length} IPA entries (${fromKaikki} kaikki-urd + ${fromHindi} Hindi-derived + ${fromHarakat} harakat-filled) → lexicon-ipa.tsv\n`);
