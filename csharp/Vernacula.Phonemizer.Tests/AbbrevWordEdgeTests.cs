/**
 * THE DOTTED-ABBREVIATION RULES START AT A UNICODE WORD EDGE, NOT AN ASCII `\b` (#1480's shape, carried to es,
 * de, en, id, ceb and hil). Ported from test/abbrev-word-edge.test.ts. Each row: the abbreviation alone (the
 * rule fires — the input changes) and glued after a non-ASCII letter (it declines — the input is returned).
 * Every word here is synthetic.
 */
using Xunit;
using Ceb = Vernacula.Phonemizer.Languages.Cebuano.Normalize;
using De = Vernacula.Phonemizer.Languages.German.Normalize;
using En = Vernacula.Phonemizer.Languages.English.Normalize;
using Es = Vernacula.Phonemizer.Languages.Spanish.Normalize;
using Hil = Vernacula.Phonemizer.Languages.Hiligaynon.Normalize;
using Id = Vernacula.Phonemizer.Languages.Indonesian.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class AbbrevWordEdgeTests
{
    private static string Norm(string lang, string s) => lang switch
    {
        "es" => Es.NormalizeSpanish(s),
        "de" => De.NormalizeGerman(s),
        "en" => En.NormalizeEnglish(s),
        "id" => Id.NormalizeIndonesian(s),
        "ceb" => Ceb.NormalizeCebuano(s),
        "hil" => Hil.NormalizeHiligaynon(s),
        _ => throw new ArgumentException(lang),
    };

    [Theory]
    [InlineData("es", "Es la sta. María.", "Es un taoísta. María.")]
    [InlineData("es", "Vino la sta.", "Era un taoísta.")]
    [InlineData("es", "En 300 a. C. hubo", "En 300 Ña. C. hubo")]
    [InlineData("es", "En 300 d. C. hubo", "En 300 Ñd. C. hubo")]
    [InlineData("es", "Los EE. UU. ganan", "Los ÑEE. UU. ganan")]
    [InlineData("es", "los ee. uu. ganan", "los ñee. uu. ganan")]
    [InlineData("es", "a las 10 p. m. hoy", "a las 10 Ñp. m. hoy")]
    [InlineData("es", "el n.º 5 gana", "el Ñn.º 5 gana")]
    [InlineData("de", "Er kam St. Peter", "Es ist gelöst. Peter")]
    [InlineData("de", "Er wohnt in St.", "Es ist gelöst.")]
    [InlineData("de", "im Jahr 50 v. Chr. kam", "im Jahr 50 Öv. Chr. kam")]
    [InlineData("de", "im Jahr 50 n. Chr. kam", "im Jahr 50 Ön. Chr. kam")]
    [InlineData("de", "Obst, z. B. Äpfel", "Obst, Öz. B. Äpfel")]
    [InlineData("de", "also d. h. nein", "also Öd. h. nein")]
    [InlineData("de", "Leute, u. a. wir", "Leute, Öu. a. wir")]
    [InlineData("de", "Obst u. Ä. hier", "Obst Öu. Ä. hier")]
    [InlineData("en", "They met Mr. smith", "They met Ømr. smith")]
    [InlineData("en", "on Main St.", "on Main Øst.")]
    [InlineData("en", "see Rev. 3 here", "see Žrev. 3 here")]
    [InlineData("en", "the Nos. Then", "the Taínos. Then")]
    [InlineData("en", "counted the nos.", "They met the Taínos.")]
    [InlineData("en", "up to max. 5 more", "up to Ømax. 5 more")]
    [InlineData("en", "up to max 5 more", "up to Ømax 5 more")]
    [InlineData("en", "up to max 5 more", "up to maxé 5 more")]
    [InlineData("en", "they saw st louis", "they saw Øst louis")]
    [InlineData("en", "Smith et al. said", "Smith Øet al. said")]
    [InlineData("en", "built ca. 1900 here", "built Ýca. 1900 here")]
    [InlineData("en", "see No. 5 here", "see Taíno. 5 here")]
    [InlineData("en", "fruit, e.g. apples", "fruit, Øe.g. apples")]
    [InlineData("en", "fruit, i.e. apples", "fruit, Øi.e. apples")]
    [InlineData("en", "at 10 a.m. today", "at 10 Øa.m. today")]
    [InlineData("en", "the U.S. army", "the ØU.S. army")]
    [InlineData("id", "harga Rp 500 saja", "harga ÉRp 500 saja")]
    [InlineData("id", "kosmonot No. 11 itu", "kosmonot Éno. 11 itu")]
    [InlineData("id", "ke Jl. Merdeka", "ke Éjl. Merdeka")]
    [InlineData("id", "di jalan dll.", "di jalan Édll.")]
    [InlineData("ceb", "si Dr. Santos", "si Édr. Santos")]
    [InlineData("hil", "si Dr. Santos", "si Édr. Santos")]
    public void AnAbbreviationGluedAfterANonAsciiLetterIsNotOne(string lang, string fires, string declines)
    {
        Assert.NotEqual(fires, Norm(lang, fires));
        Assert.Equal(declines, Norm(lang, declines));
    }

    /// The st./dr. rules gained `u`; under `iu` the alternation folds `s`↔`ſ` (#1122), so the miss branch
    /// must return the match unchanged — the old switch default read `ſt.` as "mount".
    [Fact]
    public void TheLongSFoldIsAMissNotAReading()
    {
        Assert.Equal("the ſt. louis", En.NormalizeEnglish("the ſt. louis"));
        Assert.Equal("on Main ſt.", En.NormalizeEnglish("on Main ſt."));
    }
}
