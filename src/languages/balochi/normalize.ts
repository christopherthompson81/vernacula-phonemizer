/**
 * Balochi / بلۏچی (bal) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS LANGUAGE HAS NO REFEREE OF ANY KIND. kaikki 0, wikipron 0, espeak does not ship Balochi in any
 * variety, and `referee-eval.ts` does not accept the code at all. There is also **no Wikipedia** — `bal`,
 * `bcc`, `bgn` and `bgp` are absent from Wikimedia's sitematrix and all four fail DNS — so `attest.ts`,
 * which probes `<lang>.wikipedia.org`, has nothing to probe. Every claim below therefore rests on the
 * corpus, on this engine's own cross-script lexicon, or on a cited external source, and says which.
 *
 * ⚠ AND THE CORPUS IS 37.4% NOT BALOCHI. The only Southern-Balochi text that exists is Wikimedia
 * Incubator's `Wp/bcc`, and its long paragraphs are 37.4% PERSIAN or URDU — whole physics and geography
 * articles in Persian, whole tribal histories in Urdu, all in the same script. That is worse than `bar`'s
 * 24% German and `ht`'s 15.1% French. `filter-by-language.py` gained a `bal` row for it and every count in
 * this file is over the 383 paragraphs that survive it. Full log:
 * `docs/investigations/bal_normalization_investigation.md`.
 *
 * ⚠ BALOCHI IS A MACROLANGUAGE AND THIS ENGINE IS SOUTHERN. `Wp/bgn` (Western) is four times larger and
 * covers 24/35 cells against Southern's 16/35 — it is used below only as a labelled second opinion on
 * ORTHOGRAPHIC conventions, and never as the source of a word. Where a word is attested in Western Balochi
 * and not in Southern, this file declines it and says so; `فیصد` is the worked example.
 *
 * ── WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes ──────────────────────────────────────
 *
 *     وڈݔن / شݔر     → "wɖ n" / "ʃ r"     ݔ U+0754 DELETED and the word FRAGMENTED   (×506, 38.9% of segments)
 *     گۏن / بلۏچ     → "ɡn" / "bl t͡ʃ"     ۏ U+06CF deleted                            (×578)
 *     کہ / ګون       → "k" / "on"          ہ ×813 and ګ ×256 deleted
 *     ﻫﻨﺪ            → ""                  presentation forms: the WHOLE WORD          (×110 in 5 segments)
 *     1355ھ. ق.      → "… h . k ."         the Hijri era as bare consonants + 2 pauses (×4)
 *     12,000         → "d̪uwaːzd̪ah , sifr"  grouping comma → pause, the tail reads ZERO
 *     ۶۵۲،۸۶۰        → "… d̪oː , haʃt̪ …"    same, with the Arabic comma
 *     2.5            → "d̪oː . pant͡ʃ"       the decimal point is a clause PAUSE
 *     ٪۵۰ / ₿ / &    → the sign is SILENT
 *
 * ── THE DIGIT QUESTION, ANSWERED FOR THIS LANGUAGE ────────────────────────────────────────────────────
 *
 * Balochi writes BOTH, and the native form dominates: **178 Extended Arabic-Indic runs against 42 ASCII**
 * in the Southern corpus, and the artifact records that an ASCII-only `\d` would find 13 of the 71
 * `digit-run` matches and 13 of the 68 `year` matches. So this is `ps`'s situation, not `ug`'s.
 * ⚠ NO `toAscii` IS DECLARED HERE, AND THAT IS CHECKED RATHER THAN ASSUMED: `registry.ts` folds native
 * digits for every language at its single dispatch point and `bal` is NOT in `FOLD_OPT_OUT` (which holds
 * only `te`). The comment there names `bal` explicitly as one of the seven engines that used to read their
 * own digits as an EMPTY STRING. The classes below are still written out as `[0-9۰-۹٠-٩]` rather than as
 * `\d`, so a rule is correct by construction and not by a fold happening upstream of it.
 *
 * ⚠ THE BIDI HAZARD IS ×0 HERE, MEASURED. A digit run inside RTL text is stored in LOGICAL order, so the
 * ordering a reader sees is the renderer's business and not a regex's — the risk is an explicit bidi
 * CONTROL splitting a run. Counted over the corpus: U+200E ×0, U+200F ×0, U+061C ×0, U+202A–U+202E ×0.
 * The 149 zero-width characters are ZWNJ ×146 — a real Balochi joiner control, already stripped by the
 * g2p — and ZWJ ×3, which step 2 removes because it is NOT in the engine's token class and therefore
 * splits a word in two.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO PERCENT WORD, AND THIS IS THE REFUSAL A SOUTHERN/WESTERN SPLIT FORCES. `٪` is ×2 in the Southern
 *   corpus (`۷۷٪ جهانی`, `چہ ۸۰٪ بلۏچ`) and both are silent today. The word exists — `فیصد`, ×14 in
 *   WESTERN Balochi and in exactly the right slot (`۱۹٫۸ فیصد`, `۱۳ فیصد`, `۴۵ فیصد`) — and it is ×0 in
 *   Southern. The single Southern candidate `سدی` ×1 is the CENTURY (`دھمی سدی ءَ`, "in the tenth
 *   century"): trap 37, the same shape as ug's `تەڭ`. `درصد` ×2 and `صدی` ×2 in the unfiltered project are
 *   in the Persian and Urdu paragraphs respectively. `sources.ts` reports `percent-word · no % in corpus`
 *   because it had no corpus to look in.
 *   ⚠ THE PLAYBOOK SAYS A REFUSAL RESTING ON SILENCE NEEDS A DICTIONARY CHECK, so one was attempted:
 *   webonary.org's Balochi dictionary (which is dialect-labelled, and would have settled it) returns HTTP
 *   403 to a fetch, and the Balochi Academy Sarbaz site has no entry a search surfaced. So the check was
 *   run and did not resolve, which is different from not running it. Reading a Western word into a
 *   Southern engine is this language's version of the French-into-Haitian-Creole failure, and 2 instances
 *   is not worth it. Left silent, and it costs the reading nothing it did not already lack.
 *
 * ⚠ NO RANGE CONNECTIVE. `digit–digit` is ×3 (`2-7 پیش چه میلاد`, `1960-1973`, `۱ - ۶`). Balochi does not
 *   infix a range word: it uses the CIRCUMFIX `شه … تا …` ("from … to …"), which the corpus writes out in
 *   full — `شه سال ۱۹۴۷ تا ۱۹۴۸ میلادیا`. That is the ug refusal and the `ff hakkunde` refusal in one: a
 *   preposition pair asked to be an infix, ungrammatical for every corpus instance. The juxtaposition the
 *   engine already reads is left alone.
 *
 * ⚠ NO INITIALISMS AND NO LETTER NAMES. `initialism` ×6 and `letter-name` ×7, and reading them settles it:
 *   every one sits inside an ENGLISH GLOSS the article supplies for itself — `(پہ انگرݔزی: United States
 *   of America … USA)`, `(پہ انگرݔزی: Gross Domestic Product یا GDP)`, `(لاتین: Sistàn E Hond)`. They are
 *   English text labelled as English, already routed to the Latin fallback. `core/initialisms.ts` is a
 *   NO-OP without a letter-name table anyway and `sources.ts` reports
 *   `[NONE] letter-names — espeak does not ship this language at all`, which is the true blocker (trap 16
 *   says measure it rather than assert it, so: measured).
 *
 * ⚠ NO DECIMAL WORD — the separator is replaced by a SPACE, ug's partial fix, for the same reason.
 *   `sources.ts` reports `[NONE] decimal-point` (no espeak, no manifest word) and no candidate is attested
 *   in either Balochi corpus. What step 6 buys is the removal of a spurious clause PAUSE from the middle of
 *   a quantity; what it does not buy is a reading of the point, and it says so rather than inventing one.
 *
 * ⚠ NO `/` RULE, THOUGH IT IS A DECIMAL POINT HERE. Southern writes the Iranian-convention decimal slash —
 *   `۳/۸ ملیون چارسریکی مِلل` and `۹/۸ ملیون چارسریکی کیلومتر` (3.8 and 9.8 million square miles/km), ×2.
 *   The engine already reads that as two numbers with no pause, which is byte-identical to what a
 *   space-substitution rule would produce, so a rule here would be a change that does nothing (and the
 *   Western corpus's `۰۰۰/۱۰۰` uses the same character as a THOUSANDS mark, so a rule would have to tell
 *   them apart for no gain). Recorded because a future decimal WORD would make this shape live.
 *
 * ⚠ NO `ھ.ش` ARM ON THE ERA RULE, though `هجری شمسی` ×2 is attested as a phrase. The ABBREVIATION is ×0 in
 *   Southern; adding an arm for a shape the corpus never writes is trap 9's misfire generator, which is
 *   exactly what the `ھ.ق` arm avoids by being ×4.
 *
 * ⚠ NO CURRENCY, `&`, `+` OR MATH SIGN. One instance each and none is what the class is for: `₿` is the
 *   Bitcoin logo being NAMED (`گۏن سیاھگ ₿`, "with the symbol ₿") beside its own ticker `BTC`; `&` is
 *   inside the English gloss `(Antigua & Barbuda)`; `+` is `گِد + رۏچ اَنت`, a formula in a calendar
 *   article. No Balochi word for any of them is attested in either corpus, and naming one here would be
 *   the `ff tere` failure.
 *
 * ⚠ NO CLOCK, DEGREES, UNITS, EXPONENT, RATE, ORDINAL, ROMAN OR FRACTION RULE: all ×0 in the Southern
 *   corpus. The Western corpus has 3 degrees and 3 exponents, which is a fact about Western Balochi.
 *
 * ⚠ HARAKAT ARE STILL DELETED BY THE G2P, and that is a manifest question rather than this layer's.
 *   Kasra ×790, fatha ×467, damma ×454 in the Southern corpus — i.e. this text writes, explicitly, a large
 *   share of exactly the short vowels `balochi.jsonc`'s header calls unrecoverable. Declaring
 *   `َ→a ِ→i ُ→u` there would recover them and is a g2p change with its own gold to earn. What this file
 *   does do is stop them BLOCKING the lexicon: they are stripped for the lookup in step 4, which is worth
 *   +39 tokens on its own, and are otherwise left in the text for a future manifest to read.
 */

