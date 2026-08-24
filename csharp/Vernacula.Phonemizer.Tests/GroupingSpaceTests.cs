/**
 * Digit-GROUPING SEPARATOR fidelity: the invisible space characters a language's degrouping rule accepts.
 *
 * ⚠ THESE CHARACTERS ARE INVISIBLE IN SOURCE, WHICH IS EXACTLY WHY THEY NEED A TEST. French typography groups
 * thousands with NBSP / narrow NBSP / thin space, and each engine's normalize declares a character class holding
 * the literal characters. Retyping such a class silently collapses it to plain spaces — the class still compiles,
 * still matches the ordinary-space form every golden happens to use, and quietly stops matching the real
 * typography. It reached SIX languages before an audit caught it: fr degrouped `1 040` (NBSP) to *un quarante*
 * instead of *mille quarante*, and es/en/ru/bg/oc/ast/qu carried the same latent break with no failing row.
 *
 * ⚠ THE CLASSES ARE DELIBERATELY NOT UNIFORM, so this pins each language to ITS OWN declared set rather than to a
 * fleet-wide ideal: bg accepts space+NBSP+NNBSP but not thin space, and en/qu accept only space+NBSP. Widening
 * them here would be a language-data change, made against that language's corpus, not a test fix.
 *
 * The invariant is behavioural: where a separator IS accepted, the grouped number must read exactly as the
 * unspaced number does. Both sides of every row were verified against the TypeScript engine.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class GroupingSpaceTests
{
    private const string Nbsp = " ";
    private const string Nnbsp = " ";
    private const string Thin = " ";

    public static TheoryData<string, string, bool> Cases()
    {
        var d = new TheoryData<string, string, bool>();
        // language, separator, does its declared class accept the separator?
        foreach (var lang in new[] { "fr", "es", "ru", "pt", "oc", "ast" })
            foreach (var sep in new[] { Nbsp, Nnbsp, Thin })
                d.Add(lang, sep, true);
        d.Add("bg", Nbsp, true);
        d.Add("bg", Nnbsp, true);
        d.Add("bg", Thin, false); // bg declares [space, NBSP, NNBSP] only
        d.Add("qu", Nbsp, true);
        d.Add("qu", Nnbsp, false); // qu declares [space, NBSP] only
        d.Add("qu", Thin, false);
        d.Add("en", Nbsp, true);
        d.Add("en", Nnbsp, false); // en's SPACE_GROUP matcher declares [space, NBSP] only
        d.Add("en", Thin, false);
        return d;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void GroupedNumberReadsAsUnspaced(string lang, string sep, bool accepted)
    {
        var grouped = Phonemizer.Phonemize($"5{sep}000", lang);
        var plain = Phonemizer.Phonemize("5000", lang);
        if (accepted)
            Assert.Equal(plain, grouped);
        else
            Assert.NotEqual(plain, grouped); // pins the narrower class: widening it is a data change, not a test fix
    }
}
