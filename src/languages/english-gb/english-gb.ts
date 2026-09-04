/**
 * British English (en-GB) — modern Standard Southern British / "BBC" pronunciation, an ACCENT VARIANT of the
 * General-American `en` engine (not a separate language). Reuses the full English G2P (dict + heteronyms + OOV
 * model) and applies a phonological DELTA — a lexical-set transform — to the GenAm output. The legitimate,
 * VERIFIABLE accent-transfer (docs/language-maturity.md "Scope"): the parent's community-adopted orthography + a
 * documented delta, checked against a real RP referee (wikipron eng_latn_uk, 76k).
 *
 * The delta (GenAm → SSBE), from the referee:
 *   • NON-RHOTICITY: coda /ɹ/ dropped; r-coloured vowels remap — NURSE ɝ→ɜː, lettER ɚ→ə, START ɑːɹ→ɑː, NORTH ɔːɹ→ɔː,
 *     NEAR ɪɹ→ɪə, SQUARE ɛɹ→ɛə, CURE ʊɹ→ʊə. Before a vowel, ɚ/ɝ keep a LINKING /ɹ/ (different→dɪfəɹənt).
 *   • GOAT oᶷ→əᶷ; FACE/PRICE/MOUTH/CHOICE keep the parent's SUPERSCRIPT offglide (#1252); the dark coda
 *     /ɫ/ stays (folded ɫ~l in the eval).
 *   • LOT ɑː→ɒ (un-does GenAm's father-bother merger); un-flap the tapped /t̬/→[t].
 *   • THE LEXICAL SETS (GenAm doesn't carry these splits → word lists): BATH æ→ɑː (grass, dance), CLOTH ɔː→ɒ (off,
 *     dog), yod-retention Cuː→Cjuː (new→njuː), and PALM (exceptions kept [ɑː] against the LOT rule: father, spa).
 *     Applied on the SHIPPED path only; the eval uses phonemizeWordRules → non-circular.
 */
import { createEnglish, type EnglishPhonemizer } from "../english/english.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

/**
 * THE VOWELS THIS FILE'S "not before a vowel = coda" GUARD HAS TO KNOW ABOUT — and it is the POST-transform
 * alphabet, not GenAm's. All three uses sit after the GOAT/offglide/NURSE/lettER remaps above, so the class
 * covers what those rules LEAVE, which is why `ɜ` and `ɒ` (SSBE-only) are in it.
 *
 * ⚠ `ᵻ` WAS MISSING AND THAT DELETED ONSET /ɹ/ (#1250). The reduced vowel the parent emits for unstressed
 * `re-`/`ri-` is a vowel, but it was not in this string, so `ɹᵻ` satisfied "NOT before a vowel" and the drop
 * on the last line of the block below took the /ɹ/ off the FRONT of the word — `reports` read *ᵻpʰˈɔːts*,
 * "'eports", and 13 of 13 GenAm `ɹᵻ` words with it. Non-rhotic English drops CODA /r/ and never onset /r/,
 * so nothing about the accent licensed it. It is not only word-initial: `alacrity` lost the /ɹ/ of `kɹ`.
 *
 * ⚠ AUDITED RATHER THAN PATCHED, over all 117,479 dict words: `ᵻ` (×828) is the ONLY vowel that can follow
 * an `ɹ` at this point and is missing here. Every other character that can is a consonant or the word end —
 * a genuine coda — so this was one gap and not the symptom of a drifted inventory.
 * ⚠ AND "AT THIS POINT" IS DOING WORK IN THAT SENTENCE. The parent writes `ɹɚ` 115 times and `ɹɝ` 8 times,
 * and neither is in this class; they are safe because the two linking rules above CONSUME the r-coloured
 * vowel before the coda guard runs, not because the class covers them. The completeness claim holds given
 * the ordering, and `PRE_VOWEL` is what the rules that run BEFORE that point use.
 *
 * ⚠ AND `ɐ` AND `o` STAY THOUGH THE SAME AUDIT SAYS BOTH ARE UNREACHABLE. `ɐ` is emitted nowhere by this
 * engine; `o` is emitted 17,063 times but only ever inside `oᶷ`, which GOAT rewrites two lines above the
 * first use. The class sits in a NEGATIVE lookahead, so the error here is ONE-SIDED — a vowel missing
 * deletes a consonant, a vowel that never occurs costs nothing — and the safe shape is a generous superset.
 * test/onset-r.test.ts re-runs the audit against the engine's own output so the gap cannot
 * reopen; trimming the class to today's inventory would buy nothing and spend that asymmetry.
 */
