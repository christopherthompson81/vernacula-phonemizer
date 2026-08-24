/**
 * Hungarian cardinal number → words. Hungarian writes a number as ONE concatenated word (kétszázharmincnégy);
 * the tens 20 use the bound form "huszon-" (huszonegy) and "tíz" the "tizen-" teens; "2" is "két" before a scale
 * (kétszáz, kétezer) but "kettő" standalone/final. Covers 0 … <10⁹ (a space precedes millió/ezer groups only at
 * the millió boundary). Larger / non-finite → digit-by-digit.
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
     * hyphen-suffix rule concatenates onto the spoken numeral: `2022-es` is *kétezerhuszonkettes* (not
     * *kettőes*), `1943-as` *…negyvenhármas* (not *hármas*'s stem being optional — *háromas* is not a word),
     * `1907-es` *…hetes*, `36-an` *harminchatan* (no change), `1000-es` *ezres*. Only these four morphs
     * alternate; every other cardinal takes the suffix unchanged (négyes, ötös, hatos, tízes, húszas,
     * százas, harmincas …).
     */
    // ⚠ INSERTION-ORDERED, and the order is the TS object's: `Object.entries` yields declaration order and
    // the loop below takes the FIRST match, so a Dictionary (which preserves insertion order here) keeps it.
    private static readonly IReadOnlyDictionary<string, string> VOWEL_SUFFIX_STEM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["kettő"] = "kett", ["három"] = "hárm", ["hét"] = "het", ["ezer"] = "ezr",
    };
    private static readonly JsRe VOWEL_INITIAL = JsRegex.Compile("^[aáeéiíoóöőuúüű]", "u");

    /** Apply the stem shortening above, if `suffix` is vowel-initial and `word` ends in an alternating morph. */
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
        // The multiplier before a scale word: 1→"egy", else the composed group in its ATTRIBUTIVE form —
        // *kettő* becomes *két* before a noun, and that holds for a compound multiplier too: 22 000 is
        // huszon**két**ezer, not *huszonkettőezer*, and 22 million huszonkét millió. Only `c === 2` was
        // handled before, so every multiplier ENDING in 2 read the free-standing form.
        static string Mult(double c) => c == 1 ? "egy" : Attributive(Below1000(c));
        if (mrd != 0) parts.Add($"{Mult(mrd)} {N.Milliard}");
        if (mil != 0) parts.Add($"{Mult(mil)} {N.Million}");
        // thousands + remainder concatenate into one word (kétezer-…); "2" before ezer → "két".
        var word = "";
        if (thg != 0) word += thg == 1 ? N.Thousand : $"{Attributive(Below1000(thg))}{N.Thousand}";
        if (r != 0) word += Below1000(r);
        if (word.Length > 0) parts.Add(word);
        return string.Join(" ", parts);
    }

    /**
     * The ORDINAL form of each morph that can END a Hungarian cardinal. Hungarian ordinal formation is
     * entirely regular — the cardinal plus `-dik` with a linking vowel — and it applies to the LAST morph of
     * the compound only: *ezernyolcszáznegyven·nyolcadik*, *kétszáznegyvenhetedik*, *százkilencvenedik*. The
     * stem changes are the ordinary ones the language already shows (húsz → husza-, tíz → tize-, ezer →
     * ezre-, millió → milliomo-), which is why this is a table of morphs and not of numbers.
     *
     * `egy`/`kettő` map to their COMBINING forms here (*huszonegyedik*, *tizenkettedik*); standalone 1 and 2
     * are the suppletive *első* / *második* and are special-cased in `ordinalWords`.
     */
    private static readonly IReadOnlyDictionary<string, string> ORDINAL_MORPH = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["nulla"] = "nulladik", ["egy"] = "egyedik", ["kettő"] = "kettedik", ["három"] = "harmadik", ["négy"] = "negyedik",
        ["öt"] = "ötödik", ["hat"] = "hatodik", ["hét"] = "hetedik", ["nyolc"] = "nyolcadik", ["kilenc"] = "kilencedik",
        ["tíz"] = "tizedik", ["húsz"] = "huszadik", ["harminc"] = "harmincadik", ["negyven"] = "negyvenedik",
        ["ötven"] = "ötvenedik", ["hatvan"] = "hatvanadik", ["hetven"] = "hetvenedik", ["nyolcvan"] = "nyolcvanadik",
        ["kilencven"] = "kilencvenedik", ["száz"] = "századik", ["ezer"] = "ezredik", ["millió"] = "milliomodik",
        ["milliárd"] = "milliárdodik",
    };
    // LONGEST FIRST: `kilencven` must beat nothing, but `negyven` must not be shadowed by `négy` — matching
    // is by suffix, so the longest matching key is the real final morph.
    private static readonly IReadOnlyList<string> ORDINAL_KEYS =
        ORDINAL_MORPH.Keys.OrderByDescending(k => k.Length).ToList();

    /**
     * MULTIPLICATIVE (-szor / -szer / -ször), which is how Hungarian reads a dimension `×` — `6 × 6 cm` is
     * *hatszor hat centiméter*. Sourced from the corpus's own audio: facebook/wav2vec2-xlsr-53-espeak-cv-ft
     * over hu_hu/train gives `h ɔ t s oː r  h ɔ t  ts ɛ n t i m eː ɾ t ə` and
     * `ɔ n y t v ɛ n  h ɔ t s oː r  y t v ɛ n h ɔ t  m i l i m eː t ə r` — hatszor hat, ötvenhatszor ötvenhat.
     *
     * A TABLE, NOT A HARMONY RULE, and that is the point. The allomorph looks like ordinary back/front harmony on
     * the last vowel — hat→hatszor (back), öt→ötször (front rounded), tíz→tízszer (front unrounded) — but
     * `harminc` breaks it: its only vowel that matters is a front `i`, and the form is *harmincszor*, back. It is
     * one of Hungarian's anti-harmonic stems. The numerals are a closed set, so an exact table cannot be wrong
     * where a derived rule would be, exactly as ORDINAL_MORPH above is a table for the same reason.
     * `kettő` is suppletive here too: *kétszer*, not *kettőszor*.
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
    // LONGEST FIRST, for the reason ORDINAL_KEYS gives: `negyven` must not be shadowed by `négy`.
    private static readonly IReadOnlyList<string> MULTIPLICATIVE_KEYS =
        MULTIPLICATIVE_MORPH.Keys.OrderByDescending(k => k.Length).ToList();

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");

    /**
     * Non-negative integer → the Hungarian MULTIPLICATIVE word (hatszor, ötvenhatszor), or `undefined` where the
     * cardinal could not be composed. The suffix fuses onto the LAST morph of the compound, which is why
     * `ötvenhat` yields *ötvenhatszor* — the same last-morph replacement `ordinalWords` performs.
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
     * be composed (≥10¹², where `numberToWords` falls back to digit-by-digit). 1 and 2 standing alone are
     * the suppletive *első* / *második*; everything else is the cardinal with its final morph replaced.
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
