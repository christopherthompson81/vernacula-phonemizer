// A CASE-FOLDED CLASS MUST NOT REACH AN ABSENT TABLE ENTRY — the C# half of test/case-folded-lookup.test.ts.
//
// ⚠ THE C# FAILURE MODE IS WORSE THAN THE TS ONE, which is why this file exists separately. Under `/iu` JS
// folds U+017F LONG S onto `s` (and the Cyrillic historic `ᲀ ᲃ ᲅ` onto `в с т`), so a near-miss MATCHES an
// alternation built from a table's OWN keys while the key computed from the match is absent. The TypeScript
// asserted non-null and `String.replace` stringified the `undefined`, so the WORD was spoken; a .NET
// dictionary indexer THROWS, so `Phonemize` raised `KeyNotFoundException` for the whole caller (#1122).
//
// ⚠ AND THE TRIGGER IS ALREADY IN THIS TREE'S OWN DATA: `csharp/goldens/nci.tsv` carries `Caſtellana` and
// `Confeſsionario` in 16th-century book titles. The affected corpora write it zero times today, which is
// exactly why no corpus differential found it.
//
// ⚠ EVERY PROBE IS GENERATED FROM THE TABLE IT TESTS, not from a hand-picked trigger list — the first
// version of this file swept three characters into every shape, and two of them produced probes that
// matched nothing, so the callbacks under test were never entered and it passed vacuously.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class CaseFoldedLookupTests
{
    /** One row per confirmed site: a WELL-FORMED input, and the same input with one character replaced by a
     *  fold partner that the pattern will still match.
     *
     *  ⚠ `gd` AND `hil` ARE IN THE TS TEST AND NOT HERE — neither is ported to C# yet, so `Phonemize`
     *  raises `NotImplementedException` for them. Their TS half is covered in test/case-folded-lookup.test.ts. */
    public static TheoryData<string, string, string> Sites() => new()
    {
        { "es", "sr. García", "ſr. García" },
        { "pt", "sr. Silva", "ſr. Silva" },
        { "cs", "sv. Petr", "ſv. Petr" },
        { "ru", "тыс. руб", "тыᲃ. руб" },
        { "en", "vs. them", "vſ. them" },
        { "fr", "mlles. Dupont", "mlleſ. Dupont" },
        { "pl", "ds. tego", "dſ. tego" },
        { "id", "dsb. lain", "dſb. lain" },
        { "ceb", "mrs. Cruz", "mrſ. Cruz" },
        { "bs", "str. 5", "ſtr. 5" },
        { "nl", "drs. Jansen", "drſ. Jansen" },
        { "wo", "km&sup2 bi", "km&ſup2 bi" },
        { "qu", "km&sup2; bi", "km&ſup2; bi" },
        { "so", "12°S", "12°ſ" },
        { "su", "12°S", "12°ſ" },
        { "id", "12°S", "12°ſ" },
    };

    /** The folded near-miss neither throws nor speaks "undefined". */
    [Theory]
    [MemberData(nameof(Sites))]
    public void AFoldedNearMissIsRefused(string lang, string _wellFormed, string folded) =>
        Assert.DoesNotContain("undefined", Phonemizer.Phonemize(folded, lang), StringComparison.Ordinal);

    /** ⚠ AND THE WELL-FORMED NEIGHBOUR STILL EXPANDS — without this the guard could refuse EVERYTHING and
     *  every assertion above would still pass. The instrument is the difference between the two readings. */
    [Theory]
    [MemberData(nameof(Sites))]
    public void TheWellFormedNeighbourStillExpands(string lang, string wellFormed, string folded) =>
        Assert.NotEqual(Phonemizer.Phonemize(wellFormed, lang), Phonemizer.Phonemize(folded, lang));
}
