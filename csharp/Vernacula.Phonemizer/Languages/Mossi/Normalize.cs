/**
 * Mooré / Mossi (mos) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/mossi/normalize.ts, whose header carries the corpus counts behind every
 * word chosen and the check that refused every class deliberately declined (no percent word, no
 * decimal-point word, no clock, no range joiner, no £, no °/=/×, no abbreviations, no ordinals).
 * Nothing is re-derived here.
 *
 * ⚠ THERE IS NO FLEURS FOR MOORÉ, NO KAIKKI AND NO WIKIPRON, AND espeak DOES NOT SHIP THE LANGUAGE.
 * The 39-word wiktionary referee is a TRIPWIRE for the word path and cannot arbitrate one line of
 * this file. The evidence is the mos.wikipedia dump, filtered to Mooré — see the TS for which count
 * says which.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Mossi;

public static class Normalize
{
    // ⚠ THE THOUSANDS SEPARATOR IS THREE DIFFERENT CHARACTERS IN THIS CORPUS AND TWO OF THEM ALSO WRITE
    // THE DECIMAL POINT. What separates the two roles is the DIGIT COUNT after the mark — exactly three,
    // anchored both sides. ⚠ THE TRAILING GUARD IS `(?!\d)`, NOT `(?![\d.,])`: a plain separator guard
    // rejected every CLAUSE-FINAL grouped figure (`50 000.` came back untouched) and the mixed-
    // convention number where a period-group is followed by the decimal comma (`764.387,59`). Rejecting
    // only a following digit is what the lookbehind-plus-lookahead pair needs.
    // space, NBSP, NNBSP, thin space
    private static readonly JsRe GROUPED_SPACE = JsRegex.Compile(
        @"(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)", "gu");
    private static readonly JsRe GROUPED_COMMA = JsRegex.Compile(
        @"(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)", "gu");
    private static readonly JsRe GROUPED_DOT = JsRegex.Compile(
        @"(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)", "gu");

    // Step 2. ⚠ THE ZERO-WIDTH CLASS IS FIVE CHARACTERS, one of them the BOM — the TS spells them
    // invisibly; escaped here so the class reads.
    private static readonly JsRe HTML_ENTITY = JsRegex.Compile(@"&nbsp;|&#(?:x[0-9a-f]+|\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile(@"[\u200b\u200c\u200d\u2060\ufeff]", "gu");

    // Step 3, the separator strips inside the de-grouping callbacks.
    private static readonly JsRe GROUP_SPACE_ALL = JsRegex.Compile(@"[ \u00a0\u202f\u2009]", "gu");
    private static readonly JsRe COMMA_ALL = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOT_ALL = JsRegex.Compile("\\.", "gu");

    /** ⚠ THE CURRENCY NOUN COMES BEFORE THE FIGURE IN MOORÉ, so this rule REORDERS rather than
     *  postposing. `Ero` and `doolaar` are the two signs this layer can source (see the TS header);
     *  `£` is declined and stays unread. The figure is re-emitted as digits and the engine's own
     *  number path speaks it. */
    private static readonly (string Sign, string Word)[] CURRENCY =
    [
        ("€", "Ero"),
        ("$", "doolaar"),
    ];

    /** The currency-key escape, the TS `sign.replace(/[$]/gu, "\\$&")`. */
    private static readonly JsRe DOLLAR_ESC = JsRegex.Compile("[$]", "gu");

    /** Step 5. ⚠ THE EXPONENT IS CONSUMED AND UNREAD — a stated loss (see the TS header), not a fix;
     *  what it replaces is a raw `km` plus the exponent claimed as the CARDINAL TWO. */
    private static readonly JsRe KM_PRE = JsRegex.Compile(
        @"(?<![\p{L}\p{M}\d])km(?:\^?2|²)?\s+(?=\d)", "gu");
    private static readonly JsRe KM_POST = JsRegex.Compile(
        @"(?<![\d.,\p{L}\p{M}])(\d+(?:[.,]\d+)?(?:\s?-{1,2}\s?\d+(?:[.,]\d+)?)?)\s?km(?:\^?2|²)?(?![\p{L}\p{M}\d²³\/])", "gu");

    /** The bare-token pass for the same word — a caption or a table header, or a figure a bracket put
     *  out of reach. Shared guards (Core/NormalizeSymbols.cs): multi-letter vowel-free keys, exact
     *  case, never beside a numeral, a rate slash or an exponent — so the `km²` refusal above is
     *  untouched. */
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(
        new[] { new KeyValuePair<string, string>("km", "kilometr") });

    /** Mooré normalization. A numbered, order-dependent sequence; the coupling is stated at each step. */
    public static string NormalizeMossi(string input)
    {
        // 1) NFC at the entry, so a literal in this file matches whichever normalization the dump used.
        //    Mooré's own letters ⟨ɛ ɩ ʋ ŋ⟩ do not decompose, but its NASAL vowels are written with a
        //    combining tilde that has precomposed equivalents for ⟨ã ẽ ĩ õ ũ⟩ and none for
        //    ⟨ɛ̃ ɩ̃ ʋ̃⟩, so one paragraph carries both forms.
        var s = Renormalize(input, NormalizationForm.FormC);

        // 2) HTML ENTITIES AND ZERO-WIDTH MARKS, before anything that counts characters — `&nbsp;`
        //    inside a grouped figure would otherwise hide the space that step 3 matches on.
        s = Rewrite(Rewrite(s, HTML_ENTITY, " "), ZERO_WIDTH, "");

        // 3) DIGIT DE-GROUPING — FIRST among the number rules: a grouping comma or period is otherwise
        //    read as CLAUSE PUNCTUATION, dropping a pause into the middle of one figure.
        //    ⚠ SPACE FIRST, then comma, then dot — the space arm must run before any rule that inserts
        //    a space between a figure and a following word, and step 4 is one. ⚠ THE CALLBACK STRIPS
        //    SEPARATORS FROM A CAPTURED SLICE, so it stays on JsRe.Replace, not the seam.
        s = Rewrite(s, GROUPED_SPACE, m => m.Groups[1].Value + GROUP_SPACE_ALL.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, GROUPED_COMMA, m => m.Groups[1].Value + COMMA_ALL.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, GROUPED_DOT, m => m.Groups[1].Value + DOT_ALL.Replace(m.Groups[2].Value, ""));

        // 4) CURRENCY, AFTER de-grouping — the sign is written against the figure's FIRST digit
        //    (€10,000), so matching the whole figure here means matching what step 3 has already
        //    joined up. The noun is emitted BEFORE the figure: Mooré puts it there.
        foreach (var (sign, word) in CURRENCY)
        {
            var rx = JsRegex.Compile($"{DOLLAR_ESC.Replace(sign, "\\$&")}\\s?(\\d)", "gu");
            s = Rewrite(s, rx, $"{word} $1");
        }

        // 5) THE KILOMETRE, LAST — and AFTER step 3 for the same reason step 4 is: the symbol is
        //    written against a grouped figure (18,476km, km 3,245), so the operand this rule re-emits
        //    has to be the one de-grouping has already joined up. It does not interact with step 4.
        //    ⚠ PRE-ARM FIRST. The two arms are disjoint by construction (KM_PRE demands
        //    whitespace-then-digit after the symbol, KM_POST demands a digit before it), so the order
        //    is documentation rather than load-bearing — but running the native-order arm first keeps
        //    the reordering arm from ever seeing a figure that was already correctly placed.
        s = Rewrite(s, KM_PRE, "kilometr ");
        s = Rewrite(s, KM_POST, "kilometr $1");
        s = BARE_UNITS(s);

        return s;
    }
}
