/**
 * Punjabi (pa) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the pa_in FLEURS corpus (1,589 unique utterances, column 3 — the cased, punctuated text):
 *
 *   defect                                    count   what the engine produced BEFORE
 *   ---------------------------------------   -----   ------------------------------------------------
 *   fused 21–99 cardinals (see punjabi.jsonc)   143    21 → [ˈɪkː ʋˈiːɦ] "one twenty"; 1947 → "…seven forty"
 *   grouped numerals 1,234                       35    2,500 → [d̪ˈoː , pˈə̃ɲd͡ʒ sˈɔː] "two, five hundred"
 *                                                      and 1,000 → [ˈɪkː , sˈɪfəɾ] "one, zero"
 *   ordinal suffix ਵੀਂ/ਵਾਂ/ਵੇਂ                   24    15ਵੀਂ → [pˈə̃n̪d̪əɾã ʋˈĩ] — suffix as its own word
 *   decimals N.M                                 13    2.3 → [d̪ˈoː . t̪ˈɪ̃n] — a SENTENCE BREAK mid-number
 *   times h:mm                                    9    11:20 → [ɡɪˈaːɾã , ʋˈiːɦ] — colon as a comma pause
 *   Gurmukhi unit abbreviations                   9    83 ਕਿਮੀ → [kˈɪmiː], read as a word
 *   percent %                                     4    80% → [ˈəsːiː] — the sign DROPPED
 *   currency $ / ¥                              2/3    $5 → [pˈə̃ɲd͡ʒ] — the sign DROPPED
 *   era ਈ.ਪੂ.                                     2    two spurious sentence breaks per instance
 *   degree °                                      2    35° → [pˈə̃ɲd͡ʒ t̪ˈiːɦ] — the sign DROPPED
 *   ਡਾ.                                           1    a spurious sentence break
 *
 * ZERO Gurmukhi digits ੦-੯ in the corpus — it writes ASCII throughout, so `foldNativeDigits` (already wired
 * into `text()`) has nothing to do here. The equivalent lead held for Marathi (×597) and not for pa.
 */
