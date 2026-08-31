/**
 * Tatar (tt) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE DEFINING RULE IS THE SUFFIX ON THE FIGURE, as in Bashkir — but TATAR WRITES IT FOUR WAYS AND
 * BASHKIR WRITES IT ONE: hyphenated (`3-нче`), SPACED (`1917 нче елда`), GLUED (`2005нченең`) and the
 * long form with the linking vowel typed out (`19-ынчы`). Claiming the SPACED one is why the case
 * suffixes below are a CLOSED SET rather than an open `SFX{1,5}` alternation — a bare space between a
 * figure and a Cyrillic word is otherwise the commonest shape in the language, and an open alternation
 * would eat the noun.
 * Ported from src/languages/tatar/normalize.ts — see that file for the corpus evidence, the two
 * orthographies, the Russian bibliography that excludes `-е`/`-й`/`г.`/`т.`, and the sourcing.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Tatar;

public static class Normalize
{
    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // ORDINALS — derived, not tabulated
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** The cardinal as words — the same composer the engine's number path uses. */
    private static string Cardinal(double n) => string.Join(" ", Numbers.NumberToWords(n));

    private const string VOWELS = "аәоөуүыиэеёюя";
    /** ⟨ә ө ү е и э⟩ — the FRONT series that selects the -енче/-нче allomorph. */
    private const string FRONT = "әөүеиэ";

    /**
     * The Tatar ORDINAL suffix, chosen by the last vowel of the cardinal's final word and by whether that
     * word ends in a vowel. Derived rather than tabulated — the paradigm is fully regular.
     *
     * ⚠ TATAR HAS NO LABIAL HARMONY HERE, which is the difference from the sibling: Bashkir rounds after
     * ⟨ө о⟩ (`өс` → *өсөнсө*), Tatar does not — `өч` is *өченче* and `йөз` is *йөзенче*. Porting ba's
     * ROUNDING set across would have wrecked the two commonest low ordinals in the language.
     *
     * ⚠ AND ONE STEM LENITES: a stem-final ⟨к⟩ voices to ⟨г⟩ before the vowel-initial suffix, which
     * exactly one numeral reaches — `кырык` → *кырыгынчы*.
     */
    public static string? OrdinalOf(double n)
    {
        if (!double.IsInteger(n) || n < 0) return null;
        var words = Cardinal(n).Split(' ').ToList();
        var last = words.Count > 0 ? words[^1] : null;
        if (last is null || last == "") return null;
        string? v = null;
        foreach (var c in last)
            if (VOWELS.Contains(c, StringComparison.Ordinal)) v = c.ToString();
        if (v is null) return null;
        var front = FRONT.Contains(v, StringComparison.Ordinal);
        var endsVowel = VOWELS.Contains(last[^1], StringComparison.Ordinal);
        if (!endsVowel && last.EndsWith("к", StringComparison.Ordinal)) last = last[..^1] + "г";
        var suffix = endsVowel ? (front ? "нче" : "нчы") : front ? "енче" : "ынчы";
        words[^1] = last + suffix;
        return string.Join(" ", words);
    }

    /**
     * The CASE and POSSESSIVE endings a writer glues to a figure, as a CLOSED SET — the one structural
     * departure from the Bashkir rule and the reason this layer can also claim the SPACED variant. The
     * writer has already chosen the allomorph, so the rule attaches what was typed and derives nothing.
     *
     * ⚠ `-е` AND `-й` ARE ABSENT ON PURPOSE — both are Russian (`4-е изд.`, `2-й`) and this corpus
     * carries Russian bibliography in quantity. `-ы` is kept because it is a live Tatar possessive; `-е`
     * is its front twin and is the collision, so the front possessive is reachable only as `-се`.
     */
    private static readonly IReadOnlySet<string> CASE_SUFFIX = new HashSet<string>(
    [
        "ның", "нең", "га", "гә", "ка", "кә", "на", "нә",
        "ны", "не", "н", "да", "дә", "та", "тә", "нда", "ндә",
        "дан", "дән", "тан", "тән", "ннан", "ннән",
        "лар", "ләр", "ларда", "ләрдә", "лардан", "ләрдән", "ларны", "ләрне", "ларның", "ләрнең",
        "ы", "сы", "се", "ын", "ен", "ына", "енә", "ында", "ендә", "ыннан", "еннән", "ының", "енең",
    ], StringComparer.Ordinal);

    /** The ordinal suffixes as a writer types them — the ONLY alternation allowed after a bare space. */
    private const string ORD_SUFFIX = "(?:ынчы|енче|нчы|нче)";

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // INITIALISMS
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Tatar letter NAMES. The alphabet is Russian Cyrillic plus ⟨ә ө ү җ ң һ⟩; the shared letters keep
     * their Russian names, which is how the alphabet is recited, and the six Tatar-only letters are named
     * by their own sound. Every caps run in the corpus reached the g2p as a raw consonant cluster
     * (`ТР` → [tr]).
     */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["а"] = "а", ["б"] = "бэ", ["в"] = "вэ", ["г"] = "гэ", ["д"] = "дэ", ["е"] = "е", ["ё"] = "ё",
        ["ж"] = "жэ", ["җ"] = "җэ", ["з"] = "зэ", ["и"] = "и", ["й"] = "кыска и", ["к"] = "ка",
        ["л"] = "эль", ["м"] = "эм", ["н"] = "эн", ["ң"] = "эң", ["о"] = "о", ["ө"] = "ө",
        ["п"] = "пэ", ["р"] = "эр", ["с"] = "эс", ["т"] = "тэ", ["у"] = "у", ["ү"] = "ү", ["ф"] = "эф",
        ["х"] = "ха", ["һ"] = "һэ", ["ц"] = "цэ", ["ч"] = "че", ["ш"] = "ша", ["щ"] = "ща",
        ["ы"] = "ы", ["э"] = "э", ["ә"] = "ә", ["ю"] = "ю", ["я"] = "я",
    };

    /** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and
     *  finds none against Cyrillic (playbook trap 1). */

    /** Tatar phonotactics, for the OOV rule in Core/Initialisms.cs. */
    public static readonly Func<string, bool> IsUnreadableTatar = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аәеёиоөуүыэюя]", "u"),
        LegalOnsets = new HashSet<string>(
            ["бл", "бр", "гр", "гл", "др", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр", "шк", "шт"],
            StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(
            ["кт", "нд", "нт", "нк", "рт", "рд", "рс", "лт", "лд", "ст", "шт", "рш", "рк", "лк", "мб",
             "нч", "рч", "йд", "нз"],
            StringComparer.Ordinal),
    });

    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        // Spelled out despite being pronounceable — the corpus's own runs.
        AcronymLetters = new HashSet<string>(
            ["акш", "ссср", "асср", "басср", "рсфср", "сср", "тр", "рф", "ао", "мтс", "тэп"],
            StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableTatar,
    });

    public static string NormalizeTatarInitialisms(string text) => INITIALISMS(text);

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // The rules
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** The Tatar-Cyrillic letters a written suffix can be spelt with. */
    private const string SFX = "[а-яёәөүҗңһ]";

    /** 0) DIGIT DE-GROUPING, FIRST — ⚠ THE WHOLE NUMBER AT ONCE, not one join per pass (trap 63), and the
     *  trailing guard rejects a DIGIT and nothing else: `(?![.,]\d)` costs `3 779,8` and `(?![\d.,])`
     *  declines every clause-final figure (trap 58). Separators spelled as escapes. */
    private static readonly JsRe GROUPED = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    /** 1) MULTI-DOT ABBREVIATIONS, before any single-dot rule. The era markers are sourced by one sentence
     *  of the corpus that gives all four expansions and both abbreviations at once; the negative marker is
     *  written four ways, which is why the dots and the spaces are both optional. */
    private static readonly (JsRe Re, string Word)[] MULTI =
    [
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}б\\s?\\.\\s?э\\s?\\.?\\s?к\\s?\\.?", "giu"), "безнең эрага кадәр"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}я\\s?\\.\\s?э\\s?\\.?\\s?к\\s?\\.?", "giu"), "яңа эрага кадәр"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}б\\s?\\.\\s?э\\s?\\.", "giu"), "безнең эра"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}я\\s?\\.\\s?э\\s?\\.", "giu"), "яңа эра"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}һ\\s?\\.\\s?б\\s?\\.", "giu"), "һәм башкалар"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}ш\\s?\\.\\s?и\\s?\\.", "giu"), "шул исәптән"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}млрд\\s?\\.", "giu"), "миллиард"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}млн\\s?\\.", "giu"), "миллион"),
    ];
    /** The FINAL dot is kept at a sentence end, or the pause is lost outright (trap 10).
     *  ⚠ THE CLASS IS THE TS's `["»)']` — spelled with the guillemet as an escape, the other three typed. */
    private static readonly JsRe SENTENCE_END = JsRegex.Compile("^\\s*[\"\\u00bb)']?\\s*$", "u");

    /** 2) НОМЕР — the sign was dropped outright (`№ 5. С. 49-52`). */
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");

    /** 3) CLOCK, and the case suffix that may sit on it. ⚠ THE SUFFIX ATTACHES TO THE SPOKEN MINUTE, which
     *  is why the clock is worded here: `22:30-га` is *егерме ике утызга*, and gluing the written suffix
     *  to a DIGIT can never produce that. ⚠ A THIRD FIELD IS A TIMESTAMP, NOT A CLOCK, and this corpus
     *  glues the suffix to the SECONDS (`13:23:58дә`) — a two-field rule alone would strand them. Runs
     *  BEFORE the ordinal rule so a time is not first claimed as a numeral-plus-suffix. */
    private const string TIME_SUFFIX = "(?:\\s?-\\s?|)(" + SFX + "{1,5})" + Boundaries.NOT_LETTER_AFTER;
    private static readonly JsRe CLOCK_HMS = JsRegex.Compile(
        $"(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d):([0-5]\\d)(?![\\d:.,])(?:{TIME_SUFFIX})?", "gu");
    private static readonly JsRe CLOCK_HM = JsRegex.Compile(
        $"(?<![\\d:.,])([01]?\\d|2[0-4]):\\s?([0-5]\\d)(?![\\d:.,])(?:{TIME_SUFFIX})?", "gu");

    /** 4) NUMERAL + WRITTEN SUFFIX, in its hyphenated and glued attachments — both take the FULL closed
     *  set, because the boundary is unambiguous there. MUST run before the range rule (step 8), which
     *  would otherwise eat the hyphen. */
    private static readonly JsRe NUM_SUFFIX_HYPHEN = JsRegex.Compile(
        $"(?<![\\d.,/])(\\d+)\\s?-\\s?({SFX}{{1,6}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe NUM_SUFFIX_GLUED = JsRegex.Compile(
        $"(?<![\\d.,/])(\\d+)({SFX}{{1,6}}){Boundaries.NOT_LETTER_AFTER}", "gu");

    /** 5) SIGNS. `−2.88-гә` uses the true MINUS (U+2212). ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT a `+`,
     *  so no `+` rule can ever match inside it. The dashes and ± are spelled as escapes. */
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-\\u2212\\u2013](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\\u00b1", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\d)\\s?=\\s?(?=\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s?\\u00d7\\s?(?=\\d)", "gu");

    /** 6) DEGREES — and in this corpus that means COORDINATES: not one `°` is a temperature. The
     *  degree-and-minute pair is claimed first so the prime is not stranded once the degree rule has
     *  spent the sign, and ⚠ THE CASE SUFFIX SITS ON THE PRIME (`41°11'ында`) — it must be glued to
     *  *минут*, not left standing as a bound morpheme read aloud as a word (trap 56).
     *  ⚠ BOTH THE LATIN ⟨C⟩ AND THE CYRILLIC ⟨С⟩ OCCUR and they render identically, so the classes are
     *  spelled as escapes: C U+0043 / С U+0421, F U+0046 / Ф U+0424. */
    private static readonly JsRe COORD_SFX = JsRegex.Compile(
        $"(\\d)\\s?°\\s?(\\d+)\\s?[\\u2032']\\s?({SFX}{{1,5}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe COORD = JsRegex.Compile("(\\d)\\s?°\\s?(\\d+)\\s?[\\u2032']", "gu");
    private static readonly JsRe DEG_CELSIUS =
        JsRegex.Compile("(\\d)\\s?°\\s?[\\u0043\\u0421](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_FAHRENHEIT =
        JsRegex.Compile("(\\d)\\s?°\\s?[\\u0046\\u0424](?![\\p{L}\\p{M}])", "gui");
    /** WITH A TRAILING SPACE, because the sign is written glued to letters this rule does not claim; the
     *  final space-collapse removes the doubling in the ordinary case. */
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** 7) THE SPACED ORDINAL, and ⚠ ONLY THE ORDINAL — `1917 нче елда`. Ordered before the range rule so
     *  that rule is given the leftovers. */
    private static readonly JsRe SPACED_ORDINAL = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s({ORD_SUFFIX}){Boundaries.NOT_LETTER_AFTER}", "gu");

    /** 8) NUMERIC RANGES. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE, a measured refusal:
     *  Tatar marks a span with case endings on BOTH operands, which needs an ablative and a dative this
     *  layer would have to derive unaided. ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58). */
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\s?-\\s?(?=\\d)", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /**
     * Attach a written suffix to a figure — the ordinal first, then the closed case set. Shared by the
     * hyphenated and glued branches of step 4.
     */
    private static string Attach(string whole, string digits, string rawSuffix)
    {
        var n = Js.Number(digits);
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0)) return whole;
        var suffix = Js.ToLowerCase(rawSuffix);
        var ord = OrdinalOf(n);
        // ⚠ THE WRITTEN SUFFIX MAY CARRY A CASE ENDING PAST THE ORDINAL'S OWN TAIL — `2005нченең` is
        // *ике мең бишенченең*, and a plain `endsWith` cannot see that. Splice on the OVERLAP: the longest
        // prefix of what was typed that the ordinal already ends with. Two letters minimum, because a
        // one-letter overlap is always an accident of the vowel.
        if (ord is not null)
            for (var k = Math.Min(ord.Length, suffix.Length); k >= 2; k--)
                if (ord.EndsWith(suffix[..k], StringComparison.Ordinal)) return ord + suffix[k..];
        if (!CASE_SUFFIX.Contains(suffix)) return whole;
        var card = Cardinal(n);
        if (card == "") return whole;
        // ⚠ A GLUED SUFFIX MUST BRING ITS OWN VOWEL unless the numeral ends in one, or the join is a
        // cluster no Tatar word can carry — the bare accusative `-н` after `өч` would be *өчн* (trap 56).
        var hasVowel = suffix.Any(c => VOWELS.Contains(c, StringComparison.Ordinal));
        if (!hasVowel && !VOWELS.Contains(card[^1], StringComparison.Ordinal)) return whole;
        return $"{card}{suffix}";
    }

    /**
     * Glue a written suffix onto an already-spelled phrase (a clock reading). Shares the vowel guard with
     * `Attach`, but never tries the ordinal branch — a time is not an ordinal.
     */
    private static string AttachToWords(string whole, string words, string rawSuffix)
    {
        var suffix = Js.ToLowerCase(rawSuffix);
        if (!CASE_SUFFIX.Contains(suffix)) return whole;
        var hasVowel = suffix.Any(c => VOWELS.Contains(c, StringComparison.Ordinal));
        if (!hasVowel && !VOWELS.Contains(words[^1], StringComparison.Ordinal)) return whole;
        return $"{words}{suffix}";
    }

    /** Normalize one Tatar input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeTatar(string input)
    {
        var s = input;

        // 0) Digit de-grouping, first — every later rule needs the figure whole.
        s = Rewrite(s, GROUPED, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, SPACE_SEPS, " ");

        // 1) Multi-dot abbreviations, before any single-dot rule.
        foreach (var (re, word) in MULTI)
        {
            var full = s;
            s = Rewrite(s, re, m =>
            {
                var rest = full[(m.Index + m.Length)..];
                return SENTENCE_END.IsMatch(rest) ? $"{word}." : word;
            });
        }

        // 2) Номер.
        s = Rewrite(s, NUMERO, "номер ");

        // 3) The clock — the three-field timestamp first, then the two-field time.
        s = Rewrite(s, CLOCK_HMS, m =>
        {
            var words = string.Join(" ", new[]
            {
                Cardinal(Js.Number(m.Groups[1].Value)),
                Cardinal(Js.Number(m.Groups[2].Value)),
                Cardinal(Js.Number(m.Groups[3].Value)),
            });
            return m.Groups[4].Success ? AttachToWords(m.Value, words, m.Groups[4].Value) : words;
        });
        s = Rewrite(s, CLOCK_HM, m =>
        {
            var mv = Js.Number(m.Groups[2].Value);
            var words = mv == 0
                ? Cardinal(Js.Number(m.Groups[1].Value))
                : $"{Cardinal(Js.Number(m.Groups[1].Value))} {Cardinal(mv)}";
            return m.Groups[3].Success ? AttachToWords(m.Value, words, m.Groups[3].Value) : words;
        });

        // 4) Numeral + written suffix — hyphenated, then glued.
        s = Rewrite(s, NUM_SUFFIX_HYPHEN, m => Attach(m.Value, m.Groups[1].Value, m.Groups[2].Value));
        s = Rewrite(s, NUM_SUFFIX_GLUED, m => Attach(m.Value, m.Groups[1].Value, m.Groups[2].Value));

        // 5) Signs. Run before the range rule, which would otherwise read the minus as a span's dash.
        s = Rewrite(s, MINUS, "$1минус $2");
        s = Rewrite(s, PLUS_MINUS, " плюс минус ");
        s = Rewrite(s, PLUS, "$1плюс $2");
        s = Rewrite(s, EQUALS, "$1 тигез ");
        s = Rewrite(s, TIMES, "$1 тапкыр ");

        // 6) Degrees — the coordinate pair first, then the scale names, then the bare sign.
        s = Rewrite(s, COORD_SFX, m =>
        {
            var deg = m.Groups[1].Value;
            var min = m.Groups[2].Value;
            var sfx = m.Groups[3].Value;
            var body = $"{deg} градус {min} минут";
            var glued = AttachToWords(m.Value, body, sfx);
            return glued == m.Value ? $"{body} {sfx}" : $"{glued} ";
        });
        s = Rewrite(s, COORD, "$1 градус $2 минут ");
        // ⚠ THE CELSIUS BRANCH IS INSURANCE, NOT EVIDENCE: zero of this corpus's degrees are temperatures
        // and all 28 hits for `Цельсий` are the SURNAME. It ships because it is letter-gated and cannot
        // misfire on anything the corpus contains, and because without it a `°C` loses the sign AND reads
        // the ⟨C⟩ as the ENGLISH letter name via Core/Foreign.cs.
        s = Rewrite(s, DEG_CELSIUS, "$1 Цельсий градусы");
        s = Rewrite(s, DEG_FAHRENHEIT, "$1 Фаренгейт градусы");
        s = Rewrite(s, DEG_BARE, "$1 градус ");

        // 7) The spaced ordinal.
        s = Rewrite(s, SPACED_ORDINAL, m => Attach(m.Value, m.Groups[1].Value, m.Groups[2].Value));

        // 8) Numeric ranges.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, ");

        // A padded replacement (` плюс минус `) doubles a space that was already there. Harmless
        // downstream because AssembleClauses collapses runs, but SLOT-GAP is a defect class and this pass
        // should not be the one producing candidates for it.
        return Rewrite(s, WS_RUN, " ");
    }
}
