/**
 * Modern Greek cardinal number → words (space-separated; each runs through the g2p). Simplified counting form
 * (δέκα = 10, tens[]/hundreds[] tables, χίλια = 1000); the full gender/case agreement is contextual and not
 * modelled. Covers 0 … <10¹²; larger / non-finite → digit-by-digit. Numbers are unmeasured (the referees are
 * word-only) — best-effort.
 *
 * the 10⁶ ceiling was raised because the corpus's `5.000.000` (a period-grouped number, de-grouped by
 * normalize.ts step 7) fell off it and read as seven digit names — «πέντε μηδέν μηδέν μηδέν μηδέν μηδέν
 * μηδέν». εκατομμύριο/δισεκατομμύριο take the same singular-vs-plural shape as χίλια/χιλιάδες.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Greek;

public static class Numbers
{
    private static GreekNumbersDef N => Manifest.MANIFEST.Numbers;

    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n == 10) return N.Ten;
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        var tens = N.Tens[t];
        return u != 0 ? $"{tens} {N.Units[u]}" : tens;
    }

    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        var hundred = N.Hundreds[h];
        return r != 0 ? $"{hundred} {Below100(r)}" : hundred;
    }

    /**
     * The multiplier of χιλιάδες agrees with it, and χιλιάδα is FEMININE: «πεντακόσιες χιλιάδες», «τρεις
     * χιλιάδες» — not the neuter πεντακόσια / τρία the tables hold. Only 1, 3, 4 and the hundreds inflect;
     * everything else is invariant. Exposed by the digit de-grouping, which made the corpus's 50
     * period-grouped numbers (1.000, 783.562) reach this path as whole integers for the first time.
     */
    private static readonly IReadOnlyDictionary<string, string> FEMININE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ένα"] = "μία", ["τρία"] = "τρεις", ["τέσσερα"] = "τέσσερις",
    };

    private static readonly JsRe OSIA_FINAL = JsRegex.Compile("όσια$", "u");

    private static string Feminine(string s) =>
        string.Join(" ", s.Split(' ').Select(w => FEMININE.TryGetValue(w, out var f) ? f : OSIA_FINAL.Replace(w, "όσιες")));

    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        var th = Math.Floor(n / 1000);
        var r = n % 1000;
        var thousand = th == 1 ? N.Thousand : $"{Feminine(Below1000(th))} χιλιάδες";
        return r != 0 ? $"{thousand} {Below1000(r)}" : thousand;
    }

    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.NumberToString(Math.Abs(n))
                .Select(d => d >= '0' && d <= '9' && d - '0' < N.Units.Count ? N.Units[d - '0'] : d.ToString()));
        if (n == 0) return N.Units[0];
        foreach (var (value, one, many) in new (double, string, string)[]
                 {
                     (1e9, "ένα δισεκατομμύριο", "δισεκατομμύρια"),
                     (1e6, "ένα εκατομμύριο", "εκατομμύρια"),
                 })
        {
            if (n >= value)
            {
                var q = Math.Floor(n / value);
                var r = n % value;
                var head = q == 1 ? one : $"{Below1e6(q)} {many}";
                return r != 0 ? $"{head} {NumberToWords(r)}" : head;
            }
        }
        return Below1e6(n);
    }
}
