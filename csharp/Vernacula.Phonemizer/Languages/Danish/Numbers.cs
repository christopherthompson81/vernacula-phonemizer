/**
 * Danish cardinal number → words. Danish is the fleet's VIGESIMAL (base-20) outlier above 40 and
 * units-first with "og" (enogtyve = 21); the arithmetic is lexicalised in danish.jsonc's tens table and the
 * composition is the shared units-first Germanic algorithm.
 * Ported from src/languages/danish/numbers.ts — see that file for the sourcing and the corpus evidence.
 */
namespace Vernacula.Phonemizer.Languages.Danish;

public static class Numbers
{
    private static DanishNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string OG => $" {N.Connector} ";

    private static UnitsFirstDef? DEF_;
    private static UnitsFirstDef DEF => DEF_ ??= new UnitsFirstDef
    {
        Ones = N.Ones,
        Tens = N.Tens,
        Connector = (_, _) => N.Connector, // enogtyve — no sandhi, "og" is invariant in Danish compounds
        Hundred = N.Hundred,
        Thousand = N.Thousand,
        Million = N.Million,
        Billion = N.Billion,
        MulJoin = " ",
        HundredRemJoin = OG,
        GroupJoin = OG,
    };

    /** Non-negative integer (&lt; 10¹²) → Danish words; larger / non-finite → digit-by-digit. `raw` is the
     *  TOKEN TEXT and must be threaded (#1059) — above 2^53 the double has already rounded. */
    public static string NumberToWords(double n, string? raw = null) =>
        UnitsFirstNumbers.UnitsFirstNumberToWords(n, DEF, raw);
}