/** Every digit the corpus writes. Written out rather than `\d` (which is ASCII-only and would miss 82% of
 *  this language's digit runs) and rather than `\p{Nd}` (which would admit Devanagari and friends). Must
 *  agree with the ENGINE's number token, which is `\d+` after the registry's native-digit fold. */
const D = "0-9۰-۹٠-٩";
/** "not inside a word", the trap-1/23 form: `\p{M}` beside `\p{L}`, and never `\b`. */
const NW_B = "(?<![\\p{L}\\p{M}])";

/** The Arabic-script letter range this language actually uses, INCLUDING the Arabic Supplement — ݔ U+0754
 *  is outside U+0620–U+06FF and is ×506 here. Same range the engine's TOKEN class now carries. */
const AR = "\\u0620-\\u06FF\\u0750-\\u077F";
/** Harakat and the other combining marks the corpus writes. Stripped only for a LEXICON LOOKUP. */
const HARAKAT = /[ً-ْٰٕٔٚۖ-ۭ]/gu;

/**
 * ⚠ ORTHOGRAPHIC VARIANTS OF LETTERS THE MANIFEST ALREADY HAS. Everything in this table is a *different
 * spelling of the same sound*, which is what makes folding it safe — the ug `ه→ھ` shape, and trap 36's
 * "fold a compatibility character, never NFKC".
 *
 * ⚠ EVERY ROW IS ATTESTED BY THE CORPUS GLOSSING ITSELF: the same word appears both ways, so the pairing is
 * this language's own statement and not a transliteration table imported from a neighbour. Type-pair counts
 * over the 383 Southern paragraphs:
 *
 *     ہ→ه  ×813, 28 pairs   کہ/که 201/162 · نہ/نه · ہم/هم · اگہ/اگه · جزیرہ/جزیره
 *     ګ→گ  ×256, 21 pairs   ګون/گون 21/6 · جنګی/جنگی · ګوشنت/گوشنت · انګریز/انگریز
 *     ؤ→و  ×77,  15 pairs   رؤچ/روچ · دؤلت/دولت · کؤه/کوه · اؤگانستانا/اوگانستانا
 *     ك→ک  ×45,  12 pairs   كار/کار · كُتگ/کُتگ · حكومتی/حکومتی
 *     ي→ی  ×16,   5 pairs   بلوچاني/بلوچانی · ايالت/ایالت · ياد/یاد
 *     ۇ→و  ×13           — all 13 are the STANDALONE connective `ۇ`, against `و` ×282
 *     ۓ→ے  ×2            — `بلۓ` for بلے, "but"
 *
 * ⚠ ډ ټ ړ ARE PASHTO LETTERS IN PASHTO SENTENCES AND THE FOLD IS STILL RIGHT, which is the only reason they
 * are here. `وکړ`, `وګړي`, `پیړۍ`, `پوځي` are Pashto quoted inside Wp/bcc's Afghanistan articles (trap 34 —
 * identify the sentence's language, not its script). But ډ ټ ړ carry the SAME retroflex values in Pashto as
 * Balochi ڈ ٹ ڑ do — ɖ ʈ ɽ — so the fold is correct whichever language the token belongs to, and `جوړ`/`جوڑ`
 * ×11/×1 is a Balochi self-gloss pair for one of them.
 * ⚠ AND THE PASHTO-ONLY PHONEMES ARE DECLINED for exactly that reason: ښ (/ʂ~x/) ×10, ۍ (/əi/) ×3,
 * څ (/t͡s/) ×2, ځ (/d͡z/) ×2 have no Balochi value, so folding them would assert a Balochi reading for a
 * Pashto word. They stay unread — 17 characters, all inside Pashto quotations.
 * ⚠ `ښار`/`شار` ×6/×24 is the tempting pair and it is a TRANSLATION, not a spelling: both mean "city", one
 * is the Pashto word and one the Balochi word. A cognate is not a variant.
 */
