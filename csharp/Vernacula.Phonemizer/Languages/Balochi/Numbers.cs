/**
 * Balochi (bal) cardinal number compositor — the DECIMAL IRANIAN core (units + irregular teens +
 * round-ten words, groups linked by the enclitic connective -u) over the INDIC magnitudes, with arab
 * at 10^9 and no word for 10^6.
 * Ported from src/languages/balochi/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Balochi;

public static class Numbers
{
    // Internal marker: "this word carries the enclitic connective". Stripped by the word renderer, which
    // then appends the connective's IPA. A private-use code point, so it can never collide with a Balochi
    // spelling.
    private const string ENCLITIC = Markers.PUA_SENTINEL;

    /** Wrap a word→IPA renderer so a connective-marked word gets the enclitic -u appended to its IPA. */
    public static Func<string, string> EncliticWord(Func<string, string> word, BalochiNumbersDef d) =>
        w => w.EndsWith(ENCLITIC, StringComparison.Ordinal)
            ? word(w[..^ENCLITIC.Length]) + d.ConnectiveIpa
            : word(w);

    /** Link two groups with the enclitic connective: it attaches to the LAST word of the head (بیست → bīst-u). */
    private static List<string> Link(List<string> head, List<string> tail)
    {
        if (tail.Count == 0) return head;
        var @out = new List<string>(head);
        @out[^1] += ENCLITIC;
        @out.AddRange(tail);
        return @out;
    }

    /** Compose a non-negative integer into ordered Balochi number-word spellings (Iranian core, lakh/crore scale). */
    public static List<string?> BalochiNumberWords(double n, NumbersDef def)
    {
        var d = (BalochiNumbersDef)def;
        List<string> Go(double x)
        {
            if (x < 10) return new List<string> { d.Units[(int)x] };
            if (x < 20) return new List<string> { d.Teens![(int)x - 10] };
            if (x < 100)
            {
                var t = Math.Floor(x / 10) * 10;
                var r = x % 10;
                return Link(new List<string> { d.Tens[Js.NumberToString(t)] }, r != 0 ? Go(r) : new List<string>());
            }
            // Multiplier + magnitude form ONE group (do-sad, dah lakk) — no connective inside it; the bare
            // magnitude drops the multiplier for 100 and 1,000, as in Persian.
            List<string> Grouped(double mult, string mag, bool bare)
            {
                if (bare && mult == 1) return new List<string> { mag };
                var g = Go(mult);
                g.Add(mag);
                return g;
            }
            if (x < 1000)
                return Link(Grouped(Math.Floor(x / 100), d.Magnitudes.Hundred, true), x % 100 != 0 ? Go(x % 100) : new List<string>());
            if (x < 100_000)
                return Link(Grouped(Math.Floor(x / 1000), d.Magnitudes.Thousand, true), x % 1000 != 0 ? Go(x % 1000) : new List<string>());
            if (x < 10_000_000)
                return Link(Grouped(Math.Floor(x / 100_000), d.Magnitudes.Lakh!, false), x % 100_000 != 0 ? Go(x % 100_000) : new List<string>());
            if (x < 1_000_000_000)
                return Link(Grouped(Math.Floor(x / 10_000_000), d.Magnitudes.Crore!, false), x % 10_000_000 != 0 ? Go(x % 10_000_000) : new List<string>());
            return Link(Grouped(Math.Floor(x / 1_000_000_000), d.Magnitudes.Arab!, false), x % 1_000_000_000 != 0 ? Go(x % 1_000_000_000) : new List<string>());
        }
        return Go(n).Select(w => (string?)w).ToList();
    }
}