const VOWEL = "iɪeɛæəɜɐɑɒɔʌʊuoaᵻ";
/**
 * THE SAME VOWELS ONE STEP EARLIER, for the two LINKING rules — and one step earlier `ɚ` and `ɝ` are still
 * in the string, because those two rules are what consume them.
 *
 * ⚠ AND THEY ARE VOWELS, SO AN `ɚ` BEFORE ANOTHER ONE IS PRE-VOCALIC (#1250, review). Looking ahead for
 * `VOWEL` alone, the first `ɚ` of `ɚɚ` failed the linking test, fell through to the unconditional
 * `ɚ → ə`, and its onset /r/ was deleted — `caterer` (`kʰˈeᶦt̬ɚɚ`) read *kʰˈeɪtəə* for RP /ˈkeɪtərə/, and
 * 96 dict words with it. That is the SAME defect as the missing `ᵻ`, one rule to the left, and the sweep
 * that was supposed to catch it shared the omission; test/onset-r.test.ts now counts them.
 *
 * ⚠ A SEPARATE CLASS RATHER THAN TWO MORE CHARACTERS IN `VOWEL`. Adding them there would be a no-op for the
 * coda guard — nothing r-coloured survives these two rules, so `CODA` can never see one — but `VOWEL` is
 * documented as the POST-transform alphabet and `ɚ`/`ɝ` are not in it. A class that says something false
 * about itself is how the first omission survived.
 */
const PRE_VOWEL = `${VOWEL}ɚɝ`;
/**
 * ⚠ A RUN OF STRESS MARKS, NOT ONE (#1250). This was `[ˈˌ]?`, and the parent emits `ˌˈ` together on five
 * dict words — `greedier` is `ɡɹˌˈiːd̬iʲɚ` — where one optional mark cannot see the `iː` behind the pair and
 * the ONSET CLUSTER `ɡɹ` lost its /ɹ/, exactly as the missing vowel did. `*` costs nothing: more marks
 * before a vowel still means "before a vowel".
 */
const CODA = `(?![ˈˌ]*[${VOWEL}])`; // an /ɹ/ NOT before a (optionally stressed) vowel = coda → non-rhotic

/**
 * The eight rhotic patterns, HOISTED. `toRP` runs once per word and built every one of them from `VOWEL`
 * inside the chain, recompiling eight patterns per call — the "repeated recompilation of regexes" PORTING.md
 * lists as free to fix. Measured, 40k dict words through `phonemize(w, "en-GB")`, median of five runs:
 * 1916 ms → 1607 ms, and no byte of any golden moves. The C# port has held these as statics all along.
 * ⚠ EVERY ONE IS USED WITH `.replace` ONLY. A `/g` regex hoisted to module scope carries `lastIndex`, so the
 * same move under `.test()` or `.exec()` would be a stateful bug; `replace` resets it.
 */
const NURSE_PREVOCALIC = new RegExp(`ɝ(?=[ˈˌ]*[${PRE_VOWEL}])`, "gu");
const LETTER_PREVOCALIC = new RegExp(`ɚ(?=[ˈˌ]*[${PRE_VOWEL}])`, "gu");
/**
 * ⚠ THE OFFGLIDE TRIPHTHONGS, AND WITHOUT THEM #1252 WOULD HAVE DELETED A SCHWA IN 238 WORDS. Until that
 * change the generic offglide map rewrote `ᶦ`/`ᶷ` to full `ɪ`/`ʊ` FIRST, so `NEAR` and `CURE` fired on the
 * result and turned offglide + coda /ɹ/ into RP's triphthong: `ˈæbʃaᶦɹ` → `aɪɹ` → `ˈæbʃaɪə`, `ˈaᶷɹbæk` →
 * `aʊɹ` → `ˈaʊəbæk`. Keeping the superscript stops those two matching, the coda-/ɹ/ drop takes the `ɹ`
 * instead, and the schwa is never emitted at all — `ˈæbʃaᶦ`, `ˈaᶷbæk`. Measured over the dict: `ᶦɹ` ×465 and
 * `ᶷɹ` ×94. The `ɚ` twins (`ᶦɚ` ×550, `ᶷɚ` ×285) need nothing, since `ɚ` becomes `ə` on its own.
 * ⚠ UNDER THE SAME `CODA` GUARD as the others, so a LINKING /ɹ/ still survives: `əkwˈaᶦɹɪŋ` (acquiring) has
 * the `ɹ` before a vowel and keeps it.
 */
