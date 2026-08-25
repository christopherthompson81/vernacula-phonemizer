/**
 * Dutch (nl) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/dutch/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Dutch;

public static class Normalize
{

    /** Dutch ordinals 1–19. The regular ending is the cardinal plus -de; `eerste`, `derde` and `achtste` are
     *  the three suppletive/assimilated forms. From 20 up the ending is -ste (twintigste, zestigste). */
    private static readonly string[] ORD_BELOW_20 =
    {
        "", "eerste", "tweede", "derde", "vierde", "vijfde", "zesde", "zevende", "achtste", "negende", "tiende",
        "elfde", "twaalfde", "dertiende", "veertiende", "vijftiende", "zestiende", "zeventiende", "achttiende",
        "negentiende",
    };

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");

    /** Integer → the Dutch ordinal word. */
    public static string? OrdinalWord(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 1) return null;
        if (n < 20) return ORD_BELOW_20[(int)n];
        var card = Numbers.NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        var r = n % 100;
        if (r >= 1 && r < 20)
        {
            var ones = Manifest.MANIFEST.Numbers.Ones;
            var tail = (int)r < ones.Length ? ones[(int)r] : null;
            if (tail is not null && card.EndsWith(tail, StringComparison.Ordinal))
                return $"{card[..^tail.Length]}{ORD_BELOW_20[(int)r]}";
        }
        return $"{card}ste";
    }

    /** Multi-dot abbreviations and era markers. Handled BEFORE the single-dot rule so no interior dot survives
     *  as a phrase break. */
    private static readonly (string Body, string Word)[] MULTI_DOT =
    {
        ("v\\.\\s?Chr", "voor Christus"),
        ("n\\.\\s?Chr", "na Christus"),
        ("e\\.\\s?d", "en dergelijke"),
        ("o\\.\\s?a", "onder andere"),
        ("d\\.\\s?w\\.\\s?z", "dat wil zeggen"),
        ("m\\.\\s?a\\.\\s?w", "met andere woorden"),
        ("i\\.\\s?p\\.\\s?v", "in plaats van"),
        ("a\\.\\s?u\\.\\s?b", "alstublieft"),
        ("e\\.\\s?a", "en andere"),
    };
    /** The two branches of step 1, compiled once per abbreviation (the TS builds them inside the loop). */
    private static readonly (JsRe Final, JsRe Any, string Word)[] MULTI_DOT_RE = MULTI_DOT
        .Select(x => (
            JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){x.Body}\\.(?=\\s*$)", "giu"),
            JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){x.Body}\\.", "giu"),
            x.Word))
        .ToArray();

    /** Single-dot abbreviations → the spoken words. The dot is a phrase break otherwise, and the stem itself is
     *  usually unpronounceable: `bijv.` read as the word *bɛi̯f*, `nr.` as the cluster *nr*, `St.` as *st*. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["bijv"] = "bijvoorbeeld", ["bv"] = "bijvoorbeeld", ["etc"] = "etcetera", ["enz"] = "enzovoort", ["ca"] = "circa",
        ["dd"] = "de dato", ["nr"] = "nummer", ["jr"] = "junior", ["sr"] = "senior", ["st"] = "Sint", ["blz"] = "bladzijde",
        ["dr"] = "dokter", ["prof"] = "professor", ["ir"] = "ingenieur", ["drs"] = "doctorandus", ["mr"] = "meester",
        ["mln"] = "miljoen", ["mld"] = "miljard",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /**
     * Dutch phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?).
     */
    public static readonly Func<string, bool> IsUnreadableDutch = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{Manifest.MANIFEST.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Codas, StringComparer.Ordinal),
    });

    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => Manifest.MANIFEST.LetterNames.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableDutch(w),
    });

    /** Dutch has no pronunciation dictionary that records acronym readings (nl-stems.txt is a morphological
     *  stem list rather than a pronunciation table), so — as in German — the lexical facts live entirely in
     *  the manifest's `acronymLetters` and everything else falls to the OOV phonotactic rule. */
    public static string NormalizeDutchInitialisms(string text) => InitialismNormalizer(text);

    /** Letter-by-letter reading of an all-caps run, or undefined if any letter has no name. */
    private static string? SpellCaps(string run)
    {
        var names = Js.CodePoints(run.ToLowerInvariant())
            .Select(l => Manifest.MANIFEST.LetterNames.TryGetValue(l, out var v) ? v : null).ToList();
        return names.All(n => n is not null) ? string.Join(" ", names) : null;
    }

    private static readonly JsRe DOLLAR_CODE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:US|AUD)\\$(?=[ \u00a0]?\\d)", "gu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOT_OR_SPACE = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?\u00bb)]|$))", "giu");
    private static readonly JsRe ORDINAL = JsRegex.Compile("(?<![\\d,.])(\\d{1,4})(?:ste[n]?|de[n]?|e)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![:\\d])(\\s*uur)?", "gu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?![\\d.,:])(\\s*uur)?", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?\u00b0\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?\u00b0\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?\u00b0\\s?([NOZW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?\u00b0", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\u00b1", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?\u00f7\\s?", "gu");
    private static readonly JsRe AMP_LETTERS = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})&(\\p{Lu})(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile("\\s&\\s", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "noord", ["O"] = "oost", ["Z"] = "zuid", ["W"] = "west",
    };

    /**
     * Normalize one Dutch input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling.
     */
    public static string NormalizeDutch(string input)
    {
        var s = input;

        s = DOLLAR_CODE.Replace(s, "$$");

        foreach (var (final, any, word) in MULTI_DOT_RE)
        {
            s = final.Replace(s, $"{word}.");
            s = any.Replace(s, word);
        }

        s = DOTTED_CAPS.Replace(s, m => DOT_OR_SPACE.Replace(m.Value, ""));

        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        s = ORDINAL.Replace(s, m => OrdinalWord(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // The colon form's `(?![:\d])` / `(?<![\d:])` guards are load-bearing: a three-part `4:41:30` is a
        // SPORTS TIME, and without them the rule claims `4:41` and restarts inside the rest.
        static string Clock(string h, string min, string? uur)
        {
            var head = $"{Numbers.NumberToWords(Js.Number(h))}{uur ?? " uur"}";
            return Js.Number(min) == 0 ? head : $"{head} {Numbers.NumberToWords(Js.Number(min))}";
        }
        // JS hands an unmatched optional group as `undefined`, which the `??` above turns into " uur"; .NET
        // hands an EMPTY string, so the group's Success is what decides here.
        s = CLOCK_COLON.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value,
            m.Groups[3].Success ? m.Groups[3].Value : null));
        s = CLOCK_DOT.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value,
            m.Groups[3].Success ? m.Groups[3].Value : null));

        s = DEG_C.Replace(s, "$1 graden Celsius");
        s = DEG_F.Replace(s, "$1 graden Fahrenheit");
        s = DEG_COMPASS.Replace(s, m => $"{m.Groups[1].Value} graden {COMPASS[m.Groups[2].Value]}");
        s = DEG.Replace(s, "$1 graden");

        s = PLUS.Replace(s, " plus ");

        s = PLUS_MINUS.Replace(s, " plus min ");

        s = EQUALS.Replace(s, " is gelijk aan ");
        s = LESS_THAN.Replace(s, " kleiner dan ");
        s = GREATER_THAN.Replace(s, " groter dan ");
        s = DIVIDE.Replace(s, " gedeeld door ");

        s = AMP_LETTERS.Replace(s, m =>
        {
            string? x = SpellCaps(m.Groups[1].Value), y = SpellCaps(m.Groups[2].Value);
            return x is not null && y is not null ? $"{x} en {y}" : m.Value;
        });
        s = AMP_SPACED.Replace(s, " en ");

        s = FRACTION.Replace(s, m =>
        {
            double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
            if (den == 2) return num == 1 ? "een half" : $"{Numbers.NumberToWords(num)} halve";
            var ord = OrdinalWord(den);
            return ord is null ? m.Value : $"{Numbers.NumberToWords(num)} {ord}";
        });

        return s;
    }
}
