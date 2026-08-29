/**
 * Bashkir (ba) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE DEFINING RULE OF THIS LANGUAGE IS THE SUFFIX ON THE FIGURE (trap 14 for a Turkic corpus), and it is
 * what the whole of step 5 exists for: `1-се` → *бер се*, `8:30-ҙа` → *һигеҙ , утыҙ ҙа*, `100-ҙән` →
 * *йөҙ ҙән*. ⚠ AND THE SUFFIX GOES ON THE UNIT AS OFTEN AS ON THE NUMERAL — `+2,8 °C-ҡа тиклем`, `5°-ҡа` —
 * which step 6 claims on the sign itself.
 *
 * ⚠ THE WRITER HAS ALREADY CHOSEN THE ALLOMORPH, so the rule only has to attach it: Bashkir case suffixes
 * assimilate to the stem's final consonant and harmonise with its last vowel, and every one in the corpus
 * is what the writer typed. The layer spells the numeral and GLUES the written suffix to the last word
 * rather than deriving a case ending it would have to get right unaided.
 * Ported from src/languages/bashkir/normalize.ts — see that file for the corpus evidence, the four classes
 * that are not what they pattern-match as (`г.`/`г`, `с.`, the "dot decimals", `=`), and the sourcing.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Bashkir;

public static class Normalize
{
    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // ORDINALS — derived, not tabulated
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** The cardinal as words — the same composer the engine's number path uses. */
    private static string Cardinal(double n) => string.Join(" ", Numbers.NumberToWords(n));

    /** The letters that count as a vowel for the ordinal rule (⟨ё ю я⟩ are absent, as in the TS). */
    private const string ORD_VOWELS = "аәоөуүыиэе";
    /** ⚠ LABIAL HARMONY IS NARROWER THAN THE VOWEL INVENTORY SUGGESTS: ⟨у ү⟩ are rounded but do NOT round
     *  the suffix (`ун` → *унынсы*, not *унонсо*). Only ⟨ө о⟩ do. */
    private const string ROUNDING = "өо";
    private const string BACK_ORD = "аыу";

    /**
     * The Bashkir ORDINAL suffix, chosen by the last vowel of the cardinal's final word and by whether that
     * word ends in a vowel. Derived rather than tabulated, because the paradigm is regular and a table is
     * correct only where you looked:
     *
     *     last vowel ө / о             → -өнсө / -онсо   (өс → өсөнсө, йөҙ → йөҙөнсө)
     *     last vowel а / ы / у         → -ынсы           (ун → унынсы, туҡһан → туҡһанынсы)
     *     last vowel ә / э / е / и / ү → -енсе           (бер → беренсе, дүрт → дүртенсе)
     *     …and a VOWEL-final stem drops the linking vowel: ике → икенсе, илле → илленсе.
     */
    public static string? OrdinalOf(double n)
    {
        if (!double.IsInteger(n) || n < 0) return null;
        var words = Cardinal(n).Split(' ').ToList();
        var last = words.Count > 0 ? words[^1] : null;
        if (last is null || last == "") return null;
        string? v = null;
        foreach (var c in last)
            if (ORD_VOWELS.Contains(c, StringComparison.Ordinal)) v = c.ToString();
        if (v is null) return null;
        var endsVowel = ORD_VOWELS.Contains(last[^1], StringComparison.Ordinal);
        var suffix = ROUNDING.Contains(v, StringComparison.Ordinal)
            ? (v == "ө" ? (endsVowel ? "нсө" : "өнсө") : endsVowel ? "нсо" : "онсо")
            : BACK_ORD.Contains(v, StringComparison.Ordinal)
                ? (endsVowel ? "нсы" : "ынсы")
                : endsVowel ? "нсе" : "енсе";
        words[^1] = last + suffix;
        return string.Join(" ", words);
    }

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // INITIALISMS
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Bashkir letter NAMES. The alphabet is Russian Cyrillic plus ⟨ә ө ү ҙ ҫ ң ғ ҡ һ⟩; the shared letters
     * keep their Russian names (how they are recited in Bashkir schools) and the nine Bashkir-only letters
     * take their own. The corpus's caps runs — АНК, ЭТП, СССР, ТЭЦ, АҠШ, РАН, НГДУ, АССР, ГРЭС — every one
     * of which reached the g2p as a raw consonant cluster (`СССР` → [sssɾ]).
     */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["а"] = "а", ["б"] = "бэ", ["в"] = "вэ", ["г"] = "гэ", ["ғ"] = "ғы", ["д"] = "дэ", ["ҙ"] = "ҙы",
        ["е"] = "е", ["ё"] = "ё", ["ж"] = "жэ", ["з"] = "зэ", ["и"] = "и", ["й"] = "ҡыҫҡа и", ["к"] = "ка",
        ["ҡ"] = "ҡы", ["л"] = "эль", ["м"] = "эм", ["н"] = "эн", ["ң"] = "ңы", ["о"] = "о", ["ө"] = "ө",
        ["п"] = "пэ", ["р"] = "эр", ["с"] = "эс", ["ҫ"] = "ҫы", ["т"] = "тэ", ["у"] = "у", ["ү"] = "ү",
        ["ф"] = "эф", ["х"] = "ха", ["һ"] = "һы", ["ц"] = "цэ", ["ч"] = "че", ["ш"] = "ша", ["щ"] = "ща",
        ["ы"] = "ы", ["э"] = "э", ["ә"] = "ә", ["ю"] = "ю", ["я"] = "я",
    };

    /** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and
     *  finds none against Cyrillic (playbook trap 1). */

    /** Bashkir phonotactics, for the OOV rule in Core/Initialisms.cs. */
    public static readonly Func<string, bool> IsUnreadableBashkir = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аәеёиоөуүыэюя]", "u"),
        LegalOnsets = new HashSet<string>(
            ["бл", "бр", "гр", "гл", "др", "ҡр", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр", "шк", "шт"],
            StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(
            ["ҡт", "кт", "нд", "нт", "ңҡ", "рт", "рҙ", "рҫ", "лт", "лд", "ст", "шт", "рш", "рҡ", "лҡ", "мб",
             "нс", "рс", "йҙ", "ҫт"],
            StringComparer.Ordinal),
    });

    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        // Spelled out despite being pronounceable — the corpus's own runs.
        AcronymLetters = new HashSet<string>(
            ["аҡш", "ссср", "асср", "ран", "анк", "этп", "тэц", "тэс", "грэс", "нгду", "аск", "ссо"],
            StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableBashkir,
    });

    public static string NormalizeBashkirInitialisms(string text) => INITIALISMS(text);

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // The rules
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** The Bashkir-Cyrillic letters a written suffix can be spelt with. */
    private const string SFX = "[а-яёәөүҙҫңғҡһ]";

    /** 0) DIGIT DE-GROUPING, FIRST — ⚠ THE WHOLE NUMBER AT ONCE, not one join per pass (trap 63), and the
     *  trailing guard rejects a DIGIT and nothing else: `(?![.,]\d)` costs `3 779,8` and `(?![\d.,])`
     *  declines every clause-final figure (trap 58). The separator is a SPACE and a decimal never has one
     *  before its fraction, so `(?!\d)` is the whole guard. Separators spelled as escapes. */
    private static readonly JsRe GROUPED = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    /** 1) MULTI-DOT ABBREVIATIONS, before any single-dot rule. `б. э. т.` = *беҙҙең эраға тиклем* (BC),
     *  `б. э.` = *беҙҙең эра*, `һ. б.` = *һәм башҡалар* (the Bashkir "etc."). */
    private static readonly (JsRe Re, string Word)[] MULTI =
    [
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}б\\.\\s?э\\.\\s?т\\.", "giu"), "беҙҙең эраға тиклем"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}б\\.\\s?э\\.", "giu"), "беҙҙең эра"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}һ\\.\\s?б\\.", "giu"), "һәм башҡалар"),
    ];
    /** The FINAL dot is kept at a sentence end, or the pause is lost outright (trap 10).
     *  ⚠ THE CLASS IS THE TS's `["»)']` — a straight quote, a guillemet, a CLOSING BRACKET and a straight
     *  apostrophe. Spelled with the guillemet as an escape and the other three typed. */
    private static readonly JsRe SENTENCE_END = JsRegex.Compile("^\\s*[\"\\u00bb)']?\\s*$", "u");

    /** 2) НОМЕР — the sign was dropped outright. */
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");

    /** 3) THE YEAR ABBREVIATION `й.` — Bashkir's own, written after a figure; it was reaching the g2p as
     *  the bare glide [j]. ⚠ `г.` gets NO Bashkir reading: every instance is Russian *года*. */
    private static readonly JsRe YEAR_ABBREV =
        JsRegex.Compile($"(\\d)\\s?й\\.{Boundaries.NOT_LETTER_AFTER}", "gu");

    /** 4) CLOCK, and the case suffix that may sit on it. ⚠ THE SUFFIX ATTACHES TO THE SPOKEN MINUTE, which
     *  is why the clock is worded here: `8:30-ҙа` is *һигеҙ утыҙҙа*, and gluing the suffix to a DIGIT can
     *  never produce that. Runs BEFORE the ordinal rule so a time is not first claimed as numeral+suffix. */
    private static readonly JsRe CLOCK = JsRegex.Compile(
        $"(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d)(?![\\d:.,])(?:\\s?-\\s?({SFX}{{1,4}}){Boundaries.NOT_LETTER_AFTER})?", "gu");

    /** 5) NUMERAL + WRITTEN SUFFIX — the class this language is defined by. Two morphemes share one
     *  notation and the written letters tell them apart; see the callback. MUST run before the range rule
     *  (step 9), which would otherwise eat the hyphen. */
    private static readonly JsRe NUM_SUFFIX = JsRegex.Compile(
        $"(?<![\\d.,/])(\\d+)\\s?-\\s?({SFX}{{1,5}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    /** The letters that count as a vowel inside a WRITTEN suffix (⟨ё ю я⟩ included here, unlike the
     *  ordinal rule's list — the TS spells the two lists differently and they are not interchangeable). */
    private const string SFX_VOWELS = "аәоөуүыиэеёюя";

    /**
     * 6) DEGREES, and ⚠ THE CASE SUFFIX SITS ON THE SIGN — `+0,3 °C-тан … +2,8 °C-ҡа тиклем`, `5°-ҡа`.
     * ⚠ BOTH THE LATIN ⟨C⟩ AND THE CYRILLIC ⟨С⟩ OCCUR and they render identically, so the class must carry
     * both or the Latin one falls to Core/Foreign.cs and is read as the ENGLISH letter name — which is what
     * `+28 °C` was doing ([sˈiː]). Spelled as escapes for exactly that reason: C U+0043 / С U+0421 and
     * c U+0063 / с U+0441, F U+0046 / Ф U+0424.
     * ⚠ THE LOWERCASE SCALE LETTER GOES IN THE CLASS, NOT IN AN `i` FLAG — the suffix class beside it is
     * genuinely lowercase-only, and `i` folds it so the flag would widen the suffix capture too.
     */
    private static readonly JsRe DEG_SCALE_SFX = JsRegex.Compile(
        $"(\\d)\\s?°\\s?[\\u0043\\u0421\\u0063\\u0441]\\s?-\\s?({SFX}{{1,4}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe DEG_SFX = JsRegex.Compile(
        $"(\\d)\\s?°\\s?-\\s?({SFX}{{1,4}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    /** ⚠ THE CORPUS ALSO WRITES THE SIGN AFTER THE LETTER — `−41 С°`, `+35С°`, `0С° аҙағында`. A typo for
     *  `°С`, and the only reason the degree class still reported after the rules above were in. */
    private static readonly JsRe DEG_LETTER_FIRST_SFX = JsRegex.Compile(
        $"(\\d)\\s?[\\u0043\\u0421\\u0063\\u0441]\\s?°\\s?-\\s?({SFX}{{1,4}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe DEG_LETTER_FIRST =
        JsRegex.Compile("(\\d)\\s?[\\u0043\\u0421]\\s?°(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_CELSIUS =
        JsRegex.Compile("(\\d)\\s?°\\s?[\\u0043\\u0421](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_FAHRENHEIT =
        JsRegex.Compile("(\\d)\\s?°\\s?[\\u0046\\u0424](?![\\p{L}\\p{M}])", "gui");
    /** ⚠ WITH A TRAILING SPACE, because the sign is written GLUED to letters this rule does not claim:
     *  `17—19 °Т` (degrees Turner) fused into *градуст*. The final space-collapse removes the doubling. */
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** 7) THE GRAM, claimed HERE rather than declared to the shared tier: `3,300 г` is a gram and `1938 г.`
     *  is a Russian year, and the DOT is the only thing that separates them — the tier's trailing guard
     *  does not reject a dot, so declaring the key would have read every Russian year as a weight. */
    private static readonly JsRe GRAM = JsRegex.Compile("(\\d+(?:,\\d+)?)\\s?г(?![\\p{L}\\p{M}.])", "gu");

    /** 8) SIGNS. The climate prose writes `+18 °C`, `+0,3 °C` and `−18 °C` — the true MINUS (U+2212) as
     *  well as the hyphen — and every one lost its sign. ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT a `+`, so
     *  no `+` rule can ever match inside it. */
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-\\u2212\\u2013](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\\u00b1", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");
    /** `=` is DIGIT-GATED: 16 of the corpus's 17 are LaTeX, a Russian-text typo or raw dump markup. No `÷`
     *  rule is written at all — the single instance (`6,4÷6,7`) is a RANGE in the Russian convention. */
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\d)\\s?=\\s?(?=\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s?\\u00d7\\s?(?=\\d)", "gu");

    /** 9) NUMERIC RANGES. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE, and that is a measured
     *  refusal: Bashkir marks a span with case endings on BOTH operands, which needs an ablative and a
     *  dative this layer would have to derive unaided. ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER
     *  (trap 58). Runs AFTER the ordinal and sign rules, which have spent every hyphen that belongs to a
     *  suffix or opens a negative. */
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\s?-\\s?(?=\\d)", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Bashkir input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeBashkir(string input)
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

        // 3) The year abbreviation `й.`.
        s = Rewrite(s, YEAR_ABBREV, "$1 йыл");

        // 4) The clock, and the case suffix that may sit on it.
        s = Rewrite(s, CLOCK, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            if (hv > 24) return m.Value;
            var head = Cardinal(hv);
            var tail = mv == 0 ? "" : $" {Cardinal(mv)}";
            var body = $"{head}{tail}";
            return m.Groups[3].Success ? $"{body}{m.Groups[3].Value}" : body;
        });

        // 5) Numeral + written suffix — the ordinal is tried FIRST and the overlap guard is what makes the
        //    cardinal fallback safe.
        s = Rewrite(s, NUM_SUFFIX, m =>
        {
            var whole = m.Value;
            var n = Js.Number(m.Groups[1].Value);
            // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0)) return whole;
            var suffix = Js.ToLowerCase(m.Groups[2].Value);
            // ⚠ `-е` AND `-й` ARE RUSSIAN, NOT BASHKIR, and every one of the corpus's seven proves it
            // (`Издание 1-е`, `2-й Украинский фронт`). Bashkir's ordinal is -се/-сы/-сө and its possessive
            // -ы/-е/-һы/-һе, so a BARE `-е` is formally possible and simply never occurs. Gluing it gave
            // *туҡһане*, *икее* — a word in neither language.
            if (suffix == "е" || suffix == "й") return whole;
            // ⚠ THE ORDINAL BRANCH NEEDS TWO LETTERS, because a ONE-letter suffix is always the possessive
            // and `endsWith` cannot tell them apart: `613-ө` is *алты йөҙ ун өсө*, but *өсөнсө* also ends
            // in ⟨ө⟩ and would win.
            var ord = suffix.Length >= 2 ? OrdinalOf(n) : null;
            if (ord is not null)
            {
                // ⚠ THE WRITTEN SUFFIX MAY CARRY A CASE ENDING PAST THE ORDINAL'S OWN TAIL — `Әхмәт III-сөнөң`
                // is *өсөнсөнөң*, which a plain `endsWith` cannot see (it fell through and produced
                // *өссөнөң*). Splice on the OVERLAP: the longest prefix of the written suffix the ordinal
                // already ends with, appending only what is left over. With no case ending the overlap is
                // the whole suffix and this reduces to the `endsWith` test.
                for (var k = Math.Min(ord.Length, suffix.Length); k >= 2; k--)
                    if (ord.EndsWith(suffix[..k], StringComparison.Ordinal)) return ord + suffix[k..];
            }
            var card = Cardinal(n);
            if (card == "") return whole;
            // ⚠ A GLUED SUFFIX MUST BRING ITS OWN VOWEL unless the numeral ends in one, or the join is a
            // cluster no Bashkir word can carry: `өс` + `н` is *өсн*. Declining it leaves the figure read
            // correctly with the morpheme unspoken, which beats emitting an impossible syllable (trap 56).
            var hasVowel = suffix.Any(c => SFX_VOWELS.Contains(c, StringComparison.Ordinal));
            var stemVowelFinal = ORD_VOWELS.Contains(card[^1], StringComparison.Ordinal);
            if (!hasVowel && !stemVowelFinal) return whole;
            return $"{card}{suffix}";
        });

        // 6) Degrees — the suffixed forms first, then the bare scale names, then the bare sign.
        //    ⚠ THE SCALE NAME IS DROPPED WHEN A SUFFIX FOLLOWS, deliberately: the sourced compound is
        //    *Цельсий градусы*, whose possessive -ы needs a linking -н- before a case ending the writer did
        //    not type. Emitting `градустан` is what their own choice implies; `Цельсий градусытан` is not a
        //    word. Honest lossiness, not an oversight.
        s = Rewrite(s, DEG_SCALE_SFX, "$1 градус$2");
        s = Rewrite(s, DEG_SFX, "$1 градус$2");
        s = Rewrite(s, DEG_LETTER_FIRST_SFX, "$1 градус$2");
        s = Rewrite(s, DEG_LETTER_FIRST, "$1 Цельсий градусы");
        s = Rewrite(s, DEG_CELSIUS, "$1 Цельсий градусы");
        s = Rewrite(s, DEG_FAHRENHEIT, "$1 Фаренгейт градусы");
        s = Rewrite(s, DEG_BARE, "$1 градус ");

        // 7) The gram.
        s = Rewrite(s, GRAM, "$1 грамм");

        // 8) Signs.
        s = Rewrite(s, MINUS, "$1минус $2");
        s = Rewrite(s, PLUS_MINUS, " плюс минус ");
        s = Rewrite(s, PLUS, "$1плюс $2");
        s = Rewrite(s, EQUALS, "$1 тигеҙ ");
        s = Rewrite(s, TIMES, "$1 тапҡыр ");

        // 9) Numeric ranges.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, ");

        // A padded replacement (` плюс минус `) doubles a space that was already there. Harmless downstream
        // because AssembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be
        // the one producing candidates for it.
        return Rewrite(s, WS_RUN, " ");
    }
}
