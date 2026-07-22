/**
 * Build the Urdu IPA COVERAGE lexicon — `skeleton ⇥ canonical IPA` (unstressed; weight-stress is applied at
 * lookup). Replaces the harakat lexicon for Urdu: harakat cannot encode majhūl (ی=iː~eː, و=oː~uː) — the g2p only
 * fakes it with adapted-word diacritics — whereas the cross-script Hindi gold carries it natively (Devanagari
 * writes ई vs ए, ऊ vs ओ). Two sources, precedence in this order:
 *   1. silver.hindiurdu.tsv — real Urdu spellings, gold IPA from the hi g2p (independent of wikipron → non-circular),
 *      carries short vowels AND majhūl.
 *   2. the existing harakat lexicon (src/languages/urdu/lexicon.tsv), converted to IPA via our g2p, to fill the
 *      Urdu-native / Perso-Arabic-register words the Hindi source lacks or reads with a Hindi register (شعر ʃeːr→ʃɪʔr).
 * Canonical-convention normalisation: strip stress; drop the redundant vowel-nasalisation our Hindi source emits
 * before a full nasal consonant (ə̃nd̪→ənd̪), matching our own g2p (which nasalises via the n→ŋ/m rule, not the vowel)
 * and wikipron; g→ɡ. See docs/investigations/ur_tagger_investigation.md.
 *   npx tsx tools/arabic-restorer/build_ur_ipa_lexicon.ts   # → src/languages/urdu/lexicon-ipa.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeWord as g2p } from "../../src/languages/urdu/g2p.ts";

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

const lex = new Map<string, string>();
let fromHindi = 0,
    fromHarakat = 0;

// 1. Hindi-derived IPA (primary)
for (const line of readFileSync(`${HERE}/silver.hindiurdu.tsv`, "utf8").split("\n")) {
    const p = line.split("\t");
    if (p.length < 3 || p[1] !== "urd" || !p[0] || !p[2]) continue;
    const skel = p[0].normalize("NFC");
    const ipa = finalHe(skel, canon(p[2]));
    if ([...skel].length < 2 || !ipa || lex.has(skel)) continue;
    lex.set(skel, ipa);
    fromHindi++;
}

// 2. existing harakat lexicon → IPA via g2p (fills NEW skeletons only)
const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;
for (const line of readFileSync(`${HERE}/../../src/languages/urdu/lexicon.tsv`, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.includes("\t")) continue;
    const [skelRaw, voc] = line.split("\t");
    if (!skelRaw || !voc) continue;
    const skel = skelRaw.normalize("NFC");
    if (lex.has(skel)) continue; // Hindi wins
    const ipa = canon(g2p(voc.normalize("NFC")));
    if (!ipa) continue;
    lex.set(skel, ipa);
    fromHarakat++;
}

const rows = [...lex.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const header = [
    "# Urdu IPA COVERAGE lexicon — undiacritized skeleton ⇥ canonical IPA (UNSTRESSED; weight-stress applied at lookup).",
    "# Replaces the harakat lexicon for Urdu: harakat can't encode majhūl (ی=iː~eː, و=oː~uː); the cross-script Hindi",
    "# gold carries it. Source: silver.hindiurdu.tsv (real Urdu spellings, IPA from the hi g2p — independent of wikipron)",
    "# then the g2p-converted harakat lexicon for the Urdu-native tail. Regenerate: tools/arabic-restorer/build_ur_ipa_lexicon.ts.",
];
writeFileSync(OUT, header.join("\n") + "\n" + rows.map(([k, v]) => `${k}\t${v}`).join("\n") + "\n");
process.stderr.write(`wrote ${rows.length} IPA entries (${fromHindi} Hindi-derived + ${fromHarakat} harakat-filled) → lexicon-ipa.tsv\n`);
