/**
 * Kirundi / Ikirundi (rn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS FILE OWNS THE SHARED-TIER CALL (step 7), because rn needs rules on BOTH sides of it: de-grouping
 * must run BEFORE (rn's whole `version-dot` cell is grouped thousands glued to an abbreviation, which the
 * tier's `NOT_VERSION` guard refuses) and the decimal spell-out AFTER (or the tier sees `196 7 km²` with no
 * number beside the sign). Neither the Xhosa order nor the Chichewa one expresses that.
 *
 * ⚠⚠ KINYARWANDA IS NOT A SOURCE FOR KIRUNDI, AND THE TS HEADER IS THE PROOF — seven rules diverge after
 * re-measurement against rn's own corpus, one of which (`kare` → `kwadarato`) would have read every area
 * figure as the ADVERB "early". Nothing here is inherited from the sibling; see that file for the table,
 * for every per-word attestation, and for the priced refusals (no clock, no Fahrenheit name, no euro or
 * franc key, no one-letter unit key, no cube word, no compass table, no minus).
 *
 * Ported from src/languages/kirundi/normalize.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kirundi;

public static class Normalize
{
    /** The manifest's own conjunction — the number joiner, reused for `&` and for a temperature span, so
     *  the three can never drift apart. */
    private static readonly string AND = Manifest.MANIFEST.Numbers.And;

    /** THE MEASURE NOUNS, one table shared by the tier (step 7, number-then-unit) and by step 4
     *  (unit-then-number, which the tier cannot see). Both PRECEDE their figure.
     *  ⚠ INSERTION-ORDERED, like JS `Object.keys`: the PRE/DENOM alternations are built by a STABLE
     *  length-descending sort over this order.
     *  ⚠ NO ONE-LETTER KEY IS DECLARED, the OPPOSITE decision from rw: Kirundi writes the locative elision
     *  `50 m’ubumwe`, digit-adjacent `m` is ×1 and that is the one, and `metero` is spelled out in all six
     *  of its wiki attestations. */
    private static readonly IReadOnlyList<KeyValuePair<string, string>> UNIT =
    [
        new("km", "ibirometero"),
        new("mm", "milimetero"),
    ];

    private static readonly IReadOnlyDictionary<string, string> UNIT_MAP =
        UNIT.ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);

    /** ⚠ THE SINGULAR OF THE KILOMETRE NOUN, for DENOMINATOR position only, and the noun class is the whole
     *  point: a quantity takes the class-8 plural (`Ibirometero kwadarato 1,089`) and the per-unit
     *  connective takes the class-7 singular (`Abantu 542 ku kirometero kwadarato`). Both attested in their
     *  own slot, which is why this is a second table. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_SG =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["km"] = "kirometero",
            ["mm"] = "milimetero",
        };

    /** SQUARED — `kwadarato`, the single most important finding of the bring-up. ⚠ rw's `kare` FAILS TRAP 37
     *  here: it scores 20 hits / 15 articles on rn.wikipedia and every one is the ADVERB "early". */
    private const string SQUARED = "kwadarato";

    /** ⚠ NO SCALE NAME IS EMITTED FOR EITHER `°C` OR `°F`. The scale LETTER is claimed — it cannot reach the
     *  g2p as a phoneme, which is the defect that mattered (⟨C⟩ reads [t͡ʃ]) — the degree is spoken, and the
     *  scale is left unsaid rather than borrowed from Kinyarwanda. */
    private const string DEGREE = "dogere";

    /** THE DOLLAR — class-8 plural, and ⟨l⟩ is not a Kirundi letter: the 1983 orthography conference ruled
     *  on this exact word (`Amadolari` → `Amadorari`). See the TS for why a word-first probe missed it. */
    private const string DOLLAR = "amadorari";

    /** THE SPAN JOINER, in two shapes. A pair of FOUR-DIGIT YEARS takes the full `kuva A gushika B` frame
     *  (14/14 in Kirundi running text, zero bare instances); anything else takes the bare infix. */
    private const string FROM = "kuva";
    private const string UNTIL = "gushika";
    private const string UNTIL_AT = "gushika kuri";

    /** ⚠ A TEMPERATURE SPAN TAKES THE PLAIN CONJUNCTION, NOT `gushika` — `hagati ya 17°C na 29°C`. Read from
     *  the manifest so it cannot drift from the numeral joiner. */
    private static readonly string DEGREE_AND = Manifest.MANIFEST.Numbers.And;

    /** The per-unit connective, the word the corpus itself puts in front of a bare denominator. */
    private const string PER = "kuri";

    /**
     * The shared symbol tier. ⚠ `Magnitudes` IS DELIBERATELY WITHHELD: rn writes MAGNITUDE-then-NUMBER in
     * all 17 corpus instances, the tier's `magAlt` matches the other order, so the hop can never fire — and
     * the same field gates `magAltU`, whose shape is ×0 here for the same reason. `UnitPer` is not declared
     * (a composed rate is ×0; the only slashed units are bare denominators, which step 8 claims locally).
     * `BareExponent`, `Multiply` and `€` are refused with their counts in the TS header.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ POSTPOSED, and rw's spelling `ku ijana` is ×0 in rn — Kirundi writes the elided form 7 of 7.
        Percent = new[] { "kw'ijana" },
        // ⚠ INSERTION-ORDERED, like JS `Object.keys`: the tier sorts currency keys longest-first, stably.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { DOLLAR },
            ["$"] = new[] { DOLLAR },
        },
        CurrencyPrefix = true,
        // Derived from the ONE table above, so the tier and step 4 can never name different words for one key.
        Units = UNIT.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<string>)new[] { kv.Value }, StringComparer.Ordinal),
        UnitPrefix = true,
        // ⚠ NO CUBE WORD IS DECLARED — `m³`/`km³` are ×0 in rn and no Kirundi cube word is attested.
        ExponentWords = new ExponentWordsDef { Squared = new[] { SQUARED }, Position = ExponentPosition.After },
        Ampersand = AND,
    });

    /** Unit keys longest-first, over the declaration order above. */
    private static string Alternation(IEnumerable<string> keys) =>
        string.Join("|", keys.OrderByDescending(k => k.Length));

    private static readonly string PRE_UNIT = Alternation(UNIT.Select(kv => kv.Key));
    private static readonly string DENOM_UNIT = Alternation(UNIT_SG.Keys);

    // ── the patterns, in step order ─────────────────────────────────────────
    // ⚠ EVERY SEPARATOR CLASS IS SPELLED AS AN ESCAPE, NEVER AS A LITERAL CHARACTER. A literal NBSP in C#
    // source is invisible to review and to every corpus line but one — the nso lesson (#1109). Where the TS
    // used a template literal the escape had already been resolved to the character; inside a class the two
    // are the same pattern, and the escape is the one that cannot degrade silently.

    private static readonly JsRe DOTTED_RUN = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(?:\\p{Lu}\\.[ \\u00a0]?){2,}(?:\\p{Lu}(?![\\p{L}\\p{M}]))?", "gu");  // space, NBSP
    private static readonly JsRe DOTS_AND_SPACES = JsRegex.Compile("[. \\u00a0]", "gu");  // space, NBSP
    private static readonly JsRe LEADING_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe LEADING_SPACE_CAP = JsRegex.Compile("^[ \\u00a0]+\\p{Lu}", "u");  // space, NBSP

    private static readonly JsRe DOTTED_DATE =
        JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?![\\d.,])", "gu");

    /** ⚠ THE COMMA ARM'S TRAILING GUARD DOES NOT REJECT A FOLLOWING DOT, and that asymmetry is the ANGLO
     *  form: `1,964.54` (×9, every one an area) is comma grouping followed by a dot decimal. rw's guard
     *  copied over left all nine with a clause pause inside the figure. */
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:,\\d{3})+(?!\\d|,\\d)", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:\\.\\d{3})+(?!\\d|[.,]\\d)", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:[ \\u00a0\\u202f\\u2009]\\d{3})+(?!\\d)", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    /** ⚠ THE SPACE IS MANDATORY: the unspaced shape means something else entirely — `km2` is `km²` with an
     *  ASCII exponent — and an optional space would let this rule read that `2` as the unit's NUMBER. */
    private static readonly JsRe UNIT_BEFORE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({PRE_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}]))?(?=[ \\u00a0]\\d)", "giu");  // space, NBSP

    private static readonly JsRe FOUR_DIGITS = JsRegex.Compile("^\\d{4}$", "u");
    /** ⚠ THE SUPPRESSION LOOK-BACK MUST END IN OPTIONAL SPACE: `\S{0,10}$` can only reach the figure when
     *  `kuva` is IMMEDIATELY before it, so `kuva muri 2010 – 2012` doubled the word the text already wrote. */
    private static readonly JsRe ALREADY_FROM = JsRegex.Compile("(?:kuva|guhera)\\s\\S{0,10}\\s*$", "iu");

    private static readonly JsRe DEGREE_SPAN_SIGNED = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d.,:/-])(\\d+)[ \\u00a0]?[-–—/][ \\u00a0]?(\\d+)[ \\u00a0]?°[ \\u00a0]?[CF]?(?![\\p{L}\\p{M}])", "gui");  // space, NBSP
    private static readonly JsRe DEGREE_SPAN_NAMED = JsRegex.Compile(
        $"(?<={DEGREE}[ \\u00a0])(\\d+)[ \\u00a0]?[-–—/][ \\u00a0]?(\\d+)(?![\\d.,:/])", "giu");  // space, NBSP

    /** ⚠ THE GUARD IS WHAT MAKES THE SLASH SPAN SAFE: `(?<![\d.,:/])` rejects a second or third date field
     *  and the `22` of a verse reference, `(?![\d.,]*[/:])` rejects a FIRST date field, and a denominator is
     *  excluded because the character after the slash must be a digit. */
    private static readonly JsRe SLASH_SPAN =
        JsRegex.Compile("(?<![\\d.,:/])(\\d+)[ \\u00a0]?/[ \\u00a0]?(\\d+)(?![\\d.,]*[/:])", "gu");  // space, NBSP
    /** ⚠ ITS TRAILING SEPARATOR TEST IS `[.,]\d`, NOT A BARE `[.,]` — the bare class declined all three of
     *  rn's clause-final spans, which then read as two juxtaposed cardinals at a sentence end (trap 58). */
    private static readonly JsRe DASH_SPAN = JsRegex.Compile(
        "(?<![-\\d.,\\p{L}\\p{M}])(\\d+)[ \\u00a0]?[-–—][ \\u00a0]?(\\d+)(?![-\\d\\p{L}\\p{M}]|[.,]\\d)", "gu");  // space, NBSP

    private static readonly JsRe DECIMAL_WHOLE = JsRegex.Compile("^(\\d+)[.,](\\d+)$", "u");
    private static readonly JsRe DEGREE_SCALE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])([-−–]?)(\\d+(?:[.,]\\d+)?)[ \\u00a0]?°[ \\u00a0]?[CF](?![\\p{L}\\p{M}])", "gui");  // space, NBSP
    private static readonly JsRe DEGREE_COORD = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])([-−–]?)(\\d+(?:[.,]\\d+)?)[ \\u00a0]?°(?=[ \\u00a0]?\\d+[′'])", "gu");  // space, NBSP
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])([-−–]?)(\\d+(?:[.,]\\d+)?)[ \\u00a0]?[°º](?![\\p{L}\\p{M}])", "gu");  // space, NBSP

    private static readonly JsRe PERCENT_SIGN = JsRegex.Compile("(\\d)[ \\u00a0]?%", "gu");  // space, NBSP
    /** ⚠ BOTH APOSTROPHES, because the corpus writes `kw'ijana` (U+0027) and `kw’ijana` (U+2019) and the two
     *  render identically. */
    private static readonly JsRe PERCENT_WORD = JsRegex.Compile("kw['’]ijana", "iu");

    /** ⚠ MULTI-LETTER KEYS ONLY, which is what buys the `i` flag safely: a one-letter key here would read a
     *  URL PATH SEGMENT as a unit, and the numeral guard that protects the other positions does not exist in
     *  denominator position. */
    private static readonly JsRe DENOM_SLASH = JsRegex.Compile(
        $"/[ \\u00a0]?({DENOM_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}]))?(?![\\p{{L}}\\p{{M}}\\d'’])", "giu");  // space, NBSP

    private static readonly JsRe COLON_PAIR =
        JsRegex.Compile("(?<![\\d:])(\\d{1,2}):[ \\u00a0]?(\\d{2})(?![:\\d])", "gu");  // space, NBSP

    private static readonly JsRe DECIMAL_DOT =
        JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?!\\d|[.,]\\d)", "gu");
    private static readonly JsRe DECIMAL_COMMA =
        JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?!\\d|[.,]\\d)", "gu");

    private static readonly JsRe RUN_OF_SPACES = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACES = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `54`
     *  in `1,964.54` as a NUMBER would say "fifty-four", a different quantity from "five four". */
    private static string Spell(string i, string frac) => $"{i} {string.Join(" ", Js.CodePoints(frac))}";

    /** JS `String.prototype.slice` — clamping, never throwing, where .NET's range operator would. */
    private static string Slice(string s, int start, int end)
    {
        var a = Math.Clamp(start, 0, s.Length);
        var b = Math.Clamp(end, a, s.Length);
        return s[a..b];
    }

    /** Is `word` written within ~45 characters either side of this offset? The redundancy guard for
     *  `dogere`. BOTH SIDES, because Kirundi puts the noun BEFORE its figure while a gloss would postpose it. */
    private static bool SaidNear(string full, int offset, int end, string word) =>
        Slice(full, offset - 45, end + 45).Contains(word, StringComparison.Ordinal);

    private static bool IsYear(string a, string b) => FOUR_DIGITS.IsMatch(a) && FOUR_DIGITS.IsMatch(b);

    /** The span joiner, chosen by what is spanned — and `kuva` is suppressed when the text already supplies
     *  one within ~12 characters to the left. */
    private static string Join(string a, string b, string full, int off, bool dash) =>
        dash && IsYear(a, b)
            ? $"{(ALREADY_FROM.IsMatch(Slice(full, off - 14, off)) ? "" : $"{FROM} ")}{a} {UNTIL} {b}"
            : $"{a} {UNTIL_AT} {b}";

    private static string SpellDec(string n)
    {
        var m = DECIMAL_WHOLE.Match(n);
        return m.Success ? Spell(m.Groups[1].Value, m.Groups[2].Value) : n;
    }

    /** ⚠ THE NOUN GOES OUTSIDE A LEADING SIGN, not between it and its digits: `-39°C` was coming out
     *  `-dogere 39`, the minus stranded in front of a word. The sign is re-emitted after the noun so the
     *  text stays `dogere -39` — still unread, and still VISIBLE to the scan, which is the point. */
    private static string DegreeBody(string sign, string n, int off, int end, string full) =>
        $"{(SaidNear(full, off, end, DEGREE) ? "" : $"{DEGREE} ")}{sign}{SpellDec(n)}";

    /** Normalize one Kirundi input string. Steps are ORDER-DEPENDENT; the TS states each coupling. */
    public static string NormalizeKirundi(string input)
    {
        var s = input;

        // 1) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything reads an interior dot as a phrase
        //    break. ⚠ A DOT IS ONLY EVER KEPT, NEVER ADDED — the nya condition would manufacture a sentence
        //    break inside an institution's own name (`( E.P.E.L )`).
        // ⚠ `full` IS THE PRE-REPLACE STRING, as JS's replace callback argument is — snapshot it, or the
        // closure would see `s` as reassigned by this very statement. (Same for every pass below.)
        var src1 = s;
        s = DOTTED_RUN.Replace(s, m =>
        {
            var run = m.Value;
            var letters = DOTS_AND_SPACES.Replace(run, "");
            var rest = Slice(src1, m.Index + run.Length, src1.Length);
            if (LEADING_LETTER.IsMatch(rest)) return $"{letters} ";
            if (!run.EndsWith(".", StringComparison.Ordinal)) return letters;
            return rest == "" || LEADING_SPACE_CAP.IsMatch(rest) ? $"{letters}." : letters;
        });

        // 2) A DOTTED NUMERIC DATE — `d.m.yyyy`, ten of them in the biography frame, each emitting TWO
        //    spurious sentence breaks. ⚠ ONLY THE DOTS ARE SPENT: no month name is emitted, because the
        //    corpus glosses its own numeric date as three numbers. ⚠ BEFORE step 3, so a de-grouping arm
        //    can never see a date's `dd.mm` as the head of a grouped run.
        s = DOTTED_DATE.Replace(s, "$1 $2 $3");

        // 3) THOUSANDS DE-GROUPING, before every remaining numeric rule AND before the tier.
        //    ⚠ KIRUNDI WRITES THREE CONVENTIONS AT ONCE — the francophone `12.100.000`, the space form and
        //    the Anglo `1,964.54` — so all three arms are load-bearing, where rw's space arm was near-idle.
        //    ⚠ THE HEAD MUST START 1–9: a grouped number never opens with a leading zero.
        //    ⚠ NO `NOT_COORD` GUARD, and its absence is a MEASUREMENT: rn writes coordinates as
        //    degree-and-arcminute (`9°55'`), and `\d+[.,]\d{3}\s*°` is ×0 here. A guard with no instance is
        //    a misfire generator.
        s = GROUP_COMMA.Replace(s, m => COMMAS.Replace(m.Value, ""));
        s = GROUP_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));
        s = GROUP_SPACE.Replace(s, m => GROUP_SPACES.Replace(m.Value, ""));

        // 4) A UNIT ABBREVIATION WRITTEN BEFORE ITS NUMBER — `km 1,965`, `km² 517`, `mm 1.000`. The shared
        //    tier matches ONLY number-then-unit, so these are structurally invisible to it. The output is
        //    the SAME SHAPE the tier's `unitPrefix` produces, from the same table, so the two orders
        //    converge on one reading. ⚠ AFTER step 3, so a grouped operand is already one digit run.
        s = UNIT_BEFORE.Replace(s, m =>
        {
            var noun = UNIT_MAP[Js.ToLowerCase(m.Groups[1].Value)];
            return !m.Groups[2].Success ? noun : $"{noun} {SQUARED}";
        });

        // 5) SPANS. Both shapes are claimed HERE — before the tier, so a span's operands are still bare
        //    digits, and before step 8b so a verse reference has already been excluded by the guard rather
        //    than by luck. ⚠ ASCENDING ONLY, which is what declines the date span step 2 has just un-dotted.
        //    ⚠ A FOUR-DIGIT COUNT ALONE DOES NOT IDENTIFY A YEAR — `metero 1.500 / 1.800` is a pair of
        //    ALTITUDES — so the year frame needs BOTH a dash and two four-digit operands.

        //    5a) A SPAN OF DEGREES, CLAIMED FIRST. Left to the general arms, `27/28 ° C` becomes a span and
        //    step 6 then attaches the noun to the SECOND operand only — the operands split around the noun.
        //    ⚠ AND A TEMPERATURE SPAN TAKES `na`, NOT `gushika`: it is a different idiom, and using one for
        //    the other was the mistake the first draft made.
        var src5a = s;
        s = DEGREE_SPAN_SIGNED.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            if (!(Js.Number(a) < Js.Number(b))) return m.Value;
            var noun = SaidNear(src5a, m.Index, m.Index + m.Length, DEGREE) ? "" : $"{DEGREE} ";
            return $"{noun}{a} {DEGREE_AND} {b}";
        });
        //    The second shape: the corpus's own noun stands in front, so this arm emits none.
        s = DEGREE_SPAN_NAMED.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) ? $"{a} {DEGREE_AND} {b}" : m.Value;
        });

        //    5b) A `/` SPAN — an rn shape rw's corpus does not contain. AFTER step 3, so the operands are
        //    single runs.
        var src5b = s;
        s = SLASH_SPAN.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) ? Join(a, b, src5b, m.Index, false) : m.Value;
        });

        //    5c) A HYPHEN OR DASH SPAN. 14 of 15 are YEAR or REIGN spans, which is why there is NO
        //    unit-hoisting arm here: rn has no measurement span at all.
        var src5c = s;
        s = DASH_SPAN.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) ? Join(a, b, src5c, m.Index, true) : m.Value;
        });

        // 6) DEGREES — the sign was dropped outright and the scale letter reached the g2p as a PHONEME,
        //    ⟨C⟩ as [t͡ʃ]. ⚠ THE ARMS ARE ORDERED LONGEST-FIRST so `°C` is not claimed by the bare arm.
        //    ⚠ THE NOUN IS SUPPRESSED WHEN THE CLAUSE ALREADY CARRIES IT, and the guard looks BOTH WAYS.
        //    BEFORE step 9, which would break the number↔sign adjacency. ⚠ AFTER step 5, not before: a span
        //    whose second operand carries the sign is headed by ONE `dogere`.
        //    6a) A SCALE TEMPERATURE. The `F` letter is CLAIMED so it cannot reach the phoneme stream raw,
        //    but NO Fahrenheit name is emitted — `farenheti` is 0/0 on rn.wikipedia.
        var src6a = s;
        s = DEGREE_SCALE.Replace(s, m =>
            DegreeBody(m.Groups[1].Value, m.Groups[2].Value, m.Index, m.Index + m.Length, src6a));
        //    6b) A COORDINATE — `9°55'`. ⚠ NO COMPASS TABLE: Kirundi SPELLS THE DIRECTION OUT as an
        //    ordinary word, and `[NSEW]` after a degree is ×0 in rn.
        var src6b = s;
        s = DEGREE_COORD.Replace(s, m =>
            $"{DegreeBody(m.Groups[1].Value, m.Groups[2].Value, m.Index, m.Index + m.Length, src6b)} ");
        //    6c) A BARE DEGREE.
        var src6c = s;
        s = DEGREE_BARE.Replace(s, m =>
            DegreeBody(m.Groups[1].Value, m.Groups[2].Value, m.Index, m.Index + m.Length, src6c));

        // 6d) A REDUNDANT PERCENT SIGN — the clause already SPELLS the word, so the reading must say it
        //     ONCE. ⚠ THE SIGN IS DROPPED AND THE WORDS ARE KEPT, the language-idiomatic position. BEFORE
        //     step 7, so the tier never sees a sign that has already been spoken.
        var src6d = s;
        s = PERCENT_SIGN.Replace(s, m =>
            PERCENT_WORD.IsMatch(Slice(src6d, m.Index - 45, m.Index + m.Length + 45)) ? m.Groups[1].Value : m.Value);

        // 7) THE SHARED SYMBOL TIER — percent, currency, units, exponent, ampersand. ⚠ BETWEEN steps 3 and
        //    9 BY NECESSITY, and both directions are load-bearing. That is the whole reason this file owns
        //    the call.
        s = SYMBOLS(s);

        // 8) A UNIT USED AS A BARE DENOMINATOR, with no numeral of its own — `(233/km²)`, `3372 hab/km²`.
        //    The tier's rate path composes NUMERATOR + `/` + denominator and cannot see a denominator
        //    standing alone. ⚠ THE SINGULAR NOUN IS USED HERE, which is Kirundi noun class, not a typo.
        //    ⚠ AFTER THE TIER: run first, this would steal any real rate from the rate path.
        s = DENOM_SLASH.Replace(s, m =>
        {
            var noun = UNIT_SG[Js.ToLowerCase(m.Groups[1].Value)];
            return $" {PER} {(!m.Groups[2].Success ? noun : $"{noun} {SQUARED}")}";
        });

        // 8b) COLONS. rn has NO clock and NO race duration — all 6 instances are Bible verses plus one wiki
        //     signature — so there is nothing to compose and the only job is to stop `:` becoming a clause
        //     pause inside a single reference. ⚠ AFTER step 5a, whose guard already declined `12:22/24`.
        s = COLON_PAIR.Replace(s, "$1 $2");

        // 8c) A LONE `+`, `=`, `×` — and THE MINUS — are left unread, deliberately. See the TS header: rn's
        //     single negative number is a temperature whose sentence already says `munsi ya`, and no Kirundi
        //     word for the sign is attested anywhere. `review.ts --lang rn` stays RED on it on purpose,
        //     because omitting a minus INVERTS the value and a visible defect is the honest state.

        // 9) DECIMALS, LAST of the numeric rules — steps 2 to 8 all need their number intact, and the tier
        //    needs the digit adjacent to its sign. NO separator word is emitted; `sources.ts` reports
        //    `[NONE] decimal-point` for rn. ⚠ THE TRAILING GUARD IS `(?!\d|[.,]\d)`: it keeps a decimal at a
        //    sentence END readable, which `(?![\d.,])` would have broken.
        s = DECIMAL_DOT.Replace(s, m => Spell(m.Groups[1].Value, m.Groups[2].Value));
        s = DECIMAL_COMMA.Replace(s, m => Spell(m.Groups[1].Value, m.Groups[2].Value));

        // ⚠ A padded replacement doubles a space that was already there and can leave one at an edge.
        return EDGE_SPACES.Replace(RUN_OF_SPACES.Replace(s, " "), "");
    }
}
