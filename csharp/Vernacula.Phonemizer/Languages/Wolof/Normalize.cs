/**
 * Wolof (wo) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE SHARED SYMBOL TIER IS INVOKED FROM INSIDE THE SEQUENCE (step 4), not wrapped around it: the HTML
 * entity fold must precede it (`km&sup2` has to present a real `²`, and `10&nbsp;km` a real space) while
 * de-grouping and the decimal spell-out must follow it (the tier matches `1 219 912` and `43,3` whole).
 *
 * Ported from src/languages/wolof/normalize.ts, whose header carries the whole evidential record: the
 * three-way separator census, the sourcing for every emitted word (and, where the biggest count was the
 * WRONG word, that count beside it — `aj` is ×80 the HAJJ and ×3 the degree), the two SI keys refused for
 * their KEY rather than their word (`g` is the era marker ×50, bare `m` is a year marker), and the priced
 * refusals — the clock (33 of 33 are scripture references), initialisms, `=`, multiplication, the minus,
 * fractions, the era expansion, CFA and `€`. Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Wolof;

public static class Normalize
{
    /**
     * The shared symbol tier. ⚠ NO `CountForms` HAS MORE THAN ONE ENTRY — Wolof marks plurality on the
     * noun's class prefix, not by a suffix after a numeral, so one citation form is the whole agreement
     * story. See the TS for each word's attestation.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        /** ⟨%⟩ → `ci téeméer`, "in a hundred", POSTPOSED — the sign and its reading appear in one sentence
         *  on wo.wikipedia, twice. */
        Percent = new[] { "ci téeméer" },
        /** ⚠ `US$` IS ITS OWN KEY because the tier's currency pattern is letter-bounded on the left. */
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "dolaar" }, ["$"] = new[] { "dolaar" },
        },
        /** The magnitude spellings this corpus actually writes — six of "million" and three of "billion".
         *  ⚠ DECLARED FOR BOTH CONSUMERS: the currency path and the UNIT path both need it. */
        Magnitudes = new[]
        {
            "junni-junni", "junni", "miliyaar", "milyaar", "bilyoŋ",
            "miliyoŋ", "milyioŋ", "milyoŋ", "milioŋ", "milyong", "miliari", "tamñareet",
        },
        /** Wolof joins a magnitude to the noun it counts with `ci` plus its `y`-linker. */
        MagnitudeConnective = "ciy",
        /** ⚠ TWO SI KEYS ARE REFUSED FOR THEIR KEY, NOT THEIR WORD: `g` is the ERA MARKER in all 50
         *  digit-adjacent instances, and bare `m` is the `miladi` year marker in its only one. */
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilomet" },
            ["cm"] = new[] { "sàntimet" },
            // ⚠ ITS DEFECT PRODUCED A READING, NOT A LEAK: the gemination rule claims ⟨mm⟩, so `150mm` read
            // as a plausible Wolof geminate where a millimetre belongs.
            ["mm"] = new[] { "milimet" },
            ["kg"] = new[] { "kilogaraam" },
        },
        /** ⟨²⟩ → `kaare`, POSTPOSED. ⚠ `cubed` IS OMITTED and the cost is stated in the TS: the tier's
         *  exponent branch re-emits an undeclared power, leaving the superscript visible. */
        ExponentWords = new ExponentWordsDef { Squared = new[] { "kaare" }, Position = ExponentPosition.After },
        /** ⟨&⟩ → `ak`. ⚠ THE ENTITY FOLD IN STEP 1 IS WHAT MAKES THIS SAFE — 7 of the 9 ampersands in the
         *  retained text are entity references. */
        Ampersand = "ak",
    });

    /** The degree noun — trap 37 in its sharpest form: `aj` is ×80 the HAJJ and ×3 the degree, and only the
     *  COLLOCATION beside the sign attests the unit sense. */
    private const string DEGREE = "aj";

    /** The span joiner — an INFIX taking both operands, ×15 digit-flanked in the retained corpus. */
    private const string SPAN = "ba";

    /** The semicolon-less HTML entities this corpus writes, which `core/markup.ts` does not decode because
     *  its pattern REQUIRES the closing semicolon. ⚠ `&alpha` is deliberately NOT decoded to a letter — the
     *  `&` is spent so step 4 cannot read it as the conjunction. */
    private static readonly Dictionary<string, string> ENTITY = new()
    {
        ["&sup2"] = "²", ["&sup3"] = "³", ["&nbsp"] = " ", ["&alpha"] = "alpha",
    };

    /** The digits of a fractional part, spaced so the number path speaks them one at a time. No separator
     *  word is emitted; see the TS header's `tomb` refusal. */
    private static string Spell(string integer, string frac) =>
        $"{integer} {string.Join(" ", Js.CodePoints(frac))}";

    /** Is `word` written as a whole token within ~45 characters AFTER this match? ⚠ AFTER-ONLY, measured:
     *  all four redundant instances put the gloss after the sign, and a before-arm would over-suppress the
     *  one instance that most needs the word. ⚠ WHOLE-TOKEN, because `aj` is a substring of the pilgrimage
     *  words `ajiin` and `ajkat`. */
    private static bool SaidAfter(string full, int end, string word)
    {
        var re = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){word}(?![\\p{{L}}\\p{{M}}])", "u");
        var from = Math.Min(full.Length, end);
        return re.IsMatch(full[from..Math.Min(full.Length, end + 45)]);
    }

    /**
     * A CLOCK'S COLON LOSES ITS PAUSE — but ONLY when a day-part or timezone MARKER follows (#1111).
     * ⚠ THE MARKER IS THE WHOLE RULE, because Wolof is the language where a bare-colon rule is provably
     * wrong: the mined artifact's 33 `d:dd` are 33 SCRIPTURE REFERENCES, and FLEURS adds a SPORTS TIME.
     * Keyed on the marker instead: 4 fixed, 0 claimed. ⚠ IT EMITS NO WORD — no Wolof hour noun is sourced
     * here. ⚠ THE MARKER LIST IS EXACTLY WHAT IS ATTESTED. See the TS for the counts.
     */
    private static readonly JsRe CLOCK_MARKED = JsRegex.Compile(
        "(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])(?=[ \\u00a0]*(?:ci[ \\u00a0]+(?:suba|ngoon)|GMT)(?![\\p{L}\\p{M}]))",  // space, NBSP
        "giu");

    // ── the patterns, in step order ─────────────────────────────────────────
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe NAMED_ENTITY = JsRegex.Compile("&(?:sup2|sup3|nbsp|alpha);?", "giu");
    private static readonly JsRe FORMAT_CHARS = JsRegex.Compile("\\p{Cf}", "gu");

    private static readonly JsRe DEGREE_TWO_OPERANDS =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)[ \\u00a0]?°[ \\u00a0]?(?=\\d)", "gu");  // space, NBSP
    private static readonly JsRe DEGREE_BARE =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)[ \\u00a0]?[°º](?![\\d\\p{L}\\p{M}])", "gu");  // space, NBSP

    private static readonly JsRe DOTTED_ERA =
        JsRegex.Compile("(?<![\\p{L}\\p{M}.])[a-z](?:\\.[a-zA-Z]){1,3}\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe ONLY_SPACES = JsRegex.Compile("^[ \\u00a0]*$", "u");  // space, NBSP
    private static readonly JsRe SPACE_THEN_CAP = JsRegex.Compile("^[ \\u00a0]+\\p{Lu}", "u");  // space, NBSP

    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:,\\d{3})+(?![\\d]|[.,]\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:\\.\\d{3})+(?![\\d]|[.,]\\d)", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:[ \\u00a0\\u202f\\u2009]\\d{3})+(?![\\d])", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    private static readonly JsRe DASH_RANGE = JsRegex.Compile(
        "(?<![-:\\d.,\\p{L}\\p{M}])(\\d+)[ \\u00a0]?[-–—][ \\u00a0]?(\\d+)(?![-:\\d\\p{L}\\p{M}]|,\\d)", "gu");  // space, NBSP
    /** ⚠ AND NOT AFTER A MULTIPLICATION DOT — `1,602 189 2 ∙ 10 -19` would otherwise become `10 ba 19`. */
    private static readonly JsRe MULT_DOT_BEFORE = JsRegex.Compile("[·∙×][ \\u00a0]*$", "u");  // space, NBSP

    private static readonly JsRe ENGLISH_ORDINAL =
        JsRegex.Compile("(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");

    private static readonly JsRe DECIMAL_ZERO = JsRegex.Compile("(?<![\\d.,:])0[.,](\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.,:])(\\d+)\\.(\\d{1,2})(?![\\d.,])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,:])(\\d+),(\\d{1,2})(?![\\d.,])", "gu");

    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACE = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** Normalize one Wolof input string. Steps are ORDER-DEPENDENT; each coupling is stated in the TS. */
    public static string NormalizeWolof(string input)
    {
        var s = input;

        // 0) A MARKED clock loses the colon's clause pause — see CLOCK_MARKED. First, so every numeric
        //    step below sees one digit run rather than two.
        s = CLOCK_MARKED.Replace(s, "$1 $2");

        // 1) NFC, THE SEMICOLON-LESS HTML ENTITIES, AND FORMAT CHARACTERS. ⚠ `&amp;` IS UNFOLDED FIRST, and
        //    the format-character strip is not cosmetic — a zero-width character inside a word splits it
        //    into two tokens.
        s = s.Normalize(System.Text.NormalizationForm.FormC);
        s = AMP_ENTITY.Replace(s, "&");
        s = NAMED_ENTITY.Replace(s, m =>
        {
            // JS `e.slice(1).replace(";", "")` — a STRING replace, so only the FIRST `;` goes.
            var key = "&" + Js.ToLowerCase(ReplaceFirst(m.Value[1..], ";", ""));
            // ⚠ THE MISS BRANCH IS REACHABLE AND FALLS BACK TO THE MATCH (#1122). The pattern carries `i`
            // AND `u`, so JS folds U+017F LONG S onto `s` and `&ſup2` MATCHES while the key does not exist.
            // Until #1122 the TS asserted non-null and `String.replace` stringified the `undefined`, so the
            // word was spoken; this port reproduced that deliberately. Both now pass the run through.
            return ENTITY.TryGetValue(key, out var v) ? v : m.Value;
        });
        s = FORMAT_CHARS.Replace(s, "");

        // 2) DEGREES → `aj`, BEFORE the tier and before de-grouping. The two-operand arm comes FIRST, or the
        //    bare arm claims `12°8` and strands the `8`. ⚠ The bare arm REFUSES A GLUED LETTER: with no
        //    scale name to emit there is no whole reading available, so `20 °C` is refused entire.
        var degFrozen = s;
        s = DEGREE_TWO_OPERANDS.Replace(s, m =>
            $"{Degree(m.Groups[1].Value, m.Index, m.Value.Length, degFrozen)} ");
        var bareFrozen = s;
        s = DEGREE_BARE.Replace(s, m =>
            Degree(m.Groups[1].Value, m.Index, m.Value.Length, bareFrozen));

        // 3) THE DOTTED ERA AND HONORIFIC MARKERS — de-dotted, NOT expanded. ⚠ NO EXPANSION IS INVENTED: a
        //    definitional gloss is the wrong REGISTER for what a reader says. ⚠ EVERY ELEMENT MUST BE A
        //    SINGLE LETTER, which keeps this off ordinary prose and off a domain name.
        var eraFrozen = s;
        s = DOTTED_ERA.Replace(s, m =>
        {
            var letters = string.Join(" ", Js.CodePoints(DOTS.Replace(m.Value, "")));
            var rest = eraFrozen[(m.Index + m.Value.Length)..];
            return rest == "" || ONLY_SPACES.IsMatch(rest) || SPACE_THEN_CAP.IsMatch(rest)
                ? $"{letters}." : letters;
        });

        // 4) THE SHARED SYMBOL TIER — after step 1 (it needs a real `²` and a real space) and before steps 5
        //    and 9 (it needs `1 219 912` and `43,3` as single operands).
        s = SYMBOLS(s);

        // 5) THOUSANDS DE-GROUPING. ⚠ EXACTLY THREE DIGITS PER BLOCK AND A HEAD STARTING 1–9 — the leading
        //    guard is what keeps the genuine 3-place decimals out, and step 9's third arm then claims them.
        s = GROUP_COMMA.Replace(s, m => COMMAS.Replace(m.Value, ""));
        s = GROUP_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));
        s = GROUP_SPACE.Replace(s, m => SPACE_SEPS.Replace(m.Value, ""));

        // 6) RANGES → `ba`. ⚠ THE `:` IS IN BOTH GUARDS, which is what keeps the rule off this corpus's
        //    dominant colon shape — SCRIPTURE. ⚠ ASCENDING ONLY, and not after a multiplication dot.
        var rangeFrozen = s;
        s = DASH_RANGE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            var before = rangeFrozen[Math.Max(0, m.Index - 3)..m.Index];
            return Js.Number(a) < Js.Number(b) && !MULT_DOT_BEFORE.IsMatch(before) ? $"{a} {SPAN} {b}" : m.Value;
        });

        // 7) THE ENGLISH ORDINAL SUFFIX — always foreign orthography here; Wolof writes its own as
        //    `-eel(u)`/`-eem`, which already reads.
        s = ENGLISH_ORDINAL.Replace(s, "$1");

        // 8) A LONE `+` IS LEFT UNREAD, deliberately — the sign does not occur in this corpus at all.

        // 9) DECIMALS, LAST of the numeric rules. NO SEPARATOR WORD IS EMITTED. ⚠ THE `:` IS IN THE LEADING
        //    GUARD AND `,` IN THE TRAILING ONE, or the scripture verse enumerations claim the rule.
        s = DECIMAL_ZERO.Replace(s, m => Spell("0", m.Groups[1].Value));
        s = DECIMAL_DOT.Replace(s, m => Spell(m.Groups[1].Value, m.Groups[2].Value));
        s = DECIMAL_COMMA.Replace(s, m => Spell(m.Groups[1].Value, m.Groups[2].Value));

        // A padded replacement doubles a space that was already there and can leave one at an edge.
        return EDGE_SPACE.Replace(MULTI_SPACE.Replace(s, " "), "");
    }

    private static string Degree(string n, int off, int len, string full) =>
        SaidAfter(full, off + len, DEGREE) ? n : $"{n} {DEGREE}";

    /** JS `String.prototype.replace(string, string)` — the FIRST occurrence only. */
    private static string ReplaceFirst(string s, string find, string with)
    {
        var i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + with + s[(i + find.Length)..];
    }
}
