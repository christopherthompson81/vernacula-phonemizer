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
 *
 * SOURCES. Every word emitted below is attested, and where it is, it is attested TWICE:
 *   ਪ੍ਰਤੀਸ਼ਤ  corpus ×6 (postposed: "32 ਪ੍ਰਤੀਸ਼ਤ")  + espeak-ng dictsource/pa_list `%  pR'VtIS@t`
 *   ਡਾਲਰ     corpus ×8 (postposed: "30 ਡਾਲਰ")      + pa_list (`$5` → d'Ol@R)
 *   ਡਿਗਰੀ    corpus ×4        ਵਜੇ corpus ×9        ਈਸਾ ਪੂਰਵ corpus ×2 ("323 ਈਸਾ ਪੂਰਵ")
 *   ਕਿਲੋਮੀਟਰ ×22, ਮੀਟਰ ×34, ਮਿਲੀਮੀਟਰ ×1, ਸੈਂਟੀਮੀਟਰ ×1, ਡਾਕਟਰ ×6, ਮਿਲੀਅਨ ×11, ਅਰਬ ×8, ਲੱਖ ×18,
 *   ਕਰੋੜ ×2, ਹਜ਼ਾਰ ×7 — all corpus-attested spellings.
 *
 * DELIBERATELY NOT DONE, each after measuring (a wrong word is worse than a dropped sign):
 *   - DECIMAL POINT WORD. espeak pa_list carries `_dpt  _d@s@ml'o:` — the PRONUNCIATION only — and the
 *     corpus never spells the word (ਦਸ਼ਮਲਵ ×0), so there is no sourceable Gurmukhi spelling in this repo.
 *     Step 3 therefore only NEUTRALISES the dot instead of speaking it. `numbers.decimalWord` is left unset.
 *   - ¥ (×3, the majority of the corpus's currency marks). ਯੇਨ is attested nowhere — not the corpus, not
 *     the referee, not pa_list. Left dropped.
 *   - RANGES `a-b` (×16). A blanket ਤੋਂ connective is wrong for HALF of them: 5-3, 21-20, 26-00, 6-6 and
 *     7-2 are SPORTS SCORES and 1995-96, 1418-1450, 1469-1539 are year spans. Only 8 (100-200 ਮੀਲ, 2-5
 *     ਦਿਨਾਂ, 2-3 ਕਿਲੋਮੀਟਰ, 10-60 ਮਿੰਟ, 35-40 ਮੀਲ, 56-64 ਕਿਲੋਮੀਟਰ, 120-160 ਘਣ ਮੀਟਰ, 4.2-3.9 ਲੱਖ) are true
 *     ranges, and separating them needs a measure-noun list this repo has no source for. The hyphen is
 *     already silent, which is the honest reading.
 *   - °C (×1). ਸੈਲਸੀਅਸ is unattested; step 8 emits ਡਿਗਰੀ and leaves the C to the Latin foreign path.
 *   - ਸੈਮੀ and ਗ੍ਰਾ are NOT unit keys. All ×3 ਸੈਮੀ in the corpus are ਸੈਮੀ ਆਧੁਨਿਕ / ਸੈਮੀਫਾਈਨਲ ("semi-"),
 *     and all ×18 ਗ੍ਰਾ are ਗ੍ਰਾਂਡ / ਫ਼ੋਟੋਗ੍ਰਾਫ਼ੀ / ਗ੍ਰਾਨਵਿਲੇ. Playbook trap #2, live in this corpus.
 */
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The SHARED symbol tier, with Punjabi's data. Punjabi count nouns do not inflect after a numeral
 * (ਇੱਕ ਡਾਲਰ / ਪੰਜ ਡਾਲਰ), so every `CountForms` here is a 1-element array.
 *
 * No `units`: the corpus contains essentially no Latin text at all (three runs in 1,589 utterances — Il,
 * Giancarlo, Fisichella), so Latin unit keys would be all risk and no reward. Punjabi writes its unit
 * abbreviations in Gurmukhi, which step 6 handles. No `magnitudeConnective`: Punjabi takes none
 * ("2.3 ਅਰਬ ਡਾਲਰ", corpus).
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["ਪ੍ਰਤੀਸ਼ਤ"],
    // #586 — `5 km` read as *pˈə̃ɲd͡ʒ ˈʊkm*: no unit was declared. Verified in pa_in:
    // ਕਿਲੋਮੀਟਰ ×31 "50 ਕਿਲੋਮੀਟਰ (31 ਮੀਲ) ਦੂਰ", ਮੀਟਰ ×17 "4892 ਮੀਟਰ ਮਾਉਂਟ ਵਿਨਸ".
    // ਕਿਲੋਗਰਾਮ is ×0 in the corpus and is left undeclared rather than taken from Wikidata's label alone.
    units: { km: ["ਕਿਲੋਮੀਟਰ"], m: ["ਮੀਟਰ"] },
    currency: { "$": ["ਡਾਲਰ"] },
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
 * ਮੀ. and ਸੈ.ਮੀ beats ਮੀ — this is the playbook's "multi-dot abbreviations before single-dot" coupling,
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
        // 1) THE SHARED SYMBOL TIER FIRST. It matches a sign only when a NUMBER is ADJACENT, and its own
        //    numeral pattern reads "2,500" / "2.3" as ONE token. Steps 2 and 3 below split exactly those
        //    into two tokens, so running them first would strand every sign on half a numeral. (This is
        //    the playbook's "units before decimals" coupling, one layer up: the sign tier before both.)
        let s = SYMBOLS(input);

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
        //    lookaround (playbook trap #1).
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

        return s;
    };
}
