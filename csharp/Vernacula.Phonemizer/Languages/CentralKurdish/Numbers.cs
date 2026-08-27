/**
 * Central Kurdish / Sorani (ckb) cardinal number compositor — the DECIMAL IRANIAN system, with every
 * magnitude group linked by the ENCLITIC connective ⟨و⟩ -u (appended to the END of the preceding word).
 * Ported from src/languages/central-kurdish/numbers.ts — see that file for the sources and the evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.CentralKurdish;

/** The ckb numbers table: the shared schema plus the enclitic connective ⟨و⟩ that links magnitude groups. */
public sealed class CkbNumbersDef : NumbersDef
{
    /** The enclitic connective -u; the composer appends it to the preceding word's SPELLING, not its IPA. */
    public string Connective = "";
}

public static class Numbers
{
    /** Link two groups with the enclitic connective: it attaches to the LAST word of the head (بیست → بیستو). */
    private static List<string> Link(List<string> head, List<string> tail, string u)
    {
        if (tail.Count == 0) return head;
        var outp = new List<string>(head);
        outp[^1] += u;
        outp.AddRange(tail);
        return outp;
    }

    /** Compose a non-negative integer into ordered Sorani number-word spellings. */
    public static List<string?> IranianNumberWords(double n, NumbersDef d)
    {
        var u = ((CkbNumbersDef)d).Connective;
        return Go(n, d, u).Cast<string?>().ToList();
    }

    private static List<string> Go(double x, NumbersDef d, string u)
    {
        if (x < 10) return [d.Units[(int)x]];
        if (x < 20) return [d.Teens![(int)x - 10]];
        if (x < 100)
        {
            double t = Math.Floor(x / 10) * 10, r = x % 10;
            return Link([d.Tens[Js.NumberToString(t)]], r != 0 ? Go(r, d, u) : [], u);
        }
        if (x < 1000)
        {
            double h = Math.Floor(x / 100), r = x % 100;
            // 100 = سەد (bare); 200 = دوو سەد (no connective INSIDE the hundreds group).
            return Link(h > 1 ? [d.Units[(int)h], d.Magnitudes.Hundred] : [d.Magnitudes.Hundred],
                r != 0 ? Go(r, d, u) : [], u);
        }
        if (x < 1_000_000)
        {
            double th = Math.Floor(x / 1000), r = x % 1000;
            // 1000 = هەزار (bare, like the bare سەد); 2000 = دوو هەزار.
            List<string> head = th > 1 ? [.. Go(th, d, u), d.Magnitudes.Thousand] : [d.Magnitudes.Thousand];
            return Link(head, r != 0 ? Go(r, d, u) : [], u);
        }
        if (x < 1_000_000_000)
        {
            double m = Math.Floor(x / 1_000_000), r = x % 1_000_000;
            // million/billion KEEP the leading "yek" (یەک ملیۆن).
            return Link([.. Go(m, d, u), d.Magnitudes.Million!], r != 0 ? Go(r, d, u) : [], u);
        }
        double b = Math.Floor(x / 1_000_000_000), rr = x % 1_000_000_000;
        return Link([.. Go(b, d, u), d.Magnitudes.Billion!], rr != 0 ? Go(rr, d, u) : [], u);
    }
}
