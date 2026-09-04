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
 * alphabet, not GenAm's. All three uses sit after the GOAT/NURSE/lettER remaps above, so the class
 * covers what those rules LEAVE, which is why `ɜ` and `ɒ` (SSBE-only) are in it.
 *
 * ⚠ `ᵻ` WAS MISSING AND THAT DELETED ONSET /ɹ/ (#1250). The reduced vowel the parent emits for unstressed
 * `re-`/`ri-` is a vowel, but it was not in this string, so `ɹᵻ` satisfied "NOT before a vowel" and the drop
 * on the last line of the block below took the /ɹ/ off the FRONT of the word — `reports` read *ᵻpʰˈɔːts*,
 * "'eports", and 13 of 13 GenAm `ɹᵻ` words with it. Non-rhotic English drops CODA /r/ and never onset /r/,
 * so nothing about the accent licensed it. It is not only word-initial: `alacrity` lost the /ɹ/ of `kɹ`.
 *
 * ⚠ AUDITED RATHER THAN PATCHED, over all 117,479 dict words: `ᵻ` (×828) was the ONLY vowel that could
 * follow an `ɹ` at this point and was missing here. Every other character that can is a consonant or the word
 * end — a genuine coda — so that was one gap and not the symptom of a drifted inventory.
 * ⚠ AND `ᶦ`/`ᶷ` JOINED THE CLASS WITH #1252, which is the audit being kept honest rather than a second gap.
 * That audit's answer was true only because the generic offglide map rewrote them to full `ɪ`/`ʊ` BEFORE this
 * class was ever consulted; #1252 deleted that map, so they now survive into the post-transform string and
 * the class would no longer be the superset it says it is. Nothing changes today — the parent never emits an
 * offglide without its nucleus in front of it, so `ɹᶦ` cannot occur, and the dict and the referee word list
 * are both byte-identical with and without them — but the one-sided-error argument above is exactly why they
 * go in anyway.
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
const VOWEL = "iɪeɛæəɜɐɑɒɔʌʊuoaᵻᶦᶷ";
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
 * ⚠ NAMED FOR THE GLIDE, NOT FOR ONE LEXICAL SET, because the patterns are bare `ᶦɹ`/`ᶷɹ` and each covers
 * every set that ends in that glide: `ᶦ` is FACE as well as PRICE and CHOICE (`ˈeᶦɹ` → `ˈeᶦə`, ayr), `ᶷ` is
 * GOAT as well as MOUTH. A name that said PRICE would send the next reader looking for a FACE rule.
 */
const IGLIDE_R = new RegExp(`ᶦɹ${CODA}`, "gu");
const UGLIDE_R = new RegExp(`ᶷɹ${CODA}`, "gu");
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
    // thing this line still changes. `əʊ eɪ aɪ aʊ ɔɪ` are correct IPA for RP and were never wrong — this is a
    // CONSISTENCY decision between two variants of one engine, which is how the issue itself framed it: `en`
    // has written `oᶷ eᶦ aᶦ aᶷ ɔᶦ` for a long time and `en-GB`, which is `en` plus a lexical-set delta, did
    // not follow it. A superscript offglide is ONE unit; two full vowels are two independent symbols to
    // anything reading the IPA.
    //
    // ⚠ MEASURED IN THIS REPO, over the first 60 golden rows of every ported language — the collision is not
    // hypothetical, and after this change en-GB is on the right side of it:
    //     eᶦ  28 languages (en 92, en-GB 77, nan 65, cy 51)   ·  eɪ  2 (my 56, la 6)
    //     aᶦ  27 languages (ta 174, en 86, en-GB 76)          ·  aɪ  13 (de 139, my 117, en-IN 76)
    //     aᶷ  14 languages (en 41, en-GB 27, cy 26)           ·  aʊ  8  (my 122, de 65)
    //     oᶷ  46 languages                                     ·  əʊ  3  (mai 43, awa 13, mn 12)
    // So the plain spellings are, in this fleet, mostly Burmese, German and Devanagari-language sequences,
    // and the superscript ones are where the English family already lives.
    //
    // ⚠ THE REPORTER'S DOWNSTREAM NUMBERS, CORRECTED, because the first version of them was wrong and is
    // quoted in a few places. They come from a TTS model conditioned on this IPA, and the counts that matter
    // are its 28 TRAINED languages, not the 102-language alignment/QC database first cited: `eɪ` has ELEVEN
    // occurrences in training, all Russian (the earlier "1,899 Burmese" was from the QC database — Burmese is
    // not in the trained set at all), against `eᶦ` at 9,567; `aɪ`/`aʊ` are German-only (7,468 / 2,755); `əʊ`
    // is Sindhi, 394 of 434. That is a fact about that model, not about this engine, and it is the REASON the
    // change was proposed rather than the argument for it — the argument is the consistency above.
    //
    // ⚠ `əᶷ` KEEPS RP'S CENTRAL ONSET and is deliberately NOT the parent's `oᶷ`: the onset is REALISATION
    // (RP's central unrounded vowel against GenAm's back rounded one) and only the offglide is NOTATION, so
    // substituting `oᶷ` would make en-GB sound American rather than fix anything. The pairing is not novel to
    // this fleet either — Welsh already writes it, `dəᶷˈɛdɔð` (*dywedodd*) — so `ə` + superscript `ᶷ` is a
    // sequence the engine's own IPA already contains. Whether a given downstream MODEL has seen the pair is a
    // separate question and belongs to that model's corpus.
    //
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
        .replace(IGLIDE_R, "ᶦə") // any ᶦ-glide + coda r: FACE, PRICE and CHOICE (ayr, fire, choir)
        .replace(UGLIDE_R, "ᶷə") // any ᶷ-glide + coda r: MOUTH and GOAT (hour, power, lower)
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
