/**
 * Bavarian (bar) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Pure text→text, no IPA.
 * Ported from src/languages/bavarian/normalize.ts — see that file for the corpus counts behind every rule,
 * for the note that 24.0% of the bar.wikipedia dump is not Bavarian (so every count there is over the 246
 * Bavarian segments), and for the DELIBERATELY-NOT-DONE ledger at its foot (the decimal comma, the
 * math signs, the initialisms, the year reading, the era markers), each with the count that refuses it.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bavarian;

public static class Normalize
{
    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Month names in the Bavarian spellings — what the ordinal detector must recognise AFTER the dot. */
    private const string MONTHS =
        "Jenna|Jänna|Jänner|Januar|Feba|Februar|Meaz|März|Aprui|Aprü|April|Mai|Juni|Julei|Juli"
        + "|August|Septemba|September|Oktoba|Oktober|Novemba|November|Dezemba|Dezember";

    /** The other nouns that license an ordinal reading. `Joahundat` has FOUR spellings in 246 segments,
     *  which is what having no codified orthography costs a detector — hence a pattern, not a list. */
    private const string ORDINAL_NOUN =
        "Jo(?:a|ar|our)h+und(?:at|ad|eascht|ert)s?|Jh|Beziak|Person|Lebm?s?joar|Lebensjoar|Buachstob|Auflage";

    /** ⚠ THE BAVARIAN ARTICLE AND PREPOSITION FORMS, tabulated from what actually precedes an `N.` — not
     *  German's list. `seitm` and `ausm` are fused preposition+article forms German writes apart, and `om`
     *  is this corpus's spelling of `am`; a German licenser list would have missed all three. */
    private static readonly HashSet<string> LICENSER =
    [
        "am", "om", "im", "vom", "zum", "beim", "ins", "seitm", "seit", "ausm", "aus", "bis", "nach", "noch",
        "vo", "von", "da", "dea", "de", "des", "dem", "den", "d", "ois", "as", "s",
    ];

    /** Read from the manifest — see the jsonc, where the evidence lives. */
    private static IReadOnlyDictionary<string, string> ORDINAL => Manifest.MANIFEST.OrdinalStems;

    /** Multi-dot abbreviations. ⚠ `d. h.`, `u. a.` and `v. Chr.`/`n. Chr.` are DELIBERATELY ABSENT — see
     *  the TS for the count that refuses each. */
    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    [
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])z\\.\\s?B\\.", "giu"), "zum Beispui"),
    ];

    /** Single-dot abbreviations; every expansion is a word the Bavarian subset itself spells out elsewhere. */
    private static readonly Dictionary<string, string> DOTTED_ABBREV = new()
    {
        ["bzw"] = "beziehungsweise", ["za"] = "zirka", ["ca"] = "zirka",
        ["eihw"] = "Eihwohna", ["mrd"] = "Milliardn", ["mio"] = "Millionen",
    };

    // JS `Object.keys(...).sort((a, b) => b.length - a.length)` — Array.prototype.sort is STABLE, so equal
    // lengths keep insertion order; LINQ's OrderByDescending is stable too.
    private static readonly string ABBREV_ALT =
        string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /**
     * THE SHARED SYMBOL TIER. Every word was probed on bar.wikipedia and its prose read — see the TS for the
     * per-word citations, and in particular for: `Eiro` and NOT `Euro` (the wiki's own article calls `Euro`
     * the official/German form); `US$` as a COMPOUND KEY, because the tier is letter-bounded on the left so
     * a bare `$` cannot match inside `US$105 Milliona`; `position: "compound"`, because Bavarian fuses the
     * modifier onto the FRONT (Quadratkilometa, not *Quadrat Kilometa); and the three deliberate omissions
     * — no `¥` (the corpus never writes it), no rate (`pro` is attested but no DENOMINATOR noun is), and no
     * `ampersand` (83 of 83 `&` in the Bavarian subset are `&nbsp;`, handled as markup at step 1).
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "Prozent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "Eiro" }, ["US$"] = new[] { "Dollar" },
            ["$"] = new[] { "Dollar" }, ["£"] = new[] { "Pfund" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "Kilometa" }, ["m"] = new[] { "Meta" }, ["cm"] = new[] { "Zantimeta" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "Quadrat" }, Cubed = new[] { "Kubik" }, Position = ExponentPosition.Compound,
        },
        Magnitudes = new[]
        {
            "Millionan", "Millionen", "Milliona", "Million", "Mijona", "Milliardn", "Milliarde",
        },
    });

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PASS
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Non-negative integer → the Bavarian ordinal, with the ending the governing word takes; `null`
     *  wherever the table has no sourced word, which makes the caller decline rather than invent one. */
    private static string? OrdinalWord(double n, bool weak) =>
        ORDINAL.TryGetValue(Js.NumberToString(n), out var stem) ? $"{stem}{(weak ? "n" : "e")}" : null;

    private static readonly JsRe NBSP = JsRegex.Compile("&nbsp;|&#160;|\\u00a0", "gu");

    private static readonly HashSet<string> ARTICLE = ["da", "de", "dea", "des", "dem", "den", "d"];
    private static readonly HashSet<string> WEAK_N =
    [
        "am", "om", "im", "vom", "zum", "beim", "ins", "seitm", "seit", "ausm", "aus", "bis", "nach", "noch",
        "vo", "von", "dem", "den",
    ];
    private static readonly HashSet<string> GOVERNS_WEAK =
        ["vo", "von", "in", "bei", "mid", "mit", "zu", "af", "auf", "an", "aus", "noch", "nach", "seit"];

    private static readonly JsRe ORD_RE = JsRegex.Compile(
        "(?:(\\p{L}+)(\\s+))?(?:(\\p{L}+)(\\s+))?(?<!\\p{Nd})(\\d{1,4})\\.(?=\\s+(\\p{L}+))", "gu");
    private static readonly JsRe ORD_LICENSED =
        JsRegex.Compile($"^(?:{MONTHS}|{ORDINAL_NOUN})$", "u");
    private static readonly JsRe UPPER_INITIAL = JsRegex.Compile("^\\p{Lu}", "u");

    private static readonly JsRe ABBREV_MID = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\p{{Nd}}\\p{{Sc}}])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");

    // ⚠ THE LOOKBEHIND EXCLUDES A COLON, NOT ONLY A DIGIT. With `(?<!\p{Nd})` alone the rule RESTARTED
    // INSIDE a ratio: rejected at `39`, the engine retried and matched `15:36`, so `Seitnvoöitnis 39:15:36`
    // read "…neinadreißg , fuchzea UHR sechsadreißg". A guard that stops a match beginning at the FRONT of
    // a run does not stop one beginning in the MIDDLE.
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

    private const string JOINER = "(?:bis|beziehungsweise|beziahungsweis)";
    private const string NUM = "\\p{Nd}[\\p{Nd},.]*";
    private const string DEGREE_AHEAD =
        $"(?=\\s*{NUM}(?:\\s+{JOINER}\\s+[-−–+]?\\s*{NUM})?\\s+Grad)";
    private static readonly JsRe SIGN_MINUS = JsRegex.Compile($"(^|[\\s(])[-−–]{DEGREE_AHEAD}", "gu");
    private static readonly JsRe SIGN_PLUS = JsRegex.Compile($"(^|[\\s(])\\+{DEGREE_AHEAD}", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");

    private static readonly Dictionary<string, string> DENOM =
        new() { ["2"] = "hoib", ["3"] = "Driddl", ["4"] = "Viadl" };
    private static readonly JsRe FRACTION =
        JsRegex.Compile("(?<!\\p{Nd})(\\p{Nd}{1,2})\\/(\\p{Nd})(?!\\p{Nd})", "gu");

    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![-–—\\p{Nd}])(\\p{Nd}{1,4})\\s?[-–—]\\s?(\\p{Nd}{1,4})(?![-–—\\p{Nd}])", "gu");

    private static string? Opt(Match m, int i) => m.Groups[i].Success ? m.Groups[i].Value : null;

    /** Normalize one Bavarian input string. Pure text→text. */
    public static string NormalizeBavarian(string input)
    {
        var s = input;

        // 1) ⚠ `&nbsp;` → A SPACE, FIRST, AND THIS IS THE LARGEST SINGLE DEFECT IN THE LANGUAGE. Unhandled
        //    the engine's TOKEN sees `nbsp` as a Latin word run and PHONEMIZES IT. ⚠⚠ AND IT MUST BE FIRST
        //    BECAUSE IT BLINDS EVERY GUARD DOWNSTREAM: my first `°C` count over the Bavarian subset was
        //    ZERO because the corpus writes `-13&nbsp;°C`. A SPACE, never deletion — `67&nbsp;km` must stay
        //    two tokens.
        s = NBSP.Replace(s, " ");

        // 2) MULTI-DOT ABBREVIATIONS, before the single-dot rule so no interior dot survives as a phrase
        //    break, and before the ordinal rule so `z. B.` can never be mistaken for anything numeric.
        foreach (var (re, word) in MULTI_DOT) s = re.Replace(s, word);

        // 3) ORDINALS — the largest LANGUAGE defect, and the German trap in its original form: a numeral
        //    plus a bare period a regex cannot tell from a sentence end. The rule fires on the FOLLOWING
        //    word being a month or an ordinal noun, or on a PRECEDING licenser plus a capitalised noun; a
        //    segment-final `N.` has no following word at all, so zero sentence-final pauses are lost.
        //    ⚠ IT DECLINES WHEREVER THE WORD IS UNSOURCED — `ORDINAL` holds only what bar.wikipedia prose
        //    gives, and this language's ordinals are NOT derivable from its cardinal table.
        //    ⚠ WHEN THE LICENSER IS A BARE ARTICLE, THE PREPOSITION IN FRONT OF IT DECIDES: `da` is both
        //    the masculine nominative article (→ -e) and the feminine dative one (→ -n), so a one-word
        //    lookbehind gets this wrong five times in eleven here. `um` is deliberately NOT in GOVERNS_WEAK
        //    — it governs the accusative and both instances take -e.
        s = ORD_RE.Replace(s, m =>
        {
            // Only ONE preceding word was captured when the match starts mid-sentence with a single word;
            // shift. (The two optional groups backtrack to leave the FIRST one filled, not the second.)
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
            var weak = low is not null
                && (WEAK_N.Contains(low)
                    || (ARTICLE.Contains(low) && p2 is not null && GOVERNS_WEAK.Contains(Js.ToLowerCase(p2))));
            var word = OrdinalWord(Js.Number(digits), weak);
            return word is null ? m.Value : $"{p2 ?? ""}{s2 ?? ""}{p1 ?? ""}{s1 ?? ""}{word}";
        });

        // 4) SINGLE-DOT ABBREVIATIONS. The dot is consumed while the sentence continues, so it cannot become
        //    a phrase break; at a phrase end it is kept, because there it really is the sentence end. AFTER
        //    the ordinal rule so `2005. ISBN` has already been declined rather than half-rewritten.
        //    ⚠ THE CONTINUATION LOOKAHEAD ADMITS A CURRENCY SIGN as well as a letter or digit, because the
        //    corpus's one `Mrd.` is `21,905 Mrd. €` — a letters-or-digits lookahead matched neither arm, so
        //    the abbreviation fell through unexpanded AND took the `€` with it.
        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}.");

        // 5) CLOCK, COLON FORM ONLY. The hour/minute guard rejects the corpus's two geometric ratios on its
        //    own, and the trailing `(?!:\p{Nd})` is belt-and-braces against a third field.
        //    ⚠ NO DOT-FORM CLOCK — `11.00 Uhr` would collide head-on with the thousands grouping at step 6,
        //    which is 56 instances against zero attested dot-clocks.
        //    ⚠ THE RANGE IS CLAIMED FIRST: the hyphen between two clocks stops being punctuation the moment
        //    the clocks become WORDS, and this engine's TOKEN admits `-` INSIDE a word run, so `5:00-9:00`
        //    rewrote to `fimf Uhr-nein Uhr` and FUSED into one token. The joiner is the corpus's own `bis`.
        s = CLOCK_RANGE.Replace(s, m =>
            $"{ClockWords(m.Groups[1].Value, m.Groups[2].Value, "")} bis "
            + $"{ClockWords(m.Groups[3].Value, m.Groups[4].Value, Opt(m, 5) ?? " Uhr")}");
        s = CLOCK_ONE.Replace(s, m =>
            ClockWords(m.Groups[1].Value, m.Groups[2].Value, Opt(m, 3) ?? " Uhr"));

        // 6) PERIOD-GROUPED THOUSANDS, before anything reads a bare number: the period is
        //    `clausePunctuation`, so `30.528 km²` read as a SENTENCE BREAK inside a number. Exactly three
        //    digits and no more. ⚠ AFTER the clock and BEFORE the tier, whose `NOT_VERSION` guard needs the
        //    dot of `8140.43P` to still be there — `.43` is two digits, which is why the group size is
        //    pinned at exactly three.
        s = GROUPING_DOT.Replace(s, "");
        // 6b) SPACE-GROUPED THOUSANDS. ⚠ THE WHOLE RUN AT ONCE. This arm keeps its HEAD ANCHOR, which is
        //     what stops `12345 678` merging, so it cannot use the zero-width form step 6 does.
        s = GROUPING_SPACE.Replace(s, m => m.Groups[1].Value + GROUP_SEP.Replace(m.Groups[2].Value, ""));

        // 7) DEGREES, before the unit rules so the scale letter is not left to the Latin fallback, and
        //    before the sign rule so `−20 °C` still has its `°C` visible when the sign is judged. ℃/℉ are
        //    folded first — one code point meaning what `°C` means. ⚠ The arc-minute and arc-second of a
        //    coordinate are LEFT UNREAD: nothing probed sources a Bavarian word for ′/″.
        s = DEG_F_SIGN.Replace(DEG_C_SIGN.Replace(s, "°C"), "°F");
        s = DEG_C.Replace(s, "$1 Grad Celsius");
        s = DEG_F.Replace(s, "$1 Grad Fahrenheit");
        //    ⚠ THE COMPOUND HYPHEN IS CONSUMED. `90°-Winkl` is a German-style compound, and this engine's
        //    TOKEN admits `-` inside a word run, so emitting `90 Grad-Winkl` FUSED the two into one token
        //    where before the rule existed they were two clean words.
        s = DEG_COMPOUND.Replace(s, "$1 Grad ");
        s = DEG_BARE.Replace(s, "$1 Grad");

        // 8) THE SIGNS, AND ONLY IN THE DEGREE SLOT. Of 32 sign+digit shapes in the Bavarian subset every
        //    real sign is followed by a degree word and no counter-example is (ranges, ISBNs, designations),
        //    so the degree lookahead separates them with zero false positives; a general `(^|\s)[-−–](\d)`
        //    rule would have read `1961 -1990` as *minus 1990*. Runs AFTER step 7, so the degree word is
        //    already there to look for.
        //    ⚠⚠ AND THE LOOKAHEAD MUST REACH ACROSS A RANGE JOINER, or the FIRST operand of a signed range
        //    keeps its sign silent while the second gets one — **omitting a plus is lossless and omitting a
        //    minus INVERTS**, so `−1 bis −2 °C` would read as a span from positive one to minus two.
        s = SIGN_MINUS.Replace(s, "$1minus ");
        s = SIGN_PLUS.Replace(s, "$1plus ");
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1) and no `+` rule can ever match inside it; unread it is dropped
        //    in silence. Zero instances in this corpus — robustness, not a measured repair.
        s = PLUS_MINUS.Replace(s, " plus minus ");

        // 9) FRACTIONS, NARROWLY. One real fraction in the Bavarian subset against two shapes a German-style
        //    `\d{1,3}/\d{1,3}` rule would have claimed wrongly, which is why the operands are capped at two
        //    digits and the denominator at the three values this language sources.
        //    ⚠ A NUMERATOR OF 1 TAKES THE ARTICLE, NOT THE CITATION NUMERAL: `1/3` came out *oans Driddl*,
        //    where `oans` is the counting form and what the language writes here is the indefinite `a`.
        s = FRACTION.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            if (!DENOM.TryGetValue(Js.NumberToString(Js.Number(b)), out var noun)) return m.Value;
            return $"{(Js.Number(a) == 1 ? "a" : Numbers.NumberToWords(Js.Number(a)))} {noun}";
        });

        // 9b) NUMERIC RANGES → the corpus's own joiner `bis`. ⚠ THE DISCRIMINATOR IS THAT A RANGE ASCENDS:
        //     seven true shapes in the subset all ascend and the one counter-example (`ÖNORM B 8115-2`, a
        //     standard's part number) does not. ⚠ AND THE CHAIN GUARDS ARE WHAT KEEP ISBNs OUT, which the
        //     ordering test alone would not — in `3-86520-078-8` the pair `3-86520` ascends. ⚠ Runs AFTER
        //     the ordinal rule, so `10.–23.` has already been seen and declined by both.
        s = RANGE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(b) > Js.Number(a) ? $"{a} bis {b}" : m.Value;
        });

        // 10) THE SHARED SYMBOL TIER, LAST — it matches on number-adjacency, so it must run after every rule
        //     that rewrites a number's neighbourhood and after nothing that would spend the dot it needs for
        //     `NOT_VERSION`.
        s = SYMBOLS(s);
        return s;
    }

    private static string ClockWords(string h, string min, string uhr)
    {
        var head = $"{Numbers.NumberToWords(Js.Number(h))}{uhr}";
        return Js.Number(min) == 0 ? head : $"{head} {Numbers.NumberToWords(Js.Number(min))}";
    }
}