const EXACT: readonly (readonly [string, string])[] = [
    ["ہ", "ه"], ["ۀ", "ه"], ["ة", "ه"],   // heh goal / heh-with-yeh / teh marbuta → the manifest's ه (h)
    ["ګ", "گ"],                            // Pashto-keyboard gaf → گ (ɡ)
    ["ك", "ک"], ["ي", "ی"],                // the ARABIC kaf and yeh → their Perso-Balochi shapes
    ["ؤ", "و"], ["ۇ", "و"], ["ۈ", "و"],    // waw with hamza / the Turkic u-letters → و
    ["أ", "ا"], ["إ", "ا"], ["ٱ", "ا"],    // hamzated alefs → ا
    ["ۓ", "ے"], ["ې", "ے"], ["ێ", "ے"],    // the other e-letters → the manifest's ے (eː)
    ["ۆ", "ۏ"],                            // the Kurdish/Uyghur o-letter → the Balochi Standard ۏ (oː)
    ["ډ", "ڈ"], ["ټ", "ٹ"], ["ړ", "ڑ"],    // Pashto retroflexes → the Balochi ones, same values ɖ ʈ ɽ
];

/**
 * ⚠ THE SECOND FOLD, AND IT EXISTS ONLY TO REACH THE LEXICON. `ݔ` and `ۏ` are the Balochi Standard
 * Alphabet's letters for ē and ō and `balochi.jsonc` now reads them as such, so nothing here is needed to
 * make them audible. But this engine's cross-script lexicon is keyed on the PAKISTAN-alphabet spellings —
 * `نیمگ`, `بلوچ`, `روچ`, `کوه` — and a lexicon hit returns the FULL vowels the abjad cannot, where the new
 * manifest rules return the skeleton:
 *
 *     نݔمگ  via ݔ→eː  → neːmɡ          via the lexicon (نیمگ)  → neːmaɡ   ← the short a, recovered
 *     بلۏچ  via ۏ→oː  → bloːt͡ʃ         via the lexicon (بلوچ)  → baloːt͡ʃ
 *
 * So step 4 tries this respelling FIRST and keeps it only when the lexicon knows the result; otherwise the
 * word is left in its own orthography for the manifest to read. Measured over the corpus, lexicon hits go
 * **875 → 1,101 tokens (+25.8%)**, and no word is respelled unless the respelling is a known word — which
 * is what stops this from being a blanket ݔ→ی fold that would read every OOV ē as iː.
 */
