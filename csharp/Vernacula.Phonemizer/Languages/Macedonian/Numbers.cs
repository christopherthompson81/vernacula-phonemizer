/**
 * Macedonian (mk) number WORDS — cardinal and ordinal, shared by the engine (Macedonian.cs) and the
 * normalization layer (Normalize.cs). Macedonian cardinals join tens+units and hundreds+remainder with
 * "и" (дваесет и еден = 21, сто и деведесет = 190); илјада (thousand) is FEMININE, so the 2 multiplier
 * becomes "две" (две илјади). Ordinals are formed from the cardinal by ordinalizing ONLY the last
 * element: 190 → "сто и деведесетти", 1970 → "илјада деветстотини и седумдесетти". The written
 * N-суффикс convention (17-ти, 18-тиот, 37-ма) is resolved via `MkOrdinal` plus the gender/definiteness
 * transforms in Normalize.cs, where the suffix rules live.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Macedonian;

public static class Numbers
{
    private static MacedonianNumbersDef NUM => Manifest.DEF.Numbers;

    /**
     * Build the Macedonian words for n; "и" precedes the final component (дваесет и еден; сто и еден).
     *
     * ⚠ A NON-INTEGER `n` DIVERGES FROM THE TS AT THIS BOUNDARY, AND IT IS UNREACHABLE. JS indexes
     * `units[0.5]` as a property lookup and gets `undefined` (the TS's `!` is a lie there); C# must
     * truncate to `Units[0]` and says *нула*. Matching JS would mean a nullable return threaded through all
     * fourteen call sites for a case none of them can produce — every caller passes an integer, and that is
     * enumerated rather than assumed: the clock's `Number(h)`/`Number(min)`, the ordinal rule's
     * `Number(digits)`, `Text()`'s `Number(intPart)`/`Number(joined)`/`Number(d)` are all `\d+` captures,
     * the internal recursions are `Math.Floor`/`%` of integers, and the dead `Number()` helper guards with
     * a safe-integer test first. Recorded because the difference is real, not because it can be hit.
     */
    public static string NumberToText(double n, string? raw = null)
    {
        if (n < 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n == 10) return NUM.Ten;
        if (n < 20) return NUM.Teens[(int)n - 11];
        if (n < 100)
        {
            var t = NUM.Tens[Js.NumberToString(Math.Floor(n / 10) * 10)];
            var u = n % 10;
            return u != 0 ? $"{t} {NUM.And} {NUM.Units[(int)u]}" : t;
        }
        if (n < 1000)
        {
            var h = NUM.Hundreds[Js.NumberToString(Math.Floor(n / 100))];
            var r = n % 100;
            if (r == 0) return h;
            return $"{h} {(r < 20 || r % 10 == 0 ? NUM.And + " " : "")}{NumberToText(r)}";
        }
        if (n < 1_000_000)
        {
            var th = Math.Floor(n / 1000);
            var r = n % 1000;
            // The multiplier of the FEMININE илјада takes feminine "две" for 2 (две илјади, not два).
            var thCount = string.Join(" ", NumberToText(th).Split(' ')
                .Select(x => string.Equals(x, NUM.Units[2], StringComparison.Ordinal) ? "две" : x));
            var thWord = th == 1 ? NUM.Thousand : $"{thCount} {NUM.Thousands}";
            if (r == 0) return thWord;
            return $"{thWord} {(r < 100 || r % 100 == 0 ? NUM.And + " " : "")}{NumberToText(r)}";
        }
        if (n < 1_000_000_000)
        {
            var mil = Math.Floor(n / 1_000_000);
            var r = n % 1_000_000;
            // милион is masculine, so no "две" swap here.
            var milWord = mil == 1 ? NUM.Million : $"{NumberToText(mil)} {NUM.Millions}";
            return r != 0 ? $"{milWord} {NumberToText(r)}" : milWord;
        }
        // ⚠ CODE POINTS, and the ASCII-digit filter is the TS's own: past a milliard the number is spelled
        // digit by digit off `raw` when it was given, because the double can no longer carry the figure.
        return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(n))
            .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
            .Select(d => NUM.Units[(int)Js.Number(d)]));
    }

    /** Masculine-indefinite ordinal words 1–19. */
    private static readonly string[] ORD =
    {
        "", "први", "втори", "трети", "четврти", "петти", "шести", "седми", "осми", "деветти",
        "десетти", "единаесетти", "дванаесетти", "тринаесетти", "четиринаесетти", "петнаесетти",
        "шеснаесетти", "седумнаесетти", "осумнаесетти", "деветнаесетти",
    };

    private static readonly IReadOnlyDictionary<string, string> ORD_TENS =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["20"] = "дваесетти", ["30"] = "триесетти", ["40"] = "четириесетти", ["50"] = "педесетти",
            ["60"] = "шеесетти", ["70"] = "седумдесетти", ["80"] = "осумдесетти", ["90"] = "деведесетти",
        };

    private static readonly IReadOnlyDictionary<string, string> HUND_ORD =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["1"] = "стоти", ["2"] = "двестоти", ["3"] = "тристоти", ["4"] = "четиристоти", ["5"] = "петстоти",
            ["6"] = "шестоти", ["7"] = "седумстоти", ["8"] = "осумстоти", ["9"] = "деветстоти",
        };

    /**
     * Integer → the masculine-indefinite nominative ordinal, ordinalizing only the LAST element:
     * 190 → "сто и деведесетти", 1970 → "илјада деветстотини и седумдесетти". NULL out of the supported
     * range (the corpus's ordinal contexts — suffixes, centuries, dates — are all < 10000).
     */
    public static string? MkOrdinal(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n > 9999) return null;
        if (n < 20) return ORD[(int)n];
        if (n < 100)
        {
            var t = Math.Floor(n / 10) * 10;
            var u = n % 10;
            return u != 0
                ? $"{NUM.Tens[Js.NumberToString(t)]} {NUM.And} {ORD[(int)u]}"
                : ORD_TENS[Js.NumberToString(t)];
        }
        if (n < 1000)
        {
            var h = Math.Floor(n / 100);
            var r = n % 100;
            if (r == 0) return HUND_ORD[Js.NumberToString(h)];
            return $"{NUM.Hundreds[Js.NumberToString(h)]} {(r < 20 || r % 10 == 0 ? NUM.And + " " : "")}{MkOrdinal(r)}";
        }
        var th = Math.Floor(n / 1000);
        var rem = n % 1000;
        if (rem == 0) return th == 1 ? "илјадити" : $"{NumberToText(th)} илјадити";
        var thWord = th == 1 ? NUM.Thousand : $"{NumberToText(th)} {NUM.Thousands}";
        return $"{thWord} {(rem < 100 || rem % 100 == 0 ? NUM.And + " " : "")}{MkOrdinal(rem)}";
    }
}
