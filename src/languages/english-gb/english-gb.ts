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
/**
 * ⚠ A SYLLABIC CONSONANT IS A NUCLEUS, so an /ɹ/ before one is an ONSET and must not be dropped. This
 * is the same defect the stress-run note above records, with `n̩`/`ɫ̩`/`m̩` in place of `ˌˈ`: the
 * syllabic mark REMOVES the vowel that used to follow the /ɹ/, so the bare vowel test stopped seeing a
 * nucleus and read an onset cluster as a coda. `children t͡ʃˈɪɫdɹn̩` came out `t͡ʃˈɪɫdn̩`, `neutral`
 * `njˈuːtɫ̩`, `nostril` `nˈɒstɫ̩` — 34 words losing a CLUSTER /ɹ/ that RP pronounces.
 * ⚠ IT GREW WITH THE SYLLABIC TABLE AND WAS NOT CAUSED BY IT: 22 of the 34 predate #1403's rebuild,
 * which added 12 more. The trigger is the table; the bug is here.
 */
const SYLLABIC = "\u0329";
const CODA = `(?![ˈˌ]*(?:[${VOWEL}]|[nmɫlŋ]${SYLLABIC}))`; // /ɹ/ before neither a vowel nor a syllabic consonant = coda

/**
 * The eight rhotic patterns, HOISTED. `toRP` runs once per word and built every one of them from `VOWEL`
 * inside the chain, recompiling eight patterns per call — the "repeated recompilation of regexes" PORTING.md
 * lists as free to fix. Measured, 40k dict words through `phonemize(w, "en-GB")`, median of five runs:
 * 1916 ms → 1607 ms, and no byte of any golden moves. The C# port has held these as statics all along.
 * ⚠ EVERY ONE IS USED WITH `.replace` ONLY. A `/g` regex hoisted to module scope carries `lastIndex`, so the
 * same move under `.test()` or `.exec()` would be a stateful bug; `replace` resets it.
 */
/**
 * ⚠ THE SYLLABIC NUCLEUS BELONGS HERE TOO, AND THE FIRST VERSION OF THE `CODA` FIX MISSED THESE TWO.
 * They are the same test one step earlier, so an `ɚ`/`ɝ` before a syllabic consonant failed the linking
 * test, fell through to the unconditional `ɚ→ə` / `ɝ→ɜː`, and the onset /ɹ/ vanished — exactly the
 * `caterer` defect the `PRE_VOWEL` note above records, reached by a different missing nucleus.
 * 13 words: `natural nˈæt͡ʃɚɫ̩` came out `nˈæt͡ʃəɫ̩` against RP /ˈnætʃ(ə)rəl/, and `mineral`,
 * `pastoral`, `squirrel`, `mayoral`, `operant`, `photocurrent` with it.
 */
