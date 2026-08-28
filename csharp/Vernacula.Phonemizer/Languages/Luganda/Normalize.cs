/**
 * Luganda / Oluganda (lg) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ NO SHARED SYMBOL TIER IS WIRED. Luganda puts the measure noun BEFORE its number (`mmita 800`,
 * `kiromita 10`, `ddoola US$29`) and the shared tier can only POSTPOSE, so every unit and currency rule here
 * is local, in the language's own order. Only the PERCENT reading is postposed.
 *
 * Ported from src/languages/luganda/normalize.ts, whose header carries the whole evidential record: the
 * per-word attestations with their token/article counts, the three-convention separator census, and the
 * priced refusals — the degree scale, the era phrase, initialisms, the shilling, `ha`/`ft`/`mi`, the
 * magnitude letter, the ampersand, the arithmetic signs, the MINUS (a red gate, not an accepted silence)
 * and fractions. Nothing is re-derived here.
 */
using System.Collections.Concurrent;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Luganda;

public static class Normalize
{
    /** The PERCENT reading — the sign's own words, `kikumi` being this engine's own cardinal for 100. */
    private const string PERCENT = "ku kikumi";

    /** The RANGE joiner, and the allomorph is chosen by what the operand IS: a YEAR takes the temporal
     *  locative `mu`, a QUANTITY takes `ku`. */
    private const string YEAR_TO = "okutuuka mu";
    private const string NUM_TO = "okutuuka ku";

    private const string DOLLAR = "ddoola";
    private const string EURO = "euro";
    private const string POUND = "pawundi";

    private const string KILOMETRE = "kiromita";
    private const string METRE = "mmita";
    private const string CENTIMETRE = "sentimita";
    private const string MILLIMETRE = "milimita";
    private const string KILOGRAM = "kilo";

    /** The SQUARED modifier, postposed to its unit noun with the class-10 connective `eza`. */
    private const string SQUARED = "eza kyebiriga";

    /** The spelling variants each trap-12 guard must recognise, beyond the word the rule emits. */
    private static readonly Dictionary<string, string[]> ALSO_WRITTEN = new(StringComparer.Ordinal)
    {
        [KILOMETRE] = ["kiromiita", "kilomita", "kilomiita"],
        [METRE] = ["mita", "miita"],
        [CENTIMETRE] = ["sentimiita", "ssentimita"],
        [MILLIMETRE] = ["milimiita"],
        [KILOGRAM] = ["kiro"],
    };

    /** The needle list for a unit noun: the emitted spelling plus every variant attested for it. */
    private static string[] Spellings(string noun) =>
        ALSO_WRITTEN.TryGetValue(noun, out var also) ? [noun, .. also] : [noun];

    private static readonly JsRe NEEDLE_ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe NEEDLE_SPACE = JsRegex.Compile(" ", "gu");

    // ⚠ THE TS BUILDS THIS REGEX ON EVERY CALL. The needle sets are fixed, so it is cached here by the
    // joined alternation — same pattern, same flags, one compile. Behaviour is unchanged; only the cost is.
    private static readonly ConcurrentDictionary<string, JsRe> NeedleCache = new(StringComparer.Ordinal);

