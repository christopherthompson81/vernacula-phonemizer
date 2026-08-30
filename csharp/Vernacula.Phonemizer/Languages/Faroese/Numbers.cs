/**
 * Faroese cardinal number → words — UNITS-FIRST with "og" fused into one word (einogtjúgu = 21), magnitude
 * groups above 100 chained with "og", on the shared units-first Germanic composer (the Danish module's,
 * which is language-neutral despite living there). Covers 0 … <10¹².
 * Ported from src/languages/faroese/numbers.ts — see that file for the sourcing and the judgment calls
 * (the decimal tens over the vigesimal layer; the neuter citation forms; the `ein-` compound one).
 */
using Vernacula.Phonemizer.Languages.Danish;

namespace Vernacula.Phonemizer.Languages.Faroese;

public static class Numbers
{
    private static UnitsFirstDef? DEF_;
    private static UnitsFirstDef DEF => DEF_ ??= new UnitsFirstDef
    {
        // 0–19 in the NEUTER counting series (eitt, tvey, trý; fýra upward is invariant).
        Ones = new[]
        {
            "null", "eitt", "tvey", "trý", "fýra", "fimm", "seks", "sjey", "átta", "níggju",
            "tíggju", "ellivu", "tólv", "trettan", "fjúrtan", "fimtan", "sekstan", "seytjan", "átjan", "nítjan",
        },
        // The modern DECIMAL tens.
        Tens = new[] { "", "", "tjúgu", "tríati", "fýrati", "fimmti", "seksti", "sjeyti", "áttati", "níti" },
        // In a tens compound the unit "one" is the base "ein-" (einogtjúgu), not the neuter "eitt".
        CompoundOnes = new[] { "", "ein" },
        Connector = (_, _) => "og", // einogtjúgu — invariant
        Hundred = new DanishOneWord { One = "eitt hundrað", Word = "hundrað" },
        Thousand = new DanishOneWord { One = "eitt túsund", Word = "túsund" },
        Million = new DanishOnePlural { One = "ein millión", Plural = "milliónir" },
        Billion = new DanishOnePlural { One = "ein milliard", Plural = "milliardir" },
        MulJoin = " ", // "tvey hundrað", "tólv túsund" — written open
        HundredRemJoin = " og ", // "fimm hundrað og fimmogfimmti"
        GroupJoin = " og ",
    };

    /** Non-negative integer (&lt; 10¹²) → Faroese words; larger / non-finite → digit-by-digit. `raw` is the
     *  TOKEN TEXT and must be threaded (#1059) — above 2^53 the double has already rounded. */
    public static string NumberToWords(double n, string? raw = null) =>
        UnitsFirstNumbers.UnitsFirstNumberToWords(n, DEF, raw);
}
