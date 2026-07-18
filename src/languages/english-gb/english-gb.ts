/**
 * British English (en-GB) — modern Standard Southern British / "BBC" pronunciation, an ACCENT VARIANT of the
 * General-American `en` engine (not a separate language). Reuses the full English G2P (dict + heteronyms + OOV
 * model) and applies a phonological DELTA — a lexical-set transform — to the GenAm output. The legitimate,
 * VERIFIABLE accent-transfer (docs/language-maturity.md "Scope"): the parent's community-adopted orthography + a
 * documented delta, checked against a real RP referee (wikipron eng_latn_uk, 76k). See
 * docs/investigations/en-gb_native_bringup_investigation.md.
 *
 * The delta (GenAm → SSBE), from the referee:
 *   • NON-RHOTICITY: coda /ɹ/ dropped; r-coloured vowels remap — NURSE ɝ→ɜː, lettER ɚ→ə, START ɑːɹ→ɑː, NORTH ɔːɹ→ɔː,
 *     NEAR ɪɹ→ɪə, SQUARE ɛɹ→ɛə, CURE ʊɹ→ʊə. Before a vowel, ɚ/ɝ keep a LINKING /ɹ/ (different→dɪfəɹənt).
 *   • GOAT oᶷ→əʊ; the FACE/PRICE/MOUTH/CHOICE offglides ᶦ→ɪ, ᶷ→ʊ; the dark coda /ɫ/ stays (folded ɫ~l in the eval).
 *   • LOT ɑː→ɒ (un-does GenAm's father-bother merger); un-flap the tapped /t̬/→[t].
 *   • THE LEXICAL SETS (GenAm doesn't carry these splits → word lists): BATH æ→ɑː (grass, dance), CLOTH ɔː→ɒ (off,
 *     dog), yod-retention Cuː→Cjuː (new→njuː), and PALM (exceptions kept [ɑː] against the LOT rule: father, spa).
 *     Applied on the SHIPPED path only; the eval uses phonemizeWordRules → non-circular.
 */
import { createEnglish, type EnglishPhonemizer } from "../english/english.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

const VOWEL = "iɪeɛæəɜɐɑɒɔʌʊuoa";
const CODA = `(?![ˈˌ]?[${VOWEL}])`; // an /ɹ/ NOT before a (optionally stressed) vowel = coda → non-rhotic

export interface LexSets {
    bath: Set<string>; // æ → ɑː
    cloth: Set<string>; // ɔː → ɒ
    yod: Set<string>; // Cuː → Cjuː
    palm: Set<string>; // keep [ɑː] against the LOT rule
    lotr: Set<string>; // ɑːɹ → ɒɹ before a vowel (sorry, borrow — LOT before intervocalic r; cf. starry which keeps ɑː)
}
const loadSet = (file: string): Set<string> =>
    new Set([...loadTsvMap(import.meta.url, file, (v) => v, { optional: true }).keys()]);
let SETS: LexSets | undefined;
const sets = (): LexSets =>
    (SETS ??= {
        bath: loadSet("en-gb-bath.tsv"),
        cloth: loadSet("en-gb-cloth.tsv"),
        yod: loadSet("en-gb-yod.tsv"),
        palm: loadSet("en-gb-palm.tsv"),
        lotr: loadSet("en-gb-lotr.tsv"),
    });

/** GenAm citation IPA → SSBE. `lex` (present on the shipped path) supplies the lexical-set membership for `word`. */
export function toRP(genAm: string, word: string, lex?: LexSets): string {
    const w = word.toLowerCase();
    let s = genAm;
    s = s.replace(/t̬/gu, "t").replace(/d̬/gu, "d"); // un-flap the tapped coronal
    s = s.replace(/oᶷ/gu, "əʊ"); // GOAT (before the generic offglide map)
    s = s.replace(/ᶦ/gu, "ɪ").replace(/ᶷ/gu, "ʊ"); // FACE/PRICE/MOUTH/CHOICE offglides
    s = s.replace(/ʲ/gu, ""); // drop the palatal on-glide (idea)
    // NURSE ɝ / lettER ɚ: before a vowel keep a linking /ɹ/; in coda non-rhotic.
    s = s.replace(new RegExp(`ɝ(?=[ˈˌ]?[${VOWEL}])`, "gu"), "ɜːɹ").replace(/ɝ/gu, "ɜː");
    s = s.replace(new RegExp(`ɚ(?=[ˈˌ]?[${VOWEL}])`, "gu"), "əɹ").replace(/ɚ/gu, "ə");
    // LOT: GenAm [ɑː] not before /ɹ/ → [ɒ]; PALM words keep [ɑː].
    if (!(lex && lex.palm.has(w))) s = s.replace(/ɑː(?!ɹ)/gu, "ɒ");
    // Lexical sets (shipped path only).
    if (lex) {
        // FIRST-occurrence only (no /g) — mirrors the set builder, which validated a first-occurrence edit against
        // the referee. A BATH word may also carry a TRAP æ later (aftermath → ˈɑːftəmæθ, not …mˌɑːθ); a global
        // replace would wrongly convert it. Words whose diagnostic vowel is NOT first never entered the set.
        if (lex.bath.has(w)) s = s.replace(/æ/u, "ɑː"); // BATH
        if (lex.cloth.has(w)) s = s.replace(/ɔː/u, "ɒ"); // CLOTH
        if (lex.yod.has(w)) s = s.replace(/([tdnszθl])(ʰ?)([ˈˌ]?)uː/u, "$1$2j$3uː"); // yod-retention (glide after any aspiration, before the stressed vowel)
        if (lex.lotr.has(w)) s = s.replace(/ɑːɹ/u, "ɒɹ"); // LOT before intervocalic r (the LOT rule's (?!ɹ) skipped it)
    }
    // Non-rhoticity: remap each vowel + coda /ɹ/, then drop any remaining coda /ɹ/.
    s = s
        .replace(new RegExp(`ɪɹ${CODA}`, "gu"), "ɪə") // NEAR
        .replace(new RegExp(`ɛɹ${CODA}`, "gu"), "ɛə") // SQUARE
        .replace(new RegExp(`ʊɹ${CODA}`, "gu"), "ʊə") // CURE
        .replace(new RegExp(`ɔːɹ${CODA}`, "gu"), "ɔː") // NORTH/FORCE
        .replace(new RegExp(`ɑːɹ${CODA}`, "gu"), "ɑː") // START
        .replace(new RegExp(`ɹ${CODA}`, "gu"), ""); // drop remaining coda /ɹ/
    return s;
}

let GB: EnglishPhonemizer | undefined;
const eng = (): EnglishPhonemizer => (GB ??= createEnglish());

/** Bare word→SSBE IPA, SHIPPED path (rule delta + lexical sets). For the diagnostic gold and real text. */
export function phonemizeWord(word: string): string {
    return toRP(eng().text(word), word, sets());
}
/** Bare word→SSBE IPA, RULE-ONLY (no lexical sets) — the non-circular signal for the referee eval. */
export function phonemizeWordRules(word: string): string {
    return toRP(eng().text(word), word);
}

/** Build the British-English phonemizer (GenAm engine + the RP lexical-set delta). The delta rides on the
 *  engine's per-word output hook so each word gets its lexical-set membership (BATH/CLOTH/yod/PALM/LOTR) while
 *  reusing the full number/heteronym/prosody context. Linking-r ACROSS words is deferred (per-word scope). */
export function createEnglishGB(): { text(input: string): string } {
    const e = createEnglish();
    const lex = sets();
    return { text: (input: string): string => e.text(input, (ipa, word) => toRP(ipa, word, lex)) };
}
