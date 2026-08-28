/**
 * Bavarian (bar) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Pure text→text, no IPA.
 *
 * Ported from src/languages/bavarian/normalize.ts, whose header and per-step notes carry the corpus counts
 * behind every word, every guard and every refusal (the decimal comma, the math signs, the initialisms, the
 * year reading, the era markers), plus the warning that 24.0% of the bar.wikipedia dump is not Bavarian.
 * Nothing is re-derived here.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Bavarian;

public static class Normalize
{
    /** Month names in the Bavarian spellings — what the ordinal detector matches AFTER the dot. */
    private const string MONTHS =
        "Jenna|Jänna|Jänner|Januar|Feba|Februar|Meaz|März|Aprui|Aprü|April|Mai|Juni|Julei|Juli"
        + "|August|Septemba|September|Oktoba|Oktober|Novemba|November|Dezemba|Dezember";

    /** The other nouns that license an ordinal reading (a pattern, not a list: `Joahundat` has four
     *  spellings in 246 segments, which is what having no codified orthography costs a detector). */
    private const string ORDINAL_NOUN =
        "Jo(?:a|ar|our)h+und(?:at|ad|eascht|ert)s?|Jh|Beziak|Person|Lebm?s?joar|Lebensjoar|Buachstob|Auflage";

    /** The Bavarian article and preposition forms that may precede an `N.`. */
    private static readonly HashSet<string> LICENSER =
    [
        "am", "om", "im", "vom", "zum", "beim", "ins", "seitm", "seit", "ausm", "aus", "bis", "nach", "noch",
        "vo", "von", "da", "dea", "de", "des", "dem", "den", "d", "ois", "as", "s",
    ];

    private static IReadOnlyDictionary<string, string> ORDINAL => Manifest.MANIFEST.OrdinalStems;

    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    [
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])z\\.\\s?B\\.", "giu"), "zum Beispui"),
    ];

    private static readonly Dictionary<string, string> DOTTED_ABBREV = new()
    {
        ["bzw"] = "beziehungsweise", ["za"] = "zirka", ["ca"] = "zirka",
        ["eihw"] = "Eihwohna", ["mrd"] = "Milliardn", ["mio"] = "Millionen",
    };

    // JS `Object.keys(...).sort((a, b) => b.length - a.length)` — LONGEST FIRST is the part that matters, so
    // `eihw` cannot be shadowed. Array.prototype.sort is stable and OrderByDescending is too; the equal-length
    // keys are distinct literals each followed by `\.`, so their relative order cannot change what matches.
    private static readonly string ABBREV_ALT =
        string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "Prozent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            // `US$` is a COMPOUND KEY: the tier is letter-bounded on the left, so a bare `$` cannot match
            // inside `US$105 Milliona`.
            ["€"] = new[] { "Eiro" }, ["US$"] = new[] { "Dollar" },
            ["$"] = new[] { "Dollar" }, ["£"] = new[] { "Pfund" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "Kilometa" }, ["m"] = new[] { "Meta" }, ["cm"] = new[] { "Zantimeta" },
        },
        // Bavarian fuses the measure word onto the FRONT: Quadratkilometa, not *Quadrat Kilometa.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "Quadrat" }, Cubed = new[] { "Kubik" }, Position = ExponentPosition.Compound,
        },
        Magnitudes = new[]
        {
            "Millionan", "Millionen", "Milliona", "Million", "Mijona", "Milliardn", "Milliarde",
        },
    });

    /** Non-negative integer → the Bavarian ordinal with the ending its governing word takes; `null` wherever
     *  the table has no sourced word, which makes the caller decline rather than invent one. */
    private static string? OrdinalWord(double n, bool weak) =>
        ORDINAL.TryGetValue(Js.NumberToString(n), out var stem) ? $"{stem}{(weak ? "n" : "e")}" : null;

    private static readonly JsRe NBSP = JsRegex.Compile("&nbsp;|&#160;|\\u00a0", "gu");

    private static readonly HashSet<string> ARTICLE = ["da", "de", "dea", "des", "dem", "den", "d"];
    private static readonly HashSet<string> WEAK_N =
    [
        "am", "om", "im", "vom", "zum", "beim", "ins", "seitm", "seit", "ausm", "aus", "bis", "nach", "noch",
        "vo", "von", "dem", "den",
    ];
    /** `um` is deliberately absent: it governs the accusative, and both of its corpus instances take -e. */
    private static readonly HashSet<string> GOVERNS_WEAK =
        ["vo", "von", "in", "bei", "mid", "mit", "zu", "af", "auf", "an", "aus", "noch", "nach", "seit"];

    private static readonly JsRe ORD_RE = JsRegex.Compile(
        "(?:(\\p{L}+)(\\s+))?(?:(\\p{L}+)(\\s+))?(?<!\\p{Nd})(\\d{1,4})\\.(?=\\s+(\\p{L}+))", "gu");
    private static readonly JsRe ORD_LICENSED = JsRegex.Compile($"^(?:{MONTHS}|{ORDINAL_NOUN})$", "u");
    private static readonly JsRe UPPER_INITIAL = JsRegex.Compile("^\\p{Lu}", "u");

    private static readonly JsRe ABBREV_MID = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\p{{Nd}}\\p{{Sc}}])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");

    // ⚠ THE LOOKBEHIND EXCLUDES A COLON AND NOT ONLY A DIGIT: rejected at the head of a three-field ratio the
    // engine retries one field in, so `39:15:36` would match at `15:36`. A guard that stops a match beginning
    // at the FRONT of a run does not stop one beginning in the MIDDLE.
    private const string CLOCK = "(?<![\\p{Nd}:])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.]?\\p{Nd})";
    private static readonly JsRe CLOCK_RANGE = JsRegex.Compile($"{CLOCK}\\s*[-–—]\\s*{CLOCK}(\\s*Uhr)?", "gu");
    private static readonly JsRe CLOCK_ONE = JsRegex.Compile($"{CLOCK}(\\s*Uhr)?", "gu");

    private static readonly JsRe GROUPING_DOT =
        JsRegex.Compile("(?<=\\p{Nd})(?<!(?<![\\p{Nd}\\.,])0)\\.(?=\\p{Nd}{3}(?!\\p{Nd}))", "gu");
    // space, NBSP, NNBSP, thin space
    private static readonly JsRe GROUPING_SPACE = JsRegex.Compile(
        "(?<!\\p{Nd})([1-9]\\p{Nd}{0,2})((?:[ \\u00a0\\u202f\\u2009]\\p{Nd}{3})+)(?!\\p{Nd})", "gu");
    private static readonly JsRe GROUP_SEP = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");

    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\p{Nd})\\s*°\\s*C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\p{Nd})\\s*°\\s*F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPOUND = JsRegex.Compile("(\\p{Nd})\\s*°\\s*[-–—](?=\\p{L})", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\p{Nd})\\s*°", "gu");

    // ⚠ THE LOOKAHEAD REACHES ACROSS A RANGE JOINER: only the second operand of `−1 bis −2 °C` has a degree
    // word directly after it, and a rule that signs one end and not the other reads a span from POSITIVE one
    // to minus two. Omitting a plus is lossless; omitting a minus inverts.
    private const string JOINER = "(?:bis|beziehungsweise|beziahungsweis)";
    private const string NUM = "\\p{Nd}[\\p{Nd},.]*";
    private const string DEGREE_AHEAD = $"(?=\\s*{NUM}(?:\\s+{JOINER}\\s+[-−–+]?\\s*{NUM})?\\s+Grad)";
    private static readonly JsRe SIGN_MINUS = JsRegex.Compile($"(^|[\\s(])[-−–]{DEGREE_AHEAD}", "gu");
    private static readonly JsRe SIGN_PLUS = JsRegex.Compile($"(^|[\\s(])\\+{DEGREE_AHEAD}", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");

    /** The three denominators this language sources. */
    private static readonly Dictionary<string, string> DENOM =
        new() { ["2"] = "hoib", ["3"] = "Driddl", ["4"] = "Viadl" };
    private static readonly JsRe FRACTION =
        JsRegex.Compile("(?<!\\p{Nd})(\\p{Nd}{1,2})\\/(\\p{Nd})(?!\\p{Nd})", "gu");

    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![-–—\\p{Nd}])(\\p{Nd}{1,4})\\s?[-–—]\\s?(\\p{Nd}{1,4})(?![-–—\\p{Nd}])", "gu");

    /** A JS optional group: unmatched is `undefined`, which is not the empty string. */
    private static string? Opt(Match m, int i) => m.Groups[i].Success ? m.Groups[i].Value : null;

    /** Normalize one Bavarian input string. Pure text→text. */
    public static string NormalizeBavarian(string input)
    {
        var s = input;

        // 1) ⚠ FIRST, BECAUSE IT BLINDS EVERY GUARD BEHIND IT: the corpus writes `-13&nbsp;°C`, and no
        //    pattern expecting a space or nothing can match across six intervening letters. A SPACE, never a
        //    deletion — `67&nbsp;km` must stay two tokens.
        s = Rewrite(s, NBSP, " ");

        // 2) Multi-dot abbreviations, before the single-dot rule so no interior dot survives as a phrase
        //    break, and before the ordinal rule so `z. B.` cannot be mistaken for anything numeric.
        foreach (var (re, word) in MULTI_DOT) s = Rewrite(s, re, word);

        // 3) ORDINALS: licensed by the FOLLOWING word being a month or an ordinal noun, or by a PRECEDING
        //    licenser plus a capitalised noun. Unsourced values are returned untouched.
        s = Rewrite(s, ORD_RE, m =>
        {
            // ⚠ ONLY ONE PRECEDING WORD IS CAPTURED WHEN THE MATCH STARTS MID-SENTENCE, and it lands in the
            // FIRST optional group, not the second — the engine backtracks to leave group 3 empty. Shift.
            var p1 = Opt(m, 3);
            var s1 = Opt(m, 4);
            var p2 = Opt(m, 1);
            var s2 = Opt(m, 2);
            if (p1 is null) { p1 = p2; s1 = s2; p2 = null; s2 = null; }
            var digits = m.Groups[5].Value;
            var next = m.Groups[6].Value;
            var licensed = ORD_LICENSED.IsMatch(next)
                || (p1 is not null && LICENSER.Contains(Js.ToLowerCase(p1)) && UPPER_INITIAL.IsMatch(next));
            if (!licensed) return m.Value;
            var low = p1 is null ? null : Js.ToLowerCase(p1);
            // A bare article is ambiguous between nominative (-e) and dative (-n); the PREPOSITION in front
            // of it decides, which is why the pattern captures two words rather than one.
            var weak = low is not null
                && (WEAK_N.Contains(low)
                    || (ARTICLE.Contains(low) && p2 is not null && GOVERNS_WEAK.Contains(Js.ToLowerCase(p2))));
            var word = OrdinalWord(Js.Number(digits), weak);
            return word is null ? m.Value : $"{p2 ?? ""}{s2 ?? ""}{p1 ?? ""}{s1 ?? ""}{word}";
        });

        // 4) Single-dot abbreviations: the dot is consumed while the sentence continues and kept at a phrase
        //    end. AFTER the ordinal rule, so `2005. ISBN` has already been declined rather than half-rewritten.
        //    ⚠ The continuation lookahead admits a CURRENCY SIGN, or `21,905 Mrd. €` falls through unexpanded
        //    and takes the `€` with it — the tier needs `Milliardn` as a magnitude to hop.
        s = Rewrite(s, ABBREV_MID, m => $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}{m.Groups[2].Value}");
        s = Rewrite(s, ABBREV_END, m => $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}.");

        // 5) CLOCK, colon form only (a dot form would collide with the thousands grouping at step 6).
        //    ⚠ THE RANGE IS CLAIMED FIRST: the TOKEN class admits `-` inside a word run, so the hyphen between
        //    two rewritten clocks fuses `fimf Uhr-nein Uhr` into one token.
        s = Rewrite(s, CLOCK_RANGE, m =>
            $"{ClockWords(m.Groups[1].Value, m.Groups[2].Value, "")} bis "
            + $"{ClockWords(m.Groups[3].Value, m.Groups[4].Value, Opt(m, 5) ?? " Uhr")}");
        s = Rewrite(s, CLOCK_ONE, m => ClockWords(m.Groups[1].Value, m.Groups[2].Value, Opt(m, 3) ?? " Uhr"));

        // 6) Period-grouped thousands: the period is clausePunctuation, so an unhandled `30.528` is a sentence
        //    break inside a number. ⚠ AFTER the clock and BEFORE the tier, whose NOT_VERSION guard needs the
        //    dot of `8140.43P` — which is why the group size is pinned at exactly three digits.
        s = Rewrite(s, GROUPING_DOT, "");
        // 6b) ⚠ The space-grouped form matches the WHOLE RUN rather than one join per pass: this arm keeps its
        //     head anchor (what stops `12345 678` merging), so it cannot use step 6's zero-width form.
        s = Rewrite(s, GROUPING_SPACE, m => m.Groups[1].Value + GROUP_SEP.Replace(m.Groups[2].Value, ""));

        // 7) DEGREES, before the unit rules so the scale letter is not left to the Latin fallback, and before
        //    the sign rule so the sign lookahead has a degree word to find.
        s = Rewrite(Rewrite(s, DEG_C_SIGN, "°C"), DEG_F_SIGN, "°F");
        s = Rewrite(s, DEG_C, "$1 Grad Celsius");
        s = Rewrite(s, DEG_F, "$1 Grad Fahrenheit");
        // ⚠ The compound hyphen is CONSUMED for the clock range's reason: `90 Grad-Winkl` fuses into one token.
        s = Rewrite(s, DEG_COMPOUND, "$1 Grad ");
        s = Rewrite(s, DEG_BARE, "$1 Grad");

        // 8) The signs, and only in the degree slot — see DEGREE_AHEAD.
        s = Rewrite(s, SIGN_MINUS, "$1minus ");
        s = Rewrite(s, SIGN_PLUS, "$1plus ");
        // ± is a single code point, so no `+` rule can ever match inside it.
        s = Rewrite(s, PLUS_MINUS, " plus minus ");

        // 9) FRACTIONS, narrowly — the operands are capped at two digits and the denominator at the three
        //    sourced values, which is what keeps a year range and a model designation out.
        s = Rewrite(s, FRACTION, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            // JS `DENOM[Number(b)]` — a native digit gives NaN and indexes nothing, as "NaN" does here.
            if (!DENOM.TryGetValue(Js.NumberToString(Js.Number(b)), out var noun)) return m.Value;
            // A numerator of 1 takes the indefinite article, not the counting numeral (`a Driddl`, not *oans).
            return $"{(Js.Number(a) == 1 ? "a" : Numbers.NumberToWords(Js.Number(a)))} {noun}";
        });

        // 9b) NUMERIC RANGES. A range ASCENDS, which separates it from a standard's part number; the chain
        //     guards are what keep ISBNs out, which the ordering test alone would not (`3-86520` ascends).
        s = Rewrite(s, RANGE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(b) > Js.Number(a) ? $"{a} bis {b}" : m.Value;
        });

        // 10) The shared symbol tier LAST: it matches on number-adjacency, so it must run after every rule
        //     that rewrites a number's neighbourhood and after nothing that spends the dot NOT_VERSION needs.
        s = SYMBOLS(s);
        return s;
    }

    private static string ClockWords(string h, string min, string uhr)
    {
        var head = $"{Numbers.NumberToWords(Js.Number(h))}{uhr}";
        return Js.Number(min) == 0 ? head : $"{head} {Numbers.NumberToWords(Js.Number(min))}";
    }
}
