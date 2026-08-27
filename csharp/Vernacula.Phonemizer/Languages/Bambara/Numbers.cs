/**
 * Bambara / Bamanankan cardinal number → words. DECIMAL, with two lexicalised irregularities that rule out
 * the shared western composer: 10 tan and 20 mugan are unrelated to the bi- tens series, and every magnitude
 * word takes a FOLLOWING multiplier (kɛmɛ fila = 100×2) while 100 itself is the bare kɛmɛ.
 *
 * Ported from src/languages/bambara/numbers.ts, whose header carries the six sources, the six places they
 * split and how each was decided (segin/seegin, bisegin, bikɔnɔntɔn, ba-not-waga, miliyɔn, biwolonwula), and
 * the evidence that Bambara is neither quinary nor vigesimal. Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bambara;

public static class Numbers
{
    private static readonly string[] ONES =
        ["fu", "kelen", "fila", "saba", "naani", "duuru", "wɔɔrɔ", "wolonwula", "segin", "kɔnɔntɔn"];

    /** Round tens. 10/20 are lexical; 30–90 are the solid bi- + unit derivations. */
    private static readonly Dictionary<int, string> TENS = new()
    {
        [1] = "tan", [2] = "mugan", [3] = "bisaba", [4] = "binaani", [5] = "biduuru",
        [6] = "biwɔɔrɔ", [7] = "biwolonwula", [8] = "bisegin", [9] = "bikɔnɔntɔn",
    };

    private const string NI = "ni"; // additive coordinator between magnitude slots
    private const string HUNDRED = "kɛmɛ";
    private const string THOUSAND = "ba";
    private const string MILLION = "miliyɔn";
    private const string MILLIARD = "miliyari";

    /** 0–99: lexical tan/mugan + the bi- tens, units added with ni. */
    private static string Below100(int n)
    {
        if (n < 10) return ONES[n];
        var t = n / 10;
        var u = n % 10;
        return u == 0 ? TENS[t] : $"{TENS[t]} {NI} {ONES[u]}";
    }

    /** 1–999: bare kɛmɛ for 100, kɛmɛ + multiplier above it; remainder added with ni. */
    private static string Below1000(int n)
    {
        if (n < 100) return Below100(n);
        var h = n / 100;
        var r = n % 100;
        var head = h == 1 ? HUNDRED : $"{HUNDRED} {ONES[h]}";
        return r == 0 ? head : $"{head} {NI} {Below100(r)}";
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** Non-negative integer → Bambara words; beyond the attested magnitudes (≥ 10¹²) → digit-by-digit.
     *  `raw` is the TOKEN TEXT and must be threaded — above 2^53 the double has already rounded. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e12)
            // No attested Bambara numeral above miliyari — read the digits rather than invent a "trillion".
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => ONES[(int)Js.Number(d)]));
        if (n < 1000) return Below1000((int)n);
        if (n < 1e6)
        {
            var th = (int)Math.Floor(n / 1000);
            var r0 = (int)(n % 1000);
            // ba kelen 1000 — the multiplier is kept, unlike kɛmɛ, and it may be a full 1–999.
            var head0 = $"{THOUSAND} {Below1000(th)}";
            return r0 == 0 ? head0 : $"{head0} {NI} {Below1000(r0)}";
        }
        if (n < 1e9)
        {
            var m = (int)Math.Floor(n / 1e6);
            var r1 = n % 1e6;
            var head1 = $"{MILLION} {Below1000(m)}";
            return r1 == 0 ? head1 : $"{head1} {NI} {NumberToWords(r1)}";
        }
        var g = (int)Math.Floor(n / 1e9);
        var r = n % 1e9;
        var head = $"{MILLIARD} {Below1000(g)}";
        return r == 0 ? head : $"{head} {NI} {NumberToWords(r)}";
    }

    /** N'Ko digits ߀–߉ (U+07C0–07C9) → ASCII, so the number branch serves both registered scripts. */
    public static string FoldNkoDigits(string s) =>
        string.Concat(Js.CodePoints(s).Select(ch =>
        {
            var c = Js.CodePointAt0(ch);
            return c >= 0x07c0 && c <= 0x07c9
                ? Js.NumberToString(c - 0x07c0)
                : ch;
        }));
}
