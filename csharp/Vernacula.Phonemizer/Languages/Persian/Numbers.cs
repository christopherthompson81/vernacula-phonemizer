/**
 * Persian (fa) cardinal number compositor — the DECIMAL IRANIAN system: fused irregular hundreds, the
 * enclitic connective ⟨و⟩ /o/ between groups, and the bare-vs-یک split by magnitude (صد / هزار bare,
 * میلیون / میلیارد with یک).
 * Ported from src/languages/persian/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

/** The fa numbers table: the shared schema (units/teens/tens/hundreds/magnitudes) + the connective's IPA. */
public sealed class FaNumbersDef : NumbersDef
{
    /** IPA of the linking enclitic ⟨و⟩ /o/; appended after the preceding word is phonemized. See §2 above. */
    public string ConnectiveIpa = "";
}

public static class Numbers
{
    // Internal marker: "this word carries the connective", stripped by the word renderer, which then appends
    // the connective's IPA. A private-use code point, so it can never collide with a Persian spelling.
    private static readonly string CONNECTIVE = char.ConvertFromUtf32(0xE000);

    /** Wrap a word→IPA renderer so a connective-marked word gets [o] appended to its IPA (بیست → [bˈiːsto]). */
    public static Func<string, string> EncliticWord(Func<string, string> word, FaNumbersDef d) =>
        w => w.EndsWith(CONNECTIVE, StringComparison.Ordinal)
            ? word(w[..^CONNECTIVE.Length]) + d.ConnectiveIpa
            : word(w);

    /** Link two groups with the connective: it attaches to the LAST word of the head (بیست → بیست-و). */
    private static List<string> Link(List<string> head, List<string> tail)
    {
        if (tail.Count == 0) return head;
        var @out = new List<string>(head);
        @out[^1] += CONNECTIVE;
        @out.AddRange(tail);
        return @out;
    }

    /** Compose a non-negative integer into ordered Persian number-word spellings. */
    public static List<string?> PersianNumberWords(double n, NumbersDef def)
    {
        var d = (FaNumbersDef)def;
        List<string> Go(double x)
        {
            if (x < 10) return new List<string> { d.Units[(int)x] };
            if (x < 20) return new List<string> { d.Teens![(int)x - 10] };
            if (x < 100)
            {
                var t = Math.Floor(x / 10) * 10;
                return Link(new List<string> { d.Tens[Js.NumberToString(t)] }, x % 10 != 0 ? Go(x % 10) : new List<string>());
            }
            if (x < 1000)
                return Link(new List<string> { d.Hundreds![(int)Math.Floor(x / 100)] }, x % 100 != 0 ? Go(x % 100) : new List<string>());
            // Multiplier + magnitude form one group; `bare` drops a multiplier of 1 (هزار, not *یک هزار).
            List<string> Grouped(double mult, string mag, bool bare)
            {
                if (bare && mult == 1) return new List<string> { mag };
                var g = Go(mult);
                g.Add(mag);
                return g;
            }
            if (x < 1_000_000)
                return Link(Grouped(Math.Floor(x / 1000), d.Magnitudes.Thousand, true), x % 1000 != 0 ? Go(x % 1000) : new List<string>());
            if (x < 1_000_000_000)
                return Link(Grouped(Math.Floor(x / 1_000_000), d.Magnitudes.Million!, false),
                    x % 1_000_000 != 0 ? Go(x % 1_000_000) : new List<string>());
            return Link(Grouped(Math.Floor(x / 1_000_000_000), d.Magnitudes.Billion!, false),
                x % 1_000_000_000 != 0 ? Go(x % 1_000_000_000) : new List<string>());
        }
        return Go(n).Select(x => (string?)x).ToList();
    }
}
