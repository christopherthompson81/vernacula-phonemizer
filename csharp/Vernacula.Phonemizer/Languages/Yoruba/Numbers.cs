/**
 * Yoruba cardinal numbers — a VIGESIMAL system with both addition and subtraction.
 *
 * Before this file every digit read in ENGLISH: `1945` → *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd fˈɔːɹt̬i fˈaᶦv*, because
 * Yoruba's Latin fallback is an English phonemizer. Fluent English inside Yoruba speech is worse for TTS than
 * silence, and it was happening to every number in a 46M-speaker language.
 *
 * THE SYSTEM, read off a 112,738-paragraph yo.wikipedia dump (see yoruba.jsonc for every count):
 *   · 1-10 are the free unit words; 11-14 are unit + `lá` (méjìlá 12).
 *   · ⚠ 1-4 PAST A TEN ARE ADDITIVE, 5-9 ARE SUBTRACTIVE FROM THE TEN ABOVE. 24 is mẹ́rìn-lé-lógún
 *     ("four exceeding twenty", 103 hits); 26 is mẹ́rìn-dín-lọ́gbọ̀n ("four less than thirty", 54). So the
 *     spoken form of a number depends on its LAST DIGIT in a way no decimal system does, and 86 of the 89
 *     values 11-99 are attested in the corpus by the exact spelling this file generates.
 *   · Hundreds are their own irregular words (igba 200, irinwó 400, ẹgbẹ̀ta 600), each corpus-glossed.
 *   · Magnitude FIRST, multiplier second, joined to a remainder by `ó lé`.
 *   · ⚠ `lọ́nà` multiplies when the multiplier is above ten: `ẹgbẹ̀rún méjì` is 2,000 but 32,000 is
 *     `ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n`.
 *
 * ⚠ ABOVE 10¹² AND FOR NON-FINITE INPUT IT READS DIGIT BY DIGIT in Yoruba units — the fallback chichewa and
 * igbo both use above their ceiling. An unidiomatic Yoruba reading of a huge number is a far smaller error than
 * a confident English one, and it is what guarantees no digit reaches the foreign path again.
 *
 * The anchor is the corpus's own glosses, reproduced as tests in test/yorubaNumbers.test.ts. Yoruba HAS
 * referees (wikipron yor, kaikki yor) but they are word→IPA: they can check how a numeral is PRONOUNCED, never
 * whether it is the right numeral, so the glosses are the only thing that adjudicates composition.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Yoruba;

public static class Numbers
{
    private static YorubaNumbersDef N => Manifest.MANIFEST.Numbers;

    /** 1-10 as free-standing words. */
    private static string Unit(double n) => N.Units[(int)n];

    /**
     * 11-99. The last digit decides the shape: 1-4 additive on the ten below, 5-9 subtractive from the ten above.
     *
     * ⚠ 15 AND 25 ARE IRREGULAR AND THE IRREGULAR FORM IS THE COMMON ONE — mẹ́ẹ̀ẹ́dógún 127 against the regular
     * márùndínlógún 29. From 35 up only the regular form is attested, so this is two entries, not a pattern.
     */
    private static string BelowTwoHundred(double n)
    {
        if (n == 15) return N.Fifteen;
        if (n == 25) return N.TwentyFive;
        // ⚠ THE UNIT GUARD COMES FIRST. Without it `2` fell through to the teens arm and read *méjìlá* (12) — the
        // fusing form plus `lá` — because the arm was bounded above (n < 15) and not below.
        if (n < 11) return Unit(n);
        var u = n % 10;
        if (u == 0) return N.Tens[Js.NumberToString(n)].Free;
        if (n < 15) return $"{N.Front[(int)u]}{N.Teen}"; // 11-14: unit + lá
        var lower = n - u;
        if (u <= 4) return $"{N.Front[(int)u]}{N.Add}{N.Tens[Js.NumberToString(lower)].Fused}";
        // 5-9: (10 − u) less than the ten above
        return $"{N.Front[(int)(10 - u)]}{N.Subtract}{N.Tens[Js.NumberToString(lower + 10)].Fused}";
    }

    /**
     * 100-999.
     *
     * ⚠ 100-199 IS NOT `ọgọ́rùn-ún ó lé <remainder>`, which is what this function did at first and what the corpus
     * never writes. The vigesimal series CONTINUES past a hundred in single words on bases of twenty — ọgọ́fà 120,
     * ogóje 140, ọgọ́jọ 160, ọgọ́sàn-án 180, with the intervening tens as àádọ́- forms — and the lé/dín machinery
     * composes onto them exactly as it does below 100 (`mẹ́tàdínlógóje` = 137). So the tens table runs to 190 and
     * this range goes through the same code. From 200 up the hundreds ARE their own words joined by `ó lé`, which
     * the corpus glosses directly (`igba ó lé ọgọ́rin` = 280).
     */
    private static string Below1000(double n)
    {
        if (n < 200) return BelowTwoHundred(n);
        double h = Math.Floor(n / 100), rest = n % 100;
        var hundred = N.Hundreds[(int)h];
        return rest == 0 ? hundred : $"{hundred} {N.Join} {Below1000(rest)}";
    }

    /**
     * A magnitude and its multiplier. Below eleven the multiplier follows directly (`ẹgbẹ̀rún méjì`); above it
     * `lọ́nà` intervenes (`ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n`), and ×1 is the irregular `kan`.
     */
    private static string Scaled(string magnitude, double multiplier)
    {
        if (multiplier == 1) return $"{magnitude} {N.MultiplierOne}";
        if (multiplier <= 10) return $"{magnitude} {Unit(multiplier)}";
        return $"{magnitude} {N.Times} {Below1000(multiplier)}";
    }

    /**
     * Reads each digit separately, in Yoruba units — the floor, so nothing ever escapes to English.
     *
     * ⚠ IT TAKES THE DIGIT STRING, NEVER A NUMBER, and that is a correctness fix rather than a style choice. The
     * first version was reached as `digitByDigit(String(n))`, and above 1e21 JavaScript stringifies to EXPONENTIAL
     * notation: `1e+21` was read as *ọ̀kan e + méjì ọ̀kan* — the letters `e` and `+` voiced as words, with an `e˧`
     * phoneme landing mid-number. Worse, `Number` had already lost the digits: a 24-digit run became
     * 1.2345678901234568e+23, so the digits actually spoken were not the digits given. Reading the string keeps every
     * digit and cannot produce a character that is not one.
     */
    private static string DigitByDigit(string digits) =>
        string.Join(" ", Js.CodePoints(digits)
            .Select(ch =>
            {
                var d = Js.Number(ch);
                return double.IsNaN(d) ? "" : d == 0 ? N.Zero : Unit(d);
            })
            .Where(x => x != ""));

    /**
     * A run of DIGITS → its Yoruba cardinal reading. The string form is what the engine calls: it preserves every
     * digit of a run too long for a `number`, where `Number` would both lose precision and stringify to exponential
     * notation. See `digitByDigit`.
     */
    public static string YorubaNumber(string digits)
    {
        var n = Js.Number(digits);
        // Not a safe integer → read the given digits, not a rounded reconstruction of them.
        return IsSafeInteger(n) ? YorubaCardinal(n) : DigitByDigit(digits);
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** A non-negative integer → its Yoruba cardinal reading. */
    public static string YorubaCardinal(double n)
    {
        if (!double.IsFinite(n) || n < 0 || !double.IsInteger(n) || !IsSafeInteger(n))
            return DigitByDigit(double.IsFinite(n) ? Js.NumberToString(Math.Abs(Math.Truncate(n))) : "");
        if (n == 0) return N.Zero;
        if (n < 1000) return Below1000(n);
        foreach (var (limit, word) in new (double, string)[] { (1e6, N.Thousand), (1e9, N.Million), (1e12, N.Billion) })
        {
            var bas = limit / 1000;
            if (n < limit)
            {
                double mult = Math.Floor(n / bas), rest = n % bas;
                var head = Scaled(word, mult);
                return rest == 0 ? head : $"{head} {N.Join} {YorubaCardinal(rest)}";
            }
        }
        return DigitByDigit(Js.NumberToString(n));
    }

    private static readonly JsRe DIGIT_RUN = JsRegex.Compile("\\p{Nd}+", "gu");

    /** Every run of digits in `text` → its Yoruba cardinal reading. */
    public static string ReadYorubaNumbers(string text) => DIGIT_RUN.Replace(text, m => YorubaNumber(m.Value));
}
