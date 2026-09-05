// The portable half of test/luganda.test.ts — Luganda / Oluganda (lg), Bantu (Great Lakes, JE15) over the
// Latin orthography. Tone is lexical, unwritten and DEFERRED, so the output is segmental.
//
// ⚠ THE REFEREE IS PARTLY CIRCULAR — epitran lug-Latn is the only machine referee and is itself rule-based
// (see the TS header and docs/investigations/lg/lg_native_bringup_investigation.md), so these goldens pin the
// segmental backbone rather than settling correctness. lg DOES have a FLEURS split (`lg_ug`), so
// PORTING.md's corpus-wide differential is available and was run — see docs/investigations/lg/lg_port_investigation.md.
using Vernacula.Phonemizer;
using LgEngine = Vernacula.Phonemizer.Languages.Luganda.LugandaPhonemizer;
using LgNormalize = Vernacula.Phonemizer.Languages.Luganda.Normalize;
using LgNumbers = Vernacula.Phonemizer.Languages.Luganda.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LugandaTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "lg").Trim();
    private static string Norm(string s) => LgNormalize.NormalizeLuganda(s);

    [Theory]
    // PRENASALISED consonants as units + vowel LENGTHENING before them.
    [InlineData("nga", "ᵑɡa")]
    [InlineData("buganda", "buɡaːⁿda")]
    [InlineData("omuntu", "omuːⁿtu")]
    [InlineData("enkima", "eːᵑkima")]
    // ⟨ng'⟩ → ŋ (velar nasal, distinct from ⟨ng⟩ → ᵑɡ); ⟨nny⟩ → ɲː
    [InlineData("ng'", "ŋ")]
    [InlineData("nng'", "ŋː")]
    [InlineData("nnyo", "ɲːo")]
    // GEMINATION (doubled → Cː) and prenasal + LABIALISATION (⟨ndw⟩ → ⁿdʷ)
    [InlineData("bbiri", "bːiɾi")]
    [InlineData("kitto", "kitːo")]
    [InlineData("ndwadde", "ⁿdʷadːe")]
    [InlineData("mwana", "mʷana")]
    [InlineData("luganda", "luɡaːⁿda")]
    [InlineData("era", "eɾa")]
    public void TheGreedyScan(string word, string want) => Assert.Equal(want, LgEngine.PhonemizeWord(word));

    // The literal letter ⟨ŋ⟩ (#1131), which the golden cannot see — csharp/goldens/lg.tsv carries 0 of them.
    // ⚠ ASSERTED THROUGH Phonemize, NOT PhonemizeWord: the TS defect lived in the gap between the two, where
    // the nativiser folded ŋ→n before the g2p ran. Pinning only the g2p would pass while the product was wrong.
    [Theory]
    [InlineData("ŋŋamba", "ŋːaːᵐba")]      // == nng'amba
    [InlineData("nng'amba", "ŋːaːᵐba")]
    [InlineData("ŋabo", "ŋabo")]           // == ng'abo
    [InlineData("ng'abo", "ŋabo")]
    [InlineData("ziseŋŋendo", "ziseŋːeːⁿdo")] // the FLEURS lg_ug line
    [InlineData("ŋka", "ᵑka")]             // ⟨ŋ⟩ prenasalises, as the ⟨n⟩ spelling does
    [InlineData("nka", "ᵑka")]
    [InlineData("ŋga", "ᵑɡa")]
    [InlineData("nga", "ᵑɡa")]
    [InlineData("Łódź", "lodz")]           // …and a genuinely foreign letter still folds
    public void TheVelarNasalLetter(string word, string want) => Assert.Equal(want, Say(word));

    // ⟨ŋ⟩ is NOT in `prenasalisable`, so ⟨ŋŋ⟩ falls through to the gemination rule rather than the trigger.
    [Fact]
    public void TheVelarNasalGeminates() => Assert.Equal("ŋː", LgEngine.PhonemizeWord("ŋŋ"));

    // U+0261 SCRIPT G reads exactly as ASCII ⟨g⟩ does. Two changes get there: the "defensive alias" deleted
    // from prenasalisable (data-side, shared tree), and the ɡ→g row in Core/HostWord's UNDECOMPOSABLE table,
    // which is what makes the letter READ rather than merely fail quietly.
    [Theory]
    [InlineData("n\u0261a", "ᵑɡa")]        // was ⁿa with the alias, na with it merely deleted
    [InlineData("an\u0261", "aːᵑɡ")]       // was aːⁿ — the alias's spurious length, and no consonant
    [InlineData("m\u0261a", "ᵑɡa")]
    [InlineData("lu\u0261anda", "luɡaːⁿda")]
    [InlineData("nga", "ᵑɡa")]             // the ASCII spelling, unchanged
    [InlineData("buganda", "buɡaːⁿda")]
    public void TheScriptGReadsAsAsciiG(string word, string want) => Assert.Equal(want, Say(word));

    // #1132/2 — the twelve unreachable prenasal digraph rows are deleted; the CODE rule is the single source.
    [Theory]
    [InlineData("mb", "ᵐb")] [InlineData("mp", "ᵐp")] [InlineData("mf", "ᵐf")] [InlineData("mv", "ᵐv")]
    [InlineData("nf", "ᵐf")] [InlineData("nv", "ᵐv")] [InlineData("nd", "ⁿd")] [InlineData("nt", "ⁿt")]
    [InlineData("nc", "ⁿc")] [InlineData("nj", "ⁿɟ")] [InlineData("nk", "ᵑk")] [InlineData("ng", "ᵑɡ")]
    public void TheCodeRuleHoldsTheTwelveMappings(string digraph, string ipa) =>
        Assert.Equal($"aː{ipa}a", LgEngine.PhonemizeWord($"a{digraph}a"));

    [Theory]
    // Units + the teens `na`/`n'` connective (elision before the vowel-initial emu).
    [InlineData(7, "musanvu")]
    [InlineData(10, "kkumi")]
    [InlineData(11, "kkumi n'emu")]
    [InlineData(12, "kkumi na bbiri")]
    // 20–50 are multiplicative amakumi + cl.6 a-; 60–90 are SINGLE nouns.
    [InlineData(20, "amakumi abiri")]
    [InlineData(50, "amakumi ataano")]
    [InlineData(60, "nkaaga")]
    [InlineData(90, "kyenda")]
    [InlineData(21, "amakumi abiri mu emu")]
    // Hundreds take their OWN bi- multiplier series.
    [InlineData(100, "kikumi")]
    [InlineData(122, "kikumi mu amakumi abiri mu bbiri")]
    [InlineData(222, "bikumi bibiri mu amakumi abiri mu bbiri")]
    // Thousands, millions, billions.
    [InlineData(1000, "lukumi")]
    [InlineData(2000, "nkumi bbiri")]
    [InlineData(1000000, "kakadde kamu")]
    [InlineData(1000000000, "akawumbi kamu")]
    public void TheCardinals(double n, string want) => Assert.Equal(want, LgNumbers.NumberToWords(n));

    [Theory]
    // Gemination + prenasal lengthening apply to numerals too.
    [InlineData("2", "bːiɾi")]
    [InlineData("60", "ᵑkaːɡa")]
    [InlineData("122", "kikumi mu amakumi abiɾi mu bːiɾi")]
    public void TheCardinalsEndToEnd(string text, string want) => Assert.Equal(want, Say(text));

    [Theory]
    // Thousands de-group in all three conventions this wiki writes.
    [InlineData("abantu 1,208,544 era", "abantu 1208544 era")]
    [InlineData("Obugazi: 1 244.7 km²", "Obugazi: kiromita eza kyebiriga 1244 7")]
    [InlineData("Helsinki esulwaamu abantu 570 074.", "Helsinki esulwaamu abantu 570074.")]
    [InlineData("200.000 Mitwalo abiri", "200000 Mitwalo abiri")]
    // ⚠ THE BRANCH THAT MUST NOT FIRE: an HDI figure is a decimal, not a period-grouped thousand.
    [InlineData("HDI ya 0.628 (omutono)", "HDI ya 0 6 2 8 (omutono)")]
    // A DIGIT LIST is not a number, and it is the whole of this corpus's `\d+,\d{1,2}`.
    [InlineData("digito satu (0,1, ne 2)", "digito satu (0,1, ne 2)")]
    public void TheGroupingConventions(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Ranges take `okutuuka mu` for a year pair and `okutuuka ku` for a quantity.
    [InlineData("olwa 1775–1783", "olwa 1775 okutuuka mu 1783")]
    [InlineData("Kilo 10-12", "Kilo 10 okutuuka ku 12")]
    [InlineData("wakati wa 25–31 °C", "wakati wa 25 okutuuka ku 31 °C")]
    // ⚠ THREE SHAPES THE ASCENDING GUARD DECLINES, each a real hazard in this corpus.
    [InlineData("bawangula Aizawl F.C. 4-1", "bawangula Aizawl F.C. 4-1")]
    [InlineData("mu 2008–09", "mu 2008–09")]
    [InlineData("(15. o'gwomunaana 1769-5. o'gwoogutaanu 1821)", "(15. o'gwomunaana 1769-5. o'gwoogutaanu 1821)")]
    // ⚠ AND TWO THE BIBLIOGRAPHY WOULD OTHERWISE HAND IT — the `/` and the trailing `-` guards.
    [InlineData("doi:10.1186/1742-4690-3-72", "doi:10 1 1 8 6/1742-4690-3-72")]
    [InlineData("ISBN 978-0-7817-6299-1", "ISBN 978-0-7817-6299-1")]
    // A range that ENDS A CLAUSE keeps its joiner, and the dot stays a sentence end (trap 58).
    [InlineData("wakati wa 0–1.", "wakati wa 0 okutuuka ku 1.")]
    [InlineData("olwa 1775–1783.", "olwa 1775 okutuuka mu 1783.")]
    // The COMMA is deliberately still rejected — this asserts the branch NOT taken.
    [InlineData("olwa 1775–1783, era", "olwa 1775–1783, era")]
    [InlineData("0.1–0.4 ha", "0 1–0 4 ha")]
    [InlineData("5–13.7 ha", "5 okutuuka ku 13 7 ha")]
    // The year arm reads the GROUPING, which is why ranges run ABOVE de-grouping.
    [InlineData("abantu 1,000-2,000 mu kibuga", "abantu 1000 okutuuka ku 2000 mu kibuga")]
    [InlineData("1,500–2,000 mmita", "1500 okutuuka ku 2000 mmita")]
    public void TheRanges(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Percent is postposed `ku kikumi`, and is not said twice.
    [InlineData("byaweebwa ebitundu 4.8%", "byaweebwa ebitundu 4 8 ku kikumi")]
    [InlineData("abantu nga 54.4% baali", "abantu nga 54 4 ku kikumi baali")]
    [InlineData("ebitundu 20–25%", "ebitundu 20 okutuuka ku 25 ku kikumi")]
    [InlineData("Abantu 75% ku kikumi", "Abantu 75 ku kikumi")]
    [InlineData("ebitundu 8 ku buli kikumi", "ebitundu 8 ku buli kikumi")]
    // ⚠ THE NEEDLE IS THE COLLOCATION — `kikumi` alone is this engine's own cardinal for 100.
    [InlineData("abantu kikumi mu ataano ne 25%", "abantu kikumi mu ataano ne 25 ku kikumi")]
    public void ThePercentReading(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // The currency noun PRECEDES its amount, and the redundancy guard is the majority case.
    [InlineData("ezitasukka $2.15 buli lunaku", "ezitasukka ddoola 2 1 5 buli lunaku")]
    [InlineData("ssente US$50,000 mu", "ssente ddoola 50000 mu")]
    [InlineData("($178k oba €134k)", "(ddoola 178k oba euro 134k)")]
    [InlineData("obukadde bwa ddoola US$29", "obukadde bwa ddoola 29")]
    [InlineData("n'asasulwa pawundi £30 buli wiiki", "n'asasulwa pawundi 30 buli wiiki")]
    // No shilling word is sourced, so the letters are left exactly as they were.
    [InlineData("obuwumbi bwa Uganda USh35", "obuwumbi bwa Uganda USh35")]
    [InlineData("Euro 134 oba €134", "Euro 134 oba 134")]
    public void TheCurrencyReadings(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Units are noun-FIRST, and the one-letter `m` key is narrowed on a real counter-example.
    [InlineData("obugulumivu bwa 10 cm", "obugulumivu bwa sentimita 10")]
    [InlineData("ekinnya sima 30cm", "ekinnya sima sentimita 30")]
    [InlineData("obwagagavu bwa 449 964 km²", "obwagagavu bwa kiromita eza kyebiriga 449964")]
    // The ASCII exponent is the worse of the two — it is a NUMBER, not a visible leak (trap 53).
    [InlineData("Ku 580,367 km2 (224,081 sq mi)", "Ku kiromita eza kyebiriga 580367 (224081 sq mi)")]
    [InlineData("(1.5kg)", "(kilo 1 5)")]
    [InlineData("ku buwanvu bwa 3,540 feet (1,079 m)", "ku buwanvu bwa 3540 feet (mmita 1079)")]
    // ⚠ THE COUNTER-EXAMPLE, AND IT IS IN THIS CORPUS: `1.5m` is ONE AND A HALF MILLION BIRDS.
    [InlineData("ebiwerera ddala akakadde kamu n'ekitundu (1.5m)", "ebiwerera ddala akakadde kamu n'ekitundu (1.5m)")]
    [InlineData("802.11m", "802.11m")]
    // No rate idiom is sourced, so the slash declines the whole match.
    [InlineData("ku misinde egya 299,792 km/s", "ku misinde egya 299792 km/s")]
    // A clause-final metre figure still reads — the `m` right guard carries no `.` or `,`.
    [InlineData("misinde egya 800 m.", "misinde egya mmita 800.")]
    [InlineData("yadduka 100 m, era", "yadduka mmita 100, era")]
    public void TheUnitReadings(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // ⚠ A GUARD NEEDLE IS WORD-BOUNDED — `kilo` must not match inside `kilometers`, or the `kg` is consumed
    // and NO unit noun is emitted: silent deletion, worse than the raw key it guarded against.
    [InlineData("kilometers 333 ne 5kg", "kilometers 333 ne kilo 5")]
    [InlineData("Kilo 10 ne 5kg", "Kilo 10 ne 5")]
    // ⚠ AND CASE-INSENSITIVE, AND IT KNOWS THE LONG-VOWEL SPELLINGS the maths textbook writes.
    [InlineData("Kiromita zaayo 1300 km", "Kiromita zaayo 1300")]
    [InlineData("kiromiita 20 ne 30 km", "kiromiita 20 ne 30")]
    public void TheTrapTwelveGuards(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Decimals lose the separator and keep every digit — there is no point word to insert.
    [InlineData("ogwa 4.2/10", "ogwa 4 2/10")]
    // ⚠ A SENTENCE-FINAL DECIMAL IS THIS CORPUS'S COMMONEST ONE — the trailing guard is `\.\d`, not `\.`.
    [InlineData("Obugazi: 600.2 km².", "Obugazi: kiromita eza kyebiriga 600 2.")]
    // A multi-dot run is a DATE or a designation, never a quantity.
    [InlineData("Anastacia (Chicago, 17.09.1968)", "Anastacia (Chicago, 17.09.1968)")]
    // The English ordinal suffix is stripped; Luganda spells its own ordinals as words.
    [InlineData("medicine (4th ed.)", "medicine (4 ed.)")]
    [InlineData("omulundi ogwokusatu", "omulundi ogwokusatu")]
    public void TheDecimalsAndTheOrdinalSuffix(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // ⚠ #1102 — a MARKED clock loses the separator's pause. The hour noun is written in front and is the
    // discriminator; the trailing markers catch the ones written without it.
    [InlineData("Awo kusaawa 11:29, okwekalakaasa", "Awo kusaawa 11 29, okwekalakaasa")]
    [InlineData("ku ssaawa 11:00, abeekalakaasi", "ku ssaawa 11 00, abeekalakaasi")]
    [InlineData("ku saawa 8:46 am zenyini", "ku saawa 8 46 am zenyini")]
    [InlineData("saawa 12.00 GMT", "saawa 12 00 GMT")]
    [InlineData("1:15 ezekiro kulwomukaag", "1 15 ezekiro kulwomukaag")]
    [InlineData("07:19 ez’okumakya", "07 19 ez’okumakya")]
    // ⚠ THE COUNTER-EXAMPLES ARE IN THIS CORPUS AND IN THE GOLDEN — none carries a marker.
    [InlineData("ne 802.11a", "ne 802.11a")]
    [InlineData("wa 06:30 ne 07:30.", "wa 06:30 ne 07:30.")]
    public void TheMarkedClock(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void TheMarkedClockDeclinesAMeasurementAndASkiResult()
    {
        Assert.Contains("3 5 0", Norm("bwa 3.50 m."), StringComparison.Ordinal);   // lg.tsv's own row
        Assert.Contains("4:41", Norm("akebanga 4:41.30"), StringComparison.Ordinal); // a ski result
    }

    [Theory]
    // End to end through the phonemizer. ⚠ THE REFUSALS, PINNED SO A LATER "FIX" HAS TO ARGUE WITH THEM: no
    // scale name is sourceable for `°C`, so the WHOLE match is declined rather than half of it (trap 53) —
    // and ⟨c⟩ is a real Luganda grapheme, so what survives is the palatal stop.
    [InlineData("25%", "amakumi abiɾi mu tːaːno ku kikumi")]
    [InlineData("5 km²", "kiɾomita eza kjebiɾiɡa tːaːno")]
    [InlineData("20 °C", "amakumi abiɾi c")]
    [InlineData("2.15", "bːiɾi emu tːaːno")]
    public void EndToEnd(string text, string want) => Assert.Equal(want, Say(text));
}
