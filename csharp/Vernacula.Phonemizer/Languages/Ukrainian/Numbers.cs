/**
 * EAST-SLAVIC (uk, be) cardinal composition with MAGNITUDE-NOUN AGREEMENT.
 * Ported from src/languages/ukrainian/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

/** A magnitude noun's three count forms, in `slavicCountForm` index order: nom.sg, nom.pl (2–4), gen.pl. */
public sealed class MagnitudeForms
{
    /** nom.pl — the form after a count ending in 2–4 (дві тисячі, два мільйони). */
    public string Few = "";
    /** gen.pl — the form after 5+, 11–14, and 0 (п'ять тисяч, п'ять мільйонів). */
    public string Many = "";
}

public sealed class MagnitudeCountsDef
{
    public MagnitudeForms Thousand = new();
    public MagnitudeForms Million = new();
    public MagnitudeForms Billion = new();
}

/** Feminine nominative of 1 and 2 — required before тисяча/тысяча. */
public sealed class FeminineDef
{
    public string One = "";
    public string Two = "";
}

/** The East-Slavic number data: the Western/Slavic base table plus the magnitude count forms and the
 *  feminine 1/2 that the feminine тисяча/тысяча demands. */
// NOT sealed: the language's own def extends it with the decimal-comma name, exactly as the TS
// `numbers: EastSlavicNumbers & { decimalConnector: string }` does.
public class EastSlavicNumbers : NumbersDef
{
    public MagnitudeCountsDef MagnitudeCounts = new();
    public FeminineDef Feminine = new();
}

public static class Numbers
{
    /** Pick the magnitude noun's form for `count` (nom.sg / nom.pl / gen.pl) via the shared Slavic selector. */
    private static string Magnitude(double count, string sg, MagnitudeForms forms) =>
        new[] { sg, forms.Few, forms.Many }[NormalizeSymbols.SlavicCountForm(count)];

    /** One magnitude group: the multiplier words followed by the agreeing magnitude noun. */
    private static List<string?> Group(
        double count,
        EastSlavicNumbers d,
        string sg,
        MagnitudeForms forms,
        bool feminine = false,
        bool omitOne = false)
    {
        var noun = Magnitude(count, sg, forms);
        if (count == 1 && omitOne) return new List<string?> { noun };
        var words = EastSlavicNumberWordsFn(count, d).Select(w => w ?? "?").ToList();
        if (feminine)
        {
            var i = words.Count - 1;
            if (words[i] == d.Units[1]) words[i] = d.Feminine.One;
            else if (words[i] == d.Units[2]) words[i] = d.Feminine.Two;
        }
        var outp = words.Select(w => (string?)w).ToList();
        outp.Add(noun);
        return outp;
    }

    /**
     * EAST-SLAVIC (uk, be) composition: units/teens/tens/hundreds as in the shared Western composer, but each
     * magnitude group carries agreement (gender + count) with its magnitude noun.
     */
    public static readonly NumberComposer eastSlavicNumberWords = EastSlavicNumberWordsFn;

    private static List<string?> EastSlavicNumberWordsFn(double n, NumbersDef def)
    {
        var d = (EastSlavicNumbers)def;
        var M = d.MagnitudeCounts;
        if (n < 1000) return Core.Numbers.westernNumberWords(n, d);
        var parts = new List<string?>();
        double bil = Math.Floor(n / 1_000_000_000),
            mil = Math.Floor(n % 1_000_000_000 / 1_000_000),
            th = Math.Floor(n % 1_000_000 / 1000),
            r = n % 1000;
        if (bil != 0) parts.AddRange(Group(bil, d, d.Magnitudes.Billion!, M.Billion));
        if (mil != 0) parts.AddRange(Group(mil, d, d.Magnitudes.Million!, M.Million));
        if (th != 0) parts.AddRange(Group(th, d, d.Magnitudes.Thousand, M.Thousand, feminine: true, omitOne: true));
        if (r != 0) parts.AddRange(Core.Numbers.westernNumberWords(r, d));
        return parts;
    }
}
