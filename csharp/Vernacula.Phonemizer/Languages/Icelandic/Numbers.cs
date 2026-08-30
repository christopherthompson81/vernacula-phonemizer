/**
 * Icelandic cardinal number → words — bespoke rather than the shared composer, for two reasons neither
 * the shared composer nor the units-first Germanic one can express: the "og" conjunction (tens-first,
 * bound to a SINGLE-word remainder — eitt hundrað og einn, eitt þúsund og einn — but not a second time
 * before a tens+unit pair), and GENDER CONCORD on 1–4, where each magnitude noun imposes its own gender
 * on its multiplier (hundrað and þúsund are NEUTER, milljón FEMININE, milljarður MASCULINE). A bare
 * numeral takes the MASCULINE citation series. Covers 0 … <10¹².
 * Ported from src/languages/icelandic/numbers.ts — see that file for the sourcing and the citation-form
 * judgment call.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Icelandic;

public static class Numbers
{
    private static IsNumbers N => Manifest.MANIFEST.Numbers;

    /** The three gender series for 1–4; 5+ is invariant, so each falls back to the masculine `ones`. */
    private static string One(int k, string g)
    {
        if (g == "f")
        {
            var v = k < N.OnesFeminine.Count ? N.OnesFeminine[k] : null;
            return v ?? N.Ones[k];
        }
        if (g == "n")
        {
            var v = k < N.OnesNeuter.Count ? N.OnesNeuter[k] : null;
            return v ?? N.Ones[k];
        }
        return N.Ones[k];
    }

    /** True when `Below100(n)` is a SINGLE word — i.e. it does not already carry its own "og". Such a
     *  remainder takes an "og" from the magnitude above it (hundrað OG ellefu, þúsund OG tuttugu); a
     *  tens+unit pair does not. */
    private static bool SingleWord(double n) => n < 20 || n % 10 == 0;

    /** 1 ≤ n < 100 (tens-first, "og" before the unit: tuttugu og einn). */
    private static string Below100(double n, string g)
    {
        if (n < 20) return One((int)n, g);
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        return u == 0 ? N.Tens[t] : $"{N.Tens[t]} {N.Connector} {One(u, g)}";
    }

    /** 1 ≤ n < 1000. The hundreds multiplier is NEUTER (tvö hundruð) regardless of the gender flowing
     *  through. */
    private static string Below1000(double n, string g)
    {
        if (n < 100) return Below100(n, g);
        var h = (int)Math.Floor(n / 100);
        var r = (int)(n % 100);
        var hundred = h == 1 ? N.Hundred.One : $"{One(h, "n")} {N.Hundred.Plural}";
        if (r == 0) return hundred;
        return $"{hundred} {(SingleWord(r) ? N.Connector + " " : "")}{Below100(r, g)}";
    }

    /** Non-negative integer (< 10¹²) → Icelandic words; larger / non-finite → digit-by-digit. `raw` is
     *  the TOKEN TEXT and must be threaded (#1059) — above 2^53 the double has already rounded. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
        {
            // ⚠ CODE POINTS, NOT CHARS. The TS spreads the string (`[...raw]`), which yields whole code
            // points; iterating a C# string yields UTF-16 CODE UNITS, so an astral character would come
            // back as two lone surrogates with a space between them — malformed UTF-16 in the phoneme
            // stream. Unreachable from `text()` (the token is `\d+`), but `NumberToWords` is public and
            // the TS answers it.
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d => Vernacula.Phonemizer.Core.Numbers.DigitWord(N.Ones, d) ?? d));
        }
        if (n == 0) return N.Ones[0]; // núll
        var parts = new List<string>();
        var bil = Math.Floor(n / 1e9);
        var mil = Math.Floor((n % 1e9) / 1e6);
        var th = Math.Floor((n % 1e6) / 1000);
        var r = n % 1000;
        // Each magnitude noun imposes its own gender on its multiplier: milljarður m, milljón f, þúsund/hundrað n.
        if (bil > 0) parts.Add(bil == 1 ? N.Billion.One : $"{Below1000(bil, "m")} {N.Billion.Plural}");
        if (mil > 0) parts.Add(mil == 1 ? N.Million.One : $"{Below1000(mil, "f")} {N.Million.Plural}");
        if (th > 0) parts.Add(th == 1 ? N.Thousand.One : $"{Below1000(th, "n")} {N.Thousand.Word}");
        if (r > 0)
        {
            // A trailing single-word remainder is bound to the magnitude above it with "og"
            // (eitt þúsund og einn). BARE — the masculine citation form — for the tail itself.
            var tail = Below1000(r, "m");
            parts.Add(parts.Count > 0 && SingleWord(r) ? $"{N.Connector} {tail}" : tail);
        }
        return string.Join(" ", parts);
    }
}