import { postposedSign } from "../../core/postposedSign.ts";
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The SHARED symbol tier, with Punjabi's data. Punjabi count nouns do not inflect after a numeral
 * (ਇੱਕ ਡਾਲਰ / ਪੰਜ ਡਾਲਰ), so every `CountForms` here is a 1-element array.
 *
 * ⚠ THIS TABLE IS TWO LANGUAGES', AND THE SECOND ONE IS WHERE THE LATIN LIVES. The header above measures
 * pa_in, whose text is essentially Latin-free (three runs in 1,589 utterances — Il, Giancarlo, Fisichella),
 * and an early note here concluded from that that Latin unit keys were "all risk and no reward". The
 * registry puts **pnb** (Western Punjabi, Shahmukhi) on this same engine, and pnb's wiki-mined artifact
 * carries Latin abbreviations in ordinary running text — `km`, `kg` ×2, `m²` — so a key that is inert for
 * pa is the reading for pnb. Both `units` and the entity step below exist for that second corpus; each says
 * which text it was measured on. Punjabi's own Gurmukhi abbreviations are a separate table, at step 6.
 * No `magnitudeConnective`: Punjabi takes none ("2.3 ਅਰਬ ਡਾਲਰ", corpus).
 */
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
    // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
    // ਅਤੇ is ×1441 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
    //
    // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
    // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
    // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
    // see the tier, where the spacing exists because `B&B` is two initialisms.
    ampersand: "ਅਤੇ",
    // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: "ਗੁਣਾ" },
    percent: ["ਪ੍ਰਤੀਸ਼ਤ"],
    // `5 km` read as *pˈə̃ɲd͡ʒ ˈʊkm*: no unit was declared. Verified in pa_in:
    // ਕਿਲੋਮੀਟਰ ×31 "50 ਕਿਲੋਮੀਟਰ (31 ਮੀਲ) ਦੂਰ", ਮੀਟਰ ×17 "4892 ਮੀਟਰ ਮਾਉਂਟ ਵਿਨਸ".
    // ⚠ ਕਿਲੋਗਰਾਮ WAS REFUSED ON THE pa_in CORPUS AND IS NOW DECLARED, and it is the SISTER LANGUAGE that
    // supplied both halves of the reason. The old note ("×0 in the corpus, not taken from Wikidata's label
    // alone") was right about pa_in and measured the wrong text: this table is also **pnb**'s — Western
    // Punjabi in Shahmukhi, registered onto the same engine — and pnb's mined artifact writes `kg` twice,
    // in its SI article, where the sentence is Punjabi and the symbol is quoted as itself:
    //   `اکائیاں دے چنھ بہووعدہ وچ نئيں لکھے جایاں۔ ، for example "25 kg" (not "25 kgs")`
    //   `انک تے چنھ نو‏‏ں اک بلینک سپیس … وکھ کردا اے، "2.21 kg"، "7.3 m²"، "22 K"`
    // Undeclared, both reached the phoneme stream as the raw run `kg`. The word is now sourced outside this
    // repo and outside Wikidata: `attest.ts --lang pa --words ਕਿਲੋਗਰਾਮ` returns 5 tokens / 3 articles, and
    // the read examples are Olympic weight classes (`ਫ੍ਰੀਸਟਾਇਲ 60 ਕਿਲੋਗਰਾਮ ਮੁਕਾਬਲਾ`, `96 ਕਿਲੋਗਰਾਮ`) — the
    // kilogram sense, digit-adjacent, in the slot. ⚠ `ਕਿਲੋ` alone is 89/19 and is NOT used: its examples are
    // `ਕਿਲੋ ਮੀਟਰ` and `ਕਿਲੋ ਹਰਟਜ਼`, i.e. the prefix spaced off some other unit, not a word for the kilogram.
    // ⚠ THE GURMUKHI WORD IS CORRECT FOR THE SHAHMUKHI SIDE TOO, and this is the established mechanism
    // rather than a new claim: `km` already emits ਕਿਲੋਮੀਟਰ into pnb text and `punjabi.ts` routes per WORD,
    // so the Gurmukhi spelling takes the Gurmukhi branch of the same phonology — `pnb: "ایہ 50 km دور اے"`
    // reads *…pə̃ɲd͡ʒˈaːɦ kɪloːmˈiːʈəɾ…*, the Punjabi word, in either script's sentence.
    units: { km: ["ਕਿਲੋਮੀਟਰ"], m: ["ਮੀਟਰ"], kg: ["ਕਿਲੋਗਰਾਮ"] },
    // `ਵਰਗ ਕਿਲੋਮੀਟਰ` ×4 and `ਘਣ ਮੀਟਰ` ×1, both word-first.
    // ⚠ Bare ਵਰਗ is ×12 and its first instance is `ਉੱਚ ਵਰਗ` — "upper CLASS". The bare count would have
    // triple-counted a different word; only the collocation with the unit noun attests the unit sense.
    exponentWords: { squared: ["ਵਰਗ"], cubed: ["ਘਣ"], position: "before" },
    // ⚠ `¥` → ਯੇਨ, AND IT WAS RECORDED AS UNSOURCEABLE UNTIL THE AUDIO ARRIVED. The corpus writes
    // `ਟਿਕਟਾਂ ਦੀ ਕੀਮਤ ¥2,500 ਅਤੇ ¥130,000` and the sign was DROPPED, so the price lost its currency entirely.
    // "yen" is ×0 in this corpus's TEXT and in the wiki, i.e. unsourceable — a correct
    // report about the text tiers and the wrong conclusion about the language. The reader says it: decoded with
    // facebook/wav2vec2-xlsr-53-espeak-cv-ft (a PHONEME recognizer, so it cannot echo a glyph back),
    //   `… t i k t a n d i k iː m a t … ʌ l a k a t iː h i a r r  j e n  d e v i tʃ k a r h o v e ɡ iː …`
    // — "…hazār YEN de vich…", the loan spoken in slot. ਯੇਨ reads jˈeːn, which is that decode exactly.
    // ⚠ ONE SPEAKER: pa_in carries a single recording of this sentence, so it is 1 of 1 rather than a majority.
    // ⚠ CONTRAST or, WHICH HAS THE SAME SENTENCE AND WHOSE READER OMITS THE CURRENCY: or's `¥7,000` decodes as
    // `… m u l j o p r a j o  s a t o h z e r  h e b a …` — "mūlya prāya sāta hazāra", the bare number. So the
    // silence is right for or and wrong for pa, and neither could be settled from text.
    currency: { "$": ["ਡਾਲਰ"], "¥": ["ਯੇਨ"] },
    magnitudes: ["ਹਜ਼ਾਰ", "ਲੱਖ", "ਕਰੋੜ", "ਮਿਲੀਅਨ", "ਅਰਬ"],
});

