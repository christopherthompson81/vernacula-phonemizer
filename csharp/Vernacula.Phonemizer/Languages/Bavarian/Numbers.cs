/**
 * Bavarian cardinal number → words. Units-FIRST and fused like German, but with the connector reduced from
 * ⟨und⟩ to a bare linking ⟨-a-⟩: oanazwånzg = 21, fimfazwånzg = 25. The composition is the shared
 * units-first Germanic algorithm — see Languages/Danish/UnitsFirstNumbers.cs (housed in the Danish
 * directory only because that is where the TS put it; it is language-neutral). Covers 0 … <10¹².
 * Ported from src/languages/bavarian/numbers.ts — see that file for the provenance of every numeral and
 * for the spelling-variant choices (Bavarian has no codified orthography, so each had 2–4 attested forms).
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
        // Bavarian has no codified orthography, so the multi-word spelling ("drei hundad fimfafiazg") is
        // chosen over the German-style closed one. Two reasons: nothing standardises the closed form here,
        // and the closed form walks straight into a compound-boundary artifact — Bavarian's post-vocalic
        // ⟨h⟩ is a silent length marker, so *dreihundad scans as [d̥rɑɛ̯undɑd̥] with the ⟨h⟩ of hundad
        // swallowed. Only 21–99 stays fused (oanazwånzg), where the source's spellings are unambiguous.
        MulJoin = " ",
        HundredRemJoin = " ",
        GroupJoin = " ",
    };

    /** Non-negative integer (&lt; 10¹²) → Bavarian words; larger / non-finite → digit-by-digit. `raw` is
     *  the TOKEN TEXT and must be threaded (#1080) — above 2^53 the double has already rounded. */
    public static string NumberToWords(double n, string? raw = null) =>
        UnitsFirstNumbers.UnitsFirstNumberToWords(n, DEF, raw);
}
