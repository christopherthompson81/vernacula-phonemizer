/**
 * Scottish Gaelic (gd) number → words. A real compositor for 0–999,999,999. The Goidelic shape mirrors
 * Irish (two numeral series, the ⟨a⟩ particle, h- before a vowel-initial counting form, ⟨deug⟩ lenited
 * after dhà) but Gaelic mutation is LENITION ONLY — no eclipsis: ⟨dà⟩ lenites the magnitude it counts
 * (dà cheud) and 3–10 leave it BARE (naoi ceud, where Irish says naoi gcéad). The MODERN DECIMAL tens
 * are used, not the traditional vigesimal series.
 * Ported from src/languages/scottishgaelic/numbers.ts — see that file for the Colin Mark (2003) sourcing
 * and the decimal-over-vigesimal judgment call.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.ScottishGaelic;

public static class Numbers
{
    private static ScottishGaelicNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> ATTR => N.Attributive;

    /** JS `Number.isSafeInteger` — the fleet spells this out per language. */
    internal static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static readonly JsRe LENITABLE = JsRegex.Compile("^[bcdfgmpst]", "i");
    private static readonly JsRe VOWEL_INITIAL = JsRegex.Compile("^[aeiouàèìòùáéíóú]", "i");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("\\s+", "g");

    /** Gaelic lenition (sèimheachadh): insert ⟨h⟩ after the initial consonant — ceud → cheud, mìle → mhìle. */
    private static string Lenite(string w) =>
        LENITABLE.IsMatch(w) ? w[0] + "h" + w[1..] : w;

    /** The counting form with its ⟨a⟩ particle, h- before a vowel-initial form: aon → "a h-aon",
     *  ochd → "a h-ochd". Gaelic writes the hyphen (Irish writes `a haon`); the g2p strips it. */
    private static string Counting(double u)
    {
        var w = ONES[(int)u];
        return "a " + (VOWEL_INITIAL.IsMatch(w) ? "h-" + w : w);
    }

    /** 1–99 in the counting series. */
    private static string UnderHundred(double n)
    {
        if (n <= 10) return Counting(n);
        if (n < 20)
        {
            var u = n - 10;
            // deug lenites after dhà ONLY (a dhà dheug); every other teen keeps it bare.
            return $"{Counting(u)} {(u == 2 ? Lenite(N.TeenWord) : N.TeenWord)}";
        }
        var t = Math.Floor(n / 10) * 10;
        var un = n % 10;
        return N.Tens[Js.NumberToString(t)] + (un != 0 ? $" {N.Connector} {Counting(un)}" : "");
    }

    /** A magnitude group: `count` × `word` — 2 × ceud → "dà cheud"; 9 × ceud → bare "naoi ceud"
     *  (NO eclipsis). */
    private static string Magnitude(double count, string word)
    {
        if (count == 1) return word; // bare magnitude: ceud, mìle — no "aon"
        if (count <= 10) return $"{ATTR[(int)count]} {(count == 2 ? Lenite(word) : word)}";
        // A count above ten is itself composed (12,345 needs "a dhà dheug mìle"); a PHRASE does not mutate
        // the magnitude — Gaelic mutation is triggered by the simple numeral ⟨dà⟩, not by a numeral phrase.
        return $"{Compose(count)} {word}";
    }

    /** Attach a remainder to a magnitude. The ⟨agus⟩ connector appears whenever the remainder is a BARE
     *  counting numeral (it starts with the ⟨a⟩ particle) — ceud agus a h-aon "101", mìle agus a naoi
     *  "1009" — and is absent when the remainder opens with its own tens/hundreds word. */
    private static string Attach(string head, double r)
    {
        if (r == 0) return head;
        var tail = Compose(r);
        return head + " " + (tail.StartsWith("a ", StringComparison.Ordinal) ? N.Connector + " " : "") + tail;
    }

    private static string Compose(double n)
    {
        if (n < 100) return UnderHundred(n);
        if (n < 1000) return Attach(Magnitude(Math.Floor(n / 100), N.Magnitudes.Hundred), n % 100);
        if (n < 1_000_000) return Attach(Magnitude(Math.Floor(n / 1000), N.Magnitudes.Thousand), n % 1000);
        if (n < 1_000_000_000) return Attach(Magnitude(Math.Floor(n / 1_000_000), N.Magnitudes.Million), n % 1_000_000);
        return Attach(Magnitude(Math.Floor(n / 1_000_000_000), N.Magnitudes.Billion), n % 1_000_000_000);
    }

    /** Non-negative integer → Scottish Gaelic words. Out-of-range input falls back to digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(n))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => ONES[d[0] - '0']));
        if (n == 0) return ONES[0]; // neoni — a bare zero takes no ⟨a⟩ particle
        return Js.Trim(SPACE_RUN.Replace(Compose(n), " "));
    }
}