const PRE_NUCLEUS = `(?=[ˈˌ]*(?:[${PRE_VOWEL}]|[nmɫlŋ]${SYLLABIC}))`;
const NURSE_PREVOCALIC = new RegExp(`ɝ${PRE_NUCLEUS}`, "gu");
const LETTER_PREVOCALIC = new RegExp(`ɚ${PRE_NUCLEUS}`, "gu");
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
    lotr: Set<string>; // [ɑɔ]ːɹ → ɒɹ before a vowel (LOT before intervocalic r; cf. starry, which keeps ɑː)
    /**
     * ɛɹ → æɹ before a vowel: the marry–merry merger, UNDONE for RP.
     *
     * ⚠ THIS SET EXISTS BECAUSE THE PARENT MERGED AND BRITISH DID NOT. GenAm (and Canadian) has
     * marry = merry = Mary; SSBE keeps `marry` /ˈmæri/ apart from `merry` /ˈmɛri/. The parent's dictionary
     * was INCOHERENT about it — `arrogate` æ beside `arrogance` ɛ, `arrow` beside `arrowroot`, 208 rows one
     * way and 147 the other in the same environment — and was made consistently merged against misaki gold
     * (66 of 66, no counterexamples). That change would otherwise cost this accent ~50 referee rows, so the
     * mapping back lives here, exactly as `lotr` carries `sorry` and `bath` carries `dramatize`.
     *
     * ⚠ IT IS A WORD LIST AND NOT A RULE, deliberately: a blanket ɛɹ→æɹ would wrongly convert the words that
     * are GENUINELY ɛ in both varieties — `merry`, `very`, `ferry`, `error`, `herald`, `America`. Only words
     * the parent moved belong here.
     */
    marry: Set<string>;
    /**
     * word → the GenAm-alphabet citation this accent starts from, REPLACING the parent's.
     *
     * ⚠ EVERY OTHER TABLE HERE IS AN ACCENT DELTA AND THIS ONE IS NOT. The five sets above say how the
     * SAME word is realised differently; this one says the two varieties do not use the same word. British
     * `aluminium` is /ˌæljʊˈmɪniəm/ against GenAm `aluminum` /əˈluːmɪnəm` — five syllables against four,
     * with the stress on a different one — and no phonological rule gets from one to the other. Nor should
     * one try: a transform that could insert a syllable and move the stress would be able to do it to words
     * that merely sound different, which is the whole class this file exists to handle correctly.
     *
     * ⚠ AND THE PARENT IS NOT WRONG ABOUT ITS OWN WORD. CMUdict lists `aluminium AH0 L UW1 M IH0 N AH0 M`
     * — a GenAm reference deliberately reading the British SPELLING as the American WORD, which is right
     * for `en` and is what `en` ships. The defect was only ever that `en-GB` inherited it with nowhere to
     * say otherwise, so this table is additive: it changes no GenAm reading.
     *
     * ⚠ THE VALUE IS IN THE PARENT'S ALPHABET, NOT SSBE, so the whole delta still runs over it —
     * non-rhoticity, GOAT, the lexical sets, all of it. `clerk` is stored `klˈɑːɹk` and START makes it
     * `klˈɑːk`; storing the finished `klˈɑːk` would have frozen a reading that then silently stopped
     * tracking every later rule change. A word needing a set membership joins that set as usual — `tomato`
     * is a PALM word and is in `en-gb-palm.tsv`, because in RP it genuinely is one.
     *
     * Rows are hand-written and every one is checked against the wikipron UK referee; see
     * docs/investigations/en-GB/engb_lexical_variants_investigation.md.
     */
    lexical: Map<string, LexicalRow>;
}
/**
 * One row of `en-gb-lexical.tsv`: the British citation, and OPTIONALLY the GenAm reading it is allowed to
 * replace.
 *
 * ⚠ THE GUARD EXISTS BECAUSE THE SUBSTITUTION IS POS-BLIND AND THE PARENT IS NOT. `progress` is the first
 * row here that the parent resolves by part of speech — `english.jsonc` ships `pɹˈɑːɡɹɛs` for the noun and
 * `pɹəɡɹˈɛs` for the verb — and an unconditional replacement put the NOUN's citation into a VERB frame:
 * "we progress quickly" read `pɹˈəᶷɡɹɛs`, which is not RP, not GenAm, and not any speaker. That is the same
 * wrong-within-one-sentence failure the inflection rows exist to prevent, arriving through the lemma.
 *
 * So a row may name the reading it replaces, and applies only when the parent actually produced it. A row
 * WITHOUT the field is unconditional, which is correct for the 24 words that have exactly one reading — and
 * a word that GAINS a second one later is the reason the field is here rather than a note in a doc.
 */
export interface LexicalRow {
    /** The British citation, in the PARENT's alphabet, that replaces the parent's reading. */
    readonly to: string;
    /** The GenAm reading this row may replace. Absent = any, i.e. the word has one reading. */
    readonly from?: string;
}
/** `to` or `to\tfrom` — the optional second field is the GenAm reading the row is allowed to replace. */
const parseLexicalRow = (v: string): LexicalRow => {
    const tab = v.indexOf("\t");
    return tab < 0 ? { to: v } : { to: v.slice(0, tab), from: v.slice(tab + 1) };
};
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
        marry: loadSet("en-gb-marry.tsv"),
        lexical: loadTsvMap(import.meta.url, "en-gb-lexical.tsv", parseLexicalRow, { optional: true }),
    });

