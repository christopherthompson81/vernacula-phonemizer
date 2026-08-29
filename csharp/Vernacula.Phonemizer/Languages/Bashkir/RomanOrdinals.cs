/**
 * Bashkir Roman-numeral reading. A century is an ORDINAL: `XIX быуат` is *ун туғыҙынсы быуат*; the shared
 * cardinal pass gives *ун туғыҙ быуат*, which means "nineteen centuries". `roman` is 29,234 instances
 * corpus-wide, and `быуат` ×27 in the retained text alone.
 *
 * ⚠ NO SEPARATE ORDINAL TABLE. Turkic ordinal formation is regular and Normalize.cs already derives it from
 * vowel harmony, so this file calls that function rather than authoring a second copy — which is what the
 * East Slavic policies next door have to do, because their -ый/-ое series is suppletive and cannot be
 * derived from the cardinal at all. One derivation, one place it can be wrong.
 *
 * ⚠ AND THERE IS NO GENDER TO GET WRONG, the limitation ru/uk/be each have to record: Bashkir has no
 * grammatical gender and its ordinal is invariant before any noun. The remaining limitation is CASE —
 * "XIX быуатта" wants the locative *ун туғыҙынсы быуатта*, and the ordinal is emitted uninflected while the
 * noun keeps whatever ending the writer typed, which is the right division of labour here: only the last
 * element of a Turkic noun phrase takes the case ending, and that element is the noun.
 * Ported from src/languages/bashkir/romanOrdinals.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bashkir;

public static class RomanOrdinals
{
    /** Bounded at 100: above that a Roman numeral is a year or a regnal number, and the cardinal is right. */
    public static string? Ordinal(int n) => n >= 1 && n <= 100 ? Normalize.OrdinalOf(n) : null;

    /**
     * `быуат` (century) in the cases that occur, plus `быуаттарҙа` (plural locative) — and `б.` is NOT here,
     * because that abbreviation is *беҙҙең эра* in this corpus, not *быуат*. `съезд`-type event nouns are
     * left out: none occurs beside a Roman numeral in the retained text, and a trigger with no attested
     * instance is a misfire generator (trap 9).
     */
    private static readonly JsRe CONTEXT =
        JsRegex.Compile("^(быуат(та|тан|тың|ҡа|ты|тар|тарҙа|тарҙан|тарҙың)?)$", "iu");

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
