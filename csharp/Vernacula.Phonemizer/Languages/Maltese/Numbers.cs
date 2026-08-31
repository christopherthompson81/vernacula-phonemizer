/**
 * Maltese (mt) cardinal number → words. **SYSTEM: NATIVE Semitic (Siculo-Arabic) throughout** — the whole
 * 0–999 999 999 range is native Maltese; the only loans are `miljun`/`biljun`, which are the ordinary words
 * for those magnitudes with no rival Semitic form.
 *
 * ⚠ THE ONE REAL JUDGMENT CALL — **counting form, not attributive form.** Maltese has two numeral series:
 * the ABSOLUTE/COUNTING form (`tnejn` 2, `tlieta` 3) used when counting aloud or citing a bare figure, and
 * the ATTRIBUTIVE/construct form (`żewġ` 2, `tliet` 3) used immediately before a counted noun. A digit in
 * running text has no noun attached in the token stream, so this emits the ABSOLUTE series. The attributive
 * series is still carried, because it is obligatory as the MULTIPLIER of a magnitude — 200 is `mitejn`,
 * 300 is `tliet mija`, never *tlieta mija.
 *
 * Three things make Maltese not a Western decimal, and the full sourcing for each (the GF Resource Grammar
 * `NumeralMlt.gf`, Wiktionary's absolute/attributive/-t series, and the attested composed forms) is in the
 * TypeScript original, src/languages/maltese/numbers.ts:
 *   1. **Units-first inside 21–99** with the connector `u`: 45 = `ħamsa u erbgħin`.
 *   2. **DUAL forms** for exactly 2× a magnitude: 200 `mitejn`, 2000 `elfejn`. `miljun` has no dual.
 *   3. **`u` marks only the FINAL constituent**; the higher ones simply juxtapose — which is why this is a
 *      constituent-list composer rather than a per-magnitude recursion.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Maltese;

/** One magnitude's singular / plural / (optional) dual, plus which attributive series its multiplier takes. */
internal sealed class Magnitude
{
    public required string Sg { get; init; }
    public required string Pl { get; init; }
    public string? Dual { get; init; }
    /** true → the multiplier uses the LONG -t attributive series (elf is monosyllabic: tlitt elef). */
    public required bool LongAttributive { get; init; }
}

public static class Numbers
{
    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** 1 ≤ n < 100, ABSOLUTE series. Units-first with `u` inside 21–99 (ħamsa u erbgħin). */
    private static string Below100(double n, MalteseNumbers N)
    {
        if (n < 10) return N.Units[(int)n];
        if (n == 10) return N.Ten;
        if (n < 20) return N.Teens[(int)n - 11];
        var t = Math.Floor(n / 10) * 10;
        var u = n % 10;
        var ten = N.Tens[Js.NumberToString(t)];
        return u == 0 ? ten : $"{N.Units[(int)u]} {N.Connector} {ten}";
    }

    /** The round-hundred constituent: 100 mija, 200 mitejn (dual), 300 tliet mija. */
    private static string HundredPhrase(double h, MalteseNumbers N)
    {
        if (h == 1) return N.Magnitudes.Hundred;
        if (h == 2) return N.Magnitudes.HundredDual;
        return $"{N.AttributiveShort[(int)h]} {N.Magnitudes.Hundred}";
    }

    /**
     * A magnitude COUNT — the multiplier phrase plus the correctly-inflected magnitude word: `elf`,
     * `elfejn`, `tlitt elef`, `tnax-il elf`, `wieħed u għoxrin elf`, `mitt elf`, `tliet mija u ħdax-il elf`.
     */
    private static string MagnitudePhrase(double count, Magnitude m, MalteseNumbers N)
    {
        if (count == 1) return m.Sg;                                          // elf / miljun — no leading wieħed
        if (count == 2) return m.Dual ?? $"{N.AttributiveShort[2]} {m.Pl}";    // elfejn | żewġ miljuni
        if (count <= 10)
        {
            // 3–10: the magnitude goes PLURAL and the multiplier takes the attributive series.
            var attr = m.LongAttributive ? N.AttributiveLong[(int)count] : N.AttributiveShort[(int)count];
            return $"{attr} {m.Pl}";
        }
        if (count < 20) return $"{N.Teens[(int)count - 11]}{N.TeenLinker} {m.Sg}"; // singular again from 11 up
        if (count < 100) return $"{Below100(count, N)} {m.Sg}";                    // wieħed u għoxrin elf
        var h = Math.Floor(count / 100);
        var r = count % 100;
        // A round hundred of magnitudes takes the CONSTRUCT mitt before the monosyllable: mitt elf.
        if (r == 0)
        {
            var head = h == 1 ? N.Magnitudes.HundredConstruct
                : h == 2 ? N.Magnitudes.HundredDual
                : $"{N.AttributiveShort[(int)h]} {N.Magnitudes.HundredConstruct}";
            return $"{head} {m.Sg}";
        }
        // …and the free mija when a remainder follows: tliet mija u ħdax-il elf.
        var tail = r > 10 && r < 20 ? $"{N.Teens[(int)r - 11]}{N.TeenLinker}" : Below100(r, N);
        return $"{HundredPhrase(h, N)} {N.Connector} {tail} {m.Sg}";
    }

    /**
     * Read a digit string one digit at a time (the ≥10¹² / unsafe-integer fallback).
     * ⚠ CODE POINTS — the TS spells this `[...digits]`.
     */
    public static string ReadDigits(string digits, MalteseNumbers N) =>
        string.Join(" ", Js.CodePoints(digits).Select(d => Core.Numbers.DigitWord(N.Units, d) ?? d));

    /**
     * Non-negative integer → Maltese cardinal words. Builds the numeral as a list of CONSTITUENTS and joins
     * them with the connector `u` before the LAST one only — the attested pattern (`elf erba' mija u
     * għoxrin`). ≥10¹² or non-safe → digit-by-digit.
     */
    public static string NumberToWords(double n, MalteseNumbers N)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e12) return ReadDigits(Js.NumberToString(n), N);
        if (n == 0) return N.Units[0]; // żero
        var M = N.Magnitudes;
        var billion = new Magnitude { Sg = M.Billion, Pl = M.BillionPlural, LongAttributive = false };
        var million = new Magnitude { Sg = M.Million, Pl = M.MillionPlural, LongAttributive = false };
        var thousand = new Magnitude
            { Sg = M.Thousand, Pl = M.ThousandPlural, Dual = M.ThousandDual, LongAttributive = true };

        var parts = new List<string>();
        var rest = n;
        foreach (var (scale, mag) in new (double, Magnitude)[] { (1e9, billion), (1e6, million), (1e3, thousand) })
        {
            var c = Math.Floor(rest / scale);
            if (c > 0)
            {
                parts.Add(MagnitudePhrase(c, mag, N));
                rest -= c * scale;
            }
        }
        if (rest >= 100)
        {
            parts.Add(HundredPhrase(Math.Floor(rest / 100), N));
            rest %= 100;
        }
        if (rest > 0) parts.Add(Below100(rest, N));
        // `u` attaches to the FINAL constituent only; the rest simply juxtapose.
        if (parts.Count == 1) return parts[0];
        return $"{string.Join(" ", parts.Take(parts.Count - 1))} {N.Connector} {parts[^1]}";
    }
}
