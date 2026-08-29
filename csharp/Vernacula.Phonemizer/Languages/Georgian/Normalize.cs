/**
 * Georgian (ka) TEXT NORMALIZATION — pure text→text, run inside the engine's `Text()` before tokenization.
 * Rewrites what is not already a pronounceable word into words the existing g2p speaks.
 *
 * ═══ THE DEFINING RULE: A CASE/POSTPOSITION SUFFIX GLUED TO A FIGURE (trap 14) ═══
 *
 * Georgian is agglutinative with a rich case system, and the corpus writes the ending after the DIGITS with
 * a hyphen. ⚠ A DIGIT ONLY BECOMES WORDS IN THE TOKENIZER, so gluing or spacing the written ending can never
 * work: as a free token `ზე`/`მდე`/`იან` is a bound morpheme standing alone, which Georgian does not have.
 * The fix is to convert the operand to WORDS inside the rule, then attach the ending to the LAST WORD with
 * the right stem alternation.
 *
 * ⚠ AND THE ALTERNATION IS THE POINT, NOT THE CONCATENATION. A Georgian numeral ends in the nominative -ი,
 * which is LOST or changed before an ending: ასი+ზე = ასზე (not *ასიზე), ასი+მდე = ასამდე, ასი+დან = ასიდან,
 * and the vowel stems რვა/ცხრა truncate before some endings and not others (რვის, რვამდე, რვაჯერ).
 * `Endings` below is that table.
 *
 * ⚠ THE NEGATIVE RESULT THAT SHAPED THE FILE (trap 15, answered NO): the same bound suffix is also written
 * with a SPACE — 312 instances of a figure plus a spaced year noun, the single most common numeric shape in
 * the corpus. Every one is a fully-spelled, separately-declined NOUN, and a Georgian numeral used
 * attributively before a noun DOES NOT DECLINE. So `2011 წელს` already reads correctly and NO RULE IS
 * WRITTEN FOR IT.
 *
 * Ported from src/languages/georgian/normalize.ts — see that file for every count, every word's citation,
 * and the full account of what is refused and what each refusal costs.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Georgian;

public static class Normalize
{
    private static GeorgianNumbersDef N => Manifest.MANIFEST.Numbers;

    // ── STEM ALTERNATION — the machinery trap 14 requires, and the thing that makes this layer Georgian ──

    /** A word's declension class, read off its final vowel. Georgian nouns/numerals in -ი carry a nominative
     *  marker LOST before every ending; -ა and -ე stems truncate before the "truncating" endings and keep
     *  the vowel before the rest; -ო/-უ (and consonant-final loans) never truncate. */
    private readonly record struct Stem(string Bare, string Core, char Kind);

    private static Stem Analyse(string word)
    {
        if (word.EndsWith("ი", StringComparison.Ordinal)) return new Stem(word, word[..^1], 'i');
        if (word.EndsWith("ა", StringComparison.Ordinal)) return new Stem(word, word[..^1], 'a');
        if (word.EndsWith("ე", StringComparison.Ordinal)) return new Stem(word, word[..^1], 'e');
        return new Stem(word, word, 'o');
    }

    /**
     * The endings the corpus writes after a hyphen, keyed by what is WRITTEN, mapped to the form the WORD
     * takes. The written suffix names the case; the word supplies its own shape.
     *   ს dat · ის gen · ით ins · მა erg · ად adv · ზე on/at · ში in · იდან~დან from · ამდე~მდე until ·
     *   თან with · ჯერ ×times · იან(ი) -ish (the decade adjective) · ია the copula "is"
     */
    private static readonly IReadOnlyDictionary<string, Func<Stem, string>> ENDINGS =
        new Dictionary<string, Func<Stem, string>>(StringComparer.Ordinal)
        {
            // NON-TRUNCATING for a/e stems: the ending simply follows the full word (რვას, რვაზე, რვამდე).
            ["ს"] = s => (s.Kind == 'i' ? s.Core : s.Bare) + "ს",
            ["ზე"] = s => (s.Kind == 'i' ? s.Core : s.Bare) + "ზე",
            ["ში"] = s => (s.Kind == 'i' ? s.Core : s.Bare) + "ში",
            ["მდე"] = s => s.Kind == 'i' ? s.Core + "ამდე" : s.Bare + "მდე",
            ["თან"] = s => s.Kind == 'i' ? s.Core + "თან" : s.Bare + "სთან",
            ["ჯერ"] = s => (s.Kind == 'i' ? s.Core : s.Bare) + "ჯერ",
            // TRUNCATING for a/e stems: the stem vowel drops before the ending (რვის, რვით, რვიდან, რვიანი).
            ["ის"] = s => s.Kind == 'o' ? s.Bare + "ს" : s.Core + "ის",
            ["ით"] = s => s.Kind == 'o' ? s.Bare + "თი" : s.Core + "ით",
            ["ად"] = s => s.Core + "ად",
            ["მა"] = s => s.Kind == 'i' ? s.Core + "მა" : s.Core + "მ",
            ["იდან"] = s => s.Kind == 'o' ? s.Bare + "დან" : s.Core + "იდან",
            ["იან"] = s => s.Core + "იან",
            ["იანი"] = s => s.Core + "იანი",
            // THE COPULA. `500 მმ-ია`, `12 °C-ია`, `4.52-ია` — "is N". An i-stem keeps its -ი (ასია); an
            // a-stem simply lengthens (რვაა).
            ["ია"] = s => s.Bare + "ა",
            // A CASE ENDING PLUS THE COPULA, written as one run after the figure. Without these the ending
            // fails its right-boundary test and a bare `მდეა` survives as a token — the very defect this
            // file exists to remove.
            ["მდეა"] = s => s.Kind == 'i' ? s.Core + "ამდეა" : s.Bare + "მდეა",
            ["ზეა"] = s => (s.Kind == 'i' ? s.Core : s.Bare) + "ზეა",
        };

    /** The written forms the corpus actually uses, LONGEST-FIRST so `იდან` is tried before `დან` and `იანი`
     *  before `იან`. `დან`/`ამდე` are the SAME endings written short after a figure — the writer
     *  abbreviates, the word does not. ⚠ ORDER IS LOAD-BEARING (it becomes a regex alternation). */
    private static readonly (string Written, string Key)[] WRITTEN =
    [
        ("იანი", "იანი"), ("იდან", "იდან"), ("ამდე", "მდე"), ("მდეა", "მდეა"), ("იან", "იან"),
        ("დან", "იდან"), ("მდე", "მდე"), ("ზეა", "ზეა"), ("თან", "თან"), ("ჯერ", "ჯერ"),
        ("ის", "ის"), ("ით", "ით"), ("მა", "მა"), ("ად", "ად"), ("ზე", "ზე"), ("ში", "ში"), ("ია", "ია"),
        ("ს", "ს"),
    ];
    private static readonly string WRITTEN_ALT = string.Join("|", WRITTEN.Select(w => w.Written));

    private static readonly JsRe ATTRIBUTIVE = JsRegex.Compile("(?:ული|ური)$", "u");

    /** A Georgian attributive adjective before a case-marked noun drops its own nominative -ი
     *  (კვადრატული კილომეტრი → კვადრატულ კილომეტრზე). Only the two measure adjectives this file emits. */
    private static string TruncateAttributive(string w) => ATTRIBUTIVE.IsMatch(w) ? w[..^1] : w;

    /** Attach the ending named by `written` to the LAST word of a space-separated phrase, truncating the
     *  attributive adjective in front of it if there is one. */
    private static string Attach(string phrase, string? written)
    {
        if (written is null || written == "") return phrase;
        string? key = null;
        foreach (var (w, k) in WRITTEN) if (w == written) { key = k; break; }
        if (key is null || !ENDINGS.TryGetValue(key, out var make)) return phrase;
        var words = phrase.Split(' ').ToList();
        if (words.Count == 0) return phrase;
        var last = words[^1];
        words.RemoveAt(words.Count - 1);
        if (last == "") return phrase;
        if (words.Count > 0) words[^1] = TruncateAttributive(words[^1]);
        words.Add(make(Analyse(last)));
        return string.Join(" ", words);
    }

    /** The numeral's bare STEM, for the compound-noun writing (`12-წლიანი` → თორმეტწლიანი). */
    private static string StemOf(string phrase)
    {
        var words = phrase.Split(' ').ToList();
        var last = words[^1];
        words.RemoveAt(words.Count - 1);
        var st = Analyse(last);
        words.Add(st.Kind == 'i' ? st.Core : last);
        return string.Join(" ", words);
    }

    // ── ORDINALS — the მე-…-ე circumfix, composed from the manifest's own cardinal tables ────────────────

    private static readonly JsRe CIRCUMFIX_STRIP = JsRegex.Compile("[ია]$", "u");

    /** მე + stem + ე. The strip is uniform across both stem shapes: ორი→მეორე, რვა→მერვე, ცხრა→მეცხრე,
     *  ოცი→მეოცე, ასი→მეასე, ათასი→მეათასე. */
    private static string Circumfix(string cardinal) => $"მე{CIRCUMFIX_STRIP.Replace(cardinal, "")}ე";

    /** 1–19 → the ordinal. ⚠ ONE is SUPPLETIVE in isolation (პირველი) but regular INSIDE a compound
     *  (ოცდამეერთე, 21st) — the caller says which position it is in. */
    private static string OrdSub20(int n, bool isolated)
    {
        if (n == 1) return isolated ? "პირველი" : Circumfix(N.Units[1]);
        return Circumfix(n < 10 ? N.Units[n] : N.Teens[n - 10]);
    }

    /** 1–99. A round score is ordinalised whole (ოცი→მეოცე); a score compound puts the circumfix on the
     *  REMAINDER only, inside the same word (25 → ოცდა+მეხუთე = ოცდამეხუთე). */
    private static string OrdSub100(int n, bool isolated)
    {
        if (n < 20) return OrdSub20(n, isolated);
        var s = n / 20;
        var r = n - s * 20;
        return r == 0 ? Circumfix(N.Scores.Bare[s]) : N.Scores.Comb[s] + OrdSub20(r, false);
    }

    /** 1–999. The hundred keeps its cardinal COMB form when a remainder follows. */
    private static string OrdSub1000(int n, bool isolated)
    {
        var h = n / 100;
        var r = n % 100;
        if (h == 0) return OrdSub100(n, isolated);
        return r == 0 ? Circumfix(N.Hundreds.Bare[h]) : $"{N.Hundreds.Comb[h]} {OrdSub100(r, false)}";
    }

    /** A positive integer → the Georgian ordinal, or `null` if this file declines to compose it.
     *  ⚠ CAPPED AT 9999 and pinned per BRANCH, not per corpus instance (trap 13). */
    public static string? OrdinalWord(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n > 9999) return null;
        var v = (int)n;
        if (v < 1000) return OrdSub1000(v, true);
        var th = v / 1000;
        var r = v % 1000;
        var head = th == 1
            ? N.Magnitudes.Thousand.Comb
            : $"{Numbers.NumberToWords(th)} {N.Magnitudes.Thousand.Comb}";
        return r == 0 ? Circumfix(N.Magnitudes.Thousand.Bare) : $"{head} {OrdSub1000(r, false)}";
    }

    // ── UNIT / SYMBOL VOCABULARY — see the TS header for the citation of every word ──────────────────────

    /**
     * Georgian unit abbreviations, LONGEST-FIRST (a 2-letter key must beat the 1-letter ⟨მ⟩). 102
     * digit-adjacent instances in the artifact — ⟨მმ⟩ ×36, ⟨კმ⟩ ×26, ⟨მ⟩ ×18, ⟨სმ⟩ ×2, ⟨კვტ⟩ ×1.
     * ⚠ THE LATIN SPELLINGS ARE ROBUSTNESS, NOT A MEASURED REPAIR: a bare `5 km` otherwise reaches the IPA
     * as the cluster *ˈʊkm* via the English fallback — a pronounceable non-word no leak class can see
     * (trap 56). Only MULTI-LETTER Latin keys are declared; a one-letter Latin key would bite inside the
     * Latin runs this corpus is full of.
     */
    private static readonly (string Key, string Word)[] UNITS =
    [
        ("კვტ", "კილოვატი"), ("მმ", "მილიმეტრი"), ("სმ", "სანტიმეტრი"), ("კმ", "კილომეტრი"),
        ("კგ", "კილოგრამი"), ("წმ", "წამი"), ("წთ", "წუთი"), ("სთ", "საათი"), ("მ", "მეტრი"),
        ("km", "კილომეტრი"), ("mm", "მილიმეტრი"), ("cm", "სანტიმეტრი"), ("kg", "კილოგრამი"),
    ];
    private static readonly string UNIT_ALT = string.Join("|", UNITS.Select(u => u.Key));
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD =
        UNITS.ToDictionary(u => u.Key, u => u.Word, StringComparer.Ordinal);

    /** The magnitude abbreviations, which the corpus writes WITH their dot (`$316 მლრდ.`). */
    private static readonly (string Abbr, string Word)[] SCALES =
        [("მლრდ", "მილიარდი"), ("მლნ", "მილიონი"), ("ათ", "ათასი")];

    private static readonly (string Sign, string Word)[] CURRENCY = [("$", "დოლარი"), ("€", "ევრო")];

    /** A Georgian magnitude word, spelled or abbreviated — used to spot the currency's noun slot. */
    private const string MAG_WORD = "მილიარდ|მილიონ|ათას|მლრდ|მლნ";

    private const string GEO = "\\p{Script=Georgian}";

    /** Compose the cardinal for a written figure that may still carry its decimal separator.
     *  JS `fig.split(/[.,]/u)` — a two-member class, so a plain char split is the same partition,
     *  empty pieces included. */
    private static string FigureToWords(string fig) =>
        string.Join(" ", fig.Split('.', ',')
            .Select(p => p == "" ? "" : Numbers.NumberToWords(Js.Number(p), p))
            .Where(p => p != ""));

    // ── THE RULES ────────────────────────────────────────────────────────────────────────────────────────

    /** ⚠ The optional trailing case ending shared by the degree/percent/unit rules. */
    private static readonly string DEG =
        $"(?:\\s*-?({WRITTEN_ALT}){Boundaries.NOT_LETTER_AFTER})?";

    private static readonly JsRe ORDINAL_INDICATOR = JsRegex.Compile("º", "gu");
    private static readonly JsRe SPACE_GROUP =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d])0)[ \\u00a0\\u202f\\u2009](\\d{3})(?!\\d)", "gu");  // space, NBSP, NNBSP, thin
    private static readonly JsRe COMMA_GROUP =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?![\\d.,])", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe MINUS_SIGN = JsRegex.Compile("−", "gu");
    private static readonly JsRe MINUS_PAREN = JsRegex.Compile("\\((-)(?=\\s?\\d)", "gu");
    private static readonly JsRe MINUS_DEGREE =
        JsRegex.Compile("(^|[\\s(])[-–](?=\\s?\\d[\\d.,]*\\s?°)", "gu");
    private static readonly JsRe MINUS_PLAIN =
        JsRegex.Compile("(^|[\\s(])(?<!\\d\\s)[-–](?=\\d)", "gu");
    private static readonly JsRe PLUS_LEAD = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile("(?<=\\d)\\s?\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe EQUALS =
        JsRegex.Compile("(?<=[\\d\\p{Script=Georgian}])\\s*=\\s*(?=(?:მინუს\\s+)?\\d)", "gu");
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");

    private static readonly JsRe CLOCK = JsRegex.Compile(
        $"(?<![\\d:.,])(\\d{{1,2}}):([0-5]\\d)(?::([0-5]\\d))?(?![\\d:])" +
        $"(?:\\s*-?({WRITTEN_ALT}){Boundaries.NOT_LETTER_AFTER})?" +
        $"(?:\\s+(საათ(?:{WRITTEN_ALT})?){Boundaries.NOT_LETTER_AFTER})?", "gu");
    private static readonly JsRe CLOCK_TZ =
        JsRegex.Compile("(?<![\\d:.,])(\\d{1,2}):([0-5]\\d)(?![\\d:])(?=\\s*(?:UTC|GMT))", "gu");

    private static readonly JsRe ORD_PREFIX =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}მე-(\\d{{1,4}})(?![\\d.,])", "gu");
    private static readonly JsRe ORD_SUFFIX =
        JsRegex.Compile($"(?<![\\d.,])(\\d{{1,4}})-ე{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe ORD_FIRST =
        JsRegex.Compile($"(?<![\\d.,])1-ლი{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe ROMAN_CENTURY =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])([IVX])(?![\\p{L}\\p{M}])(\\s+)(?=საუკუნ|ათასწლეულ)", "gu");
    private static readonly JsRe DIGIT_CENTURY =
        JsRegex.Compile("(?<![\\d.,\\p{L}\\p{M}])(\\d{1,2})(?=\\s+(?:საუკუნ|ათასწლეულ))", "gu");

    private static readonly JsRe DEG_C = JsRegex.Compile($"(\\d[\\d.,]*)\\s?°\\s?C{DEG}", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile($"(\\d[\\d.,]*)\\s?°\\s?F{DEG}", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile($"(\\d[\\d.,]*)\\s?°{DEG}", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile($"(\\d[\\d.,]*)\\s?%{DEG}", "gu");
    private static readonly JsRe PERMILLE = JsRegex.Compile($"(\\d[\\d.,]*)\\s?‰{DEG}", "gu");
    private static readonly JsRe PERCENT_BARE = JsRegex.Compile($"%{DEG}", "gu");

    private static readonly JsRe SQUARE_SPELLED =
        JsRegex.Compile($"(\\d[\\d.,]*)\\s?კვ\\.?\\s?({UNIT_ALT}){DEG}", "gu");
    private static readonly JsRe KWH =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])კვტ\\s?\\/\\s?სთ(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe UNIT_RATE = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}({UNIT_ALT})\\s?\\/\\s?({UNIT_ALT}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe NOUN_RATE = JsRegex.Compile(
        $"({GEO}+)\\s?\\/\\s?({UNIT_ALT})([²³])?{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe FIGURE_EXPONENT = JsRegex.Compile(
        $"(\\d[\\d.,]*)\\s?{Boundaries.NOT_LETTER_BEFORE}({UNIT_ALT})([²³]){DEG}", "gu");
    private static readonly JsRe BARE_EXPONENT = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}({UNIT_ALT})([²³]){DEG}", "gu");
    private static readonly JsRe FIGURE_UNIT = JsRegex.Compile(
        $"(\\d[\\d.,]*)\\s?{Boundaries.NOT_LETTER_BEFORE}({UNIT_ALT}){DEG}{Boundaries.NOT_LETTER_AFTER}", "gu");

    private static readonly JsRe MAG_STRIP = JsRegex.Compile("[ია]$", "u");

    private const string MONTHS =
        "იანვ|თებერვ|მარტ|აპრილ|მაის|ივნის|ივლის|აგვისტ|სექტემბ|ოქტომბ|ნოემბ|დეკემბ";
    private static readonly JsRe FRACTION = JsRegex.Compile(
        $"(?<![\\d.,/])(\\d{{1,3}})\\s?\\/\\s?(\\d{{1,3}})(?![\\d.,/])(?!\\s*(?:{MONTHS})){DEG}", "gu");
    private static readonly JsRe ORD_TO_FRACTION = JsRegex.Compile("ე$", "u");

    private static readonly JsRe FIGURE_SUFFIX = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(?<![\\d.,])(\\d[\\d.,]*\\d|\\d)-({WRITTEN_ALT}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe COMPOUND_NOUN = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(?<![\\d.,])(\\d+)-({GEO}{{2,}}იან[ია]?){Boundaries.NOT_LETTER_AFTER}", "gu");

    private static readonly JsRe DECIMAL_SEP = JsRegex.Compile("(?<=\\d)[.,](?=\\d)", "gu");

    /** The era markers and dotted abbreviations, each in two arms — before a word, and clause-final. */
    private static readonly (string Pattern, string Expansion)[] ABBREV =
    [
        ("ძვ\\.\\s?წ\\.", "ძველი წელთაღრიცხვით"),
        ("ახ\\.\\s?წ\\.", "ახალი წელთაღრიცხვით"),
        ("ე\\.\\s?წ\\.", "ეგრეთ წოდებული"),
        ("ა\\.\\s?შ\\.", "ასე შემდეგ"),
        ("მ\\.\\s?შ\\.", "მათ შორის"),
        ("დაახლ\\.", "დაახლოებით"),
        ("სხვ\\.", "სხვა"),
        ("წწ\\.", "წლები"),
    ];

    private static string? Opt(Match m, int g) => m.Groups[g].Success ? m.Groups[g].Value : null;

    /** Normalize one Georgian input string. Pure text→text; every word emitted is phonemized by the g2p
     *  downstream, so no spelling reaches the phoneme sink (trap 6). ⚠ ORDER IS LOAD-BEARING. */
    public static string NormalizeGeorgian(string input)
    {
        var s = input;

        // 0) Fold the masculine ordinal indicator onto the degree sign.
        s = Rewrite(s, ORDINAL_INDICATOR, "°");

        // 1) DE-GROUP, FIRST OF ALL. The engine's TOKEN is `\d+`, so a grouped thousand splits and its tail
        //    reads as a separate number (`5 000` → *χutʰi nuli*, "five zero"). Two passes, because adjacent
        //    groups share the digit the first consumes.
        for (var i = 0; i < 2; i++) s = Rewrite(s, SPACE_GROUP, "$1");
        s = Rewrite(s, COMMA_GROUP, m => m.Groups[1].Value + COMMAS.Replace(m.Groups[2].Value, ""));

        // 2) SIGNS — and they run HERE, above everything that spends a degree sign or a unit (trap 39).
        s = Rewrite(s, MINUS_SIGN, " მინუს ");
        s = Rewrite(s, MINUS_PAREN, "( მინუს ");
        s = Rewrite(s, MINUS_DEGREE, "$1მინუს ");
        s = Rewrite(s, MINUS_PLAIN, "$1მინუს ");
        s = Rewrite(s, PLUS_LEAD, "$1პლუს ");
        s = Rewrite(s, PLUS_INFIX, " პლუს ");
        s = Rewrite(s, EQUALS, " უდრის ");
        s = Rewrite(s, NUMERO, "ნომერი ");

        // 3) THE CLOCK, before anything that reads a bare number or a pause.
        s = Rewrite(s, CLOCK, m =>
        {
            var hv = (int)Js.Number(m.Groups[1].Value);
            var mv = (int)Js.Number(m.Groups[2].Value);
            if (hv > 23) return m.Value;
            var se = Opt(m, 3);
            var sfx = Opt(m, 4);
            var hourWord = Opt(m, 5);
            if (se is null && sfx is null && hourWord is null) return m.Value;
            var ending = sfx ?? (hourWord is null
                ? null
                : hourWord[Math.Min("საათ".Length, hourWord.Length)..] is var tail && tail != "" ? tail : null);
            var parts = new List<string> { $"{Numbers.NumberToWords(hv)} საათი" };
            if (mv != 0 || se is not null) parts.Add($"{Numbers.NumberToWords(mv)} წუთი");
            if (se is not null) parts.Add($"{Numbers.NumberToWords(Js.Number(se), se)} წამი");
            var joined = parts.Count == 1
                ? parts[0]
                : $"{string.Join(", ", parts.Take(parts.Count - 1))} და {parts[^1]}";
            return Attach(joined, ending);
        });
        //    3b) THE TIMEZONE ARM — the zone name is the context.
        s = Rewrite(s, CLOCK_TZ, m =>
        {
            var h = m.Groups[1].Value;
            var mi = m.Groups[2].Value;
            return Js.Number(h) > 23
                ? m.Value
                : $"{Numbers.NumberToWords(Js.Number(h), h)} საათი და {Numbers.NumberToWords(Js.Number(mi), mi)} წუთი";
        });

        // 4) ORDINALS. Both halves of the circumfix, and the century.
        s = Rewrite(s, ORD_PREFIX, m => OrdinalWord(Js.Number(m.Groups[1].Value)) ?? m.Value);
        s = Rewrite(s, ORD_SUFFIX, m => OrdinalWord(Js.Number(m.Groups[1].Value)) ?? m.Value);
        s = Rewrite(s, ORD_FIRST, "პირველი");
        s = Rewrite(s, ROMAN_CENTURY, m =>
        {
            var r = m.Groups[1].Value;
            int? n = r switch { "I" => 1, "V" => 5, "X" => 10, _ => null };
            var ord = n is null ? null : OrdinalWord(n.Value);
            return ord is null ? m.Value : ord + m.Groups[2].Value;
        });
        s = Rewrite(s, DIGIT_CENTURY, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            return n >= 1 && n <= 21 ? OrdinalWord(n) ?? m.Value : m.Value;
        });

        // 5) DEGREES, before the general suffix rule so `°C-მდე` attaches to ცელსიუსი and not to a bare figure.
        s = Rewrite(s, DEG_C, m => Attach($"{FigureToWords(m.Groups[1].Value)} გრადუსი ცელსიუსი", Opt(m, 2)));
        s = Rewrite(s, DEG_F, m => Attach($"{FigureToWords(m.Groups[1].Value)} გრადუსი ფარენჰაიტი", Opt(m, 2)));
        s = Rewrite(s, DEG_BARE, m => Attach($"{FigureToWords(m.Groups[1].Value)} გრადუსი", Opt(m, 2)));

        // 6) PERCENT AND PER MILLE, postposed, with the ending attaching to the WORD.
        s = Rewrite(s, PERCENT, m => Attach($"{FigureToWords(m.Groups[1].Value)} პროცენტი", Opt(m, 2)));
        s = Rewrite(s, PERMILLE, m => Attach($"{FigureToWords(m.Groups[1].Value)} პრომილე", Opt(m, 2)));
        s = Rewrite(s, PERCENT_BARE, m => Attach("პროცენტი", Opt(m, 1)));

        // 7) UNITS. Ordered longest-key-first, and the COMPOSED forms before the bare ones.
        //    7a) `კვ. კმ` / `კვ კმ` — the spelled-out square.
        s = Rewrite(s, SQUARE_SPELLED, m =>
            Attach($"{FigureToWords(m.Groups[1].Value)} კვადრატული {UNIT_WORD[m.Groups[2].Value]}", Opt(m, 3)));
        //    7b) THE RATE, before the exponent — a denominator can itself be an exponent.
        s = Rewrite(s, KWH, "კილოვატ საათი");
        s = Rewrite(s, UNIT_RATE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return $"{UNIT_WORD[a]} {Attach(UNIT_WORD[b], b == "სთ" ? "ში" : "ზე")}";
        });
        s = Rewrite(s, NOUN_RATE, m =>
        {
            var head = m.Groups[1].Value;
            var u = m.Groups[2].Value;
            var ex = Opt(m, 3);
            var noun = ex is null
                ? UNIT_WORD[u]
                : $"{(ex == "²" ? "კვადრატული" : "კუბური")} {UNIT_WORD[u]}";
            return $"{head} {Attach(noun, "ზე")}";
        });
        //    7c) THE EXPONENT, ² and ³.
        s = Rewrite(s, FIGURE_EXPONENT, m => Attach(
            $"{FigureToWords(m.Groups[1].Value)} {ExponentNoun(m.Groups[2].Value, m.Groups[3].Value)}", Opt(m, 4)));
        s = Rewrite(s, BARE_EXPONENT, m =>
            Attach(ExponentNoun(m.Groups[1].Value, m.Groups[2].Value), Opt(m, 3)));
        //    7d) THE PLAIN UNIT.
        s = Rewrite(s, FIGURE_UNIT, m =>
            Attach($"{FigureToWords(m.Groups[1].Value)} {UNIT_WORD[m.Groups[2].Value]}", Opt(m, 3)));
        //    7e) THE MAGNITUDE ABBREVIATIONS, with their own dot consumed.
        foreach (var (abbr, word) in SCALES)
        {
            var re = JsRegex.Compile(
                $"(?<=\\d)\\s?{Boundaries.NOT_LETTER_BEFORE}{abbr}\\.?{DEG}{Boundaries.NOT_LETTER_AFTER}", "gu");
            s = Rewrite(s, re, m => " " + Attach(word, Opt(m, 1)));
        }

        // 8) CURRENCY, postposed after the magnitude in the NOMINATIVE — the frame the attesting sentence uses.
        foreach (var (sign, word) in CURRENCY)
        {
            var S = sign == "$" ? "\\$" : sign;
            var stem = MAG_STRIP.Replace(word, ""); // დოლარი → დოლარ, ევრო → ევრო: matches any inflected form
            var re = JsRegex.Compile(
                $"{S}\\s?(\\d[\\d.,]*)((?:\\s+(?:{MAG_WORD}){GEO}*)?)" +
                $"(?:\\s*-?({WRITTEN_ALT}){Boundaries.NOT_LETTER_AFTER})?", "gu");
            var already = JsRegex.Compile($"^\\s*{stem}", "u");
            var frozen = s;
            s = Rewrite(s, re, m =>
            {
                var head = $"{FigureToWords(m.Groups[1].Value)}{m.Groups[2].Value}";
                var after = frozen[(m.Index + m.Length)..];
                if (already.IsMatch(after)) return head;
                return Attach($"{head} {word}", Opt(m, 3));
            });
            var post = JsRegex.Compile($"(\\d[\\d.,]*)\\s{S}(?!\\d)", "gu");
            s = Rewrite(s, post, m => $"{FigureToWords(m.Groups[1].Value)} {word}");
        }

        // 9) ERA MARKERS AND DOTTED ABBREVIATIONS. Multi-dot before single-dot, each in two arms.
        foreach (var (pat, expansion) in ABBREV)
        {
            s = Rewrite(s, JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}{pat}\\s*(?=[\\p{{L}}\\d])", "gu"),
                expansion + " ");
            s = Rewrite(s, JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}{pat}(?=\\s*(?:[.,;:!?»)\\]]|$))", "gu"),
                expansion + ".");
        }

        // 10) FRACTIONS.
        s = Rewrite(s, FRACTION, m =>
        {
            var num = (int)Js.Number(m.Groups[1].Value);
            var den = (int)Js.Number(m.Groups[2].Value);
            var sfx = Opt(m, 3);
            if (num < 1 || den < 2 || den > 100 || num >= den) return m.Value;
            if (den == 2) return Attach("ნახევარი", sfx); // the numerator can only be 1 under `num < den`
            var ord = OrdinalWord(den);
            if (ord is null) return m.Value;
            return Attach($"{Numbers.NumberToWords(num)} {ORD_TO_FRACTION.Replace(ord, "ედი")}", sfx);
        });

        // 11) THE GENERAL GLUED SUFFIX ON A BARE FIGURE — the rest of trap 14, after every symbol rule.
        s = Rewrite(s, FIGURE_SUFFIX, m =>
        {
            var words = FigureToWords(m.Groups[1].Value);
            return words == "" ? m.Value : Attach(words, m.Groups[2].Value);
        });
        //     11b) THE COMPOUND NOUN WRITING — `12-წლიანი`, `120,000-კაციანი`.
        s = Rewrite(s, COMPOUND_NOUN, m =>
        {
            var words = Numbers.NumberToWords(Js.Number(m.Groups[1].Value));
            return words == "" ? m.Value : $"{StemOf(words)}{m.Groups[2].Value}";
        });

        // 12) THE DECIMAL SEPARATOR — LAST, so every rule above still sees the number ADJACENT to its unit.
        //     ⚠ NO WORD IS AUTHORED (the sourcing found none in any tier), but the refusal is not neutral:
        //     the separator becomes a SPACE rather than being left alone, because the defect being fixed is a
        //     CLAUSE PAUSE inside a number, which is wrong under every candidate reading.
        s = Rewrite(s, DECIMAL_SEP, " ");

        return s;
    }

    private static string ExponentNoun(string u, string ex) =>
        $"{(ex == "²" ? "კვადრატული" : "კუბური")} {UNIT_WORD[u]}";
}
