/**
 * Classical Latin number → words, 0–999,999,999,999: subtractive x8/x9, the mīlle/mīlia split, and
 * macronized spellings because the g2p reads vowel length off the macron.
 * Ported from src/languages/latin/numbers.ts — see that file for the Allen & Greenough sourcing and the
 * two documented departures from Classical usage (nihil, mīlliō).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latin;

public static class Numbers
{
    private static readonly string[] UNITS =
        ["nihil", "ūnus", "duo", "trēs", "quattuor", "quīnque", "sex", "septem", "octō", "novem"];

    private static readonly string[] TEENS =
    [
        "decem", "ūndecim", "duodecim", "tredecim", "quattuordecim",
        "quīndecim", "sēdecim", "septendecim", "duodēvīgintī", "ūndēvīgintī",
    ];

    private static readonly Dictionary<string, string> TENS = new()
    {
        ["20"] = "vīgintī", ["30"] = "trīgintā", ["40"] = "quadrāgintā", ["50"] = "quīnquāgintā",
        ["60"] = "sexāgintā", ["70"] = "septuāgintā", ["80"] = "octōgintā", ["90"] = "nōnāgintā",
        ["100"] = "centum",
    };

    private static readonly string[] HUNDREDS =
    [
        "", "centum", "ducentī", "trecentī", "quadringentī",
        "quīngentī", "sescentī", "septingentī", "octingentī", "nōngentī",
    ];

    private const string ThousandSingular = "mīlle";
    private const string ThousandPlural = "mīlia";
    private const string MillionSingular = "mīlliō";
    private const string MillionPlural = "mīlliōnēs";
    private const string BillionSingular = "mīlliardum";
    private const string BillionPlural = "mīlliarda";

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static readonly JsRe HUNDRED_MASC = JsRegex.Compile("ntī$", "u");
    private static readonly JsRe SPACES = JsRegex.Compile("\\s+", "gu");

    /** Neuter-plural agreement for a count of `mīlia` (tria mīlia, ducenta mīlia). */
    private static string Neuter(string phrase) =>
        string.Join(" ", phrase.Split(' ').Select(w =>
            w == "ūnus" ? "ūna" : w == "trēs" ? "tria" : HUNDRED_MASC.IsMatch(w) ? w[..^1] + "a" : w));

    /** 1–99. Tens-first for the additive compounds, subtractive for every x8/x9. */
    private static string UnderHundred(double n)
    {
        if (n < 10) return UNITS[(int)n];
        if (n < 20) return TEENS[(int)n - 10];
        var t = Math.Floor(n / 10) * 10;
        var u = n % 10;
        if (u == 8) return "duodē" + TENS[Js.NumberToString(t + 10)];
        if (u == 9) return "ūndē" + TENS[Js.NumberToString(t + 10)];
        return TENS[Js.NumberToString(t)] + (u != 0 ? $" {UNITS[(int)u]}" : "");
    }

    /** A magnitude group: bare singular for a count of 1 (mīlle, mīlliō), else count + the plural. */
    private static string Magnitude(double count, string singular, string plural, bool neuterCount)
    {
        if (count == 1) return singular;
        var c = Compose(count);
        return $"{(neuterCount ? Neuter(c) : c)} {plural}";
    }

    private static string Compose(double n)
    {
        if (n < 100) return UnderHundred(n);
        if (n < 1000)
        {
            var h = Math.Floor(n / 100);
            var r = n % 100;
            return HUNDREDS[(int)h] + (r != 0 ? $" {Compose(r)}" : "");
        }
        if (n < 1_000_000)
        {
            var th = Math.Floor(n / 1000);
            var r = n % 1000;
            return Magnitude(th, ThousandSingular, ThousandPlural, true) + (r != 0 ? $" {Compose(r)}" : "");
        }
        if (n < 1_000_000_000)
        {
            var m = Math.Floor(n / 1_000_000);
            var r = n % 1_000_000;
            return Magnitude(m, MillionSingular, MillionPlural, false) + (r != 0 ? $" {Compose(r)}" : "");
        }
        var b = Math.Floor(n / 1_000_000_000);
        var rb = n % 1_000_000_000;
        return Magnitude(b, BillionSingular, BillionPlural, false) + (rb != 0 ? $" {Compose(rb)}" : "");
    }

    /** Non-negative integer → Classical Latin words. Out-of-range input falls back to digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!IsSafeInteger(n) || n < 0)
        {
            return string.Join(" ", Js.NumberToString(n)
                .Where(c => c >= '0' && c <= '9')
                .Select(d => UNITS[d - '0']));
        }
        if (n == 0) return UNITS[0]; // nihil
        return SPACES.Replace(Compose(n), " ").Trim();
    }
}
