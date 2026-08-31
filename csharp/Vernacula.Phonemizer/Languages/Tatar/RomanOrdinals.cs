/**
 * Tatar Roman-numeral reading. A century is an ORDINAL: `XX гасыр` is *егерменче гасыр*; the shared
 * cardinal pass gives *егерме гасыр*, which means "twenty centuries". ⚠ THIS POLICY IS NOT INFERRED —
 * tt.wikipedia spells the reading out in the title of every century article ("XL (кырыгынчы) гасыр"),
 * which also confirms the ⟨к⟩→⟨г⟩ lenition Normalize.cs derives.
 *
 * ⚠ NO SEPARATE ORDINAL TABLE. Turkic ordinal formation is regular and Normalize.cs already derives it
 * from vowel harmony, so this file calls that function rather than authoring a second copy — one
 * derivation, one place it can be wrong. And there is no GENDER to get wrong, the limitation ru/uk/be
 * each have to record; the remaining one is CASE, and the ordinal is emitted uninflected while the noun
 * keeps whatever ending the writer typed — the right division of labour, since only the last element of
 * a Turkic noun phrase takes the case ending and that element is the noun.
 * Ported from src/languages/tatar/romanOrdinals.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tatar;

public static class RomanOrdinals
{
    /** Bounded at 100: above that a Roman numeral is a year or a regnal number, and the cardinal is right. */
    public static string? Ordinal(int n) => n >= 1 && n <= 100 ? Normalize.OrdinalOf(n) : null;

    /**
     * `гасыр` (century) in the cases the corpus writes, plus `йөзьеллык`, the native synonym its own
     * article gives. ⚠ Russian `век` is NOT here even though the retained text contains it: every
     * instance is inside a Russian-language citation, where a Tatar ordinal would be the wrong language.
     * A regnal number takes the CARDINAL and is left to the shared pass.
     */
    private static readonly JsRe CONTEXT = JsRegex.Compile(
        "^(гасыр(да|дан|ның|га|ны|лар|ларда|лардан|ларның)?|йөз[ьъ]еллык(та|тан|ның|ка)?)$", "iu");

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
