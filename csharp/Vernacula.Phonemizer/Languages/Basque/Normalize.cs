/**
 * Basque / Euskara (eu) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ AN ISOLATE, SO THERE IS NO SIBLING TO READ AND NONE TO MIS-COPY. Trap 55 cannot bite here, and that
 * cuts both ways: every reading was sourced from Basque's own evidence, and where it could not be, the
 * class is declined — no ranges, no subtraction/times/division, no initialisms, no ampersand.
 *
 * ── THE ONE THING THAT MAKES THE CASE SUFFIX TRACTABLE ────────────────────────────────────────────────
 *
 * Basque glues a case ending to a figure and the ending's SHAPE depends on how the numeral is SPOKEN:
 * after a vowel `1980an`, after a consonant `1981ean`. That is trap 14 — agreement cannot be applied to
 * digits — and in Mongolian and Kazakh it forces the layer to CHOOSE the allomorph. ⚠ HERE IT DOES NOT,
 * BECAUSE THE AUTHOR HAS ALREADY CHOSEN IT: the suffix is written in the text, harmonised to the form the
 * writer had in mind, so the rule only has to ATTACH it to the last spoken word. The one exception is the
 * HYPHENATED form, where the ending is written bare and the linking vowel is supplied in speech — see
 * step 5, which declines it unless the head is vowel-final.
 * Ported from src/languages/basque/normalize.ts — see that file for the corpus counts, the sourcing of
 * every word, and the full account of what is deliberately not done.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Basque;

public static class Normalize
{
    /** The PERCENT reading, and the best-sourced word in this layer — the wiki states it DEFINITIONALLY and
     *  states the POSITION in the same sentence: *"batzuetan, euskara kasu, zenbakiaren aurretik jartzen da
     *  (ehuneko 5 esaten delako)"*. ⚠ The prefix position is a fact about SPEECH, not an inference from the
     *  corpus's typography (which writes `% 32,1` ×112); the two agree. */
    private const string PERCENT = "ehuneko";

    /** ⚠ THE SQUARE WORD IS A VARIANT CHOICE, NOT A CORRECTNESS ONE. Basque writes both `kilometro karratu`
     *  and `kilometro koadro`; the token count favours `koadro` but six of its seven corpus hits are ONE
     *  settlement-stub template repeated across six articles, while `karratu` carries the only real area
     *  figure in running prose. A count inside a repeated template is not evidence about the language.
     *  `karratu` is also the Euskaltzaindia form. ⚠ `kubiko` is thinner still (×1) and is declared on that
     *  instance plus its transparency. */
    private const string SQUARED = "karratu";
    private const string CUBED = "kubiko";

    /** The UNIT nouns. `metro` is counted WORD-BOUNDED (×5) rather than as a substring (×22 inside
     *  kilometro/diametro/parametro) — the bare substring is what makes it look better attested than it is. */
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> UNITS =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometro" },
            ["m"] = new[] { "metro" },
            ["kg"] = new[] { "kilogramo" },
            ["mm"] = new[] { "milimetro" },
        };

    /** RATE DENOMINATORS. Basque forms "per X" with the GENITIVE of the time noun rather than a preposition
     *  — `kilometro orduko` — so `UnitPer` is the empty string and the denominator carries the whole
     *  construction. ⚠ DENOMINATORS ONLY, never standalone: declaring `s` in Units so `m/s` could compose
     *  would also make a bare `76s` match — the tier's own documented hazard. */
    private static readonly IReadOnlyDictionary<string, string> RATE_DENOMINATORS =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "orduko", ["s"] = "segundoko" };

    /** THE DEGREE + SCALE reading. Both scales come from ONE attestation (`gradu Celsius` 7 tok / 6 arts,
     *  the same sentences supplying `gradu Fahrenheit`), so neither is inferred from the other. `gradu`
     *  alone is ×1 in the corpus and is the ANGULAR degree — which is why the bare sign is not claimed. */
    private const string DEGREE = "gradu";
    private static readonly IReadOnlyDictionary<string, string> SCALES =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["C"] = "Celsius", ["F"] = "Fahrenheit" };

    /** The DECIMAL separator word, from espeak's `dictsource/eu_list`: `_dpt _koma` — the separator's own
     *  name rather than the punctuation mark's, which is the distinction the shared sourcing check draws. */
    private const string DECIMAL_WORD = "koma";

    /** The CASE ENDINGS this rule will attach, exactly the set the corpus writes onto a figure and no more.
     *  ORDERED LONGEST-FIRST so `ean` is tried before `an` and `etik` before `tik`.
     *  ⚠ `m` ×3 AND `x` ×2 ARE IN THE SAME TABULATION AND ARE NOT ENDINGS — they are `5m` (a unit) and `2x`
     *  (a multiplication), which is why this is a CLOSED list rather than `[a-z]{1,4}`. */
    private static readonly string[] CASE_ENDINGS =
        ["etik", "eko", "ean", "era", "koa", "tik", "an", "ko", "ra", "en", "a", "n"];

    /** The shared symbol tier. Basque POSTPOSES its unit and currency nouns and PREFIXES the percent word,
     *  which the tier expresses directly. A Basque noun does not inflect for number after a numeral, so
     *  `CountForm` is constant.
     *  ⚠ A MAGNITUDE WORD SITS BETWEEN THE FIGURE AND THE UNIT, and without declaring it the number is not
     *  ADJACENT to the unit, the match fails, and `km` reaches the IPA raw. The words are the engine's own
     *  (basque.jsonc → mila, milioi), so this is a declaration rather than new vocabulary: `mila milioi` is
     *  the Euskaltzaindia-aligned billion that CardinalWords already composes. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { PERCENT },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["€"] = new[] { "euro" },
            ["£"] = new[] { "libera" },
            ["$"] = new[] { "dolar" },
        },
        Units = UNITS,
        Magnitudes = new[] { "mila milioi", "milioi", "mila" },
        RateDenominators = RATE_DENOMINATORS,
        UnitPer = "",
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { SQUARED },
            Cubed = new[] { CUBED },
            Position = ExponentPosition.After,
        },
        CountForm = _ => 0,
    });

    // ── The step patterns ───────────────────────────────────────────────────────────────────────────────

    /** 0) FOLD U+00BA `º` (MASCULINE ORDINAL INDICATOR) TO U+00B0 `°`. This corpus writes the wrong
     *  character almost as often as the right one (×12 against ×16), and two separate failures follow from
     *  not folding — step 2 keys on `°`, and `º` IS `\p{L}` (category Lo) so it also satisfied step 6's
     *  trailing letter guard and the decimal comma beside it stayed a PAUSE.
     *  ⚠ SAFE HERE BECAUSE BASQUE DOES NOT WRITE ORDINALS THIS WAY: its ordinal is `1.`/`1go`, not `1º`. */
    private static readonly JsRe ORDINAL_INDICATOR = JsRegex.Compile("\\u00BA", "gu");

    /** 1) THOUSANDS DE-GROUPING, first, because every later rule needs the figure to be one digit run and
     *  the grouping mark here is the PERIOD. ⚠ THE TRAILING GUARD IS `(?!\d)` AND NOT `(?![\d.,])` — trap
     *  58: a clause mark after a grouped figure is not a continuation of the number. */
    private static readonly JsRe DOT_GROUPED =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:\\.\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    /** …AND THE SPACE-GROUPED FORM (×5). A wiki that writes `44.579.000` also writes `40 091`. */
    private static readonly JsRe SPACE_GROUPED =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:[ \\u00a0\\u202f\\u2009]\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    /** 2) THE DEGREE SIGN WITH A SCALE LETTER. ⚠ THE DEFECT WAS NOT SILENCE: the `°` dropped and ⟨C⟩ reached
     *  the g2p as a Basque LETTER, read /k/ — a plausible phoneme with no basis (trap 56), which no leak
     *  class can see. ⚠ THE BARE `°` IS DELIBERATELY NOT CLAIMED: the corpus's bare-`°` instances are
     *  coordinates, and claiming the sign without its scale would put a temperature word on a latitude. */
    private static readonly JsRe DEGREE_SCALE =
        JsRegex.Compile("(\\d)[ \\u00a0]?°[ \\u00a0]?([CF])(?![\\p{L}\\p{M}])", "gui");  // space, NBSP

    /** 3) THE CASE ENDING GLUED TO THE **UNIT** — the same morpheme as step 5 attached to the other side of
     *  the quantity (trap 15). ⚠ THE HYPHEN OR THE EXPONENT MUST BE PRESENT, and that is the whole guard:
     *  without it a one-letter key plus a two-letter ending claims ordinary words (`m`+`an` is *man*).
     *  ⚠ THE BARE ENDING IS ALWAYS RIGHT HERE because every noun in UNITS is VOWEL-final, so Basque supplies
     *  no linking vowel — a property of this table rather than of the language, checked rather than assumed.
     *  ⚠ THE RATE CARRIES IT TOO, and leaving that out DOUBLED the morpheme rather than stranding it:
     *  `km/h-ko` fell through to the tier, which saw the HYPHEN rather than a letter, matched happily and
     *  left the writer's own `-ko` beside its own — *bost kilometro orduko ko*. Matched BEFORE the bare-unit
     *  arm so `km/h-ko` cannot be claimed as `km` plus stray text. */
    private static readonly string UNIT_ALT =
        string.Join("|", UNITS.Keys.OrderByDescending(k => k.Length));
    private static readonly string DENOM_ALT = string.Join("|", RATE_DENOMINATORS.Keys);
    private static readonly string ENDING_ALT = string.Join("|", CASE_ENDINGS);
    private static readonly JsRe UNIT_RATE_ENDING = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({UNIT_ALT})/({DENOM_ALT})-({ENDING_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe TRAILING_KO = JsRegex.Compile("ko$", "u");
    private static readonly JsRe UNIT_ENDING = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({UNIT_ALT})(?:(²|³)-?|-)({ENDING_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");

    /** 4b) THE NEGATIVE SIGN — a sign attached to an amount, with no left operand. ⚠ THIS FIXES A SEMANTIC
     *  ERROR, NOT A SILENCE: the corpus's record low temperatures were dropping the sign and reading as
     *  POSITIVE — wrong by 178 degrees and invisible to every gate. ⚠ SUBTRACTION STAYS REFUSED: the same
     *  wiki article that sources `minus` gives the OPERATOR a different word (*hamar KEN zazpi*).
     *  ⚠ THE LOOKBEHIND SPANS WHITESPACE so `2.000 – 1.000` is refused; the EN DASH is excluded and the
     *  PERIOD is in the left guard (a parenthetical `–700 inguru–` and a spaced ordinal range `21. - 29.`
     *  were both read as negatives by the first cut); and there is NO SPACE between sign and figure, which
     *  is what separates a negative from the label-value dash of wiki list prose (`Bilbo - 400.000`). */
    private static readonly JsRe NEGATIVE =
        JsRegex.Compile("(?<![\\d.]\\s{0,3})(?<![\\p{L}\\p{M}.,])[\\u2212-](?=\\d)", "gu");

    /** 5) THE CASE ENDING GLUED TO A FIGURE — the largest class in this corpus at ×296. The ending is
     *  RE-EMITTED, NOT DERIVED. ⚠ AFTER THE TIER, because a figure can carry BOTH a sign and an ending
     *  (`% 80ko`). ⚠ AND THE FIGURE MAY CARRY A DECIMAL, which fell between the two steps in the first cut.
     *  ⚠ AND THE ENDING MAY BE HYPHENATED — Basque writes both `1980an` and `995-ko`. */
    private static readonly JsRe FIGURE_ENDING = JsRegex.Compile(
        $"(?<![\\d.,\\p{{L}}\\p{{M}}])(\\d+)(?:,(\\d+))?(-?)({ENDING_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe VOWEL_FINAL = JsRegex.Compile("[aeiou]$", "u");

    /** 6) THE DECIMAL COMMA → `koma`. It was reaching clausePunctuation and becoming a PAUSE inside a
     *  number (×120 in the retained text). ⚠ LAST OF THE NUMERIC RULES. ⚠ THE GUARDS EXCLUDE A MULTI-COMMA
     *  RUN on both sides (leaving a comma-separated LIST alone) and a trailing letter (leaving an
     *  ending-carrying figure to step 5); a following clause mark is NOT excluded (trap 58). */
    private static readonly JsRe DECIMAL_COMMA =
        JsRegex.Compile("(?<![\\d,])(\\d+),(\\d+)(?![\\d,\\p{L}\\p{M}])", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_WS = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** Basque text normalization. A numbered, ORDER-DEPENDENT sequence; each step states its coupling. */
    public static string NormalizeBasque(string input)
    {
        var s = input;

        // 0) Fold the masculine ordinal indicator onto the degree sign.
        s = Rewrite(s, ORDINAL_INDICATOR, "°");

        // 1) Thousands de-grouping, first — the grouping mark is the PERIOD, so left alone it reads as a
        //    sentence break INSIDE a number.
        s = Rewrite(s, DOT_GROUPED, m => DOTS.Replace(m.Value, ""));
        s = Rewrite(s, SPACE_GROUPED, m => SPACE_SEPS.Replace(m.Value, ""));

        // 2) The degree sign with a scale letter — before the tier, so the scale letter cannot be mistaken
        //    for a unit key, and before step 6 so the operand is still one figure.
        s = Rewrite(s, DEGREE_SCALE, m =>
            $"{m.Groups[1].Value} {DEGREE} {SCALES[m.Groups[2].Value.ToUpperInvariant()]}");

        // 3) The case ending glued to the UNIT, before the tier, whose trailing guard refuses a letter after
        //    a unit key and therefore declined the whole match — leaving a raw `km` in the IPA.
        s = Rewrite(s, UNIT_RATE_ENDING, m =>
        {
            var unit = m.Groups[1].Value;
            var denom = m.Groups[2].Value;
            var ending = m.Groups[3].Value;
            var stem = TRAILING_KO.Replace(RATE_DENOMINATORS[denom], "");
            return $"{UNITS[unit][0]} {stem}{(ending is "ko" or "koa" ? ending : $"ko{ending}")}";
        });
        s = Rewrite(s, UNIT_ENDING, m =>
        {
            var noun = UNITS[m.Groups[1].Value][0];
            var exp = m.Groups[2].Success ? m.Groups[2].Value : null;
            // ⚠ THE ENDING GLUES TO THE LAST WORD EMITTED — `km²ko` is *kilometro karratuko*, not
            // *kilometroko karratu*: the exponent modifier is the head of the phrase and carries the case.
            var mod = exp == "²" ? $" {SQUARED}" : exp == "³" ? $" {CUBED}" : "";
            return $"{noun}{mod}{m.Groups[3].Value}";
        });

        // 4) The shared symbol tier — percent (PREFIXED), currency, units, the km²/km³ exponent and the
        //    km/h, km/s rates. ⚠ IT MUST RUN BEFORE STEP 6, and that ordering is the whole reason the
        //    decimal step is late: the tier matches a number ADJACENT to its sign or unit, and Basque's
        //    decimal separator is a comma inside that number.
        s = SYMBOLS(s);

        // 4b) The negative sign.
        s = Rewrite(s, NEGATIVE, "minus ");

        // 5) The case ending glued to a figure.
        s = Rewrite(s, FIGURE_ENDING, m =>
        {
            var whole = m.Value;
            var n = Js.Number(m.Groups[1].Value);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0 || n >= 1e12) return whole;
            var head = BasquePhonemizer.CardinalWords(n);
            if (head == "") return whole;
            var hyphen = m.Groups[3].Value;
            var ending = m.Groups[4].Value;
            // ⚠ A HYPHEN CHANGES THE CONTRACT, AND THIS IS THE ONE PLACE THE HEADER'S CLAIM DOES NOT HOLD.
            // The claim is that the writer has already chosen the allomorph — true of the GLUED form, where
            // `1980an` and `1981ean` are two different spellings. It is NOT true of the hyphenated form: the
            // hyphen exists precisely so the ending can be written BARE and the linking vowel supplied in
            // speech, so `995-ko` is spoken *…hamabostEKO*, not *…hamabostko*, which is not a word. Deriving
            // that vowel is the Mongolian problem this layer was written to avoid, so the hyphen is accepted
            // only where the bare ending is provably right — after a VOWEL-final word, where Basque adds
            // nothing.
            if (hyphen != "" && !VOWEL_FINAL.IsMatch(head)) return whole;
            if (!m.Groups[2].Success) return $"{head}{ending}";
            return GlueFraction(head, m.Groups[2].Value, ending) ?? whole;
        });

        // 6) The decimal comma → `koma`.
        s = Rewrite(s, DECIMAL_COMMA, m =>
            $"{m.Groups[1].Value} {DECIMAL_WORD} {FractionDigits(m.Groups[2].Value)}");

        return Tidy(s);
    }

    /**
     * ⚠ A LEADING ZERO IN THE FRACTION IS PART OF THE QUANTITY, AND DROPPING IT IS A WRONG NUMBER.
     *
     * The fraction is read as a NUMBER here (`93,55` is *koma berrogeita hamabost*, not five-five) — but
     * handing `09` to a cardinal compositor yields *bederatzi*, so `5,09` and `5,9` came out BYTE-IDENTICAL.
     * That is trap 56 in its purest form: every word is well-formed Basque, the quantity is wrong by a
     * factor of ten, and no leak class, DROP or referee can see it. Each leading zero is SPOKEN, then the
     * remainder is left as digits for the engine's own number branch to read.
     */
    private const string ZERO = "zero";

    private static int LeadingZeros(string frac)
    {
        var z = 0;
        while (z < frac.Length && frac[z] == '0') z++;
        return z;
    }

    private static string FractionDigits(string frac)
    {
        var zeros = LeadingZeros(frac);
        var rest = frac[zeros..];
        var lead = string.Join(" ", Enumerable.Repeat(ZERO, zeros));
        return rest == "" ? lead : lead == "" ? rest : $"{lead} {rest}";
    }

    /** The same, as WORDS, for step 5 — where the ending has to glue to the last one. `null` declines the
     *  match rather than guessing, and the magnitude bound mirrors the integer head's: without it a 14-digit
     *  fraction was fed to the compositor and came back as twenty-five words. */
    private static string? GlueFraction(string head, string frac, string ending)
    {
        var zeros = LeadingZeros(frac);
        var rest = frac[zeros..];
        var lead = Enumerable.Repeat(ZERO, zeros).ToList();
        if (rest == "")
        {
            var parts = lead.Take(Math.Max(0, lead.Count - 1)).Append($"{ZERO}{ending}");
            return $"{head} {DECIMAL_WORD} {string.Join(" ", parts)}";
        }
        var f = Js.Number(rest);
        if (!(double.IsInteger(f) && Math.Abs(f) <= 9007199254740991.0) || f >= 1e12) return null;
        var words = BasquePhonemizer.CardinalWords(f);
        if (words == "") return null;
        return $"{head} {DECIMAL_WORD} {string.Join(" ", lead.Append($"{words}{ending}"))}";
    }

    /** ⚠ A padded replacement doubles a space that was already there and can leave one at an edge. SLOT-GAP
     *  is a corpus-diff defect class; this pass may not feed it. */
    private static string Tidy(string s) => Rewrite(Rewrite(s, WS_RUN, " "), EDGE_WS, "");
}