    /**
     * Is any of `words` written within ~45 characters either side of this match? The trap-12 guard, checked
     * on BOTH sides because a Luganda measure or currency noun normally PRECEDES its number.
     * ⚠ WORD-BOUNDED AND CASE-INSENSITIVE, and both halves are repairs: `kilo` is four characters inside
     * `kilometers`, and every one of these nouns is written sentence-initially somewhere in this corpus.
     */
    private static bool SaidNear(string full, int offset, int end, params string[] words)
    {
        var alt = string.Join("|", words.Select(w =>
            NEEDLE_SPACE.Replace(NEEDLE_ESCAPE.Replace(w, "\\$&"), "\\s+")));
        var re = NeedleCache.GetOrAdd(alt, a =>
            JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])(?:{a})(?![\\p{{L}}\\p{{M}}])", "iu"));
        var from = Math.Max(0, offset - 45);
        var to = Math.Min(full.Length, end + 45);
        return re.IsMatch(full[from..to]);
    }

    /**
     * A CLOCK'S SEPARATOR LOSES ITS PAUSE BEHIND `saawa` OR A DAY-PART/TIMEZONE MARKER — nothing else.
     * ⚠ THE HOUR NOUN IS WRITTEN IN FRONT and is the discriminator; the spelling varies (`saawa`/`ssaawa`,
     * glued in `kusaawa`) and the lookbehind tolerates all of it. ⚠ NO WORD IS EMITTED — `saawa` is already
     * written. ⚠ THE TRAILING GUARD REJECTS A DIGIT OR A SEPARATOR THAT CONTINUES THE NUMBER, NOT A CLAUSE
     * MARK. ⚠ THE DAY-PART MARKER IS `ez` + ANY LETTER, not `ez` + an apostrophe.
     */
    private static readonly JsRe CLOCK_MARKED = JsRegex.Compile(
        "(?:(?<=s{1,2}aawa\\s)([01]?\\d|2[0-3])[.:]([0-5]\\d)(?![\\d]|[.,:]\\d)"
        + "|(?<![\\d.,:])([01]?\\d|2[0-3])[.:]([0-5]\\d)(?![\\d]|[.,:]\\d)"
        + "(?=\\s*(?:am\\b|p\\.?\\s?m\\.?|GMT|UTC|ez[\\p{L}’'])))",
        "giu");

    private static readonly JsRe ENGLISH_ORDINAL =
        JsRegex.Compile("(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");

    private const string GROUPED = "[1-9]\\d{0,2}(?:,\\d{3})+|\\d+";
    private static readonly JsRe DASH_RANGE = JsRegex.Compile(
        $"(?<![-+−–—/\\d.,\\p{{L}}\\p{{M}}])({GROUPED})[ \\u00a0]?[-–—][ \\u00a0]?({GROUPED})"  // space, NBSP
        + "(?![-+−/\\d,\\p{L}\\p{M}])",
        "gu");

    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:,\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:[ \\u00a0\\u202f\\u2009]\\d{3})+(?!\\d)", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:\\.\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");

    private static readonly JsRe PERCENT_RE =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+(?:\\.\\d+)?)[ \\u00a0]?%", "gu");  // space, NBSP

    /** The trap-12 needle for the dollar arms — a SUBSTRING test in the TS, not the word-bounded one. */
    private static readonly JsRe NAMED_DOLLAR = JsRegex.Compile("d+oola|dolla|doola", "iu");
    private static readonly JsRe US_DOLLAR_SIGN =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])US[ \\u00a0]?\\$[ \\u00a0]?(?=\\d)", "giu");  // space, NBSP
    private static readonly JsRe DOLLAR_SIGN = JsRegex.Compile("\\$[ \\u00a0]?(?=\\d)", "gu");  // space, NBSP
    private static readonly JsRe EURO_SIGN = JsRegex.Compile("€[ \\u00a0]?(?=\\d)", "gu");  // space, NBSP
    private static readonly JsRe POUND_SIGN = JsRegex.Compile("£[ \\u00a0]?(?=\\d)", "gu");  // space, NBSP

    private static readonly JsRe KM_SQUARED = JsRegex.Compile(
        "(?<![\\d.,\\p{L}\\p{M}])(\\d+(?:\\.\\d+)?)[ \\u00a0\\u202f\\u2009]?km[²2](?![\\p{L}\\p{M}\\d])", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe KM_BARE = JsRegex.Compile(
        "(?<![\\d.,\\p{L}\\p{M}])(\\d+(?:\\.\\d+)?)[ \\u00a0\\u202f\\u2009]?km(?![\\p{L}\\p{M}\\d²³/])", "gu");  // space, NBSP, NNBSP, thin space

    /** ⚠ THE ONE-LETTER `m` KEY REQUIRES A MANDATORY SPACE AND AN INTEGER OPERAND, on a counter-example this
     *  corpus contains: `(1.5m)` is ONE AND A HALF MILLION, and all three true metre figures are spaced
     *  integers. The same shape gives the version guard (`802.11m`) for free. ⚠ ITS RIGHT GUARD CARRIES
     *  NEITHER `.` NOR `,` — that declined every clause-final metre figure and left a bare `m` in the stream. */
    private static readonly JsRe METRE_RE = JsRegex.Compile(
        "(?<![\\d.,\\p{L}\\p{M}])(\\d+)[ \\u00a0]m(?![\\p{L}\\p{M}\\d²³/])", "gu");  // space, NBSP

    /** `cm`/`mm`/`kg` — one pattern per key, built from the key so the two can never disagree.
     *  ⚠ INSERTION-ORDERED: the TS iterates the pairs in this order and each replace sees the previous
     *  one's output. */
    private static readonly (string Noun, JsRe Re)[] UNIT_KEYS =
        [.. new[] { ("cm", CENTIMETRE), ("mm", MILLIMETRE), ("kg", KILOGRAM) }
            .Select(p => (p.Item2, MakeUnitRe(p.Item1)))];

    private static JsRe MakeUnitRe(string key) => JsRegex.Compile(
        $"(?<![\\d.,\\p{{L}}\\p{{M}}])(\\d+(?:\\.\\d+)?)[ \\u00a0]?{key}(?![\\p{{L}}\\p{{M}}\\d²³/])", "gu");  // space, NBSP

    private static readonly JsRe DECIMAL_DOT =
        JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d,\\p{L}\\p{M}]|\\.\\d)", "gu");

    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACE = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** Luganda text normalization. A numbered, ORDER-DEPENDENT sequence; each step's coupling is stated in
     *  the TypeScript. */
    public static string NormalizeLuganda(string input)
    {
        // 0) THE MARKED CLOCK loses the separator's pause. First, because the numeric steps below read a
        //    digit run and the separator was splitting one in half.
        input = CLOCK_MARKED.Replace(input, m => m.Groups[1].Success
            ? $"{m.Groups[1].Value} {m.Groups[2].Value}"
            : $"{m.Groups[3].Value} {m.Groups[4].Value}");
        var s = input;

        // ⚠ THERE IS NO ENTITY-FOLDING STEP AND NO FORMAT-CHARACTER STEP: `stripMarkup` (core/markup.ts,
        //    Core/Markup.cs) decodes every entity and strips `\p{Cf}` at the registry's single dispatch
        //    point, ABOVE this layer. A local copy was written, measured at 0 lines moved, and deleted.

        // 1) THE ENGLISH ORDINAL SUFFIX — foreign orthography glued to a digit; stripping it is the whole
        //    fix, because Luganda's own ordinals are already spelled out as words wherever it means them.
        //    ⚠ FIRST, because the range rule's right guard excludes a trailing letter and would otherwise
        //    decline `1990th-2000th`.
        s = ENGLISH_ORDINAL.Replace(s, "$1");

        // 2) RANGES → `okutuuka mu` for a year pair, `okutuuka ku` otherwise.
        //    ⚠ THIS RUNS ABOVE THE DE-GROUPING STEP AND MATCHES A GROUPED OPERAND ITSELF — the writer's
        //    grouping is exactly the evidence that tells a YEAR from a QUANTITY, and de-grouping first
        //    destroys it. ⚠ ASCENDING ONLY: a football score, an abbreviated second year and a birth–death
        //    line whose second operand is a DAY are all non-ascending.
        s = DASH_RANGE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            var na = Js.Number(COMMAS.Replace(a, ""));
            var nb = Js.Number(COMMAS.Replace(b, ""));
            if (na >= nb) return m.Value;
            var year = !a.Contains(',', StringComparison.Ordinal) && !b.Contains(',', StringComparison.Ordinal)
                && a.Length == 4 && b.Length == 4 && na >= 1000;
            return $"{a} {(year ? YEAR_TO : NUM_TO)} {b}";
        });

        // 3) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping comma reads as a CLAUSE
        //    PAUSE. ⚠ THIS WIKI WRITES ALL THREE CONVENTIONS, so each arm is measured separately. ⚠ THE
        //    PERIOD ARM IS THE RISKY ONE and the 1–9 head is the guard doing the work — it is what keeps the
        //    corpus's `0.628` out of a rule that would otherwise read it as six hundred and twenty-eight.
        s = GROUP_COMMA.Replace(s, m => COMMAS.Replace(m.Value, ""));
        s = GROUP_SPACE.Replace(s, m => SPACE_SEPS.Replace(m.Value, ""));
        s = GROUP_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));

        // 4) PERCENT → `N ku kikumi`, the one POSTPOSED reading here. ⚠ THE NEEDLE IS THE COLLOCATION, NOT
        //    `kikumi` ALONE: that word is this engine's own cardinal for 100, so a bare needle suppressed the
        //    reading whenever a hundred was spelled out anywhere in the window.
        var pctFrozen = s;
        s = PERCENT_RE.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return SaidNear(pctFrozen, m.Index, m.Index + m.Length, PERCENT, "ku buli kikumi") ? n : $"{n} {PERCENT}";
        });

        // 5) CURRENCY — the noun BEFORE its amount, this language's order. ⚠ `US$` IS CLAIMED BY ITS OWN ARM
        //    FIRST, so the two letters do not reach the g2p as a separate token reading *us*. ⚠ THE TRAP-12
        //    GUARD IS THE MAJORITY CASE: this wiki names the currency in Luganda and THEN writes the sign,
        //    so the correct reading drops the sign.
        var usdFrozen = s;
        s = US_DOLLAR_SIGN.Replace(s, m => NamedDollarNear(usdFrozen, m.Index, m.Length) ? "" : $"{DOLLAR} ");
        var dollarFrozen = s;
        s = DOLLAR_SIGN.Replace(s, m => NamedDollarNear(dollarFrozen, m.Index, m.Length) ? "" : $"{DOLLAR} ");
        var euroFrozen = s;
        s = EURO_SIGN.Replace(s, m =>
            SaidNear(euroFrozen, m.Index, m.Index + m.Length, EURO) ? "" : $"{EURO} ");
        var poundFrozen = s;
        s = POUND_SIGN.Replace(s, m =>
            SaidNear(poundFrozen, m.Index, m.Index + m.Length, POUND) ? "" : $"{POUND} ");

        // 6) UNITS — the measure noun FIRST. AFTER the ranges and BEFORE the decimals, which is what leaves
        //    `1244.7` intact to be this rule's operand. Longest key first, so `km²` is claimed before the
        //    bare `km` arm can see it. ⚠ THE ASCII `km2` IS THE WORSE OF THE TWO SPELLINGS: it is not a
        //    visible leak, it is a NUMBER, so `580,367 km2` read *"…musanvu km bbiri"*.
        var km2Frozen = s;
        s = KM_SQUARED.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return SaidNear(km2Frozen, m.Index, m.Index + m.Length, Spellings(KILOMETRE)) ? n
                : $"{KILOMETRE} {SQUARED} {n}";
        });
        // ⚠ THE BARE `km` ARM IS ROBUSTNESS AND IS SAID SO: digit-adjacent `km` with nothing after it is ×0
        //    in the retained text. The `/` in the right guard keeps `299,792 km/s` out — there is no rate
        //    idiom for this language.
        var kmFrozen = s;
        s = KM_BARE.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return SaidNear(kmFrozen, m.Index, m.Index + m.Length, Spellings(KILOMETRE)) ? n : $"{KILOMETRE} {n}";
        });
        foreach (var (noun, re) in UNIT_KEYS)
        {
            var frozen = s;
            var needles = Spellings(noun);
            s = re.Replace(s, m =>
            {
                var n = m.Groups[1].Value;
                return SaidNear(frozen, m.Index, m.Index + m.Length, needles) ? n : $"{noun} {n}";
            });
        }
        var metreFrozen = s;
        s = METRE_RE.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return SaidNear(metreFrozen, m.Index, m.Index + m.Length, Spellings(METRE)) ? n : $"{METRE} {n}";
        });

        // 7) DECIMALS, LAST of the numeric rules — steps 3 to 6 all need their number intact. ⚠ NO SEPARATOR
        //    WORD IS EMITTED AND NONE IS SOURCEABLE, so the fractional digits are read ONE AT A TIME. ⚠ THE
        //    TRAILING DOT GUARD IS `\.\d`, NOT A BARE `\.`: this corpus's commonest decimal ends a sentence,
        //    and a bare guard read the SENTENCE PERIOD as the start of a second dot run.
        //    ⚠ THERE IS NO COMMA ARM — this corpus's `\d+,\d{1,2}` is the maths article's DIGIT LISTS.
        s = DECIMAL_DOT.Replace(s, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        return Tidy(s);
    }

    /** The dollar arms' guard — a bare `RegExp.test` over the window in the TS, not the word-bounded
     *  `saidNear`, because the needle is already an alternation of the spellings. */
    private static bool NamedDollarNear(string full, int offset, int length)
    {
        var from = Math.Max(0, offset - 45);
        var to = Math.Min(full.Length, offset + length + 45);
        return NAMED_DOLLAR.IsMatch(full[from..to]);
    }

    /** ⚠ A padded replacement doubles a space that was already there and can leave one at an edge. */
    private static string Tidy(string s) => EDGE_SPACE.Replace(MULTI_SPACE.Replace(s, " "), "");
}
