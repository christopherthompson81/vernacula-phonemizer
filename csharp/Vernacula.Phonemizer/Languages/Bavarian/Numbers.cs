/**
 * Bavarian cardinal number → words. Units-first and fused like German, but with the connector reduced from
 * ⟨und⟩ to a bare linking ⟨-a-⟩ (oanazwånzg = 21). The composition is the shared, language-neutral
 * units-first algorithm in Languages/Danish/UnitsFirstNumbers.cs.
 * Ported from src/languages/bavarian/numbers.ts — see that file for the provenance of every numeral and
 * the spelling-variant choices behind it.
 */
using Vernacula.Phonemizer.Languages.Danish;

namespace Vernacula.Phonemizer.Languages.Bavarian;

public static class Numbers
{
    private static BarNumbersDef N => Manifest.MANIFEST.Numbers;

    private static UnitsFirstDef? DEF_;
    private static UnitsFirstDef DEF => DEF_ ??= new UnitsFirstDef
    {
        Ones = N.Ones,
        Tens = N.Tens,
        CompoundOnes = N.CompoundOnes,
        Connector = (_, _) => N.Connector, // the reduced linker ⟨-a-⟩ — invariant
        Hundred = N.Hundred,
        Thousand = N.Thousand,
        Million = N.Million,
        Billion = N.Billion,
        // The multi-word spelling, not the German-style closed one: a closed *dreihundad would lose the ⟨h⟩
        // of hundad to the silent post-vocalic-h rule. Only 21–99 stays fused.
        MulJoin = " ",
        HundredRemJoin = " ",
        GroupJoin = " ",
    };

    /** Non-negative integer (&lt; 10¹²) → Bavarian words; larger / non-finite → digit-by-digit. `raw` is
     *  the TOKEN TEXT and must be threaded (#1080) — above 2^53 the double has already rounded. */
    public static string NumberToWords(double n, string? raw = null) =>
        UnitsFirstNumbers.UnitsFirstNumberToWords(n, DEF, raw);
}
