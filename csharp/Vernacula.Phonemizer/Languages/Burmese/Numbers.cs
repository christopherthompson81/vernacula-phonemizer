/**
 * Burmese (my) cardinal number → words.
 *
 * Burmese has a DISTINCT word for every power of ten from 10¹ to 10⁷ — ဆယ် 10, ရာ 100, ထောင် 1000,
 * သောင်း 10⁴, သိန်း 10⁵, သန်း 10⁶, ကုဋေ 10⁷ — so a number is read place by place as
 * `multiplier + place`, with no myriad grouping below 10⁷. Above 10⁷ the places repeat in increments of
 * 10⁷, which this composes recursively (10⁹ = တစ်ရာ ကုဋေ, "a hundred crore").
 *
 * Two rules the sources state explicitly, both implemented:
 *  1. A place word takes its CREAKY form when a nonzero remainder follows it, and its plain form when the
 *     number ends there: ဆယ် → ဆယ့်, ရာ → ရာ့, ထောင် → ထောင့်. Wikipedia: "shift from ဆယ် (low tone) to
 *     ဆယ့် (creaky tone), except in numbers divisible by ten", and the same for ထောင်/ထောင့် at 1000.
 *  2. The multiplier တစ် (one) IS spoken before ရာ and above (တစ်ရာ = 100, တစ်ထောင် = 1000) but is
 *     omitted at ဆယ်: "Ten to nineteen are almost always expressed without including တစ် (one)", so
 *     10 is ဆယ် and 11 is ဆယ့်တစ်, not *တစ်ဆယ့်တစ်.
 *
 * Sources: Wikipedia "Burmese numerals" (the place inventory, the increment rule, and both quoted tone
 * rules); Omniglot "Numbers in Burmese" (the 0–10 and tens lists, cross-checked). Every numeral word was
 * verified to phonemize through this engine standalone before being used here.
 *
 * ⚠ COMPOUND VOICING IS LEXICAL, NOT DERIVABLE, and there is deliberately no rule for it. A romanization like
 * Omniglot's "koe-zeh" for 90 ကိုးဆယ် suggests one, but the gold contradicts it: wikipron and kaikki both give
 * 30 သုံးဆယ် as [θóʊɴsʰɛ̀], VOICELESS, after an open syllable where any systematic rule would voice it — while
 * 10 တစ်ဆယ် is [təzɛ̀], voiced. The common numeral compounds are covered by dictionary.tsv, so composed
 * numerals match the gold as they stand. A systematic rule was implemented and measured: every variant LOST
 * ground against the referee (95.7% → 91.7% / 81.2% / 79.0%).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Burmese;

public static class Numbers
{
    private static BurmeseNumbersDef N => Manifest.DEF.Numbers;

    private const double CRORE = 10_000_000; // 10⁷ ကုဋေ — the place at which the series repeats

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /**
     * THE DIGIT-AT-A-TIME READING — the fallback for a digit run `numberToWords` must refuse.
     *
     * ⚠ ABOVE 2^53 `numberToWords` RETURNS ITS ASCII ARGUMENT, AND THE NUMBER USED TO VANISH FROM THE READING:
     * the engine's g2p has no rules for Latin digits, so the returned string was dropped on the floor and the
     * sentence scanned without its numeral. Refusing to compose is right — `Number()` has already lost the low
     * digits, so the composed numeral would be confidently WRONG about the quantity — but there was no else.
     *
     * ⚠ SPACED, NOT SOLID, which is the opposite of the composed path above. There the solid join is load-bearing
     * (it is what lets compound voicing run across တစ်+ရာ → [təja˨]); here the digits are being READ OUT, not
     * composed into one numeral, so joining them would fuse voicing across a boundary no speaker articulates.
     * `N.units[0]` is empty by design (the composed path never says a zero place), so a zero digit reads N.zero.
     */
    public static string SpellDigits(string digits) =>
        string.Join(" ", digits.Where(c => c >= '0' && c <= '9')
            .Select(c => c == '0' ? N.Zero : N.Units[c - '0']));

    /**
     * Non-negative integer → the Burmese numeral as ONE orthographic word (no spaces). Burmese writes
     * numerals solid — တစ်ရာ, တစ်ထောင့်တစ်ရာ့ဆယ့်တစ် — and joining them here rather than emitting separate
     * tokens is what lets the engine segmenter and compound voicing apply across the joins: 100 renders
     * [təja˨] as a speaker says it, not [tɪʔ ja˨] as two isolated words.
     */
    public static string NumberToWords(double n)
    {
        if (!IsSafeInteger(n) || n < 0) return Js.NumberToString(n);
        if (n == 0) return N.Zero;
        if (n >= CRORE)
        {
            // Above 10⁷ the places repeat: read the crore count, the place word, then the remainder.
            var crores = Math.Floor(n / CRORE);
            var restC = n % CRORE;
            var placeC = N.Places[6]; // ကုဋေ
            return string.Concat(new[]
            {
                NumberToWords(crores),
                restC == 0 ? placeC[0] : placeC[1],
                restC == 0 ? "" : NumberToWords(restC),
            }.Where(s => s != ""));
        }
        var outp = new List<string>();
        // Walk the places from 10⁶ down to 10¹, then the bare unit.
        for (var p = 6; p >= 1; p--)
        {
            var value = Math.Pow(10, p);
            var mult = Math.Floor(n / value) % 10;
            if (mult == 0) continue;
            var place = N.Places[p - 1];
            var rest = n % value;
            // The multiplier for 1 is dropped only at ဆယ် (10¹).
            if (!(mult == 1 && p == 1)) outp.Add(mult == 1 ? N.One : N.Units[(int)mult]);
            outp.Add(rest == 0 ? place[0] : place[1]);
        }
        var unit = n % 10;
        if (unit != 0) outp.Add(N.Units[(int)unit]);
        return string.Concat(outp);
    }
}