/** GenAm citation IPA → SSBE. `lex` (present on the shipped path) supplies the lexical-set membership for `word`. */
export function toRP(genAm: string, word: string, lex?: LexSets): string {
    const w = word.toLowerCase();
    // ⚠ FIRST, AND IT REPLACES THE INPUT RATHER THAN EDITING IT. A lexical variant is a different word, so
    // there is nothing in the parent's citation worth keeping; everything below then treats the substitute
    // as though the dictionary had produced it. Shipped path only — `lex` is absent for the referee eval,
    // which must stay non-circular, exactly as the five sets below are.
    const row = lex?.lexical.get(w);
    // ⚠ A ROW MAY NAME THE READING IT REPLACES, and then applies only when the parent produced it — see
    // LexicalRow. Without that, a POS heteronym gets the noun's citation in a verb frame.
    const lexical = row !== undefined && (row.from === undefined || row.from === genAm) ? row.to : undefined;
    let s = lexical ?? genAm;
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
    // ⚠ AND A WORD THE LEXICAL TABLE OWNS IS EXEMPT FROM THIS AND FROM EVERY SET BELOW. The citation was
    // written with the SSBE target in mind, so a set edit derived for a DIFFERENT word has no business
    // running over it: `tomato`'s hand-written ɑː is the thing the table exists to supply, and the LOT
    // rule ate it. The first version bought that back with a hand-added row in `en-gb-palm.tsv` — a
    // generated file — and `build-en-gb-sets.ts` now skips table-owned words, so the next regeneration
    // would have deleted it and silently regressed the word. Worse, `tomato` was never CLAIMABLE into
    // palm: the builder claims from the rules-only output, where the word has no ɑː to preserve, so the
    // edit never matched. Exempting here makes the runtime and the builder agree in both directions and
    // lets `en-gb-palm.tsv` go back to being purely generated.
    // ⚠ THE PHONOLOGICAL RULES STILL RUN — non-rhoticity, GOAT, the NURSE/lettER remapping, un-flapping.
    // It is the WORD-LIST layer that is skipped, not the accent.
    if (lexical === undefined && !(lex && lex.palm.has(w))) s = s.replace(/ɑː(?!ɹ)/gu, "ɒ");
    // Lexical sets (shipped path only, and never over a word the table owns).
    if (lex && lexical === undefined) {
        // FIRST-occurrence only (no /g) — mirrors the set builder, which validated a first-occurrence edit against
        // the referee. A BATH word may also carry a TRAP æ later (aftermath → ˈɑːftəmæθ, not …mˌɑːθ); a global
        // replace would wrongly convert it. Words whose diagnostic vowel is NOT first never entered the set.
        // ⚠ marry–merry RUNS FIRST, BEFORE BATH, and the order is load-bearing. Four words are in BOTH sets
        // (`barry`, `clara`, `dara`, `scarry`): they were `æ` in the parent, BATH lifted them to `ɑː`, and the
        // merger then made them `ɛ` — which BATH cannot see, so they came out `æ` and RP lost `klˈɑːɹə`.
        // Running marry first chains ɛ → æ → ɑː and both sets get what they are for.
        if (lex.marry.has(w)) s = s.replace(/ɛ(ˈ|ˌ)?ɹ/u, "æ$1ɹ");
        if (lex.bath.has(w)) s = s.replace(/æ/u, "ɑː"); // BATH
        if (lex.cloth.has(w)) s = s.replace(/ɔː/u, "ɒ"); // CLOTH
        if (lex.yod.has(w)) s = s.replace(/([tdnszθl])(ʰ?)([ˈˌ]?)uː/u, "$1$2j$3uː"); // yod-retention (glide after any aspiration, before the stressed vowel)
        // LOT before intervocalic r (the LOT rule's (?!ɹ) skipped it).
        // ⚠ EITHER GenAm REALIZATION, not just ɑː. #1334 aligned the parent's AA/AO assignment to misaki gold's
        // consistent LOT–THOUGHT split, and 7 of the set's then-13 words moved to ɔː with it — `sorry` is the
        // US /ˈsɔːri/ vs RP /ˈsɒri/ split, where BOTH varieties are right and only the mapping between them was
        // missing. Matching only ɑːɹ left the rule silently failing on over half its own list.
        // ⚠ AND THOSE SEVEN ARE NOT IN THIS SET ANY MORE (#1381). Once they became ɔː, `cloth`s `ɔː → ɒ`
        // claims them first and produces the identical result, so the #1381 rebuild moved `sorry`, `sorrow`,
        // `sorrowful`, `morrow`, `overmorrow`, `florist` and `categorical` to `cloth` and left `lotr` with 6.
        // Nothing regressed — `sorry` is still sˈɒɹi — but do not read the examples above as members: they
        // document why the edit is WIDE, not who is in the set. The wide form is kept because the builder's
        // probe is now the same expression, so a future reordering cannot silently un-widen it.
        if (lex.lotr.has(w)) s = s.replace(/[ɑɔ]ːɹ/u, "ɒɹ");
    }
    /**
     * ⚠ THE `-ary / -ery / -ory` WEAK VOWEL (#1380) — A RULE, NOT A WORD LIST, because the suffix is
     * PRODUCTIVE. GenAm carries a secondary-stressed full vowel there (`secretary` sˈɛkɹətʰˌɛɹi,
     * `category` kʰˈætəɡˌɔːɹi) and SSBE does not. An unseen `-ary` word takes the reduction too, which a
     * lexicon by construction cannot do — putting this family in `en-gb-lexical.tsv` would be the
     * `aluminium` mistake in the other direction.
     *
     * ⚠ THE PARENT IS NOT WRONG HERE, WHICH IS WHY THIS IS AN ACCENT RULE. The dictionary distinguishes
     * `secretary` S EH1 K R AH0 T EH2 R IY0 from `accessory` AE0 K S EH1 S ER0 IY0, and BOTH are correct
     * GenAm — the first genuinely has the full vowel and the second genuinely reduces. 262 of our 703
     * `-ary/-ery/-ory` words already come out reduced for that reason. Nothing upstream needs changing.
     *
     * ⚠ REDUCED `əɹi`, NOT THE SYNCOPE `ɹi`, AND THAT IS A REGISTER CALL RATHER THAN A CORRECTNESS ONE.
     * Over the 774 referee headwords spelled this way: 662 attest the reduced form (418 of them ONLY the
     * reduced form) against 284 attesting the syncope and 40 attesting ONLY the syncope. Both are real
     * SSBE — the referee lists `sɛkɹətəɹi` AND `sɛkɹətɹi` for 244 words — so the choice is which register
     * this accent targets, and the reduced form is the one the corpus supports. The syncope would have
     * been defensible on `en-gb-yod`'s "prefer the RP-diagnostic realisation whenever attested" policy;
     * it is not taken because it is attested for barely a third of the class.
     *
     * ⚠ AND THE SECONDARY STRESS MARK IS DROPPED, WHICH NOTHING IN THIS REPO CAN VERIFY. The referee
     * carries no stress marks at all and the eval's fold strips them, so no instrument here witnesses
     * this either way. It is taken on the phonology — a reduced vowel does not carry a secondary stress —
     * and recorded as unverifiable rather than asserted as measured.
     *
     * ⚠ THE TRIGGER IS THE SPELLING **AND** A NON-PRIMARY SUFFIX VOWEL. Spelling alone would reach words
     * whose suffix vowel is the tonic — `canary` is kənˈɛɹi and `actuary` ˌækt͡ʃuːˈɛɹi — where the full
     * vowel is correct and reducing it would delete the stressed nucleus. Phone shape alone would reach
     * words not spelled with the suffix at all.
     *
     * ⚠ ~65 WORDS RESIST IT AND ARE LEFT WRONG ON PURPOSE: 40 attest only the syncope (`monastery`
     * mɒnəstɹi) and 25 keep a full vowel (`amatory` æmətɔːɹi). Each is one segment out, and an exception
     * table would be another generated artifact to keep fresh — which is what #1381, #1385 and #1388 were
     * all about. The residue is documented, not patched.
     */
    // ⚠ TWO PASSES AND NOT ONE OPTIONAL MARK. `/ˌ?(ɛ|ɔː)ɹi$/` reads as "an optional secondary" and is
    // not: the primary mark sits BEFORE the vowel too, so it matches `ˈɛɹi` with the group empty and
    // reduced `canary` kənˈɛɹi to kənˈəɹi and `actuary` to ˌækt͡ʃuːˈəɹi — deleting the tonic nucleus.
    // The first pass takes a secondary mark AND DROPS IT; the second takes an unmarked suffix vowel and
    // is blocked by a lookbehind on either mark.
    //
    // ⚠ THE INFLECTIONS COME TOO, AND ANCHORING ON `$` ALONE LEFT THEM OUT. A rule sold on being
    // PRODUCTIVE that stops at the lemma is not one: `ðə sˈɛkɹətʰəɹi ənd ðə sˈɛkɹətʰˌɛɹiz` said the
    // singular one way and the plural the other in a single utterance, which is the `clerk`/`clerks`
    // split #1385 treated as a blocker and #1390 tracks for the sets. The dictionary alone holds 53
    // `-aries/-ories` rows with the full vowel (`categories`, `dictionaries`, `cemeteries`).
    //
    // ⚠ AND `-story` COMPOUNDS ARE EXCLUDED, because the spelling cannot otherwise tell a weak suffix
    // from a compound whose final element is the free noun `story`: `understory` AH1 N D ER0 S T AO2 R
    // IY0, `multistory`, and the OOV `backstory` all keep a full THOUGHT vowel in SSBE. This is NOT the
    // documented residue — the residue is a bounded list of words the rule gets wrong, while this class
    // reaches unseen coinages through the very productivity the rule is sold on.
    // ⚠ EXCLUDING THE WHOLE `story$` SPELLING COSTS NOTHING: the only other members are `history`,
    // `protohistory` and `celestory`, and the parent already reduces all three (`HH IH1 S T ER0 IY0`),
    // so the rule was never firing on them.
    // ⚠ AND THE CLITIC, which the first fix for the inflections still missed: `secretary's` reaches here
    // with the apostrophe intact and its phones already end `ɹiz`, so only the SPELLING guard was
    // blocking it — the singular and its possessive disagreed for one more round.
    // ⚠ AND IT IS EXEMPT FOR A WORD THE LEXICAL TABLE OWNS, like every rule above it. No
    // `en-gb-lexical.tsv` row is spelled this way today, so this is latent — but that file exists
    // precisely to hand-write forms the rules get wrong, and the first such row would otherwise be
    // silently rewritten by the rule it was added to override.
    // ⚠ THE SET BLOCK RUNS BEFORE THIS AND THE BUILDER PROBES AFTER IT — see english-gb-ary.test.ts for
    // why that divergence is left in place and guarded rather than reordered.
    // ⚠ `\W?` RATHER THAN A LITERAL APOSTROPHE CLASS, AND THAT IS ABOUT TOOLING, NOT MATCHING.
    // `tools/extract_regexes.mts` scrapes pattern literals out of `src/` for the C# `JsRegex` harness,
    // and its scraper mangles any pattern containing a literal `'` inside a character class — six
    // patterns across hebrew, dutch, english, madurese and karakalpak are already dropped as
    // "unparseable" for that reason, and `['’]` here made it seven. A dropped pattern is one the
    // translator harness never replays, which is the one thing that file's header says must not happen.
    if (lexical === undefined && /(ar|er|or)(y|ies)\W?s?$/u.test(w) && !/story\W?s?$/u.test(w)) {
        s = s.replace(/ˌ(?:ɛ|ɔː)(ɹiz?)$/u, "ə$1").replace(/(?<![ˈˌ])(?:ɛ|ɔː)(ɹiz?)$/u, "ə$1");
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

/** The lexical-variant rows themselves, for the guard sweep in test/english-gb-lexical.test.ts. */
export function lexicalRows(): ReadonlyMap<string, LexicalRow> {
    return sets().lexical;
}

/** The words the lexical-variant table owns, for the set builder — which must not claim one into an
 *  ACCENT set (see build-en-gb-sets.ts). */
export function lexicalVariants(): ReadonlySet<string> {
    return new Set(sets().lexical.keys());
}

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
    return { text: (input: string): string => e.text(input, rpWordTransform()) };
}

/** The per-word delta on its own, for the ASYNC entry (englishNeural.ts) — same hook, same lexical sets. */
let RP_HOOK: ((ipa: string, word: string) => string) | undefined;
export function rpWordTransform(): (ipa: string, word: string) => string {
    if (RP_HOOK === undefined) {
        const lex = sets();
        RP_HOOK = (ipa, word) => toRP(ipa, word, lex);
    }
    return RP_HOOK;
}
