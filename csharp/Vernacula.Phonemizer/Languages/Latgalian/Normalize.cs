/**
 * Latgalian (ltg) TEXT NORMALIZATION — the pre-tokenizer pass. Pure text→text; no IPA.
 * Ported from src/languages/latgalian/normalize.ts, where every reading's corpus attestation lives.
 *
 * ⚠ NEVER `\b` — Latgalian carries ⟨ā ē ī ō ū y č š ž ģ ķ ļ ņ⟩, which `\b` treats as boundaries; the
 * boundary guards are `Boundaries.NOT_LETTER_BEFORE/AFTER`.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Latgalian;

public static class Normalize
{
    /**
     * The East-Baltic count form, and it is NOT a new claim: Numbers.cs already implements exactly this
     * rule as `Agree` for its own magnitude nouns. SINGULAR after a count ending in …1 but not …11 —
     * *21 procents*, *101 kilometrs* — and plural otherwise. A count with a FRACTION never takes the
     * singular, because `n % 10` of 21.5 is 1.5 and not 1, so the arithmetic handles it for free.
     */
    private static readonly Func<double, int> CountFormFn = n => n % 10 == 1 && n % 100 != 11 ? 0 : 1;

    /**
     * THE UNIT NOUNS. ⚠ EVERY ONE IS ATTESTED IN THE COUNTED SLOT on ltg.wikipedia, and for four of the six
     * the attested form is the OBLIQUE PLURAL rather than the nominative singular — the opposite direction
     * from Latvian's table. ⚠ `mm` IS DECLARED NOWHERE AND THAT IS DELIBERATE: `milimetri`/`milimetru` are
     * both ×0, and composing *mili-* + the attested `metru` would be inventing a word; it stays raw Latin
     * where the leak gate can see it. ⚠ AND `g` IS THE YEAR, not the gram — 32 against 1.
     */
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> UNITS =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = ["kilometrs", "kilometri"],
            ["m"] = ["metrs", "metri"],
            ["cm"] = ["ceņtimetrs", "ceņtimetri"],
            ["ha"] = ["hektars", "hektari"],
            ["kg"] = ["kilograms", "kilogrami"],
        };

    /**
     * The shared SYMBOL tier. ⚠ `kvadrat` IS `compound`: `kvadratkilometru` is ONE WORD in both
     * attestations, so `after` would emit *kilometri kvadrat* and `before` *kvadrat kilometri*, neither of
     * which is a word. ⚠ `$` IS NOT DECLARED — the sign is ×0 in the whole retained text, and a currency
     * name is worth declaring only when its SIGN occurs. ⚠ The magnitude list carries the DECLINED forms
     * the corpus writes, because declaring only a nominative lets the short form match and strand the
     * suffix — the defect Latvian's own list records.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = ["procents", "procenti"],
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["€"] = ["eura", "euru"],
        },
        Units = UNITS,
        ExponentWords = new ExponentWordsDef { Squared = ["kvadrat"], Position = ExponentPosition.Compound },
        Multiply = new MultiplyDef { Times = "reiz", By = "reiz" },
        Ampersand = "i",
        Magnitudes =
        [
            "miljardim", "milijardi", "milijonim", "triļjonim", "milijoni",
            "miljonu", "miļjoni", "miljoni", "tyukstūšys",
        ],
        CountForm = CountFormFn,
    });

    // ── THE ORDINAL PERIOD, in four arms ──────────────────────────────────────────────────────────────
    private static readonly JsRe ORD_BEFORE_DASH = JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.(?=\\s*[-–—]\\s*\\d)", "gu");
    private static readonly JsRe ORD_BEFORE_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.(?=,)", "gu");
    private static readonly JsRe ORD_MAIN = JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.(\\s*)(\\p{Ll})", "gu");

    /** ⚠ Each arm removes a dot that Latgalian orthography says is not a full stop, and nothing else. */
    private static string OrdinalPeriod(string text)
    {
        // …before a DASH, and this arm MUST run before the range step or the first endpoint of
        // `143.–153. lpp.` keeps its dot and the range pattern never sees two bare figures.
        var s = Rewrite(text, ORD_BEFORE_DASH, "$1");
        // …immediately before a COMMA, which a sentence-ending period never is.
        s = Rewrite(s, ORD_BEFORE_COMMA, "$1");
        // …and the main arm: whitespace-or-nothing plus a LOWER-CASE letter. A Latgalian sentence does not
        // continue in lower case, so the dot is an ordinal marker.
        // ⚠ THE GAP IS SUPPLIED WHEN THERE IS NONE (`1922.gods`), or a bare removal fuses the figure onto
        // the word and the number path cannot read the token at all.
        return Rewrite(s, ORD_MAIN, m =>
        {
            var gap = m.Groups[2].Value;
            return $"{m.Groups[1].Value}{(gap.Length > 0 ? gap : " ")}{m.Groups[3].Value}";
        });
    }

    // ── DEGREES ───────────────────────────────────────────────────────────────────────────────────────
    private static readonly JsRe DEG_WRITERS_GLOSS =
        JsRegex.Compile($"(\\d[\\d.,]*\\s+gradi)\\s+C{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe DEG_C =
        JsRegex.Compile($"(\\d)\\s?°\\s?C{Boundaries.NOT_LETTER_AFTER}", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°(?!\\s*gradi)", "gu");
    private static readonly JsRe DEG_LEFTOVER = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** ⚠ THE SCALE ARM RUNS FIRST AND CONSUMES THE LETTER, because a bare ⟨C⟩ left behind reads as
     *  Latgalian /t͡s/ — a plausible syllable, not audible garbage, so no leak class can see it.
     *  ⚠ AND THE WRITER'S OWN GLOSS IS READ TOO: `(–43 gradi C)` has the degree word already spelled and a
     *  bare ⟨C⟩ after it, so the sign-keyed arms cannot reach it. The word is re-emitted, not doubled. */
    private static string Degrees(string text)
    {
        var s = Rewrite(text, DEG_WRITERS_GLOSS, "$1 pa Celseja skolai");
        s = Rewrite(s, DEG_C, "$1 gradi pa Celseja skolai");
        s = Rewrite(s, DEG_BARE, "$1 gradi ");
        return Rewrite(s, DEG_LEFTOVER, "$1");
    }

    // ── THE ERA MARKER and the two "and others" abbreviations ─────────────────────────────────────────
    private static readonly JsRe ERA =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}p\\s?\\.\\s?Kr\\s?\\.", "gu");
    private static readonly JsRe UC = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}u\\.c\\.", "gu");
    private static readonly JsRe CT = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}ct\\.", "gu");
    private static readonly JsRe SENTENCE_END = JsRegex.Compile("^\\s*[\"»)']?\\s*$", "u");
    private static readonly JsRe NEXT_IS_CAPITAL = JsRegex.Compile("^\\s+\\p{Lu}", "u");

    /** The final period is KEPT at a sentence end, or the pause is lost outright. */
    private static bool AtSentenceEnd(string rest) => SENTENCE_END.IsMatch(rest) || NEXT_IS_CAPITAL.IsMatch(rest);

    // ── the remaining patterns ────────────────────────────────────────────────────────────────────────
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe MAG_ABBREV = JsRegex.Compile("(?<=\\d)(\\s*)(?:mln|mil)\\s?\\.", "gu");
    private static readonly JsRe PRODUCT = JsRegex.Compile("(?<=\\d)\\s?\\*\\s?(?=\\d)", "gu");
    private static readonly JsRe APPROX = JsRegex.Compile("[~≈]\\s*(?=[\\d])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d+)(?!\\d)", "gu");
    private static readonly JsRe LEADING_ZEROS = JsRegex.Compile("^0*", "u");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe RANGE_DASH = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe RANGE_HYPHEN =
        JsRegex.Compile("(?<![\\d.,\\-/])(\\d+)\\s?-\\s?(\\d+)(?![\\d/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe SPACE_RUNS = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** The Latgalian normalization pre-pass. The numbered order below is LOAD-BEARING. */
    public static string NormalizeLatgalian(string input)
    {
        var s = input;

        // 1) THE ERA MARKER, before any other rule spends one of its four periods.
        s = Rewrite(s, ERA, m =>
            AtSentenceEnd(s[(m.Index + m.Value.Length)..]) ? "pyrma Krystus." : "pyrma Krystus");

        // 2) THE TWO "AND OTHERS" ABBREVIATIONS, for the same reason — their dots are the same dots.
        //    ⚠ CASE-SENSITIVE, and Latvian's review found out why: personal INITIAL PAIRS are everywhere in
        //    this corpus (`O. Rupaiņs`, `R. K. Aggarwal`), and a case-insensitive `u.c.` introduces a surname.
        var afterEra = s;
        s = Rewrite(s, UC, m => AtSentenceEnd(afterEra[(m.Index + m.Value.Length)..]) ? "i cyti." : "i cyti");
        var afterUc = s;
        s = Rewrite(s, CT, m => AtSentenceEnd(afterUc[(m.Index + m.Value.Length)..]) ? "cyti." : "cyti");

        // 3) THE ORDINAL PERIOD — above the range step and above everything that consumes a dot.
        s = OrdinalPeriod(s);

        // 4) DE-GROUPING, BOTH MARKS, BEFORE THE TIER — a figure still grouped when the unit rule fires is
        //    the wrong quantity. ⚠ THE WHOLE NUMBER AT ONCE: a repeated two-digit join de-groups three
        //    groups correctly and four groups into a different number, and this corpus writes `9 223 766`.
        //    ⚠ AND THE TRAILING GUARD REJECTS A DIGIT AND NOTHING ELSE, or `700 000.` at a sentence end
        //    loses the whole grouping.
        s = Rewrite(s, GROUP_SPACE, m => m.Groups[1].Value + SPACES.Replace(m.Groups[2].Value, ""));
        //    …then the COMMA, by the three-digit test. The `(?!\d)` is what leaves `0,702804` alone — a
        //    fourth digit after the group means the comma was a decimal all along.
        s = Rewrite(s, GROUP_COMMA, m => m.Groups[1].Value + COMMAS.Replace(m.Groups[2].Value, ""));

        // 5) THE MAGNITUDE ABBREVIATIONS, before the tier so its magnitude hop can see them.
        //    ⚠ A PRECEDING DIGIT IS REQUIRED, because `mil` and `mln` unguarded are a fragment of any word.
        s = Rewrite(s, MAG_ABBREV, m =>
        {
            var gap = m.Groups[1].Value;
            return $"{(gap.Length > 0 ? gap : " ")}milijoni";
        });

        // 6) THE PRODUCT SIGN — digits on BOTH sides, which is the whole guard (the corpus's other asterisk
        //    is the biographical birth mark, `* ap 310—305 g. p. Kr.`).
        s = Rewrite(s, PRODUCT, " reiz ");

        // 7) THE APPROXIMATION SIGN — `apmāram 15% (~16 tyukstūšys)`.
        s = Rewrite(s, APPROX, "apmāram ");

        // 8) THE SHARED SYMBOL TIER — percent, currency, units, the squared exponent, magnitudes, `&`, `×`.
        s = SYMBOLS(s);

        // 9) DEGREES, after the tier (nothing in the tier touches `°`) and before the decimal step, which
        //    would otherwise have split `56,4°` away from its sign.
        s = Degrees(s);

        // 10) THE DECIMAL SEPARATORS, NEUTRALISED RATHER THAN SPOKEN, and running LAST because the tier
        //     matches `12,8 m` and `9,21%` as one figure-plus-symbol. ⚠ NO DECIMAL WORD IS SOURCEABLE:
        //     `komats` is ×0 and `punkts` is a FACILITY in every example.
        //     ⚠ EVERY LEADING ZERO IN THE FRACTION IS SPOKEN SEPARATELY — handing the fraction to the number
        //     path whole makes `5,09` and `5,9` identical, because the tokenizer reads `09` as nine: the
        //     quantity wrong by a factor of ten, in well-formed text, invisible to every gate.
        s = Rewrite(s, DECIMAL_COMMA, m =>
        {
            var head = m.Groups[1].Value;
            var frac = m.Groups[2].Value;
            var zeros = LEADING_ZEROS.Match(frac).Value;
            var rest = frac[zeros.Length..];
            var parts = new List<string> { head };
            parts.AddRange(zeros.Select(z => z.ToString()));
            if (rest.Length > 0) parts.Add(rest);
            return string.Join(" ", parts);
        });
        //     …then the DOT, and ONLY IF THE RUN CARRIES EXACTLY ONE. That guard is what declines the five
        //     dotted DATES this corpus writes (`07.02.1922`), which have two dots each.
        s = Rewrite(s, DECIMAL_DOT, "$1 $2");

        // 11) RANGES. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: this corpus writes `nu X da Y`
        //     in full wherever it means it. ⚠ RUNS AFTER THE DECIMAL STEP, so `0,6-0,8 cm` is already
        //     `0 6-0 8 cm` and the hyphen still sits between two digits.
        s = Rewrite(s, RANGE_DASH, "$1, ");
        s = Rewrite(s, RANGE_HYPHEN, "$1, $2");

        // A padded replacement doubles a space that was already there; SLOT-GAP is a defect class and this
        // pass should not be the one producing candidates for it.
        return Rewrite(s, SPACE_RUNS, " ");
    }
}