const TO_LEXICON: readonly (readonly [string, string])[] = [["ݔ", "ی"], ["ۏ", "و"], ["ے", "ی"]];

/**
 * THE ERA ABBREVIATIONS, AND THE EXPANSIONS ARE THE CORPUS'S OWN WORDS.
 *
 *     ھ.ق  ×4   →  هجری کمری   ×3 as a phrase, in the SAME corpus  (`چه هجری کمری گرگ بیتگ`)
 *     ق.م  ×1   →  پیش چه میلاد ×1 as a phrase, in the SAME corpus
 *
 * ⚠ `کمری` WITH ک IS THE SOUTHERN SPELLING AND IT IS NOT A TYPO. Western Balochi writes `هجری قمری` (×3 in
 * Wp/bgn, ×0 in Wp/bcc) and Southern writes `هجری کمری` (×3 in Wp/bcc, ×0 in Wp/bgn) — which is what this
 * language's own manifest predicts, since it maps ق→k and records that Balochi has no native /q/. Taking
 * the Southern spelling is the whole point of keeping the two corpora apart.
 *
 * ⚠ DIGIT-ANCHORED, BOTH SIDES, BECAUSE THE BARE LETTERS ARE WORDS. `1355ھ. ق.` and `1373ﻫـ .ﻕ.` put the
 * year BEFORE; `11,000 ق م ءِ کش` puts it before too, but the anchor has to admit either because a Balochi
 * era phrase can precede its date. Without the anchor `ق م` would claim **قم, the Iranian city** — ×10 in
 * the Western corpus (`شارستان قم ولایت قم`) and never once digit-adjacent. That is trap 2 caught before it
 * was written rather than after.
 */
