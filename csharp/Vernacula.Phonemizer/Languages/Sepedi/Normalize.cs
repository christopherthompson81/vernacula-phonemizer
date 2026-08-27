/**
 * Sepedi / Northern Sotho (nso) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which
 * is not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ IT RUNS *AFTER* THE SHARED SYMBOL TIER — `NormalizeSepedi` calls `SYMBOLS(input)` on its first line, the
 * Chichewa/Swahili order. The coupling is forced from both ends: the DECIMAL spell-out (step 9) must happen
 * after the percent/currency word is attached, and the LOCAL UNIT step (step 5) must still see the version
 * DOT that step 9 spends.
 *
 * ⚠ THE UNIT PATH IS LOCAL, NOT ON THE TIER, for three reasons argued in the TS: the squared compound
 * RE-SHAPES its head (`disekwere-khilomithara`, not `disekwere dikhilomithara`), the cubed word is
 * unsourceable and the tier's fallback would strand the superscript, and the one-letter key `s` must be a
 * denominator only.
 *
 * Ported from src/languages/sepedi/normalize.ts, whose header carries the whole evidential record: the
 * per-word attestations and their article counts, the three-convention separator census, and the priced
 * refusals — the decimal-separator word (`khutlo` is the mark's NAME, in the wrong register), the arithmetic
 * signs, `£`/`€` (`diponto` is this wiki's POUND WEIGHT), `°F`, letter names, fractions, the clock and the
 * `ha` key. Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sepedi;

public static class Normalize
{
    private static SepediNumbers N => Manifest.MANIFEST.Numbers;
    /** The class-8/10 concord, read from the manifest so this file and `Numbers.cs` can never name two
     *  different particles for one language. */
    private static string TSE => N.Class8Concord;
    private static string AND => N.And;

    /** THE UNIT TABLE — key → [citation form, counted form]. ⚠ Index 0 is the bare noun (a unit standing
     *  alone must not end in a dangling particle) and index 1 adds the concord. ⚠ `cm` keeps the
     *  singular-shaped noun in BOTH slots: `disenthimetara` is ×0 and the one attestation is a plural
     *  quantity written with the bare noun. */
    private static readonly Dictionary<string, (string Cite, string Counted)> UNIT = new()
    {
        ["km"] = ("dikhilomithara", $"dikhilomithara {TSE}"),
        ["m"] = ("dimithara", $"dimithara {TSE}"),
        ["cm"] = ("senthimetara", "senthimetara"),
        ["mm"] = ("dimilimithara", $"dimilimithara {TSE}"),
        ["kg"] = ("dikhilograma", $"dikhilograma {TSE}"),
    };

    /** THE SQUARED COMPOUND, per unit — a table rather than a modifier because the compound RE-SHAPES its
     *  head: the class-10 `di-` moves to the FRONT and the head noun appears bare. ⚠ NO CUBED ROW and no
     *  cm²/mm²/kg² row: step 5 REFUSES THE WHOLE MATCH for them rather than emitting a length where the text
     *  wrote an area. */
    private static readonly Dictionary<string, string> SQUARED = new()
    {
        ["km"] = $"disekwere-khilomithara {TSE}",
        ["m"] = $"disekwere-mithara {TSE}",
    };

    private const string PER = "ka";
    private static readonly Dictionary<string, string> DENOM = new() { ["h"] = "iri", ["s"] = "motsotswana" };

    private static string RAND => $"diranta {TSE}";
    private static string DOLLAR => $"ditolara {TSE}";

    /** ⚠ THE DEGREE NOUN IS NOT MERELY UNFOUND, IT IS REFUTED — `dikgato` is this wiki's word for the
     *  imperial FOOT — so only the scale NAME is emitted, and only for Celsius. */
    private const string CELSIUS = "Celsius";

    private static readonly Dictionary<string, string> COMPASS = new()
    {
        ["N"] = "leboa", ["S"] = "borwa", ["E"] = "bohlabela", ["W"] = "bodikela",
    };

    /** THE SPAN JOINER. ⚠ DESCENDING SPANS ARE ADMITTED, a MEASURED divergence from the ascending-only guard
     *  the nya/rw siblings ship — this corpus's spans are dates counted backwards from the present. */
    private const string UNTIL = "go ya go";

    /** The digits of a fractional part, spaced so the number path speaks them one at a time. */
    private static string Spell(string integer, string frac) =>
        $"{integer} {string.Join(" ", Js.CodePoints(frac))}";

    /** Is `word` written within ~45 characters either side of this offset? The redundancy guard for CELSIUS.
     *  BOTH SIDES, because the one corpus sentence that writes the scale name writes it AFTER two figures
     *  that each carry the sign. */
    private static bool SaidNear(string full, int offset, int end, string word)
    {
        var from = Math.Max(0, offset - 45);
        var to = Math.Min(full.Length, end + 45);
        return full[from..to].Contains(word, StringComparison.Ordinal);
    }

    /** THE SHARED SYMBOL TIER, for the three classes it can express for nso. ⚠ THE PERCENT CONCORD IS PART
     *  OF THE WORD and is a DIFFERENT one in each slot — cl.9 `ye` for the singular, cl.10 `tše` for the
     *  rest; only the second can come from the manifest. `R` is claimed LOCALLY in step 4. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "peresente ye", $"diperesente {TSE}" },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { DOLLAR }, ["$"] = new[] { DOLLAR },
        },
        CurrencyPrefix = true,
        Magnitudes = new[] { "dimilione", "milione", "dibilione", "bilione", "dipilione", "pilione" },
        Ampersand = AND,
    });

    /** The bare unit token — a `km` with no numeral of its own. Only the WORD is local, and it is index 0 of
     *  the table, the citation form with no dangling concord. */
    private static readonly Func<string, string> BARE_UNIT =
        NormalizeSymbols.MakeBareUnitNormalizer(
            UNIT.Select(kv => new KeyValuePair<string, string>(kv.Key, kv.Value.Cite)).ToList());

    /** Unit keys longest-first, so `km` is tried before `m`. */
    private static readonly string UNIT_ALT = string.Join("|", UNIT.Keys.OrderByDescending(k => k.Length));
    private static readonly string DENOM_ALT =
        string.Join("|", UNIT.Keys.Concat(DENOM.Keys).OrderByDescending(k => k.Length));

    /** ⚠ A DOTTED DESIGNATION IS NOT A QUANTITY, and a one-letter unit key will claim it. BOTH HALVES ARE
     *  NEEDED: the lookahead stops a match beginning at the front of the designation, the lookbehind stops
     *  one beginning inside it. */
    private const string NOT_VERSION = "(?<![\\d.,])(?!802[.,]11[a-zA-Z](?![a-zA-Z\\d]))";

    private const string MAG = "dimilione|milione|dibilione|bilione|dipilione|pilione";

    // ── the patterns, in step order ─────────────────────────────────────────
    private static readonly JsRe DOTTED_CAPS =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:\\p{Lu}\\.[ \\u00a0]?){2,}(?:\\p{Lu}(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe DOT_OR_SPACE = JsRegex.Compile("[. \\u00a0]", "gu");  // NBSP
    private static readonly JsRe LEADING_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe SPACE_THEN_CAP = JsRegex.Compile("^[ \\u00a0]+\\p{Lu}", "u");  // space, NBSP

    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:,\\d{3}){1,4}(?!\\d|[.,]\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:\\.\\d{3}){1,4}(?!\\d|[.,]\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:[ \\u00a0\\u202f\\u2009]\\d{3}){1,4}(?!\\d)", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    private static readonly JsRe ENGLISH_ORDINAL =
        JsRegex.Compile("(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");

    private static readonly JsRe RAND_DECIMAL_OR_LONG = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])R[ \\u00a0]?(\\d+\\.\\d+|\\d{{4,}})([ \\u00a0](?:{MAG}))?(?![\\p{{L}}\\p{{M}}\\d])", "giu");  // space, NBSP
    private static readonly JsRe RAND_MAGNITUDE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])R[ \\u00a0]?(\\d+)([ \\u00a0](?:{MAG}))(?![\\p{{L}}\\p{{M}}\\d])", "giu");  // space, NBSP

    // ⚠ A TEMPLATE LITERAL in the TS, so the separators are the CHARACTERS, not the escapes.
    private static readonly JsRe UNIT_RE = JsRegex.Compile(
        $"{NOT_VERSION}(\\d+(?:[    ]\\d{{3}}(?!\\d)|[.,]\\d+)*)(?![\\d.,])[    ]?({UNIT_ALT})"  // NBSP, NNBSP, thin space
        + $"(?:[    ]?/[    ]?({DENOM_ALT})|[    ]?(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}])))?"  // NBSP, NNBSP, thin space
        + "(?![\\p{L}\\p{M}\\d'’ʼ])",
        "giu");

    private static readonly JsRe DEGREE_C = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \\u00a0]?[°º][ \\u00a0]?C(?![\\p{L}\\p{M}])", "gui");  // space, NBSP
    private static readonly JsRe DEGREE_F = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \\u00a0]?[°º][ \\u00a0]?F(?![\\p{L}\\p{M}])", "gui");  // space, NBSP
    private static readonly JsRe DEGREE_COMPASS = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \\u00a0]?[°º][ \\u00a0]?([NSEW])(?![\\p{L}\\p{M}])", "gu");  // space, NBSP
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \\u00a0]?[°º](?![\\p{L}\\p{M}])", "gu");  // space, NBSP

    private static readonly JsRe DASH_RANGE = JsRegex.Compile(
        "(?<![-–—\\d.,\\p{L}\\p{M}])(?<![-–—][ \\u00a0])(\\d+)[ \\u00a0]?[-–—][ \\u00a0]?(\\d+)(?![-–—\\d\\p{L}\\p{M}]|[.,]\\d)(?![ \\u00a0][-–—])",  // space, NBSP
        "gu");

    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?![\\d])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");

    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACE = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** Normalize one Sepedi input string — the shared symbol tier first, then this language's own rules. */
    public static string NormalizeSepedi(string input)
    {
        var s = SYMBOLS(input);

        // 1) DOTTED CAPITAL RUNS → the bare letters. ⚠ THE LETTERS ARE JOINED WITH A HYPHEN, NOT GLUED, and
        //    in this language that is not cosmetic: glued, `T.L.` meets the g2p's DIGRAPH table and reads as
        //    the lateral affricate, `P.H.` as the aspirate — trap 56 in miniature. ⚠ A DOT IS ONLY EVER
        //    KEPT, NEVER ADDED.
        var frozen = s;
        s = DOTTED_CAPS.Replace(s, m =>
        {
            var letters = string.Join("-", Js.CodePoints(DOT_OR_SPACE.Replace(m.Value, "")));
            var rest = frozen[(m.Index + m.Value.Length)..];
            if (LEADING_LETTER.IsMatch(rest)) return $"{letters} ";
            if (!m.Value.EndsWith(".", StringComparison.Ordinal)) return letters;
            return rest == "" || SPACE_THEN_CAP.IsMatch(rest) ? $"{letters}." : letters;
        });

        // 2) THOUSANDS DE-GROUPING. ⚠ Sepedi's wiki writes ALL THREE conventions at once and the
        //    discriminator is the BLOCK LENGTH, never the character. ⚠ AT MOST FOUR GROUPS — a measured cap,
        //    because the base-16 article tabulates 43- and 60-digit space-grouped powers of two.
        s = GROUP_COMMA.Replace(s, m => COMMAS.Replace(m.Value, ""));
        s = GROUP_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));
        s = GROUP_SPACE.Replace(s, m => SPACE_SEPS.Replace(m.Value, ""));

        // 3) THE ENGLISH ORDINAL SUFFIX — foreign orthography on a digit; stripping it is the whole fix.
        s = ENGLISH_ORDINAL.Replace(s, "$1");

        // 4) THE RAND SIGN — LOCAL, because `R` is also South Africa's ROUTE prefix. ⚠ THE DISCRIMINATOR IS
        //    WHAT THE FIGURE CARRIES: all nine currency instances have a magnitude word, a decimal point or a
        //    grouping separator, and neither road number has any of the three.
        s = RAND_DECIMAL_OR_LONG.Replace(s, m =>
            $"{RAND}{(m.Groups[2].Success ? m.Groups[2].Value : "")} {m.Groups[1].Value}");
        s = RAND_MAGNITUDE.Replace(s, m => $"{RAND}{m.Groups[2].Value} {m.Groups[1].Value}");

        // 5) UNITS — noun first, concord, then the figure. ⚠ AN UNSAYABLE POWER, AND A RATE WITH AN
        //    UNDECLARED DENOMINATOR, REFUSE THE WHOLE MATCH: half a reading is not a reading.
        s = UNIT_RE.Replace(s, m =>
        {
            var num = m.Groups[1].Value;
            var k = m.Groups[2].Value.ToLowerInvariant();
            if (!UNIT.TryGetValue(k, out var forms)) return m.Value;
            var head = Js.Number(num) == 1 ? forms.Cite : forms.Counted;
            if (m.Groups[3].Success)
            {
                var dl = m.Groups[3].Value.ToLowerInvariant();
                var dWord = DENOM.TryGetValue(dl, out var dw) ? dw
                    : UNIT.TryGetValue(dl, out var uf) ? uf.Cite : null;
                if (dWord is null) return m.Value; // half a rate is not a reading
                return $"{head} {num} {PER} {dWord}";
            }
            if (m.Groups[4].Success)
            {
                var exp = m.Groups[4].Value;
                if (exp == "³" || exp == "3") return m.Value; // no cube word exists for nso
                if (!SQUARED.TryGetValue(k, out var sq)) return m.Value; // no square compound attested
                return $"{sq} {num}";
            }
            return $"{head} {num}";
        });

        // 6) THE BARE UNIT TOKEN, after the digit-adjacent path has had every chance. ⚠ TWO OF THESE KEYS
        //    ARE TRAP-56 MISREADS RATHER THAN LEAKS: `kg` is the Sepedi DIGRAPH for /kx/, and `cm` reads
        //    [km], one ejective mark away from ⟨km⟩.
        s = BARE_UNIT(s);

        // 7) DEGREES. ⚠ ONLY CELSIUS IS NAMED (`Fahrenheit` is ×0, so `°F`'s letter is CLAIMED and the scale
        //    left unsaid), the scale name is SUPPRESSED when the clause already carries it, and both `°`
        //    and the MASCULINE ORDINAL INDICATOR `º` are in the class.
        var degFrozen = s;
        s = DEGREE_C.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return SaidNear(degFrozen, m.Index, m.Index + m.Value.Length, CELSIUS) ? n : $"{n} {CELSIUS}";
        });
        s = DEGREE_F.Replace(s, "$1");
        s = DEGREE_COMPASS.Replace(s, m => $"{m.Groups[1].Value} {COMPASS[m.Groups[2].Value]}");
        s = DEGREE_BARE.Replace(s, "$1");

        // 8) RANGES → `go ya go`. ⚠ THE ONE NUMERIC GUARD IS A DIGIT-LENGTH GAP OF TWO OR MORE, which is what
        //    separates a span from a standard's part number and from an abbreviated year span. ⚠ AND THE
        //    HYPHEN GUARD REACHES ACROSS A SPACE, or the wiki's spaced year-index chains read as spans.
        s = DASH_RANGE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Math.Abs(a.Length - b.Length) >= 2 ? m.Value : $"{a} {UNTIL} {b}";
        });

        // 9) DECIMALS, LAST of the numeric rules. NO separator word is emitted; see the TS header for the
        //    `khutlo` register finding. ⚠ THE COMMA ARM'S `(?![\d,])` IS WHAT DECLINES A LIST.
        s = DECIMAL_DOT.Replace(s, m => Spell(m.Groups[1].Value, m.Groups[2].Value));
        s = DECIMAL_COMMA.Replace(s, m => Spell(m.Groups[1].Value, m.Groups[2].Value));

        // A padded replacement doubles a space that was already there and can leave one at an edge.
        return EDGE_SPACE.Replace(MULTI_SPACE.Replace(s, " "), "");
    }
}
