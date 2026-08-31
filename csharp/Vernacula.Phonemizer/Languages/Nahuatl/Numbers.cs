/**
 * Classical Nahuatl (nci) cardinal number → words. VIGESIMAL (base 20) and genuinely positional — hence
 * Pattern B. TWO DIFFERENT JOINERS: the linker ⟨on-⟩ (assimilating to ⟨om-⟩ before a vowel or ⟨m⟩) inside
 * the sub-400 part, and the relational word ⟨īpan⟩ between groups from 400 up.
 * Ported from src/languages/nahuatl/numbers.ts — see that file for the Wiktionary sourcing and the
 * disclosures (the 20⁷ digit fallback, the non-numeral zero stopgap, the two source-table errors).
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nahuatl;

public static class Numbers
{
    private const string ZERO = "ahtle"; // 'nothing' — a stopgap, not an attested numeral
    // 1..9, then 10 and 15, the two additive bases inside a score.
    private static readonly string[] UNITS =
        { "", "cē", "ōme", "ēyi", "nāhui", "mācuīlli", "chicuacē", "chicōme", "chicuēyi", "chiucnāhui" };
    private const string TEN = "mahtlāctli";
    private const string FIFTEEN = "caxtōlli";

    // The magnitude nouns for 20¹…20⁶. A name starting with ⟨p⟩ takes the LABIAL prefix series (cem-, ōm-, …);
    // the others take the plain series (cen-, ōn-, …) — the same nine numerals, assimilated to the following stop.
    private static readonly string[] MAGNITUDES =
        { "", "pōhualli", "tzontli", "xiquipilli", "pōhualxiquipilli", "tzonxiquipilli", "pōhualtzonxiquipilli" };
    // Multiplier combining forms 1..9, before a ⟨p⟩-initial magnitude: cempōhualli, ōmpōhualli, …
    private static readonly string[] PRE_P =
        { "", "cem", "ōm", "ēx", "nāp", "mācuīl", "chicuacem", "chicōm", "chicuēx", "chiucnāp" };
    // …and before ⟨t⟩/⟨x⟩: centzontli, ōntzontli, … (identically for -xiquipilli).
    private static readonly string[] PRE_T =
        { "", "cen", "ōn", "ē", "nāuh", "mācuīl", "chicuacen", "chicōn", "chicuē", "chiucnāuh" };
    // The 10 and 15 multiplier forms bind directly: mahtlācpōhualli 200, caxtōlpōhualli 300, …
    private const string PRE_10_P = "mahtlāc", PRE_10_T = "mahtlāc", PRE_15_P = "caxtōl", PRE_15_T = "caxtōl";

    /** The additive linker ⟨on-⟩, assimilating to ⟨om-⟩ before a vowel or ⟨m⟩ (omōme, omēyi, ommahtlāctli). */
    private static string Link(string word)
    {
        var first = word.Length > 0 ? word[0] : '\0';
        return (first is 'a' or 'e' or 'i' or 'o' or 'u' or 'ā' or 'ē' or 'ī' or 'ō' or 'ū' or 'm')
            ? "om" + word
            : "on" + word;
    }

    /** Join a word list with the ⟨on-⟩ linker on every word after the first. */
    private static string Chain(List<string> words)
    {
        var sb = new StringBuilder(words[0]);
        for (var k = 1; k < words.Count; k++) sb.Append(' ').Append(Link(words[k]));
        return sb.ToString();
    }

    /** A multiplier 1..19 bound to a magnitude noun (or to nothing, for the units place). */
    private static List<string> MagnitudeWords(double d, string mag)
    {
        if (mag == "")
            return d <= 9 ? new List<string> { UNITS[(int)d] }
                : d == 10 ? new List<string> { TEN }
                : d < 15 ? new List<string> { TEN, UNITS[(int)(d - 10)] }
                : d == 15 ? new List<string> { FIFTEEN }
                : new List<string> { FIFTEEN, UNITS[(int)(d - 15)] };
        var p = mag[0] == 'p' ? PRE_P : PRE_T;
        var p10 = mag[0] == 'p' ? PRE_10_P : PRE_10_T;
        var p15 = mag[0] == 'p' ? PRE_15_P : PRE_15_T;
        if (d <= 9) return new List<string> { p[(int)d] + mag };
        if (d == 10) return new List<string> { p10 + mag };
        if (d < 15) return new List<string> { TEN, p[(int)(d - 10)] + mag }; // 220 = mahtlāctli oncempōhualli
        if (d == 15) return new List<string> { p15 + mag };
        return new List<string> { FIFTEEN, p[(int)(d - 15)] + mag }; // 380 = caxtōlli onnāppōhualli
    }

    /** Non-negative integer → Classical Nahuatl words. ≥ 20⁷ (no further magnitude noun) → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= Math.Pow(20, 7))
        {
            // ⚠ THE RAW TOKEN GOES ALONG, so the digit arm reads the digits the text wrote rather than a
            // double that above 2^53 has already lost its low digits. JS `[...s]` spreads by CODE POINT.
            var sb = new StringBuilder();
            foreach (var c in Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))))
            {
                if (c[0] < '0' || c[0] > '9') continue;
                if (sb.Length > 0) sb.Append(' ');
                sb.Append(c[0] == '0' ? ZERO : UNITS[c[0] - '0']);
            }
            return sb.ToString();
        }
        if (n == 0) return ZERO;
        // The base-20 digits, most significant first. Powers 20⁶…20² each become their own ⟨īpan⟩ group; the
        // 20¹ and 20⁰ places form the single sub-400 chunk that uses the ⟨on-⟩ linker instead.
        var groups = new List<string>();
        var rest = n;
        for (var k = 6; k >= 2; k--)
        {
            var p = Math.Pow(20, k);
            var d = Math.Floor(rest / p);
            if (d > 0) groups.Add(Chain(MagnitudeWords(d, MAGNITUDES[k])));
            rest -= d * p;
        }
        var score = Math.Floor(rest / 20);
        var unit = rest % 20;
        var tail = new List<string>();
        if (score > 0) tail.AddRange(MagnitudeWords(score, MAGNITUDES[1]));
        if (unit > 0) tail.AddRange(MagnitudeWords(unit, ""));
        if (tail.Count > 0) groups.Add(Chain(tail));
        return string.Join(" īpan ", groups);
    }
}
