/**
 * Latgalian cardinal numbers — the East-Baltic counted-noun concord, with the FEMININE ⟨tyukstūša⟩.
 * Ported from src/languages/latgalian/numbers.ts, where the sourcing for every form lives.
 *
 * ⚠ GENDER IS THE THING THIS TABLE EXISTS FOR. Unlike Latvian, whose *tūkstotis* is masculine, Latgalian
 * *tyukstūša* is FEMININE (4th declension), so the thousands multiplier takes the feminine unit forms
 * (*sešys tyukstūšys*) while symts / miļjons / miļjards, being masculine, take the masculine ones.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latgalian;

public static class Numbers
{
    /** Masculine unit series (index 0 = zero). Used everywhere except a thousands multiplier. */
    private static readonly string[] UNITS =
        ["nulle", "vīns", "divi", "treis", "četri", "pīci", "seši", "septeni", "ostoni", "deveni"];
    /** ⚠ FEMININE unit series — the multiplier of the feminine noun "tyukstūša". */
    private static readonly string[] UNITS_F =
        ["nulle", "vīna", "divi", "treis", "četrys", "pīcys", "sešys", "septenis", "ostonis", "devenis"];
    /** 10–19: the -padsmit teens (one word), gender-invariant. */
    private static readonly string[] TEENS =
    [
        "desmit", "vīnpadsmit", "divpadsmit", "treispadsmit", "četrupadsmit",
        "pīcpadsmit", "sešpadsmit", "septeņpadsmit", "ostoņpadsmit", "deveņpadsmit",
    ];
    /** Round tens, indexed by the tens digit (0/1 unused — 10–19 are the teens); gender-invariant. */
    private static readonly string[] TENS =
    [
        "", "", "divdesmit", "treisdesmit", "četrudesmit",
        "pīcdesmit", "sešdesmit", "septeņdesmit", "ostoņdesmit", "deveņdesmit",
    ];

    /** A counted magnitude noun: `One` after a count ending in …1 (but not …11), `Many` otherwise. */
    private readonly record struct Forms(string One, string Many);

    private static readonly Forms HUNDRED = new("symts", "symti");           // masculine, 1st declension
    private static readonly Forms THOUSAND = new("tyukstūša", "tyukstūšys"); // ⚠ FEMININE, 4th declension
    private static readonly Forms MILLION = new("miļjons", "miļjoni");       // masculine
    private static readonly Forms MILLIARD = new("miļjards", "miļjardi");    // masculine

    /** The East-Baltic count form (as Latvian): SINGULAR after a count ending in …1 except …11. */
    private static string Agree(double count, Forms forms) =>
        count % 10 == 1 && count % 100 != 11 ? forms.One : forms.Many;

    /** 0–99. `fem` switches ONLY the final unit word (tens and teens do not inflect for gender). */
    private static string Sub100(double n, bool fem)
    {
        var u = fem ? UNITS_F : UNITS;
        if (n < 10) return u[(int)n];
        if (n < 20) return TEENS[(int)n - 10];
        int t = (int)Math.Floor(n / 10), r = (int)(n % 10);
        return r == 0 ? TENS[t] : $"{TENS[t]} {u[r]}";
    }

    /** 0–999. The hundred is a MASCULINE counted noun, so its own multiplier stays masculine even inside a
     *  feminine thousands group (divi symti tyukstūšys). */
    private static string Sub1000(double n, bool fem)
    {
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        if (h == 0) return Sub100(n, fem);
        var hw = h == 1 ? HUNDRED.One : $"{UNITS[h]} {HUNDRED.Many}";
        return r != 0 ? $"{hw} {Sub100(r, fem)}" : hw;
    }

    /** One magnitude group. `keepOne` = whether a count of exactly 1 keeps the numeral: 1000 reads as the
     *  bare noun "tyukstūša", while 1 000 000 keeps it — "vīns miļjons". */
    private static string Magnitude(double count, Forms forms, bool fem, bool keepOne)
    {
        if (count == 1) return keepOne ? $"{(fem ? UNITS_F : UNITS)[1]} {forms.One}" : forms.One;
        return $"{Sub1000(count, fem)} {Agree(count, forms)}";
    }

    /**
     * Read a raw digit STRING digit-by-digit — the fallback beyond the miļjards group (n ≥ 10¹²).
     * ⚠ CODE UNITS, NOT CODE POINTS, AND THAT IS THE FAITHFUL READING: the TS spells this `digits.split("")`,
     * and `String.prototype.split("")` splits by UTF-16 CODE UNIT. Spreading with `[...]` — which is what
     * #1193 corrected six languages TO — would be a divergence here, exactly as it would be for afrikaans
     * and georgian. Iterating a C# string is the same thing the TS does.
     */
    public static string ReadDigits(string digits) =>
        string.Join(" ", digits.Select(d => Core.Numbers.DigitWord(UNITS, d.ToString()) ?? d.ToString()));

    /** A non-negative integer (< 10¹²) → space-separated Latgalian cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || double.IsNaN(n) || double.IsInfinity(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return UNITS[0]; // nulle
        if (n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        var parts = new List<string>();
        var bil = Math.Floor(n / 1e9);
        n %= 1e9;
        if (bil != 0) parts.Add(Magnitude(bil, MILLIARD, false, true));
        var mil = Math.Floor(n / 1e6);
        n %= 1e6;
        if (mil != 0) parts.Add(Magnitude(mil, MILLION, false, true));
        var th = Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(Magnitude(th, THOUSAND, true, false)); // ⚠ feminine; 1000 → bare tyukstūša
        if (n != 0) parts.Add(Sub1000(n, false));
        return string.Join(" ", parts);
    }
}