/**
 * ⚠ WHAT MAY SIT BETWEEN THE TWO LETTERS OF AN ERA ABBREVIATION, AND THE TATWEEL IS WHY THIS IS A CONSTANT.
 * The corpus writes `1355ھ. ق.` and also `1373ﻫـ .ﻕ.` — with U+0640 ARABIC TATWEEL, a space, and the dot on
 * the OTHER side of the space. A pattern of `\s?\.?\s?` typechecked, ran, and silently claimed only the
 * first of the four instances; the second form was caught by reading the corpus DIFF rather than by any
 * probe, which is the third time in this file that the corpus's own typography beat the shape I had in
 * mind. Elongation cannot follow a digit, so admitting it here is safe.
 */
const ERA_SEP = "[ـ\\s]*\\.?[ـ\\s]*";

const ERA: readonly (readonly [string, string])[] = ([
    ["[ھه]", "ق", "هجری کمری"],
    ["ق", "م", "پیش چه میلاد"],
] as const).map(([a, b, w]) => [`${a}${ERA_SEP}${b}`, w] as const);

export interface BalochiNormalizerDeps {
    /** Is this exact Arabic-script spelling a headword of the cross-script lexicon? Supplied by the engine
     *  so this file needs no import from `balochi.ts` — which would be a cycle, since the engine calls the
     *  normalizer. The `make…Normalizer(deps)` shape is the playbook's convention for exactly this. */
    knownWord: (arabic: string) => boolean;
}

