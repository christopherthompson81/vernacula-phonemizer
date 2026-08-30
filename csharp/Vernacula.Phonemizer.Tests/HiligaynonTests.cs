/**
 * The portable half of test/hiligaynon.test.ts — Hiligaynon / Ilonggo (hil), Austronesian (Western
 * Bisayan), near-phonemic. A shallow rule g2p (the Cebuano/Tagalog pattern); the deltas from Cebuano
 * are the Spanish-loan letters ⟨j⟩→[h] and ⟨f⟩→[p]. Native cardinal numbers, tens-first with the
 * "kag" connector and the "ka" ligature before a magnitude.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Hiligaynon;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class HiligaynonTests
{
    private static string Word(string s) => HiligaynonPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "hil").Trim();

    [Theory]
    // Glottal stops: word-initial + hiatus; ⟨ng⟩→ŋ; ⟨ay⟩ glide.
    [InlineData("anak", "ʔˈanak")]    // word-initial glottal onset
    [InlineData("daan", "dˈaʔan")]    // hiatus glottal between the two a's
    [InlineData("mango", "mˈaŋo")]    // ⟨ng⟩→ŋ (word-final glottal [maŋoʔ] deferred)
    [InlineData("balay", "bˈalaj")]   // ⟨ay⟩ glide → aj
    public void GlottalStopsAndTheNasal(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The Spanish-loan deltas from Cebuano.
    [InlineData("Bermejo", "beɾmˈeho")]     // ⟨j⟩ → h (Spanish jota, NOT Cebuano's d͡ʒ)
    [InlineData("Demafeliz", "demapˈelis")] // ⟨f⟩ → p (nativised), ⟨z⟩ → s
    public void TheSpanishLoanDeltas(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Native vocabulary (the Cebuano core).
    [InlineData("kalibutan", "kalibˈutan")] // "world" — plain CV
    [InlineData("ginhawa", "ɡinhˈawa")]     // "breath/ease"
    public void NativeVocabulary(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void RegistryWiring() => Assert.Equal("kalibˈutan", Say("kalibutan"));

    [Theory]
    // Units and the irregular ka-…-an tens.
    [InlineData(0, "sˈeɾo")]             // sero (Spanish loan; no native numeral for zero)
    [InlineData(5, "lˈima")]             // lima
    [InlineData(20, "kaluhˈaʔan")]       // kaluhaan (hiatus glottal)
    [InlineData(40, "kapʔˈatan")]        // kap-atan (hyphen → glottal)
    // Compounds 11-99 join tens-first with kag.
    [InlineData(11, "napˈulo kˈaɡ ʔˈisa")]
    [InlineData(25, "kaluhˈaʔan kˈaɡ lˈima")]
    [InlineData(99, "kasijˈaman kˈaɡ sˈijam")]
    // Hundreds / thousands / millions take the ka ligature.
    [InlineData(100, "ʔˈisa kˈa ɡˈatos")]
    [InlineData(555, "lˈima kˈa ɡˈatos kˈaɡ kalˈimʔan kˈaɡ lˈima")]
    [InlineData(1000, "ʔˈisa kˈa lˈibo")]
    [InlineData(1000000, "ʔˈisa kˈa mˈiljon")]
    public void CardinalNumbers(double n, string want) => Assert.Equal(want, Say(n.ToString()));

    [Fact]
    public void TheNativeSeriesTopsOutAtMilyon() =>
        Assert.Equal(10, Say("1000000000").Split(' ').Length); // isa sero sero … (documented fallback)

    [Theory]
    // De-grouping and the decimal point — the two rules that carry the bulk of the layer.
    [InlineData("populasyon nga 14,473",
        "populˈasjon ŋˈa napˈulo kˈaɡ ʔˈapat kˈa lˈibo kˈaɡ ʔˈapat kˈa ɡˈatos kˈaɡ kapitˈuʔan kˈaɡ tˈatlo")]
    [InlineData("May 302.18 kilometro",
        "mˈaj tˈatlo kˈa ɡˈatos kˈaɡ dˈuha pˈunto ʔˈisa wˈalo kilomˈetɾo")]
    // Both at once, in that order: the de-grouping guard has to let a group through when its decimal point follows.
    [InlineData("1,821.42",
        "ʔˈisa kˈa lˈibo kˈaɡ wˈalo kˈa ɡˈatos kˈaɡ kaluhˈaʔan kˈaɡ ʔˈisa pˈunto ʔˈapat dˈuha")]
    public void DeGroupingAndTheDecimalPoint(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // THE PERIOD-THOUSANDS INSTANCE MUST NOT BE READ AS A DECIMAL: the two-fractional-digit cap refuses it.
    public void ThePeriodThousandsFormIsNotADecimal() => Assert.DoesNotContain("pˈunto", Say("17.865 ka pumuluyo"));

    [Theory]
    [InlineData("1910-1912",
        "ʔˈisa kˈa lˈibo kˈaɡ sˈijam kˈa ɡˈatos kˈaɡ napˈulo hˈasta ʔˈisa kˈa lˈibo kˈaɡ sˈijam kˈa ɡˈatos kˈaɡ napˈulo kˈaɡ dˈuha")]
    // THE BRANCH THE ORDERING EXISTS FOR: the range rule runs ABOVE the decimal rule so its operands are
    // still whole. Reversed, this reads `5 hasta 3` — a backwards span inside a number.
    [InlineData("3.5–3.8 bilyon", "tˈatlo pˈunto lˈima hˈasta tˈatlo pˈunto wˈalo bˈiljon")]
    public void RangesReadHastaWithDecimalOperands(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    public void AConnectiveTheTextAlreadyWroteIsNotDoubled() => Assert.DoesNotContain("hˈasta hˈasta", Say("2016 hasta 2022"));

    [Theory]
    [InlineData("59%", "kalˈimʔan kˈaɡ sˈijam poɾsijˈento")]  // the sign was DROPPED outright
    [InlineData("₱5", "lˈima pˈiso")]                        // the only currency sign in the corpus; `$` is declined
    [InlineData("12,706 km²",
        "napˈulo kˈaɡ dˈuha kˈa lˈibo kˈaɡ pˈito kˈa ɡˈatos kˈaɡ ʔˈanum kilomˈetɾo kwadɾˈado")]
    // The ASCII exponent — it used to read the `2` as the NUMBER two.
    [InlineData("949 km2", "sˈijam kˈa ɡˈatos kˈaɡ kapʔˈatan kˈaɡ sˈijam kilomˈetɾo kwadɾˈado")]
    [InlineData("120 km/h", "ʔˈisa kˈa ɡˈatos kˈaɡ kaluhˈaʔan kilomˈetɾo kˈada ʔˈoɾas")]
    public void TheSymbolTier(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // TRAP 46, PINNED: bare `m` is a declared one-letter unit key, so a dotted designation could read as
    // metres — and the tier's NOT_VERSION guard only works because the tier runs ABOVE the decimal rule.
    public void TheVersionDesignationIsNotMetres() => Assert.DoesNotContain("mˈetɾo", Say("802.11m"));

    [Theory]
    [InlineData("sa alas-5:00 sang aga", "sˈa ʔˈalas lˈima sˈaŋ ʔˈaɡa")]
    [InlineData("alas 9:30", "ʔˈalas sˈijam kˈaɡ katlˈoʔan")] // minutes join with `kag`
    public void TheClockIsGuardedOnAlas(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // THE ADVERSARY: `ISO 20715:2023` is the corpus's other colon shape — an unguarded clock rule would
    // match `15:20` inside it. The bare colon is deliberately left as clause punctuation.
    public void TheStandardNumberIsStillAPause() => Assert.Contains(",", Say("ISO 20715:2023"));

    [Theory]
    // A CLOSED LIST, never a shape: `Panay.` ×8 is a SENTENCE END.
    [InlineData("Dr. Jose", "dˈoktoɾ hˈose")]  // was *dɾ* plus a phrase break
    [InlineData("Fr. Tomas", "pˈadɾe tˈomas")] // ⟨f⟩→[p], so the bare form is the cluster [pɾ]
    public void DottedAbbreviations(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    public void AGenuineSentenceEndSurvivesUntouched() => Assert.Equal("pˈanaj .", Say("Panay."));

    [Theory]
    // THE SEAM THAT ALREADY WORKED IS LEFT ALONE: ⟨ika-⟩ is an ordinary ordinal prefix, so the bare form
    // needed no rule. Pinned so it stays that way.
    [InlineData("ika-19 nga siglo", "ʔˈika napˈulo kˈaɡ sˈijam ŋˈa sˈiɡlo")]
    // TRAP 14/15: the linker glued to the DIGITS cannot become a word, so it is detached into `nga`.
    [InlineData("ika-5ng Gobernador", "ʔˈika lˈima ŋˈa ɡobeɾnˈadoɾ")]
    public void TheOrdinals(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // Ordinary Hiligaynon text is untouched by every rule above.
    [InlineData("Ang kada barangay may mga purok kag ang iban",
        "ʔˈaŋ kˈada baɾˈaŋaj mˈaj mˈaŋa pˈuɾok kˈaɡ ʔˈaŋ ʔˈiban")]
    // `tunga` MUST STILL BE THE PREPOSITION — which is why no fraction rule ships at all.
    [InlineData("sa tunga sang mga atomo", "sˈa tˈuŋa sˈaŋ mˈaŋa ʔatˈomo")]
    public void OrdinaryTextIsUntouched(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // `sg` reads as `sang`, in every slot the corpus writes it in.
    public void TheGenitiveShorthand() =>
        Assert.Equal(Say("Republika sang Pilipinas"), Say("Republika sg Pilipinas"));

    [Fact]
    public void TheGenitiveShorthandWired() =>
        Assert.Equal("pˈila kˈa mˈaŋa paktˈoɾja sˈaŋ pˈanit", Say("Pila ka mga paktorya sg panit"));

    [Fact]
    public void TheGenitiveShorthandInTheOfSlot() => Assert.Contains("sˈaŋ", Say("sa edad sg 25 años"));

    [Theory]
    // The collisions that make the rule LOWER CASE AND BOUNDED.
    [InlineData("zh-sg:814")]
    [InlineData("http://a.sg/x")]
    public void TheShorthandDeclinesItsCollisions(string input) => Assert.DoesNotContain("sˈaŋ", Say(input));
}
