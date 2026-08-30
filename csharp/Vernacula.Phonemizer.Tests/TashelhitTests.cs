/**
 * The portable half of test/tashelhit.test.ts — Tashelhit / Shilha (shi), a Berber (Amazigh) language of SW
 * Morocco. A near-1:1 phonemic converter over BOTH community scripts: the Berber Latin alphabet and
 * Neo-Tifinagh, which yield IDENTICAL IPA. Emphatics (dot-below) ḍ→dˤ, pharyngeals ḥ→ħ / ɛ→ʕ, uvulars,
 * ⟨c⟩→ʃ; labialisation C+ʷ→Cʷ; gemination (doubling)→Cː.
 *
 * ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). Where a branch the corpus does not
 * exercise exists — `m³`, `km/h`, `802.11m`, an upper-case unit key — it is pinned with a case the corpus
 * does NOT contain, because that is the half no corpus diff can reach.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;
using ShiEngine = Vernacula.Phonemizer.Languages.Tashelhit.TashelhitPhonemizer;
using ShiNormalize = Vernacula.Phonemizer.Languages.Tashelhit.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class TashelhitTests
{
    private static readonly JsRe WS = JsRegex.Compile("\\s+", "gu");
    private static string Word(string s) => ShiEngine.PhonemizeWord(s);
    private static string N(string s) => ShiNormalize.NormalizeTashelhit(s);
    private static string Say(string s) => Js.Trim(WS.Replace(Phonemizer.Phonemize(s, "shi"), " "));

    [Theory]
    // Emphatics (pharyngealised, dot-below), pharyngeals, uvulars.
    [InlineData("aḍaṛ", "adˤarˤ")]        // ⟨ḍ⟩→dˤ, ⟨ṛ⟩→rˤ ("foot/leg")
    [InlineData("Taclḥit", "taʃlħit")]    // ⟨c⟩→ʃ, ⟨ḥ⟩→ħ (the endonym)
    [InlineData("amaziɣ", "amaziɣ")]
    [InlineData("aɣrum", "aɣrum")]        // ("bread")
    public void EmphaticsPharyngealsUvulars(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Gemination (doubling) → a long consonant [Cː], including emphatic and labialised geminates.
    [InlineData("azz", "azː")]
    [InlineData("abaṭṭaḥ", "abatˤːaħ")]   // ⟨ṭṭ⟩ emphatic geminate → tˤː
    [InlineData("aggʷrn", "aɡʷːrn")]      // ⟨ggʷ⟩ labialised geminate → ɡʷː
    [InlineData("akkʷ", "akʷː")]
    public void Gemination(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("awal", "awal")]
    [InlineData("tamdint", "tamdint")]
    public void LabialisationAndTheRest(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void ClauseAssembly() => Assert.Equal("taʃlħit d awal amaziɣ .", Say("Taclḥit d awal amaziɣ."));

    /** ⚠ NFD INPUT: the tokenizer must NFC-normalize, else the combining dot-below shatters the word and the
     *  emphatics are dropped — "ad ar" instead of "adˤarˤ". */
    [Fact]
    public void TheTextPathHandlesNfdInput() =>
        Assert.Equal("adˤarˤ", Js.Trim(Phonemizer.Phonemize("aḍaṛ".Normalize(System.Text.NormalizationForm.FormD), "shi")));

    [Theory]
    // Neo-Tifinagh (Morocco's official IRCAM script) is a phonemic alphabet → same phonology, same IPA.
    [InlineData("ⵜⴰⵛⵍⵃⵉⵜ", "taʃlħit")]   // = Taclḥit (the endonym)
    [InlineData("ⴰⴹⴰⵕ", "adˤarˤ")]        // = aḍaṛ (emphatics ⴹ→dˤ, ⵕ→rˤ)
    [InlineData("ⴰⵎⴰⵣⵉⵖ", "amaziɣ")]
    public void TheTifinaghFrontEnd(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void TifinaghEqualsLatin()
    {
        Assert.Equal(Word("Taclḥit"), Word("ⵜⴰⵛⵍⵃⵉⵜ"));
        Assert.Equal("taʃlħit d awal", Say("ⵜⴰⵛⵍⵃⵉⵜ ⴷ ⴰⵡⴰⵍ"));
    }

    // ── CARDINALS: Moroccan Arabic loans with NATIVE Berber kept for 1–3 ─────────────────────────────
    [Theory]
    [InlineData("1", "jan")]                    // yan — NATIVE Berber (never `waḥd` standalone)
    [InlineData("3", "kradˤ")]                  // kraḍ — NATIVE; the cut-off
    [InlineData("4", "rbʕa")]                   // rbɛa — Arabic from here up
    [InlineData("11", "ħdaʃ")]
    [InlineData("20", "ʕʃrin")]                 // ɛcrin — a loan with NO native competitor at all
    // Inside a tens compound the sources give Arabic waḥd/tnayn for 1/2; 3 keeps native kraḍ, because no
    // free Arabic form for 3 is attested and synthesising `tlata` would be inventing a numeral.
    [InlineData("21", "waħd u ʕʃrin")]          // UNITS-FIRST
    [InlineData("33", "kradˤ u tlatin")]        // the documented hybrid seam
    [InlineData("45", "χmsa u rbʕin")]
    public void CardinalsNativeOneToThreeThenArabic(string digits, string want) => Assert.Equal(want, Say(digits));

    [Theory]
    [InlineData("0", "sˤifr")]                  // ṣifr (the IRCAM neologism `amya` is NOT generated)
    [InlineData("100", "mja")]
    [InlineData("200", "mjatajn")]              // myatayn — the DUAL
    [InlineData("345", "tlt mja u χmsa u rbʕin")]
    [InlineData("1000", "alf")]
    [InlineData("2000", "alfajn")]              // alfayn — the DUAL
    [InlineData("3000", "tlt alaf")]            // 3–10 takes the PLURAL alaf
    [InlineData("12345", "tnaʃ alf u tlt mja u χmsa u rbʕin")] // 11+ → SINGULAR alf again
    [InlineData("1000000", "mljun")]
    public void CardinalsDualsAndTheCountTriggeredPlural(string digits, string want) => Assert.Equal(want, Say(digits));

    /** Arabic-Indic digits ٠-٩ are accepted too, since Moroccan text mixes them with 0-9. */
    [Fact]
    public void ArabicIndicDigitsRead() => Assert.Equal("χmsa u rbʕin", Say("٤٥"));

    // ── TEXT NORMALIZATION ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void DeGroupingAllFourSeparators()
    {
        // The period is unambiguous in this corpus: 16/16 three-digit-block instances are GROUPING.
        Assert.Equal("510072000 kilumitr amkkuẓ", N("510.072.000 km²"));
        Assert.Equal("15000 n ufgan", N("15.000 n ufgan"));
        Assert.Equal("8000 kilumitr (5000 mil)", N("8,000 kilumitr (5,000 mil)"));
        Assert.Equal("85133000 kilumitr amkkuẓ", N("85,133,000 km2"));
        // SPACE grouping — `1 470 m` used to read as TWO numbers with a raw `m`.
        Assert.Equal("ɣ jat tatːujt n alf u rbʕ mja u sbʕin mitru", Say("ɣ yat tattuyt n 1 470 m"));
        // U+066C, the Arabic thousands separator the corpus writes beside Arabic-Indic digits.
        Assert.Equal("106710325", N("106٬710٬325"));
        // ⚠ AND A 1–2-DIGIT TAIL IS A DECIMAL, NOT A GROUP, on either mark — the other side of the same rule.
        Assert.Equal("37 4", N("37.4"));
        Assert.Equal("17 9", N("17,9"));
        // ⚠ THE `%` LOOKAHEAD IS THE ONE EXCEPTION, and it buys back the corpus's `99,854 %` (a decimal).
        Assert.Equal("99 8 5 4 %", N("99,854 %"));
    }

    /** The separator is SPENT, not read as a pause — the defect repaired is prosodic. No decimal-point word
     *  is shipped, so the fraction is read one digit at a time. */
    [Fact]
    public void Decimals()
    {
        Assert.Equal("sbʕa u tlatin rbʕa", Say("37.4"));
        Assert.Equal("kradˤ jan rbʕa", Say("3,14"));
        // ⚠ THE TRAILING GUARD MUST EXCLUDE A SEPARATOR+DIGIT, NOT A CLAUSE MARK.
        Assert.Equal("π≈3 1 4, π≈22/7", N("π≈3,14, π≈22/7"));
    }

    [Fact]
    public void Units()
    {
        Assert.Equal("tmn alaf u stː mja u χmsa u stːin kilumitr amkːuzˤ", Say("8665 km²"));
        Assert.Equal("χmsa kiluɡram", Say("5 kg"));
        Assert.Equal("sˤifr χmsa milimitr", Say("0.5 mm"));
        Assert.Equal("24 santim", N("24 cm"));
        Assert.Equal("450 gram", N("450 gram"));   // already a word — the rule must not double it
        // ⚠ BRANCHES THE CORPUS DOES NOT EXERCISE. The rate keys are compound KEYS, not compositions
        // (trap 44): shi's "per" is the locative `ɣ` plus a time noun, not "A per B".
        Assert.Equal("120 kilumitr ɣ tasragt", N("120 km/h"));
        Assert.Equal("30 kilumitr ɣ tsnat", N("30 km/s"));
        Assert.Equal("24 3 mitr mukaɛɛab ɣ tsnat", N("24.3 m³/s"));
        Assert.Equal("60000 mitr amkkuẓ", N("60000 m²"));
        // ⚠ CASE-INSENSITIVE, measured: the corpus writes `91,982 Km²` and `180.000Km²` with a capital K.
        Assert.Equal("91982 kilumitr amkkuẓ", N("91,982 Km²"));
        // ⚠ A MAGNITUDE MAY STAND BETWEEN THE FIGURE AND ITS UNIT and is hopped, not consumed.
        Assert.Equal("2 1 5 id mlyun kilumitr amkkuẓ", N("2.15 id mlyun km²"));
    }

    /** ⚠ TRAP 46: a one-letter key must not claim a dotted designation. A leading `(?<![\d.,])` alone does
     *  NOT stop this — rejected at `802`, the engine retries from the FRACTIONAL part and matches `11m`. */
    [Theory]
    [InlineData("802.11m", "802 1 1m")]   // the letter stays raw — a designation, not a measurement
    [InlineData("4000m", "4000 mitru")]   // …while the glued genuine metre still reads
    [InlineData("12.5 km", "12 5 kilumitr")]
    public void AOneLetterKeyMustNotClaimADottedDesignation(string input, string want) => Assert.Equal(want, N(input));

    /** ⟨C⟩ was being read as the shi grapheme c = /ʃ/, which is worse than a drop. */
    [Fact]
    public void Degrees()
    {
        Assert.Equal("ʕʃrin taskflt n silsjus", Say("20°C"));
        Assert.Equal("tsʕtaʃ n tskflt d kradˤ u ʕʃrin n tskflt ɣ uzal", Say("19° d 23° ɣ uzal"));
        // ⚠ TRAP 12: the corpus writes the scale name GLUED to the sign, so the word must not be doubled.
        Assert.Equal("-45 taskflt n Silsyus", N("-45°Silsyus"));
        // ⚠ AND THE BARE `°` IS DECLINED WHERE IT IS A COORDINATE — the right context is the discriminator.
        Assert.Equal("31° 57′ 51″ N", N("31° 57′ 51″ N"));
        Assert.Equal("7° Ouest", N("7° Ouest"));
    }

    /** The corpus glosses its own abbreviation, and this rule expands what the AUTHOR wrote — it does not
     *  adjudicate the century. */
    [Fact]
    public void EraMarkers()
    {
        Assert.Equal("mja u tmnja u rbʕin dat ʕisa .", Say("148 D.Ɛ."));
        Assert.Equal("1980 ḍarat tlalit. G izwar", N("1980 Ḍ.T. G izwar"));
        // ⚠ THE FINAL DOT SURVIVES ONLY WHEN THE SENTENCE ENDS.
        Assert.Equal("179 dat tlalit yat tdri", N("179 D.T. yat tdri"));
        // ⚠ THE MARKER IS ALSO WRITTEN WITHOUT ITS FINAL DOT — looking for one form finds half the instances.
        Assert.Equal("238 dat Ɛisa immt", N("238 D.Ɛ immt"));
        // ⚠ `b.ɛ` GETS NO ERA PHRASE (its initials compose from nothing attested), only the pause repair.
        Assert.Equal("632 bɛ.", N("632 b.ɛ."));
    }

    [Fact]
    public void Currency()
    {
        Assert.Equal("sbʕa u rbʕin alf u mjatajn u kradˤ dularˤ", Say("$47,203"));
        Assert.Equal("638186 uṛu", N("€ 638186"));
        // ⚠ TRAP 12: the corpus's own `€3 id mlyun n Wuṛu` already names the currency.
        Assert.Equal("3 id mlyun n Wuṛu", N("€3 id mlyun n Wuṛu"));
        // ¥ and £ are one instance each with no attested shi word, so they stay unclaimed.
        Assert.Equal("¥ 106710325", N("¥ 106710325"));
    }

    [Fact]
    public void OrdinaryTextAndARealSentenceEndSurvive()
    {
        Assert.Equal("taʃlħit d awal amaziɣ .", Say("Taclḥit d awal amaziɣ."));
        // Nothing in this layer keys on a Tifinagh character, so the Tifinagh path is untouched.
        Assert.Equal("taʃlħit d awal", Say("ⵜⴰⵛⵍⵃⵉⵜ ⴷ ⴰⵡⴰⵍ"));
        // A run in a script the engine does not claim is ROUTED, not deleted.
        Assert.Equal("s tʕrabt , mħmd", Say("(s tɛrabt: محمد)"));
    }

    /**
     * ⚠ THE REASON THIS PORT EXISTS (#1196). Tifinagh routes to `shi` (Scripts.cs), so while the engine was
     * unported EVERY C# language silently DROPPED a Tifinagh run where the TypeScript read it — invisible to
     * the parity gate, because no golden row in any language carries a Tifinagh character. These assert the
     * run is read, in languages that have nothing to do with Berber.
     */
    [Theory]
    [InlineData("ga", "ˈan̪ˠ w l̪ˠˈɑː")]
    [InlineData("gl", "ˈaŋ w lˈa")]
    [InlineData("ee", "an w la")]
    [InlineData("en", "æn w lˈɑː")]
    [InlineData("is", "ˈan w lˈau")]
    public void ATifinaghRunIsReadInEveryLanguage(string code, string want) =>
        Assert.Equal(want, Js.Trim(WS.Replace(Phonemizer.Phonemize("an ⵡ lá", code), " ")));
}