/** Build the Balochi (Southern) normalizer. See `BalochiNormalizerDeps` for why this is a factory. */
export function makeBalochiNormalizer({ knownWord }: BalochiNormalizerDeps) {
    const applyAll = (w: string, table: readonly (readonly [string, string])[]): string => {
        let out = w;
        for (const [from, to] of table) out = out.split(from).join(to);
        return out;
    };
    const WORD = new RegExp(`[${AR}\\u200C]+`, "gu");

    return function normalizeBalochi(input: string): string {
        // 1) NFC at the entry. Arabic-script text mixes precomposed and decomposed forms, so a rule keyed
        //    on a literal would otherwise match a fraction of its instances (trap 11). The engine NFCs
        //    again downstream, so this costs nothing.
        let s = input.normalize("NFC");

        // 2) HTML entities and the zero-width characters that are NOT orthography, before anything can
        //    read one as a letter or split a word on one.
        //    ⚠ ZWJ IS REMOVED AND ZWNJ IS NOT, and the asymmetry is the engine's token class rather than a
        //    judgement about Balochi. `[ؠ-ۿݐ-ݿ‌]` contains U+200C, so a ZWNJ keeps its word whole and
        //    `phonemizeArabic` then strips it; U+200D is absent from that class, so its 3 instances SPLIT
        //    a word into two tokens and each half goes to the g2p alone. Same for the BOM.
        s = s.replace(/&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ").replace(/[‍﻿​]/gu, "");

        // 3) ⚠ ARABIC PRESENTATION FORMS — ×110 across 5 of the 383 segments, and those segments read as
        //    the EMPTY STRING today: the engine's token class stops at U+06FF (and now U+077F), so
        //    U+FB50–U+FDFF and U+FE70–U+FEFF match nothing at all and every letter is deleted
        //    (`ﻫﻨﺪ` → ""). This is ug's largest defect appearing again in another Perso-Arabic language,
        //    and it is invisible to every DROP class, which hunt a symbol that SURVIVES.
        //    ⚠ NFKC PER CHARACTER, OVER A CURATED RANGE — never `s.normalize("NFKC")` (trap 36). Blanket
        //    NFKC folds `²` to `2`, `…` into three clause breaks and `¾` into `3⁄4`. Restricted to the two
        //    presentation blocks it is exact for this corpus: every one of the 47 distinct forms here is an
        //    ordinary Arabic letter (ﺎ ﺍ ﺳ ﻫ ﺪ ﺮ ﻣ ﻨ ﻼ …) whose NFKC is its own base letter.
        //    ⚠ AND UG'S HEH EXCEPTION DOES NOT APPLY TO BALOCHI. There, plain-heh presentation forms had to
        //    be split between the vowel ە and the consonant ھ because Uyghur uses both. Balochi has no
        //    ە: ﻩ/ﻪ fold to ه, which this manifest already reads as /h/ — the value they have in the
        //    corpus's `ﺣﻀﺮﺕ ﺷﺎﻩ ﻏﻮ…`. Checked rather than inherited.
        //    ⚠ RUNS ABOVE STEP 5, because one of the four Hijri abbreviations is itself written in
        //    presentation forms (`ماں ﺳﺎﻝ 1373ﻫـ .ﻕ. وتی وانگ`) — a guard's evidence has a lifetime
        //    (trap 39), and here the evidence does not exist until this step has created it.
        s = s.replace(/[ﭐ-﷿ﹰ-﻿]/gu, (c) => c.normalize("NFKC"));

        // 4) ⚠ THE ORTHOGRAPHIC VARIANT FOLD — THIS LANGUAGE'S DEFINING RULE, and by a wide margin. Every
        //    other rule in this file touches at most a handful of instances; this one touches 1,443
        //    characters across 149 of the 383 segments, every one of which is a letter the g2p DELETED.
        //    See EXACT for the table and for the corpus's own attestation of each row, and TO_LEXICON for
        //    why a second, narrower fold exists.
        //
        //    ⚠ WORD-WISE AND LEXICON-FIRST, IN FOUR STEPS, and the order is the whole design:
        //      a. a word the lexicon already knows is left completely alone — including its harakat;
        //      b. otherwise the harakat are stripped and the lexicon asked again (+39 tokens: the corpus
        //         writes `کُتگ` where the lexicon's headword is `کتگ`, so the marks were BLOCKING lookups);
        //      c. otherwise the Pakistan-alphabet respelling is tried against the lexicon, and kept only if
        //         it hits — this is what recovers the short vowels for نݔمگ, بلۏچ, رۏچ, کۏہ and their kin;
        //      d. otherwise only the EXACT-value folds are applied, leaving ݔ and ۏ in place for the
        //         manifest to read as eː and oː rather than guessing them into ی and و.
        //    Step (d) is what stops this being a blanket transliteration: an OOV ē stays an ē.
        s = s.replace(WORD, (w) => {
            if (knownWord(w)) return w;
            const bare = w.replace(HARAKAT, "");
            if (knownWord(bare)) return bare;
            const lex = applyAll(applyAll(bare, EXACT), TO_LEXICON);
            if (knownWord(lex)) return lex;
            return applyAll(w, EXACT);
        });

        // 5) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as
        //    CLAUSE PUNCTUATION and the tail as a number in its own right: `12,000` read as
        //    "twelve, ZERO".
        //    ⚠ THREE MARKS, AND EACH IS ATTESTED AS A GROUPING MARK IN ONE OF THE TWO CORPORA:
        //        ,  ×3 Southern (`12,000`, `11,000`, `500,000`) · ×2 Western
        //        ،  ×1 Southern (`۶۵۲،۸۶۰`)                      · ×11 Western
        //        ٬  ×0 Southern                                  · ×30 Western (`۴۴۷٬۴۰۰`, `۲٬۲۷۵٬۰۰۰`)
        //    ⚠ THE MARKS DO NOT OVERLAP AT ALL IN SOUTHERN, which is what makes this rule safe to write as
        //    a de-grouping rule and step 7 safe to write as a decimal rule. Counted over the corpus:
        //        ,  3-digit groups ×3   1–2 digit tail ×0        ٬  groups ×0   tail ×0
        //        ،  3-digit groups ×1   1–2 digit tail ×0        .  groups ×0   tail ×1
        //    i.e. the comma family is ALWAYS grouping and the dot is ALWAYS a decimal. (Western Balochi is
        //    messier — `٬` has 49 groups and one decimal tail, `.` one group — which is one more reason the
        //    two corpora are not pooled.) `12,5` therefore keeps its pause, correctly: this language does
        //    not write a comma decimal, and claiming one would invent a quantity.
        //    ⚠ AND `٬` IS A CLAUSE COMMA IN SOUTHERN — all 10 of its Southern instances sit between clauses
        //    (`… اینت٬ که …`, `… کورته٬و …`), which is why it is ALSO in the manifest's
        //    `clausePunctuation`. This rule claims the digit-grouped shape and whatever it leaves reaches
        //    that table as the pause the Southern corpus wants. The mark does not decide; the context does.
        //    ⚠ THE LEADING GUARD IS WHAT KEEPS A YEAR LIST OUT, and the corpus contains one:
        //    `۱۳۲۷،۱۳۳۷،۱۳۴۷،۱۳۵۲` is four Solar Hijri years separated by commas, not a grouped number.
        //    A 4-digit head cannot start a match, so the guard rejects it — and rejecting it is why the
        //    pauses between those years survive.
        //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, not a clause mark, or a number
        //    followed by its own sentence comma would lose its last group and speak it as zero.
        for (const mark of ["،", ",", "٬"]) {
            s = s.replace(
                new RegExp(`(?<![${D}.,،٬])[${D}]{1,3}(?:${mark}[${D}]{3})+(?![${D}]|${mark}[${D}])`, "gu"),
                (w) => w.split(mark).join(""),
            );
        }

        // 6) ERA MARKERS, digit-anchored. See ERA for the two arms, their corpus counts and their
        //    self-glossed expansions. Today `1355ھ. ق.` reads as `h . k .` — two bare consonants and two
        //    spurious clause pauses — which is ug's `م.ب. 55` → `m b` in another language.
        //    ⚠ THE ABBREVIATION'S OWN TRAILING DOT IS CONSUMED, which is the mistake ug's first version
        //    made: the corpus writes a dot after EACH letter, so a body ending at the second letter leaves
        //    `.` behind as a phrase break in the middle of the date.
        //    ⚠ MULTI-PART BEFORE SINGLE (the playbook's standing ordering rule) is not needed here, since
        //    neither arm is a prefix of the other and neither bare letter is claimed alone — a lone `ھ` or
        //    `م` next to a digit is far too common in Balochi to key on.
        for (const [body, word] of ERA) {
            s = s.replace(new RegExp(`(?<=[${D}])[ـ\\s]*${body}${ERA_SEP}\\.?`, "gu"), ` ${word}`);
            s = s.replace(new RegExp(`${NW_B}${body}${ERA_SEP}\\.?\\s*(?=[${D}])`, "gu"), `${word} `);
        }

        // 7) DECIMALS, LAST, because every rule above needs the number intact — and the separator is
        //    replaced by a SPACE rather than by a word. See the header for why no decimal word is named.
        //    ⚠ SUBSTITUTE, NEVER DELETE (trap 26). Deleting the point would turn `2.5` into `25` — a
        //    different quantity, i.e. confidently wrong, which is the one outcome worse than the pause.
        //    ⚠ THE TRAILING GUARD MUST REJECT A FOLLOWING `.`+DIGIT so an IP address or a version number
        //    is not split into pieces; written as `\.[D]` rather than a bare `.` deliberately, because a
        //    decimal that ENDS a sentence is followed by a dot too and must still be read.
        //    ⚠ `٫` U+066B, the Arabic decimal separator, needs NO arm and is not given one: it is in
        //    neither `clausePunctuation` nor the token class, so `۱۱٫۳ کیلومتر` already reads as two
        //    numbers with no pause — byte-identical to what this rule would produce. Stated rather than
        //    coded, so nobody adds it to the punctuation table by symmetry and turns 2 quantities into 2
        //    spurious pauses.
        s = s.replace(
            new RegExp(`(?<![${D}.])([${D}]+)\\.([${D}]+)(?![${D}]|\\.[${D}])`, "gu"),
            "$1 $2",
        );

        return s;
    };
}
