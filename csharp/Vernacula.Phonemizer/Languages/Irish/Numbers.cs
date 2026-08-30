/**
 * Irish number → words. A real compositor for 0–999,999,999. Ported from src/languages/irish/numbers.ts —
 * see that file for the evidence behind each of the five rules below.
 *
 * Irish is not a plain units/tens/hundreds language, so this cannot use `WesternNumberWords`:
 *
 *  1. **Two numeral series.** The COUNTING form (standalone, and after the particle `a`) differs from the
 *     ATTRIBUTIVE form used before a counted noun — ceathair vs ceithre, dó vs dhá. Magnitude words are counted
 *     attributively: 200 is `dhá chéad`, never *a dó chéad.
 *  2. **The particle `a`** introduces a bare counting numeral: `a haon`, `fiche a cúig`, `céad a hocht`.
 *  3. **Initial mutation after a numeral.** 2–6 LENITE the following magnitude (dhá chéad, sé chéad), 7–10
 *     ECLIPSE it (seacht gcéad, naoi gcéad). `míle` is m-initial and has no eclipsed form, so 7–10 leave it bare.
 *  4. **h-prefix** on the vowel-initial counting forms after `a`: aon → `a haon`, ocht → `a hocht`.
 *  5. **déag lenites after dó** only: a haon déag, `a dó dhéag`, a trí déag.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Irish;

public static class Numbers
{
    private static IrishNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;   // counting series: náid, aon, dó, trí, ceathair, …
    private static IReadOnlyList<string> ATTR => N.Attributive; // attributive: —, aon, dhá, trí, ceithre, …

    /** JS `Number.isSafeInteger` — the fleet spells this out per language. */
    internal static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static readonly JsRe LENITABLE = JsRegex.Compile("^[bcdfgmpt]", "i");
    private static readonly JsRe VOWEL_INITIAL = JsRegex.Compile("^[aeiouáéíóú]", "i");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("\\s+", "g");

    /** Lenition: insert `h` after the initial consonant (céad → chéad, míle → mhíle). */
    public static string Lenite(string w) =>
        LENITABLE.IsMatch(w) ? w[0] + "h" + w[1..] : w;

    /** Eclipsis: prefix the voiced/nasal counterpart (céad → gcéad). `m` has no eclipsed form. */
    private static readonly IReadOnlyDictionary<string, string> ECLIPSE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["c"] = "g", ["p"] = "b", ["t"] = "d", ["b"] = "m", ["d"] = "n", ["g"] = "n", ["f"] = "bhf",
    };

    private static string Eclipse(string w) =>
        ECLIPSE.TryGetValue(Js.ToLowerCase(w[0].ToString()), out var e) ? e + w : w;

    /** Mutate a magnitude word after the numeral `k`: 2–6 lenite, 7–10 eclipse, 1 (bare magnitude) unchanged. */
    private static string AfterNumeral(double k, string word)
    {
        if (k >= 2 && k <= 6) return Lenite(word);
        if (k >= 7 && k <= 10) return Eclipse(word);
        return word;
    }

    /** The counting form with its `a` particle and h-prefix (aon → "a haon", ocht → "a hocht"). */
    private static string Counting(double u)
    {
        var w = ONES[(int)u];
        return "a " + (VOWEL_INITIAL.IsMatch(w) ? "h" + w : w);
    }

    /** 1–99 in the counting series. */
    private static string UnderHundred(double n)
    {
        if (n <= 10) return Counting(n);
        if (n < 20)
        {
            var u = n - 10;
            // déag lenites after dó ONLY (a dó dhéag); every other teen keeps it bare.
            return $"{Counting(u)} {(u == 2 ? Lenite(N.TeenWord) : N.TeenWord)}";
        }
        var t = Math.Floor(n / 10) * 10;
        var un = n % 10;
        return N.Tens[Js.NumberToString(t)] + (un != 0 ? $" {Counting(un)}" : "");
    }

    /** A magnitude group: `count` × `word` (e.g. 9 × céad → "naoi gcéad"; 1 × míle → bare "míle"). */
    private static string Magnitude(double count, string word)
    {
        if (count == 1) return word; // bare magnitude: céad, míle — no "aon"
        if (count <= 10) return $"{ATTR[(int)count]} {AfterNumeral(count, word)}";
        // A count above ten is itself composed — via `Compose`, not `UnderHundred`, so a three-digit count works
        // (999,999 needs "naoi gcéad nócha a naoi míle"; UnderHundred alone reached a tens key that is absent).
        // The magnitude then stays unmutated: mutation is triggered by a simple numeral, not by a phrase.
        return $"{Compose(count)} {word}";
    }

    private static string Compose(double n)
    {
        if (n < 100) return UnderHundred(n);
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            return Magnitude(h, N.Magnitudes.Hundred) + (r != 0 ? $" {Compose(r)}" : "");
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            return Magnitude(th, N.Magnitudes.Thousand) + (r != 0 ? $" {Compose(r)}" : "");
        }
        if (n < 1_000_000_000)
        {
            double m = Math.Floor(n / 1_000_000), r = n % 1_000_000;
            return Magnitude(m, N.Magnitudes.Million) + (r != 0 ? $" {Compose(r)}" : "");
        }
        double b = Math.Floor(n / 1_000_000_000), rb = n % 1_000_000_000;
        return Magnitude(b, N.Magnitudes.Billion) + (rb != 0 ? $" {Compose(rb)}" : "");
    }

    /** Non-negative integer → Irish words. Out-of-range/non-integer input falls back to digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        // Out of range → digit-by-digit over the DIGITS only; a stray "-" or "." must not reach the g2p as a
        // word. (Unreachable from the text path — the tokenizer matches \d+ — but this is a public entry point.)
        if (!IsSafeInteger(n) || n < 0)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(n))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => ONES[d[0] - '0']));
        if (n == 0) return ONES[0]; // náid — a bare zero takes no "a" particle
        return Js.Trim(SPACE_RUN.Replace(Compose(n), " "));
    }
}