/**
 * Ordinal suffixes. Punjabi writes the ordinal as the numeral plus the suffix, and the suffix carries the
 * gender/number agreement, so it is read off the text rather than guessed. All five spellings below occur
 * in the corpus (ਵੀਂ ×19, ਵਾਂ ×3, ਵੇਂ ×2, and the bindi-less ਵੀ / ਵਾ ×1 each).
 */
const ORDINAL_SUFFIXES = ["ਵੀਂ", "ਵੀ", "ਵਾਂ", "ਵਾ", "ਵੇਂ", "ਵੇ"];

/**
 * Gurmukhi unit abbreviations → the full word, matched only AFTER a number. Longest first so ਕਿ.ਮੀ. beats
 * ਮੀ. and ਸੈ.ਮੀ beats ਮੀ — ⚠ multi-dot abbreviations must precede single-dot ones,
 * expressed as alternation order (an interior dot that survives becomes a phrase break).
 * Attested: ਕਿਮੀ ×4, ਕਿ.ਮੀ ×2, ਮਿਮੀ ×4, ਮੀ. ×2, ਸੈ.ਮੀ ×1.
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "ਕਿ.ਮੀ.": "ਕਿਲੋਮੀਟਰ", "ਕਿ.ਮੀ": "ਕਿਲੋਮੀਟਰ", "ਕਿਮੀ": "ਕਿਲੋਮੀਟਰ",
    "ਸੈ.ਮੀ.": "ਸੈਂਟੀਮੀਟਰ", "ਸੈ.ਮੀ": "ਸੈਂਟੀਮੀਟਰ",
    "ਮਿ.ਮੀ.": "ਮਿਲੀਮੀਟਰ", "ਮਿ.ਮੀ": "ਮਿਲੀਮੀਟਰ", "ਮਿਮੀ": "ਮਿਲੀਮੀਟਰ",
    "ਮੀ.": "ਮੀਟਰ",
};
const UNIT_ALT = Object.keys(UNIT_WORD)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/\./gu, "\\."))
    .join("|");

/** Build the Punjabi normalizer. Takes the numbers definition so the ordinal rule composes its cardinal
 *  from exactly the data the engine's own number path uses. */
