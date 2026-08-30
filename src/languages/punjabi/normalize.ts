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
import { MANIFEST } from "./manifest.ts";
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { rewrite } from "../../core/provenance.ts";

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
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    ampersand: MANIFEST.symbolTier.ampersand,
    multiply: MANIFEST.symbolTier.multiply,
});

/** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
const ORDINAL_SUFFIXES = MANIFEST.ordinalSuffixes;

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
        //      byte-identical to the source run `lrm`, so the raw-Latin differential never fires.
        //      ⚠ THE GENERAL FIX HAS SINCE LANDED — `lrm` and `zwnj` are in the shared `NAMED` table, which
        //      runs FIRST (registry.ts, before this file), so those two names no longer reach this arm at
        //      all. It is kept because the ARABIC-SEMICOLON arm below is not general and cannot be: the
        //      shared decoder's pattern ends at an ASCII `;`, and `&nbsp؛` is a fact about this dump.
        //    An entity NOT in this list still falls through to the shared decoder unchanged.
        // ⚠ ON THE SEAM — the entity fold runs on the PIPELINE STRING (#1179).
        let s = rewrite(input, /&(nbsp|lrm|rlm|zwnj|zwj|amp|ndash|mdash)[;؛]/giu,
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
        s = rewrite(s, /(?<![\d,])(\d{1,2}(?:,\d{2})+,\d{3})(?![\d,])/gu, (m) => m.replace(/,/gu, ""));
        s = rewrite(s, /(?<![\d,])([1-9]\d{0,2}(?:,\d{3})+)(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

        // 3) DECIMALS — after de-grouping (a grouped numeral may carry a decimal tail) and before the clock,
        //    so a stray dot cannot survive into a time match. The dot is NEUTRALISED, not spoken: there is
        //    no sourceable Gurmukhi spelling of the decimal-point word in this repo (see the header), and
        //    the defect being fixed is the SENTENCE BREAK the dot was producing mid-number
        //    ("2.3 ਅਰਬ ਡਾਲਰ" → [d̪ˈoː . …]). Dropping a sign beats speaking a word we cannot source.
        s = rewrite(s, /(\d)\.(?=\d)/gu, "$1 ");

        // 4) TIMES, before the unit and ordinal rules so a bare-number rule cannot claim 11:30 first.
        //    The colon was becoming a COMMA PAUSE ("eleven, twenty"). Punjabi reads the clock as bare
        //    juxtaposition plus ਵਜੇ (corpus ×9: "11:20 ਵਜੇ", "ਸਵੇਰੇ 10:00 ਵਜੇ"), so the colon becomes a
        //    space. At :00 the minutes DROP OUT — otherwise "10:00 ਵਜੇ" reads "ਦਸ ਸਿਫ਼ਰ ਵਜੇ", ten zero —
        //    and the corpus's own bare form ("ਲਗਭਗ 10 ਵਜੇ", "ਸਵੇਰੇ 5 ਵਜੇ") is then exactly what is left.
        //    The two-digit minute guard is load-bearing: the corpus also writes the ratio "3:2" and the
        //    degree classification "2:2", neither of which is a time and neither of which matches.
        s = rewrite(s, /(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu,
            (_m, h: string, min: string) => (Number(min) === 0 ? h : `${h} ${min}`));

        // 5) ORDINAL SUFFIXES. Written attached to the numeral (15ਵੀਂ) but tokenized apart from it, so the
        //    suffix was spoken as its own word. A space may intervene (18 ਵੀਂ ×2 in the corpus).
        //    THE TRAILING BOUNDARY IS LOAD-BEARING — without it the suffix matches the START of an
        //    ordinary word and glues it to the numeral. `\b` cannot express it: `\b` is ASCII-defined and
        //    finds nothing at all against Gurmukhi, so every boundary in this file is an explicit
        //    lookaround — `\b` is ASCII-defined and matches nothing against this script.
        s = rewrite(s,
            new RegExp(`(?<![\\d.,])(\\d+)\\s?(${ORDINAL_SUFFIXES.join("|")})(?![\\p{L}\\p{M}])`, "gu"),
            (whole, digits: string, suffix: string) => ordinal(Number(digits), suffix) ?? whole);

        // 6) GURMUKHI UNIT ABBREVIATIONS, only after a number — which is what keeps ਸੈਮੀ ਆਧੁਨਿਕ and
        //    ਫ਼ੋਟੋਗ੍ਰਾਫ਼ੀ out (none of those is preceded by a digit), and why neither key is declared at all.
        //    Longest first (see UNIT_ALT). The trailing guard stops ਮੀ. biting into a longer word.
        s = rewrite(s, new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

        // 7) ERA MARKER, before the ਡਾ. abbreviation rule so the generic single-dot rule cannot claim the
        //    bare ਈ. first. Both dots were surviving as phrase breaks ("1000 ਈ.ਪੂ. ਵਿੱਚ" → [ˈiː . pˈuː .]).
        //    ਈਸਾ ਪੂਰਵ is the corpus's own spelling of the expansion ("323 ਈਸਾ ਪੂਰਵ", "ਤੀਜੀ ਸਦੀ ਈਸਾ ਪੂਰਵ").
        s = rewrite(s, /(?<![\p{L}\p{M}])ਈ\.\s?ਪੂ\.?/gu, "ਈਸਾ ਪੂਰਵ");

        //    ⚠ AND THE SHAHMUKHI HALF HAS AN ERA MARKER TOO, WRITTEN AS A BARE HAMZA. `1238 ء وچ` is
        //    "in 1238 CE": ⟨ء⟩ after a year abbreviates عیسوی, exactly as ⟨ਈ.ਪੂ.⟩ abbreviates ਈਸਾ ਪੂਰਵ above.
        //    Unread it is silent content loss on a DATE — `silentCharsIn` reports ⟨ء⟩ ×158 in pnb, and ×126 of
        //    those are this standalone marker rather than a hamza inside a word.
        //    ⚠ THE EXPANSION IS THE CORPUS'S OWN. pnb writes both forms, in the same construction, in the same
        //    artifact: `874 عیسوی وِچّ` and `985 عیسوی وِچّ` against `1238 ء وچ` and `57 ء وچ` — 10 spelled-out
        //    against 126 abbreviated, so nothing here is supplied from outside the text.
        //    ⚠ A PRECEDING DIGIT IS REQUIRED, and that is what keeps the rule off the ordinary word-final hamza
        //    of an Arabic loan (علماء, اشیاء, فضاء), which is correctly SILENT in a language with no /ʔ/ — see
        //    the ʔ-removal in punjabi.ts. Attached (`2016ء`) and spaced (`1238 ء`) are both attested.
        s = rewrite(s, /(\d)\s?ء(?![\p{L}\p{M}])/gu, "$1 عیسوی");

        // 8) ABBREVIATION. The DOT IS REQUIRED here, unlike Hindi's डॉ — ਡਾ is a live word-medial sequence
        //    (ਸਾਡਾ, ਵੱਡਾ, ਕੈਨੇਡਾ), and the leading lookaround alone would not save a dot-optional rule from
        //    a word-FINAL ਡਾ. The dot is consumed so it cannot become a phrase break.
        s = rewrite(s, /(?<![\p{L}\p{M}])ਡਾ\.(\s+)(?=[\p{L}])/gu, (_m, sp: string) => `ਡਾਕਟਰ${sp}`);

        // 9) DEGREES. The bare sign was dropped outright. °C is left to emit ਡਿਗਰੀ + the Latin C: the
        //    Punjabi word for the scale is attested nowhere in this repo (see the header).
        s = rewrite(s, /(\d)\s?°/gu, "$1 ਡਿਗਰੀ");

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
        s = rewrite(s, /±/gu, " ਜਮ੍ਹਾਂ ਘਟਾਓ ");
        s = rewrite(s, /(\d)\s?\+\s?(?=\d)/gu, "$1 ਜਮ੍ਹਾਂ ");
        s = rewrite(s, /(^|[\s(])\+\s?(?=\d)/gu, "$1ਜਮ੍ਹਾਂ ");
        s = rewrite(s, /(^|[\s(])[-−–](?=\d)/gu, (m0: string, pre: string, off: number, whole: string) =>
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
        s = rewrite(s, /\s?=\s?/gu, " ਬਰਾਬਰ ");
        s = rewrite(s, /\s?÷\s?/gu, " ਭਾਗ ");

        return s;
    };
}
