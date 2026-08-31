/**
 * Luxembourgish (lb) text normalization — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * The full stop does four jobs at once (thousands grouping, the period-clock, the ordinal marker, the
 * version dot) and they are resolved from the most constrained shape to the least; the discriminator
 * between grouping and clock is FRACTION LENGTH (three digits group, two clock); the ordinal ending
 * is the Eifeler Regel, not a case table; the colon is a score, never a clock.
 * Ported from src/languages/luxembourgish/normalize.ts — see that file for the corpus counts behind
 * every word, every guard and every refusal.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Luxembourgish;

public static class Normalize
{
    private const string MONTHS = "Januar|Februar|Mäerz|Abrëll|Mee|Juni|Juli|August|September|Oktober|November|Dezember";
    private const string ORDINAL_NOUN = $"{MONTHS}|Joerhonnert|Joerhonnerts|Joerdausend";

    private static readonly HashSet<string> LICENSER =
    [
        "de", "den", "dem", "der", "dat", "déi", "d'", "d’", "am", "um", "vum", "zum", "nom", "beim",
        "an", "vun", "vu", "säi", "säin", "seng", "hir", "hire", "hiren", "hiert", "deem", "dësem", "dësen",
    ];

    /** The feminine dative article takes -er: *op der zéngter Plaz*. */
    private static readonly HashSet<string> FEM_DATIVE = ["der"];

    // space, NBSP, NNBSP, thin space
    private const string SP = "[ \\u00a0\\u202f\\u2009]";

    private static readonly JsRe ORDINAL_LIST = JsRegex.Compile(
        $"^(?:,|{SP}+(?:an|a|bis|oder))(?:{SP}+[\\p{{L}}'’-]+){{0,2}}{SP}+\\d{{1,4}}\\.", "u");

    // ⚠ `Mee` is capitalised on purpose — lowercase *mee* is the conjunction "but".
    private static readonly Dictionary<string, string> DOTTED_ABBREV = new()
    {
        ["asw"] = "an sou weider", ["dr"] = "Dokter", ["jr"] = "Junior", ["nr"] = "Nummer",
    };

    // JS `Object.keys(...).sort((a, b) => b.length - a.length)` — longest first. Array.prototype.sort is
    // stable and OrderByDescending is too; the equal-length keys are distinct literals each followed by `\.`,
    // so their relative order cannot change what matches.
    private static readonly string ABBREV_ALT =
        string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Time prepositions that license a period-clock on their own (capitalised forms too). */
    private static readonly JsRe CLOCK_PREP = JsRegex.Compile("^(?:um|ëm|géint|tëschent)$", "iu");

    /** Zone labels written where `Auer` would otherwise be. */
    private const string CLOCK_MARKER = "Auer|UTC|GMT|MDT|MST|MEZ|CET|CEST";

    // `een` before a word, with the Eifeler Regel: *een Drëttel* but *ee Fënneftel*.
    private static string OneBefore(string word) => Numbers.ApplyEifelerRegel("een", word);

    private static readonly JsRe ERA_MID_V = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}v\\.{SP}?Chr\\b\\.?(?={SP}+[\\p{{L}}\\d(])", "gu");
    private static readonly JsRe ERA_BEFORE_MARK_V = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}v\\.{SP}?Chr\\b\\.?(?={SP}*[»\\)\\]!?,;:])", "gu");
    private static readonly JsRe ERA_END_V = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}v\\.{SP}?Chr\\b\\.?", "gu");
    private static readonly JsRe ERA_MID_N = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}n\\.{SP}?Chr\\b\\.?(?={SP}+[\\p{{L}}\\d(])", "gu");
    private static readonly JsRe ERA_BEFORE_MARK_N = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}n\\.{SP}?Chr\\b\\.?(?={SP}*[»\\)\\]!?,;:])", "gu");
    private static readonly JsRe ERA_END_N = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}n\\.{SP}?Chr\\b\\.?", "gu");

    private static readonly JsRe MULTIDOT_ZB = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}z\\.{SP}?B\\.", "gu");
    private static readonly JsRe MULTIDOT_DH = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}d\\.{SP}?h\\.", "gu");

    private static readonly JsRe ABBREV_MID = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}({ABBREV_ALT})\\.({SP}+)(?=[\\p{{L}}\\d])", "giu");
    private static readonly JsRe ABBREV_BEFORE_MARK = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}({ABBREV_ALT})\\.(?={SP}*[,;:!?»\\)\\]])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}({ABBREV_ALT})\\.(?={SP}*(?:\\.|$))", "giu");

    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:\\.\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile($"(?<![\\d.,])[1-9]\\d{{0,2}}(?:{SP}\\d{{3}}(?!\\d))+", "gu");
    private static readonly JsRe SPACE_ANY = JsRegex.Compile(SP, "gu");
    private static readonly JsRe DOT_ANY = JsRegex.Compile("\\.", "gu");

    private static readonly JsRe ORD = JsRegex.Compile(
        $"(?:([\\p{{L}}'’-]+)({SP}+))?(?<![\\d.,:])(\\d{{1,4}})\\.(?=[,;)]?{SP})", "gu");
    private static readonly JsRe ORD_NEXT = JsRegex.Compile($"^[,;)]?{SP}+([\\p{{L}}'’-]+)", "u");
    private static readonly JsRe ORD_NOUN_RE = JsRegex.Compile($"^(?:{ORDINAL_NOUN})$", "u");
    private static readonly JsRe REST_STARTS_PUNCT = JsRegex.Compile("^[,;)]", "u");

    private static readonly JsRe SPORTS_TIME =
        JsRegex.Compile("(?<![\\d.,:])(\\d{1,2})\\.(\\d{2}),(\\d{1,2})(?!\\d)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        $"(?:([\\p{{L}}'’]+)({SP}+))?(?<![\\d.,:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?![\\d,.:\\p{{L}}])"
        + $"(?:({SP}+)({CLOCK_MARKER}))?", "gu");
    private static readonly JsRe DOT_DECIMAL =
        JsRegex.Compile("(?<![\\d.,:])(\\d{1,2})\\.(\\d)(?![\\d,.:\\p{L}])", "gu");
    private static readonly JsRe COMMA_DECIMAL =
        JsRegex.Compile("(?<![\\d.,:])(\\d+),(\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        $"(\\d[\\d.,]*\\d|\\d){SP}*[–—]{SP}*(?=\\d)", "gu");
    private static readonly JsRe MPH = JsRegex.Compile(
        $"(\\d){SP}?(?:mph|Meilen?{SP}?/{SP}?h)(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile($"(\\d){SP}?°{SP}?C(?![\\p{{L}}\\p{{M}}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile($"(\\d){SP}?°{SP}?F(?![\\p{{L}}\\p{{M}}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile($"(\\d){SP}?°{SP}?", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_AFTER_WORD = JsRegex.Compile($"(\\S)\\+{SP}?(\\d)", "gu");
    private static readonly JsRe PLUS_INITIAL = JsRegex.Compile($"(^|[\\s])\\+{SP}?(\\d)", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,:/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");

    // JS `[...frac].join(" ")` — one space between the code points.
    private static string PerDigit(string frac) => string.Join(" ", Js.CodePoints(frac));

    private static readonly JsRe DIGITS_ONLY = JsRegex.Compile("^\\d+$", "u");
    private static readonly JsRe TT_END = JsRegex.Compile("tt$", "u");
    private static readonly JsRe EN_END = JsRegex.Compile("en$", "u");
    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");

    /** Integer → the Luxembourgish ordinal STEM: cardinal + `t` below 20, + `st` from 20, with a doubled
     *  `t` collapsed and two suppletive stems. The multi-word carrier is free: numberToWords joins
     *  magnitude groups with a space, and appending lands the ending on the last word. */
    public static string? OrdinalStem(double n)
    {
        if (!double.IsInteger(n) || n < 1 || Math.Abs(n) > 9007199254740991d) return null;
        var key = Js.NumberToString(n);
        if (IRREGULAR_STEM.TryGetValue(key, out var irr)) return irr;
        var card = Numbers.NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        return TT_END.Replace($"{card}{(n < 20 ? "t" : "st")}", "t");
    }

    private static readonly Dictionary<string, string> IRREGULAR_STEM = new() { ["1"] = "éischt", ["3"] = "drëtt" };

    /** Denominator → the fraction NOUN: ordinal stem + `el`. `4` is the one irregular, and `2` is not a
     *  noun at all but the adjective `hallef`, handled by the caller. */
    private static readonly Dictionary<string, string> FRACTION_NOUN = new() { ["4"] = "Véierel" };

    private static string? FractionNoun(double den)
    {
        if (FRACTION_NOUN.TryGetValue(Js.NumberToString(den), out var irr)) return irr;
        var stem = OrdinalStem(den);
        return stem is null ? null : char.ToUpperInvariant(stem[0]) + stem[1..] + "el";
    }

    /** Normalize one Luxembourgish input string. Pure text→text: ⚠ every word this layer emits lands as
     *  TEXT, so the tokenizer phonemizes it through the same g2p as everything else. */
    public static string NormalizeLuxembourgish(string input)
    {
        var s = input;

        // 1) DE-GROUP THOUSANDS — first, before anything reads a period or a space as a boundary. MUST
        //    PRECEDE the clock rule: `1.000`/`2.500`/`130.000`/`7.000` each contain a `\d{1,2}\.\d{2}`
        //    prefix that would otherwise be claimed as a time — the period ambiguity resolved by requiring
        //    EXACTLY THREE digits after the dot for grouping and TWO for a clock.
        s = Rewrite(s, GROUP_DOT, m => DOT_ANY.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_SPACE, m => SPACE_ANY.Replace(m.Value, ""));

        // 2) ERA markers, before the single-dot rule so their interior dot is not left behind as a phrase
        //    break (`v. Chr.`, `n. Chr.`).
        s = Rewrite(s, ERA_MID_V, "vir Christus");
        s = Rewrite(s, ERA_BEFORE_MARK_V, "vir Christus");
        s = Rewrite(s, ERA_END_V, "vir Christus.");
        s = Rewrite(s, ERA_MID_N, "no Christus");
        s = Rewrite(s, ERA_BEFORE_MARK_N, "no Christus");
        s = Rewrite(s, ERA_END_N, "no Christus.");

        // 3) MULTI-DOT abbreviations (`z. B.`, `d. h.`), still before the single-dot rule.
        s = Rewrite(s, MULTIDOT_ZB, "zum Beispill");
        s = Rewrite(s, MULTIDOT_DH, "dat heescht");

        // 4) SINGLE-DOT abbreviations: the dot is consumed when the sentence continues, kept at a phrase
        //    end (the German shape), with one extra branch — `asw., déi` and `asw.).` would otherwise keep
        //    the abbreviation dot AND its real terminator, two pauses where the text has one.
        s = Rewrite(s, ABBREV_MID, m => $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}{m.Groups[2].Value}");
        s = Rewrite(s, ABBREV_BEFORE_MARK, m => DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]);
        s = Rewrite(s, ABBREV_END, m => $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}.");

        // 5) ORDINALS — licensed by a following month/Joerhonnert, a preceding determiner with a word
        //    after, or a coordinated list. A sentence-final `N.` satisfies none of them AND the pattern
        //    requires whitespace after the dot, so a sentence-final year is structurally unreachable.
        //    MUST FOLLOW step 1 (`Säin 1 000. Timber` is only an ordinal once the group separator is
        //    gone) and MUST PRECEDE every rule that reads a period.
        s = Rewrite(s, ORD, m =>
        {
            var whole = m.Value;
            // TS `full.slice(offset + whole.length)` — `s` is the very string being replaced.
            var rest = s[(m.Index + whole.Length)..];
            var nextM = ORD_NEXT.Match(rest);
            var next = nextM.Success ? nextM.Groups[1].Value : null;
            var prev = m.Groups[1].Success ? m.Groups[1].Value : null;
            var licensed =
                (next is not null && ORD_NOUN_RE.IsMatch(next))
                || (prev is not null && LICENSER.Contains(Js.ToLowerCase(prev)) && next is not null)
                || ORDINAL_LIST.IsMatch(rest);
            if (!licensed) return whole;
            var stem = OrdinalStem(Js.Number(m.Groups[3].Value));
            if (stem is null) return whole;
            var head = $"{prev ?? ""}{(m.Groups[2].Success ? m.Groups[2].Value : "")}";
            if (prev is not null && FEM_DATIVE.Contains(Js.ToLowerCase(prev))) return $"{head}{stem}er";
            // The sandhi looks at what actually follows the dot: a comma is a pause, so the ⟨n⟩ survives.
            var sandhiCue = REST_STARTS_PUNCT.IsMatch(rest) ? "n" : (next ?? "");
            return $"{head}{Numbers.ApplyEifelerRegel($"{stem}en", sandhiCue)}";
        });

        // 6) SPORTS TIMES `M.SS,hh`. ⚠ MUST PRECEDE the clock and both decimal rules, or one of them
        //    restarts inside the time.
        s = Rewrite(s, SPORTS_TIME, m => $"{m.Groups[1].Value} {m.Groups[2].Value} Komma {PerDigit(m.Groups[3].Value)}");

        // 7) CLOCK, written with a PERIOD. Licensed by a following zone label or a preceding time
        //    preposition. A consumed `Auer` is put back, and a consumed ZONE label after an inserted
        //    `Auer`. ⚠ `Auer` is FEMININE, so hour 1 is *eng Auer* — the hour is words-ified in exactly
        //    that case, because a digit could never agree.
        s = Rewrite(s, CLOCK, m =>
        {
            var whole = m.Value;
            var prev = m.Groups[1].Success ? m.Groups[1].Value : null;
            var psp = m.Groups[2].Success ? m.Groups[2].Value : "";
            var h = m.Groups[3].Value;
            var min = m.Groups[4].Value;
            var msp = m.Groups[5].Success ? m.Groups[5].Value : null;
            var marker = m.Groups[6].Success ? m.Groups[6].Value : null;
            if (marker is null && !(prev is not null && CLOCK_PREP.IsMatch(prev))) return whole;
            var hour = Js.Number(h) == 1 ? "eng" : h;
            var tail = marker is null || marker == "Auer" ? "" : $"{(msp ?? " ")}{marker}";
            var mins = Js.Number(min) == 0 ? "" : $" {Js.NumberToString(Js.Number(min))}";
            return $"{prev ?? ""}{psp}{hour} Auer{mins}{tail}";
        });

        // 8) DOT DECIMAL — after the clock, which has first claim on `\d{1,2}.\d{2}`. THE FRACTION IS
        //    LIMITED TO ONE DIGIT on purpose: a two-digit fraction after a period is the clock shape
        //    (the decimal separator is the comma), so an unlicensed `20.30` is left alone.
        s = Rewrite(s, DOT_DECIMAL, m => $"{m.Groups[1].Value} Komma {PerDigit(m.Groups[2].Value)}");

        // 9) COMMA DECIMAL — the language's own decimal separator. Digits on both sides, so a clause
        //    comma is safe. The fraction is read digit by digit, and both operands stay DIGITS so the
        //    shared tier can still see a following unit.
        s = Rewrite(s, COMMA_DECIMAL, m => $"{m.Groups[1].Value} Komma {PerDigit(m.Groups[2].Value)}");

        // 10) RANGES — an en dash between nbsp. Digits are required on BOTH sides: the same dash is far
        //     more often the parenthetical dash, which must not be touched. The LEFT operand is
        //     words-ified when and only when it needs the n-deletion; the right stays digits, which is
        //     what keeps the number↔unit adjacency alive for `2 – 3 km`.
        s = Rewrite(s, RANGE, m =>
        {
            var left = m.Groups[1].Value;
            var words = DIGITS_ONLY.IsMatch(left) ? Numbers.NumberToWords(Js.Number(left)) : "";
            // ⚠ Only an unstressed final ⟨-en⟩ is the rule's target — a bare final-⟨n⟩ test strips the
            // STEM of *Millioun* (1 000 000 → *eng Milliou*).
            return EN_END.IsMatch(words)
                ? $"{Numbers.ApplyEifelerRegel(words, "bis")} bis "
                : $"{left} bis ";
        });

        // 11) MILES PER HOUR — declaring `meile` as a unit would pluralise the writer's own Eifeler
        //     form; claiming only the RATE leaves the spelled-out noun alone.
        s = Rewrite(s, MPH, "$1 Meilen an der Stonn");

        // 12) DEGREES. The compass letter (`35 °W`) is deliberately left raw — *Grad West* is
        //     unsourced — but the ° itself is still spoken.
        s = Rewrite(s, DEG_C, "$1 Grad Celsius");
        s = Rewrite(s, DEG_F, "$1 Grad Fahrenheit");
        s = Rewrite(s, DEG_BARE, "$1 Grad ");

        // 13) SIGNS. A BARE `-N` is almost never a negative number in this language — it is a compound
        //     hyphen (`Typ-1-Diabetes`, `COVID-19`) — so the minus rule keeps the German guard,
        //     requiring a space or an opening paren before the sign. Ranges (step 10) are gone by now,
        //     so the en dash cannot reach here either.
        s = Rewrite(s, MINUS, "$1minus $2");
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
        s = Rewrite(s, PLUS_MINUS, " plus minus ");
        s = Rewrite(s, PLUS_AFTER_WORD, "$1 plus $2");
        s = Rewrite(s, PLUS_INITIAL, "$1plus $2");

        // RELATIONAL AND ARITHMETIC SIGNS, and the AMPERSAND.
        s = Rewrite(s, JsRegex.Compile("[ \\u00a0]*[=≈][ \\u00a0]*", "gu"), " ass gläich ");
        s = Rewrite(s, JsRegex.Compile("[ \\u00a0]*<[ \\u00a0]*", "gu"), " méi kleng ewéi ");
        s = Rewrite(s, JsRegex.Compile("[ \\u00a0]*>[ \\u00a0]*", "gu"), " méi grouss ewéi ");
        s = Rewrite(s, JsRegex.Compile("(\\d)[ \\u00a0]*×[ \\u00a0]*(?=\\d)", "gu"), "$1 mol ");
        s = Rewrite(s, JsRegex.Compile("[ \\u00a0]*÷[ \\u00a0]*", "gu"), " dividéiert duerch ");
        s = Rewrite(s, JsRegex.Compile("[ \\u00a0]*[&＆][ \\u00a0]*", "gu"), " an ");

        // 14) FRACTIONS. Denominator 2 is the ADJECTIVE `hallef`; everything else composes as ordinal
        //     stem + `el`. The numerator 1 is `een`, itself subject to the Eifeler Regel.
        s = Rewrite(s, FRACTION, m =>
        {
            var num = Js.Number(m.Groups[1].Value);
            var den = Js.Number(m.Groups[2].Value);
            if (den == 2) return $"{(num == 1 ? OneBefore("hallef") : Numbers.NumberToWords(num))} hallef";
            var noun = FractionNoun(den);
            if (noun is null) return m.Value;
            return $"{(num == 1 ? OneBefore(noun) : Numbers.NumberToWords(num))} {noun}";
        });

        return s;
    }
}