export function makePunjabiNormalizer(numbers: NumbersDef): (text: string) => string {
    const cardinal = (n: number): string[] => indicNumberWords(n, numbers).map((w) => w ?? "");

    /**
     * The ordinal: the cardinal with the suffix JOINED to its final word. Punjabi writes ਪੰਦਰਵੀਂ,
     * ਸੌਵਾਂ, ਨੱਬੇਵਾਂ as ONE word (the last two are in this repo's own pa.wikipron-pan-broad.tsv), and
     * emitting the suffix separately is exactly what made it a stray stressed syllable, [… ʋˈĩ].
     * The 1–4 suppletive ordinals (ਪਹਿਲਾ, ਦੂਜਾ, …) are NOT handled: no corpus ordinal is below 5, and
     * authoring the three agreement forms of each from no source would be invention.
     */
    const ordinal = (n: number, suffix: string): string | undefined => {
        const words = cardinal(n);
        if (words.length === 0 || words.some((w) => w === "")) return undefined;
        words[words.length - 1] = `${words[words.length - 1]}${suffix}`;
        return words.join(" ");
    };

    return (input: string): string => {
        // 0) HTML ENTITIES THAT `core/markup.ts` CANNOT SEE, and both misses are specific to a
        //    Perso-Arabic corpus. They must run BEFORE the symbol tier, whose ampersand rule reads EVERY
        //    ⟨&⟩ and so voices the entity NAME as a word.
        //
        //    · AN ENTITY TERMINATED BY THE ARABIC SEMICOLON ⟨؛⟩ U+061B. The shared decoder's pattern ends
        //      at an ASCII `;`, and pnb's dump has been through a punctuation conversion that rewrote the
        //      semicolon along with the comma and the question mark — INSIDE the entities too. The
        //      artifact's Archimedes sentence is the whole of it: `(؛ &nbsp؛ای.پو.&nbsp؛– &nbsp؛ای.پو.)`,
        //      3 instances against 20 correctly-terminated `&nbsp;` that the shared decoder already
        //      resolves. Read: *ˈət̪eː nbsp* — "and n-b-s-p" — which is the raw run this brief reports.
        //    · ⟨&lrm;⟩, the LEFT-TO-RIGHT MARK, ×7 and CORRECTLY terminated. It is simply not in the shared
        //      NAMED table, and an unknown entity is deliberately left literal there — right for a name
        //      nothing can render, wrong for this one, which is a bidi formatting hint and says nothing at
        //      all. It read *ˈət̪eː lˈɝm*, a leak no gate in the tree can see: the IPA token `lˈɝm` is not
        //      byte-identical to the source run `lrm`, so the raw-Latin differential never fires. ⚠ The
        //      general fix belongs in `core/markup.ts` beside `nbsp`; it is done locally here because this
        //      is the corpus that proves it, and an RTL bidi mark is a Perso-Arabic fact.
        //    An entity NOT in this list still falls through to the shared decoder unchanged.
        let s = input.replace(/&(nbsp|lrm|rlm|zwnj|zwj|amp|ndash|mdash)[;؛]/giu,
            (_m, name: string) => (name.toLowerCase() === "amp" ? "&" : name.toLowerCase() === "ndash" ? "–"
                : name.toLowerCase() === "mdash" ? "—" : name.toLowerCase() === "nbsp" ? " " : ""));

        // 1) THE SHARED SYMBOL TIER FIRST. It matches a sign only when a NUMBER is ADJACENT, and its own
        //    numeral pattern reads "2,500" / "2.3" as ONE token. Steps 2 and 3 below split exactly those
        //    into two tokens, so running them first would strand every sign on half a numeral. (This is
        //    units are resolved BEFORE decimals; here the sign tier precedes both.)
        s = SYMBOLS(s);

        // 2) DIGIT DE-GROUPING, before anything else that reads punctuation. A grouping comma is otherwise
        //    claimed by `clausePunctuation` as a phrase break AND it truncates the numeral: "1,000" was
        //    read as [ˈɪkː , sˈɪfəɾ] — "one, zero" — because the tokenizer's number class is `[0-9]+`
        //    with no separators, so the trailing "000" became its own number, 0.
        //    Both groupings: Indian 2-2-3 (1,00,000) and Western 3-3 (5,000,000). A final 3-digit group is
        //    REQUIRED, which is what keeps a list separator ("1990, 1991" — a space) out of the match.
        s = s.replace(/(?<![\d,])(\d{1,2}(?:,\d{2})+,\d{3})(?![\d,])/gu, (m) => m.replace(/,/gu, ""));
        s = s.replace(/(?<![\d,])(\d{1,3}(?:,\d{3})+)(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

        // 3) DECIMALS — after de-grouping (a grouped numeral may carry a decimal tail) and before the clock,
        //    so a stray dot cannot survive into a time match. The dot is NEUTRALISED, not spoken: there is
        //    no sourceable Gurmukhi spelling of the decimal-point word in this repo (see the header), and
        //    the defect being fixed is the SENTENCE BREAK the dot was producing mid-number
        //    ("2.3 ਅਰਬ ਡਾਲਰ" → [d̪ˈoː . …]). Dropping a sign beats speaking a word we cannot source.
        s = s.replace(/(\d)\.(?=\d)/gu, "$1 ");

        // 4) TIMES, before the unit and ordinal rules so a bare-number rule cannot claim 11:30 first.
        //    The colon was becoming a COMMA PAUSE ("eleven, twenty"). Punjabi reads the clock as bare
        //    juxtaposition plus ਵਜੇ (corpus ×9: "11:20 ਵਜੇ", "ਸਵੇਰੇ 10:00 ਵਜੇ"), so the colon becomes a
        //    space. At :00 the minutes DROP OUT — otherwise "10:00 ਵਜੇ" reads "ਦਸ ਸਿਫ਼ਰ ਵਜੇ", ten zero —
        //    and the corpus's own bare form ("ਲਗਭਗ 10 ਵਜੇ", "ਸਵੇਰੇ 5 ਵਜੇ") is then exactly what is left.
        //    The two-digit minute guard is load-bearing: the corpus also writes the ratio "3:2" and the
        //    degree classification "2:2", neither of which is a time and neither of which matches.
        s = s.replace(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu,
            (_m, h: string, min: string) => (Number(min) === 0 ? h : `${h} ${min}`));

        // 5) ORDINAL SUFFIXES. Written attached to the numeral (15ਵੀਂ) but tokenized apart from it, so the
        //    suffix was spoken as its own word. A space may intervene (18 ਵੀਂ ×2 in the corpus).
        //    THE TRAILING BOUNDARY IS LOAD-BEARING — without it the suffix matches the START of an
        //    ordinary word and glues it to the numeral. `\b` cannot express it: `\b` is ASCII-defined and
        //    finds nothing at all against Gurmukhi, so every boundary in this file is an explicit
        //    lookaround — `\b` is ASCII-defined and matches nothing against this script.
        s = s.replace(
            new RegExp(`(?<![\\d.,])(\\d+)\\s?(${ORDINAL_SUFFIXES.join("|")})(?![\\p{L}\\p{M}])`, "gu"),
            (whole, digits: string, suffix: string) => ordinal(Number(digits), suffix) ?? whole);

        // 6) GURMUKHI UNIT ABBREVIATIONS, only after a number — which is what keeps ਸੈਮੀ ਆਧੁਨਿਕ and
        //    ਫ਼ੋਟੋਗ੍ਰਾਫ਼ੀ out (none of those is preceded by a digit), and why neither key is declared at all.
        //    Longest first (see UNIT_ALT). The trailing guard stops ਮੀ. biting into a longer word.
        s = s.replace(new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

        // 7) ERA MARKER, before the ਡਾ. abbreviation rule so the generic single-dot rule cannot claim the
        //    bare ਈ. first. Both dots were surviving as phrase breaks ("1000 ਈ.ਪੂ. ਵਿੱਚ" → [ˈiː . pˈuː .]).
        //    ਈਸਾ ਪੂਰਵ is the corpus's own spelling of the expansion ("323 ਈਸਾ ਪੂਰਵ", "ਤੀਜੀ ਸਦੀ ਈਸਾ ਪੂਰਵ").
        s = s.replace(/(?<![\p{L}\p{M}])ਈ\.\s?ਪੂ\.?/gu, "ਈਸਾ ਪੂਰਵ");

        // 8) ABBREVIATION. The DOT IS REQUIRED here, unlike Hindi's डॉ — ਡਾ is a live word-medial sequence
        //    (ਸਾਡਾ, ਵੱਡਾ, ਕੈਨੇਡਾ), and the leading lookaround alone would not save a dot-optional rule from
        //    a word-FINAL ਡਾ. The dot is consumed so it cannot become a phrase break.
        s = s.replace(/(?<![\p{L}\p{M}])ਡਾ\.(\s+)(?=[\p{L}])/gu, (_m, sp: string) => `ਡਾਕਟਰ${sp}`);

        // 9) DEGREES. The bare sign was dropped outright. °C is left to emit ਡਿਗਰੀ + the Latin C: the
        //    Punjabi word for the scale is attested nowhere in this repo (see the header).
        s = s.replace(/(\d)\s?°/gu, "$1 ਡਿਗਰੀ");

        // THE ADDITIVE SIGNS. pa_in gives nothing usable — ਜਮਾਂ is ×0, ਪਲੱਸ appears only inside the brand
        // name ਮੈਟਰੋਪਲੱਸ, and ਜੋੜ is ×1 token against ×33 SUBSTRING (ਜੋੜੇ, "couples"). pa.wikipedia's arithmetic
        // article settles all of it, naming the sign and then READING an expression with operands:
        //
        //   "ਜੋੜ ਜਾਂ ਜਮ੍ਹਾਂ (ਜਿਸਨੂੰ ਆਮ ਤੌਰ 'ਤੇ "+" ਦੇ ਚਿੰਨ੍ਹ ਨਾਲ ਦਰਸਾਇਆ ਜਾਂਦਾ …)"   addition, denoted by the "+" sign
        //   "3 ਜਮ੍ਹਾਂ 2 ਬਰਾਬਰ 5 ਹਨ।"                                          3 PLUS 2 EQUALS 5
        //
        // ⚠ THE SECOND QUOTE ALSO CORROBORATES THE EQUALITY WORD SHIPPED BELOW, which was sourced independently
        // from the corpus (ਬਰਾਬਰ ×8). Evidence in both directions, from two different tiers.
        //
        // `ਘਟਾਓ` ×5 / 4 articles is the subtraction word, so ± is then this language's own two words juxtaposed —
        // the tier-1 route, at no further sourcing cost.
        //
        // ⚠ THE MINUS TAKES THE RANGE GUARD th NEEDED. The fleet convention rejects a sign with a space AFTER it,
        // which misses a range spaced only BEFORE the sign (`1000 -1300` read as a subtraction in th_th). A digit
        // anywhere to the left rejects the match: a negative quantity does not follow a number, a range does.
        s = s.replace(/±/gu, " ਜਮ੍ਹਾਂ ਘਟਾਓ ");
        s = s.replace(/(\d)\s?\+\s?(?=\d)/gu, "$1 ਜਮ੍ਹਾਂ ");
        s = s.replace(/(^|[\s(])\+\s?(?=\d)/gu, "$1ਜਮ੍ਹਾਂ ");
        s = s.replace(/(^|[\s(])[-−–](?=\d)/gu, (m0: string, pre: string, off: number, whole: string) =>
            /\d\s*$/u.test(whole.slice(0, off)) ? m0 : `${pre}ਘਟਾਓ `);

        // THE RELATIONAL AND DIVISION SIGNS, sourced ENTIRELY from pa_in:
        //
        //   `ਬਰਾਬਰ`     ×8 token    "ਬਰਾਬਰ ਜਾਂ ਇਸ ਪੱਖ ਅਨੁਪਾਤ ਦੇ ਲਗਪਗ ਨੇੜੇ" — EQUAL TO this aspect ratio
        //   `ਤੋਂ ਘੱਟ`    ×14 phrase   "ਚੀਜ਼ਾਂ ਤੋਂ ਘੱਟ ਪੁਰਾਣੇ" — less old THAN things
        //   `ਤੋਂ ਵੱਧ`    ×51 phrase
        //   `ਨਾਲ ਭਾਗ`   ×1          "ਬਾਰ੍ਹਾਂ ਨਾਲ ਭਾਗ ਕਰਨਾ" — FLEURS's parallel division sentence
        //
        // ⚠ THE COMPARATIVES ARE POSTPOSITIONAL (ਤੋਂ follows the standard), so they use core/postposedSign.ts;
        // an infix rule would read the comparison backwards.
        //
        // ⚠ AND `ਭਾਗ` IS A HOMOGRAPH: ×16 token, but the commonest sense in this corpus is "part / section"
        // ("100 ਫੁੱਟ ਚੌੜੇ ਭਾਗ" — a 100-foot wide SECTION), not division. It is nonetheless the division word —
        // `hi` ships the cognate भाग on its own wiki citation, and the parallel sentence puts this exact word in
        // the division slot here. The count is not the evidence; the parallel sentence is.
        s = postposedSign(s, "<", "ਤੋਂ ਘੱਟ");
        s = postposedSign(s, ">", "ਤੋਂ ਵੱਧ");
        s = s.replace(/\s?=\s?/gu, " ਬਰਾਬਰ ");
        s = s.replace(/\s?÷\s?/gu, " ਭਾਗ ");

        return s;
    };
}
