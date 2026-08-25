/**
 * Hungarian cardinal number → words.
 * Ported from src/languages/hungarian/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hungarian;

public static class Numbers
{
    private static HungarianNumbersDef N => Manifest.MANIFEST.Numbers;

    /** 1 ≤ n < 100 (one word: huszonegy, harmincnégy). */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n < 20) return N.Teens[(int)n - 10];
        double t = Math.Floor(n / 10), u = n % 10;
        if (t == 2) return u == 0 ? N.Tens[2] : $"{N.TensPrefix["20"]}{N.Units[(int)u]}";
        return u == 0 ? N.Tens[(int)t] : $"{N.Tens[(int)t]}{N.Units[(int)u]}";
    }

    /** ATTRIBUTIVE form: *kettő* → *két* before a noun or a scale word (két·száz, huszonkét·ezer, huszonkét
     *  millió). Hungarian's one cardinal with a distinct attributive form. */
    private static string Attributive(string w) =>
        w.EndsWith("kettő", StringComparison.Ordinal) ? $"{w[..^5]}két" : w;

    /**
     * STEM SHORTENING before a VOWEL-INITIAL suffix — the ordinary Hungarian alternations, needed because the
     * hyphen-suffix rule concatenates onto the spoken numeral (`2022-es` → *kétezerhuszonkettes*). Only these
     * four morphs alternate; every other cardinal takes the suffix unchanged.
     */
    // ⚠ INSERTION-ORDERED, and the order is the TS object's: `Object.entries` yields declaration order and
    // the loop below takes the FIRST match, so a Dictionary (which preserves insertion order here) keeps it.
    private static readonly IReadOnlyDictionary<string, string> VOWEL_SUFFIX_STEM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["kettő"] = "kett", ["három"] = "hárm", ["hét"] = "het", ["ezer"] = "ezr",
    };
    private static readonly JsRe VOWEL_INITIAL = JsRegex.Compile("^[aáeéiíoóöőuúüű]", "u");

    /**
     * Apply the stem shortening above, if `suffix` is vowel-initial and `word` ends in an alternating morph.
     */
    public static string StemForSuffix(string word, string suffix)
    {
        if (!VOWEL_INITIAL.IsMatch(suffix)) return word;
        foreach (var (morph, stem) in VOWEL_SUFFIX_STEM)
            if (word.EndsWith(morph, StringComparison.Ordinal)) return word[..(word.Length - morph.Length)] + stem;
        return word;
    }

    /** 1 ≤ n < 1000 (kétszázharmincnégy). "2" before száz → "két". */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundred = h == 1 ? N.Hundred : $"{(h == 2 ? "két" : N.Units[(int)h])}{N.Hundred}";
        return r != 0 ? $"{hundred}{Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10¹²) → Hungarian words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.CodePoints(Js.NumberToString(Math.Abs(n)))
                .Select(d =>
                {
                    var i = Js.Number(d);
                    return double.IsInteger(i) && i >= 0 && i < N.Units.Length ? N.Units[(int)i] : d;
                }));
        if (n == 0) return N.Units[0]; // nulla
        var parts = new List<string>();
        double mrd = Math.Floor(n / 1e9),
            mil = Math.Floor(n % 1e9 / 1e6),
            thg = Math.Floor(n % 1e6 / 1000),
            r = n % 1000;
        static string Mult(double c) => c == 1 ? "egy" : Attributive(Below1000(c));
        if (mrd != 0) parts.Add($"{Mult(mrd)} {N.Milliard}");
        if (mil != 0) parts.Add($"{Mult(mil)} {N.Million}");
        var word = "";
        if (thg != 0) word += thg == 1 ? N.Thousand : $"{Attributive(Below1000(thg))}{N.Thousand}";
        if (r != 0) word += Below1000(r);
        if (word.Length > 0) parts.Add(word);
        return string.Join(" ", parts);
    }

    /** The ordinal form of each morph that can END a cardinal — from the manifest. See the jsonc. */
    private static IReadOnlyDictionary<string, string> ORDINAL_MORPH => Manifest.MANIFEST.OrdinalMorphs;

    // LONGEST FIRST: matching is by suffix, so `negyven` must not be shadowed by `négy`.
    private static readonly IReadOnlyList<string> ORDINAL_KEYS =
        ORDINAL_MORPH.Keys.OrderByDescending(k => k.Length).ToList();

    /**
     * MULTIPLICATIVE (-szor / -szer / -ször), which is how Hungarian reads a dimension `×` — `6 × 6 cm` is
     * *hatszor hat centiméter*.
     */
    private static readonly IReadOnlyDictionary<string, string> MULTIPLICATIVE_MORPH = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["nulla"] = "nullaszor", ["egy"] = "egyszer", ["kettő"] = "kétszer", ["három"] = "háromszor", ["négy"] = "négyszer",
        ["öt"] = "ötször", ["hat"] = "hatszor", ["hét"] = "hétszer", ["nyolc"] = "nyolcszor", ["kilenc"] = "kilencszer",
        ["tíz"] = "tízszer", ["húsz"] = "húszszor", ["harminc"] = "harmincszor", ["negyven"] = "negyvenszer",
        ["ötven"] = "ötvenszer", ["hatvan"] = "hatvanszor", ["hetven"] = "hetvenszer", ["nyolcvan"] = "nyolcvanszor",
        ["kilencven"] = "kilencvenszer", ["száz"] = "százszor", ["ezer"] = "ezerszer", ["millió"] = "milliószor",
        ["milliárd"] = "milliárdszor",
    };
    // LONGEST FIRST, for the reason ORDINAL_KEYS gives.
    private static readonly IReadOnlyList<string> MULTIPLICATIVE_KEYS =
        MULTIPLICATIVE_MORPH.Keys.OrderByDescending(k => k.Length).ToList();

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");

    /**
     * Non-negative integer → the Hungarian MULTIPLICATIVE word (hatszor, ötvenhatszor), or `undefined` where
     * the cardinal could not be composed.
     */
    public static string? MultiplicativeWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0) return null;
        var card = NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        var parts = card.Split(' ').ToList();
        var last = parts[^1];
        var key = MULTIPLICATIVE_KEYS.FirstOrDefault(k => last.EndsWith(k, StringComparison.Ordinal));
        if (key is null) return null;
        parts[^1] = last[..(last.Length - key.Length)] + MULTIPLICATIVE_MORPH[key];
        return string.Join(" ", parts);
    }

    /**
     * Non-negative integer → the Hungarian ORDINAL word, or `undefined` where the cardinal itself could not
     * be composed (≥10¹², where `numberToWords` falls back to digit-by-digit).
     */
    public static string? OrdinalWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0) return null;
        if (n == 1) return "első";
        if (n == 2) return "második";
        var card = NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        var parts = card.Split(' ').ToList();
        var last = parts[^1];
        var key = ORDINAL_KEYS.FirstOrDefault(k => last.EndsWith(k, StringComparison.Ordinal));
        if (key is null) return null;
        parts[^1] = last[..(last.Length - key.Length)] + ORDINAL_MORPH[key];
        return string.Join(" ", parts);
    }
}
