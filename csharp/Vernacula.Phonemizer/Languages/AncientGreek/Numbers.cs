/**
 * Ancient Greek (5th-c. BCE Attic) number → words, for 0 … 2^53-1.
 *
 * Ported from src/languages/ancientgreek/numbers.ts, whose header carries the Smyth §§347–354 sourcing and
 * the three things that make Greek not a plain units/tens/hundreds table — the καί-linked compounds and the
 * tens-first order chosen for them, the MYRIAD (10⁴) grouping rather than thousands, and the masculine
 * nominative citation forms. Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.AncientGreek;

public static class Numbers
{
    /** 0–9, masculine nominative. ⟨τέτταρες⟩ is the Attic form. Spellings are POLYTONIC and fully accented,
     *  because the g2p reads breathings and pitch accents off the diacritics — a bare ⟨εις⟩ would lose the
     *  [h] of `εἷς`. */
    private static readonly string[] UNITS =
        ["οὐδέν", "εἷς", "δύο", "τρεῖς", "τέτταρες", "πέντε", "ἕξ", "ἑπτά", "ὀκτώ", "ἐννέα"];

    /** 10–19. 13/14 are Smyth's units-first phrases; 15–19 are the fused -καίδεκα forms. */
    private static readonly string[] TEENS =
    [
        "δέκα", "ἕνδεκα", "δώδεκα", "τρεῖς καὶ δέκα", "τέτταρες καὶ δέκα",
        "πεντεκαίδεκα", "ἑκκαίδεκα", "ἑπτακαίδεκα", "ὀκτωκαίδεκα", "ἐννεακαίδεκα",
    ];

    private static readonly Dictionary<string, string> TENS = new()
    {
        ["20"] = "εἴκοσι", ["30"] = "τριάκοντα", ["40"] = "τετταράκοντα", ["50"] = "πεντήκοντα",
        ["60"] = "ἑξήκοντα", ["70"] = "ἑβδομήκοντα", ["80"] = "ὀγδοήκοντα", ["90"] = "ἐνενήκοντα",
    };

    private static readonly string[] HUNDREDS =
    [
        "", "ἑκατόν", "διακόσιοι", "τριακόσιοι", "τετρακόσιοι",
        "πεντακόσιοι", "ἑξακόσιοι", "ἑπτακόσιοι", "ὀκτακόσιοι", "ἐνακόσιοι",
    ];

    /** 1000–9000: the multiplicative χίλιοι series. */
    private static readonly string[] THOUSANDS =
    [
        "", "χίλιοι", "δισχίλιοι", "τρισχίλιοι", "τετρακισχίλιοι",
        "πεντακισχίλιοι", "ἑξακισχίλιοι", "ἑπτακισχίλιοι", "ὀκτακισχίλιοι", "ἐνακισχίλιοι",
    ];

    private const string KAI = "καὶ";
    private const string MYRIAD_SG = "μυριάς";
    private const string MYRIAD_PL = "μυριάδες";
    private const string MYRIAD_GEN = "μυριάδων";

    /** 20–99: tens-first, καὶ-linked (εἴκοσι καὶ εἷς). */
    private static string TensUnits(int n)
    {
        var t = n / 10 * 10;
        var u = n % 10;
        return TENS[Js.NumberToString(t)] + (u != 0 ? $" {KAI} {UNITS[u]}" : "");
    }

    /** 1–9999 — the contents of ONE myriad group. Elements joined descending by καὶ. */
    private static string UnderMyriad(int n)
    {
        var parts = new List<string>();
        var th = n / 1000;
        var h = n % 1000 / 100;
        var rem = n % 100;
        if (th != 0) parts.Add(THOUSANDS[th]);
        if (h != 0) parts.Add(HUNDREDS[h]);
        if (rem != 0) parts.Add(rem < 10 ? UNITS[rem] : rem < 20 ? TEENS[rem - 10] : TensUnits(rem));
        return string.Join($" {KAI} ", parts);
    }

    /** The myriad tag for power level `k` (k≥1): μυριάδες, then one genitive μυριάδων per extra level. */
    private static string MyriadTag(int k, bool singular) =>
        string.Join(" ", new[] { singular ? MYRIAD_SG : MYRIAD_PL }
            .Concat(Enumerable.Repeat(MYRIAD_GEN, k - 1)));

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static readonly JsRe SPACES = JsRegex.Compile("\\s+", "gu");

    /** Non-negative integer → Ancient Greek words. Out-of-range input falls back to digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!IsSafeInteger(n) || n < 0)
            // JS `String(n)` — NOT `Math.abs`, so a negative keeps its sign character, which the filter drops.
            return string.Join(" ", Js.CodePoints(Js.NumberToString(n))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => UNITS[(int)Js.Number(d)]));
        if (n == 0) return UNITS[0]; // οὐδέν — Classical Greek has no cardinal zero
        // Decompose in BASE 10,000 (the myriad), highest group first.
        var groups = new List<int>();
        for (var r = n; r > 0; r = Math.Floor(r / 10000)) groups.Add((int)(r % 10000));
        var parts = new List<string>();
        for (var k = groups.Count - 1; k >= 0; k--)
        {
            var g = groups[k];
            if (g == 0) continue;
            if (k == 0) parts.Add(UnderMyriad(g));
            else if (g == 1) parts.Add(MyriadTag(k, true)); // μυριάς, μυριὰς μυριάδων (10⁴, 10⁸)
            else parts.Add($"{UnderMyriad(g)} {MyriadTag(k, false)}");
        }
        return Js.Trim(SPACES.Replace(string.Join($" {KAI} ", parts), " "));
    }
}