const PRICE_R = new RegExp(`ᶦɹ${CODA}`, "gu");
const MOUTH_R = new RegExp(`ᶷɹ${CODA}`, "gu");
const NEAR = new RegExp(`ɪɹ${CODA}`, "gu");
const SQUARE = new RegExp(`ɛɹ${CODA}`, "gu");
const CURE = new RegExp(`ʊɹ${CODA}`, "gu");
const NORTH = new RegExp(`ɔːɹ${CODA}`, "gu");
const START = new RegExp(`ɑːɹ${CODA}`, "gu");
const CODA_R = new RegExp(`ɹ${CODA}`, "gu");

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
    // ⚠ THE CLOSING DIPHTHONGS KEEP THE PARENT'S SUPERSCRIPT OFFGLIDE (#1252), and the GOAT onset is the only
    // thing this line still changes. `əʊ eɪ aɪ aʊ ɔɪ` are correct IPA for RP and were never wrong; they are
    // wrong as a CONVENTION, because two full vowels are two independent symbols to anything reading the IPA
    // and a superscript offglide is one unit. In a shared multilingual corpus that is not hypothetical: over
    // 271,798 OmniVoice utterances, `əʊ` is 917 tokens with NO English behind it (sd 394, mn 359, nb 102) and
    // `eɪ` is 1,913 of which 1,899 are Burmese — so a model conditioned on this IPA renders en-GB's GOAT
    // through phones it learned from Sindhi and its FACE from Burmese. `eᶦ aᶦ aᶷ ɔᶦ` are now byte-identical
    // to what `en` emits and inherit its training directly.
    // ⚠ `əᶷ` KEEPS RP'S CENTRAL ONSET and is deliberately NOT the parent's `oᶷ`: substituting that would make
    // en-GB sound American rather than fix anything. It is a novel COMBINATION — the corpus has `ə`, has `ᶷ`,
    // has `oᶷ`/`aᶷ` as units, but has never seen this pair — which is the premise an IPA-conditioned model
    // rests on and is untested for it. If it renders badly the honest fix is corpus-side (en-GB audio in the
    // fine-tune), not more notation.
    // ⚠ AND THE CENTRING DIPHTHONGS ARE LEFT ALONE. `ɪə ɛə ʊə` are contaminated the same way, but the obvious
    // parallel `ɪᵊ ɛᵊ ʊᵊ` is worse: `ᵊ` occurs ZERO times in that corpus, so it would trade a
    // contaminated-but-trained symbol for an untrained one. No notation fixes a vowel the model never heard.
    s = s.replace(/oᶷ/gu, "əᶷ"); // GOAT — RP's central onset, the parent's offglide
    s = s.replace(/ʲ/gu, ""); // drop the palatal on-glide (idea)
    // NURSE ɝ / lettER ɚ: before a vowel keep a linking /ɹ/; in coda non-rhotic.
    s = s.replace(NURSE_PREVOCALIC, "ɜːɹ").replace(/ɝ/gu, "ɜː");
    s = s.replace(LETTER_PREVOCALIC, "əɹ").replace(/ɚ/gu, "ə");
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
        .replace(PRICE_R, "ᶦə") // PRICE/CHOICE + coda r — the triphthong (fire, choir)
        .replace(MOUTH_R, "ᶷə") // MOUTH/GOAT + coda r — likewise (hour, power)
        .replace(NEAR, "ɪə") // NEAR
        .replace(SQUARE, "ɛə") // SQUARE
        .replace(CURE, "ʊə") // CURE
        .replace(NORTH, "ɔː") // NORTH/FORCE
        .replace(START, "ɑː") // START
        .replace(CODA_R, ""); // drop remaining coda /ɹ/
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
