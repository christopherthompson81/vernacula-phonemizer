/**
 * Hungarian (hu) text normalization — the pre-tokenizer pass that rewrites anything not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/hungarian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hungarian;

public static class Normalize
{
    private const string LOWER = "a-záéíóöőúüű";

    /** The twelve month names, matched case-insensitively and UNANCHORED at the end — Hungarian agglutinates
     *  onto them (`szeptemberében`, `augusztusban`). */
    private const string MONTH =
        "(?:janu[áa]r|febru[áa]r|m[áa]rcius|[áa]prilis|m[áa]jus|j[úu]nius|j[úu]lius|augusztus|szeptember|okt[óo]ber|november|december)";

    /** Dotted abbreviations → the spoken words. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["pl"] = "például",
        ["kb"] = "körülbelül",
        ["stb"] = "satöbbi",
        ["ld"] = "lásd",
        ["dr"] = "doktor",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Hungarian DIGRAPHS folded to one stand-in letter before the phonotactic test. */
    private static readonly JsRe DIGRAPH = JsRegex.Compile("dzs|sz|zs|cs|gy|ny|ty|ly|dz", "gu");
    private static readonly IReadOnlyDictionary<string, string> DIGRAPH_FOLD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dzs"] = "z", ["sz"] = "s", ["zs"] = "z", ["cs"] = "c", ["gy"] = "g", ["ny"] = "n",
        ["ty"] = "t", ["ly"] = "j", ["dz"] = "z",
    };
    private static string Fold(string w) => DIGRAPH.Replace(w, m => DIGRAPH_FOLD[m.Value]);

    /** Hungarian phonotactics, for the OOV rule in core/initialisms.ts. Native Hungarian words admit NO
     *  initial cluster; the onsets listed are the ones loanwords brought in. Applied to the digraph-folded
     *  form (see `fold`). */
    private static readonly Func<string, bool> UnreadableFolded = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{Manifest.MANIFEST.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Codas, StringComparer.Ordinal),
    });
    public static bool IsUnreadableHungarian(string word) => UnreadableFolded(Fold(word.ToLowerInvariant()));

    /** Letter-by-letter reading, or undefined if any character has no Hungarian letter name — the caller then
     *  leaves the token alone rather than emitting a partial reading. Mirrors core/initialisms.ts's own
     *  `spellOut`, which is private to it. */
    private static string? SpellOut(string acr)
    {
        var names = Js.CodePoints(acr.ToLowerInvariant())
            .Select(c => Manifest.MANIFEST.LetterNames.TryGetValue(c, out var v) ? v : null).ToList();
        return names.All(n => n is not null) ? string.Join(" ", names) : null;
    }

    /** LEXICAL overrides: acronyms whose Hungarian reading is neither "spell the letters" nor "read as a
     *  word". `WC` is *vécé*, a dictionary-recorded Hungarian word — the letter names would give the
     *  three-word *dupla vé cé*. */
    private static readonly IReadOnlyDictionary<string, string> ACRONYM_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["WC"] = "vécé",
    };

    /** Hungarian has no pronunciation dictionary here (the g2p is rule-based), so nothing is "recorded" and
     *  the decision rests on the phonotactic OOV test alone. */
    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => Manifest.MANIFEST.LetterNames.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = new HashSet<string>(StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableHungarian,
    });

    /** Unit and percent words. */
    private static readonly Func<string, string> NormalizeSymbolsFn = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "és",
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        RateDenominators = Manifest.MANIFEST.SymbolTier.RateDenominators,
        UnitPer = Manifest.MANIFEST.SymbolTier.UnitPer,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
    });

    /** Unit abbreviations that may carry a hyphen-attached suffix directly (`km-re`, `mm-es`, `km²-en`). */
    private static readonly IReadOnlyDictionary<string, string> SUFFIXABLE_UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilométer",
        ["mm"] = "milliméter",
        ["cm"] = "centiméter",
        ["kg"] = "kilogramm",
        ["mérföld"] = "mérföld",
    };
    private static readonly string UNIT_ALT = string.Join("|", SUFFIXABLE_UNIT.Keys.OrderByDescending(k => k.Length));

    /** Attach a suffix to the LAST word of a spoken numeral, applying the stem shortening a vowel-initial
     *  suffix triggers (see Numbers.StemForSuffix). The split matters only at the millió/milliárd boundary,
     *  the one place `NumberToWords` emits a space. */
    private static string AttachSuffix(string words, string suffix)
    {
        var parts = words.Split(' ').ToList();
        parts[^1] = Numbers.StemForSuffix(parts[^1], suffix) + suffix;
        return string.Join(" ", parts);
    }

    private static readonly JsRe BACK_VOWEL = JsRegex.Compile("[aáoóuú]", "u");
    private static string? DateStem(double n)
    {
        if (n == 1) return "elsej"; // elseje, elsején, elseji
        return Numbers.OrdinalWords(n);
    }
    /** The bare DATE NOMINATIVE — `augusztus 24.` → *huszonnegyedike*, `március 3.` → *harmadika*. The
     *  linking vowel is chosen by the vowel before the ordinal's `-dik`; day 1 is suppletive (*elseje*). */
    private static string? DateNominative(double n)
    {
        var stem = DateStem(n);
        if (stem is null) return null;
        if (n == 1) return "elseje";
        // JS `stem.slice(0, -3).slice(-1)`: the character before `-dik`, or "" on a short stem — and
        // `BACK_VOWEL.test("")` is false, so a short stem takes the front vowel. Same here.
        var head = stem.Length >= 3 ? stem[..^3] : "";
        var link = BACK_VOWEL.IsMatch(head.Length > 0 ? head[^1..] : "") ? "a" : "e"; // the vowel before -dik
        return stem + link;
    }

    /** Date suffixes written after the hyphen on a day number (`17-én`, `1-jén`, `11-e`, `4-i`). They attach
     *  to the ORDINAL stem, not the cardinal: `szeptember 17-én` is *szeptember tizenhetedikén*, never
     *  *tizenhétén*. The `j-` forms belong to day 1's suppletive stem *elsej-* and are folded onto it. */
    private static readonly JsRe DATE_SUFFIX = JsRegex.Compile("^(j?[áé]n|je|jei|ei|e|i)$", "u");

    private static readonly JsRe TIMES = JsRegex.Compile("(?<![\\d.,\\-])(?<!\\d[ .,])(\\d{1,6})\\s?[x\u00d7]\\s?(?=\\d)", "gu");
    private static readonly (JsRe Re, string Word)[] ERA =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])Kr\\.\\s?e\\.", "giu"), "Krisztus előtt"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])Kr\\.\\s?u\\.", "giu"), "Krisztus után"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])i\\.\\s?sz\\.", "giu"), "időszámításunk szerint"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])i\\.\\s?e\\.", "giu"), "időszámításunk előtt"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])d\\.\\s?e\\.", "giu"), "délelőtt"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])d\\.\\s?u\\.", "giu"), "délután"),
    };
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?\u00bb)\\]]|$))", "giu");
    // The three de-grouping classes carry a NON-BREAKING SPACE (U+00A0) beside the plain one, written as an
    // escape so an editor that folds it cannot narrow the class in silence. Same for CLOCK below.
    private static readonly JsRe GROUP_DOT_SPACE = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[.\u00a0\u202f\u2009 ](?=\\d{3}(?![\\d]|,\\d))", "gu");
    private static readonly JsRe GROUP_DOT_THEN_SPACE = JsRegex.Compile("(\\d)\\.[ \u00a0\u202f\u2009](\\d{3})(?![\\d]|,\\d)", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0),(?=\\d{3}(?![\\d]|,\\d))", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3]):[ \u00a0]?([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe UNIT_SUFFIX = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({UNIT_ALT})([\u00b2\u00b323])?-([{LOWER}]+)", "giu");
    private static readonly JsRe METRE_SUFFIX = JsRegex.Compile($"(\\d)\\s?m([\u00b2\u00b323])?-([{LOWER}]+)", "gu");
    private static readonly JsRe PCT_SUFFIX = JsRegex.Compile($"(\\d)\\s?[%\u066a\uff05]-([{LOWER}]+)", "gu");
    private static readonly JsRe DEG_SUFFIX = JsRegex.Compile($"(\\d)\\s?\u00b0\\s?([CFcf])?-([{LOWER}]+)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?\u00b0\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?\u00b0\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?\u00b0", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-\u2212\u2013](?=\\d)", "gu");
    private static readonly JsRe DIGIT_BEFORE = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\u00b1", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\d+)\\s?\u00f7\\s?(\\d+)", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d),(?=\\d)", "gu");
    private static readonly JsRe YEAR_MONTH = JsRegex.Compile($"(?<![\\d.,])(\\d{{1,4}})\\.(\\s+)(?={MONTH})", "giu");
    private static readonly JsRe MONTH_DAY = JsRegex.Compile($"({MONTH}\\p{{L}}*\\s+)(\\d{{1,2}})\\.(?=\\s+[{LOWER}])", "giu");
    private static readonly JsRe ORDINAL_DOT = JsRegex.Compile($"(?<![\\d.,])(\\d{{1,4}})\\.(?=\\s+[{LOWER}]|,)", "gu");
    private static readonly JsRe ORDINAL_PERIOD = JsRegex.Compile($"(?<=dik|első)\\.(?=\\s+[{LOWER}])", "gu");
    private static readonly JsRe DATE_HYPHEN = JsRegex.Compile($"(?<={MONTH}\\p{{L}}*\\s)(\\d{{1,2}})-([{LOWER}]+)(?![\\p{{L}}\\p{{M}}])", "giu");
    private static readonly JsRe NUM_HYPHEN = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}\\d])(\\d+)-([{LOWER}]+)(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe ACRONYM_HYPHEN = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])(\\p{{Lu}}{{2,}})-([{LOWER}]+)", "gu");
    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");
    private static readonly JsRe HU_BACK = JsRegex.Compile("[aáoóuú]", "u");
    private static readonly JsRe HU_VOWEL = JsRegex.Compile("[aáeéiíoóöőuúüű]", "u");
    private static readonly JsRe HU_VOWEL_FINAL = JsRegex.Compile("[aáeéiíoóöőuúüű]$", "u");
    private static readonly string[] HU_DIGRAPH = { "gy", "sz", "cs", "ny", "ly", "ty", "zs", "dz" };

    /**
     * The last vowel decides harmony; `harminc` is the one numeral where the vowel and the harmony disagree.
     */
    private static string HuLinkVowel(string stem)
    {
        if (stem.EndsWith("harminc", StringComparison.Ordinal)) return "a";
        var vs = Js.CodePoints(stem).Where(c => HU_VOWEL.IsMatch(c)).ToList();
        var last = vs.Count > 0 ? vs[^1] : null;
        return last is not null && HU_BACK.IsMatch(last) ? "a" : "e";
    }

    /** Instrumental -val/-vel: harmony, then v→consonant assimilation with digraph-aware doubling. */
    private static string HuInstrumental(string w)
    {
        var cut = w.LastIndexOf(' ') + 1;
        string head = w[..cut], stem = w[cut..];
        var v = HuLinkVowel(stem);
        if (HU_VOWEL_FINAL.IsMatch(stem)) return $"{head}{stem}v{v}l";
        // ⚠ The doubled letter goes BEFORE the digraph, not after the word: egy → e+g+gy = eggyel,
        // húsz → hússzal. Appending instead gives *egygel* / *húszsal*, which the g2p reads as two wrong
        // consonants.
        var dg = HU_DIGRAPH.FirstOrDefault(d => stem.EndsWith(d, StringComparison.Ordinal));
        var doubled = dg is not null ? $"{stem[..^dg.Length]}{dg[..1]}{dg}" : stem + stem[^1..];
        return $"{head}{doubled}{v}l";
    }

    /** Normalize one Hungarian input string. The numbered steps below are ORDER-DEPENDENT. */
    public static string NormalizeHungarian(string input)
    {
        var s = input;

        s = TIMES.Replace(s, m =>
        {
            var w = Numbers.MultiplicativeWords(Js.Number(m.Groups[1].Value));
            return w is null ? m.Value : $"{w} ";
        });

        foreach (var (re, word) in ERA) s = re.Replace(s, word);
        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        // 2) DIGIT DE-GROUPING, FIRST among the number rules — before the ordinal detector in step 9, which
        //    would otherwise read `100.` as an ordinal. Looped three times: `5.000.000` has two separators.
        for (var i = 0; i < 3; i++)
        {
            s = GROUP_DOT_SPACE.Replace(s, "");
            s = GROUP_DOT_THEN_SPACE.Replace(s, ""); // the `400. 000` shape
            s = GROUP_COMMA.Replace(s, "");
        }

        s = CLOCK.Replace(s, m =>
            Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} {m.Groups[2].Value}");

        // 4) UNIT ABBREVIATION + HYPHEN SUFFIX, BEFORE the shared symbol tier (step 6). The tier would
        //    otherwise claim `20 km-re` and leave `-re` stranded behind the substituted word.
        s = UNIT_SUFFIX.Replace(s, m =>
        {
            var u = m.Groups[1].Value;
            var exp = m.Groups[2].Success ? m.Groups[2].Value : null;
            var suf = m.Groups[3].Value;
            if (!SUFFIXABLE_UNIT.TryGetValue(u.ToLowerInvariant(), out var head)) return m.Value;
            var pre = exp is null ? "" : exp == "\u00b3" || exp == "3" ? "köb" : "négyzet";
            return $"{pre}{head}{suf}";
        });
        s = METRE_SUFFIX.Replace(s, m =>
        {
            var exp = m.Groups[2].Success ? m.Groups[2].Value : null;
            var pre = exp is null ? "" : exp == "\u00b3" || exp == "3" ? "köb" : "négyzet";
            return $"{m.Groups[1].Value} {pre}méter{m.Groups[3].Value}";
        });

        // 5) PERCENT + HYPHEN SUFFIX, before the tier, for the reason step 4 gives.
        s = PCT_SUFFIX.Replace(s, "$1 százalék$2");

        // 6) SHARED SYMBOL TIER — %, units, rates, exponents. BEFORE the decimal rewrite in step 8: the tier
        //    matches a unit only when a NUMBER is adjacent, and `3,5` → *három egész öt* destroys that.
        s = NormalizeSymbolsFn(s);

        // 7) DEGREES and SIGNS. The suffixed form (`35°-tól`) is claimed FIRST, for the reason step 4 exists.
        // ⚠ The lowercase scale letters go in the CLASS, not in an `i` flag: `LOWER` is the Hungarian
        //    lowercase alphabet and the suffix is genuinely lowercase-only, so `i` would silently widen the
        //    suffix capture.
        s = DEG_SUFFIX.Replace(s, m =>
        {
            var scale = m.Groups[2].Success ? m.Groups[2].Value : null;
            var pre = scale?.ToUpperInvariant() == "C" ? "Celsius-"
                : scale?.ToUpperInvariant() == "F" ? "Fahrenheit-" : "";
            return $"{m.Groups[1].Value} {pre}fok{m.Groups[3].Value}";
        });
        s = DEG_C.Replace(s, "$1 Celsius-fok");
        s = DEG_F.Replace(s, "$1 Fahrenheit-fok");
        s = DEG.Replace(s, "$1 fok");
        // ⚠ Every `-<digit>` in Hungarian text of this kind is a RANGE or a score, not a negative, so the
        // minus is restricted to positions a range cannot occupy.
        {
            var subject = s;
            s = MINUS.Replace(s, m => DIGIT_BEFORE.IsMatch(subject[..m.Index]) ? m.Value : "mínusz ");
        }
        s = PLUS_MINUS.Replace(s, " plusz mínusz ");
        s = PLUS_ATTACHED.Replace(s, "$1 plusz $2"); // UTC+1
        s = PLUS_LEADING.Replace(s, "$1plusz $2"); // "a + 30°C"

        s = EQUALS.Replace(s, " egyenlő ");
        s = LESS_THAN.Replace(s, " kisebb mint ");
        s = GREATER_THAN.Replace(s, " nagyobb mint ");
        s = DIVIDE.Replace(s, m =>
            $"{Numbers.NumberToWords(Js.Number(m.Groups[1].Value), m.Groups[1].Value)} " +
            $"{HuInstrumental(Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value))} osztva");

        s = DECIMAL.Replace(s, "$1 egész ");

        // 9) ORDINALS.
        // 9a) YEAR + MONTH: the year is a plain CARDINAL and its period is silent. Must precede 9c, which
        //     would otherwise claim the same period as an ordinal marker.
        s = YEAR_MONTH.Replace(s, "$1$2");
        s = MONTH_DAY.Replace(s, m =>
        {
            var w = DateNominative(Js.Number(m.Groups[2].Value));
            return w is null ? m.Value : $"{m.Groups[1].Value}{w}";
        });
        // 9c) The general ordinal. The period is CONSUMED — removing the spurious phrase break is half the fix.
        s = ORDINAL_DOT.Replace(s, m => Numbers.OrdinalWords(Js.Number(m.Groups[1].Value)) ?? m.Value);
        // 9d) The period after a Roman-numeral ORDINAL WORD, which the shared roman pass has already
        //     produced by the time this runs. Not extended to a capitalised follower on purpose: that shape
        //     is indistinguishable from a sentence that merely ENDS in an ordinal.
        s = ORDINAL_PERIOD.Replace(s, "");

        // 10) NUMERAL + HYPHEN SUFFIX → WORDS. LAST of the number rules, because it is the only one that
        //     leaves digits behind: steps 3–9 all need the digits still present to match on.
        // 10a) Dates take the ORDINAL stem, gated on a preceding month name.
        s = DATE_HYPHEN.Replace(s, m =>
        {
            var suf = m.Groups[2].Value;
            if (!DATE_SUFFIX.IsMatch(suf)) return m.Value;
            var d = Js.Number(m.Groups[1].Value);
            var stem = DateStem(d);
            if (stem is null) return m.Value;
            // Day 1's stem is *elsej-*, so the written `j` of `1-jén` is already in the stem.
            return stem + (d == 1 ? (suf.StartsWith("j", StringComparison.Ordinal) ? suf[1..] : suf) : suf);
        });
        s = NUM_HYPHEN.Replace(s, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return m.Value;
            var words = Numbers.NumberToWords(n);
            return HAS_DIGIT.IsMatch(words) ? m.Value : AttachSuffix(words, m.Groups[2].Value);
        });

        // 11) ACRONYMS, LAST of the letter rules: after step 1, else `Kr`/`ld` are spelled out.
        // 11a) Acronym + hyphen suffix — the suffix belongs to the LAST letter name (*gé pé eshez*), so it is
        //      glued here rather than left for the tokenizer to drop the hyphen.
        s = ACRONYM_HYPHEN.Replace(s, m =>
        {
            var acr = m.Groups[1].Value;
            var suf = m.Groups[2].Value;
            if (ACRONYM_WORD.TryGetValue(acr, out var lexical)) return lexical + suf;
            if (!IsUnreadableHungarian(acr)) return acr.ToLowerInvariant() + suf;
            var spelled = SpellOut(acr);
            return spelled is null ? m.Value : spelled + suf;
        });
        // 11b) The lexical overrides, before the shared pass can spell them out letter by letter.
        foreach (var (acr, word) in ACRONYM_WORD)
            s = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){acr}(?![\\p{{L}}\\p{{M}}])", "gu").Replace(s, word);
        s = NormalizeInitialisms(s);

        return s;
    }
}
