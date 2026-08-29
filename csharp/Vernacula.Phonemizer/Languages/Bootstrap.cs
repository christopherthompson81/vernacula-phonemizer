/**
 * The language registration list — the C# stand-in for registry.ts's static imports.
 *
 * The TS registry imports every `create<Language>` factory at the top of the file, so importing the
 * registry is what makes a language exist. C# has no equivalent side effect, so each ported language
 * exposes an internal `RegisterSelf()` and this file calls them all, ONCE, the first time the registry
 * is asked for anything.
 *
 * ⚠ ONE EXPLICIT LIST, NOT 182 [ModuleInitializer]s. Initializers would work, but they are load-time
 * side effects in a library (CA2255) and — the reason that actually matters — they would scatter the
 * answer to "which languages are ported?" across 182 files. Here it is one grep.
 */
namespace Vernacula.Phonemizer.Languages;

public static class Bootstrap
{
    private static bool done;
    private static readonly object Gate = new();

    /// <summary>Register every ported language exactly once. Called by the registry before any lookup.</summary>
    public static void EnsureRegistered()
    {
        lock (Gate)
        {
            if (done) return;
            done = true;
            // The async (neural best-path) table, the C# stand-in for neuralRegistry.ts's static imports.
            // Installed here for the same reason the engines are: nothing else imports the language modules.
            Phonemizer.GetNeuralPhonemizer = NeuralRegistry.GetNeuralPhonemizer;

            // English also supplies the foreign-run OOV prewarm, which phonemizeAsync calls for every
            // non-English host carrying Latin text (core/foreign.ts).
            Phonemizer.PrewarmForeignEnglish = English.EnglishNeural.PrewarmForeignEnglish;

            Afrikaans.AfrikaansPhonemizer.RegisterSelf();
            Amharic.AmharicPhonemizer.RegisterSelf();
            Arabic.Arabic.RegisterSelf();
            Assamese.Assamese.RegisterSelf();
            Asturian.AsturianPhonemizer.RegisterSelf();
            Awadhi.AwadhiPhonemizer.RegisterSelf();
            Azerbaijani.AzerbaijaniPhonemizer.RegisterSelf();
            Bengali.Bengali.RegisterSelf();
            Bhojpuri.BhojpuriPhonemizer.RegisterSelf();
            Bulgarian.BulgarianPhonemizer.RegisterSelf();
            Cebuano.CebuanoPhonemizer.RegisterSelf();
            CentralKurdish.CentralKurdishPhonemizer.RegisterSelf();
            Chhattisgarhi.ChhattisgarhiPhonemizer.RegisterSelf();
            English.EnglishFactory.RegisterSelf();
            EnglishGb.EnglishGb.RegisterSelf();
            EnglishIn.EnglishIn.RegisterSelf();
            French.FrenchPhonemizer.RegisterSelf();
            FrenchCa.FrenchCa.RegisterSelf();
            German.GermanPhonemizer.RegisterSelf();
            Greek.GreekPhonemizer.RegisterSelf();
            Hindi.Hindi.RegisterSelf();
            Igbo.IgboPhonemizer.RegisterSelf();
            Indonesian.IndonesianPhonemizer.RegisterSelf();
            Japanese.JapanesePhonemizer.RegisterSelf();
            Kalaallisut.KalaallisutPhonemizer.RegisterSelf();
            Kannada.KannadaPhonemizer.RegisterSelf();
            Magahi.MagahiPhonemizer.RegisterSelf();
            Maithili.MaithiliPhonemizer.RegisterSelf();
            Malayalam.MalayalamPhonemizer.RegisterSelf();
            Mandarin.MandarinPhonemizer.RegisterSelf();
            Malagasy.MalagasyPhonemizer.RegisterSelf();
            Malay.MalayPhonemizer.RegisterSelf();
            Maori.MaoriPhonemizer.RegisterSelf();
            Naija.NaijaPhonemizer.RegisterSelf();
            Norwegian.NorwegianPhonemizer.RegisterSelf();
            Occitan.OccitanPhonemizer.RegisterSelf();
            Odia.OdiaPhonemizer.RegisterSelf();
            Oromo.OromoPhonemizer.RegisterSelf();
            Portuguese.PortuguesePhonemizer.RegisterSelf();
            PortugueseBr.PortugueseBr.RegisterSelf();
            Russian.RussianPhonemizer.RegisterSelf();
            Spanish.SpanishPhonemizer.RegisterSelf();
            Spanish419.Spanish419.RegisterSelf();
            Sundanese.SundanesePhonemizer.RegisterSelf();
            Somali.SomaliPhonemizer.RegisterSelf();
            Umbundu.UmbunduPhonemizer.RegisterSelf();
            Urdu.UrduPhonemizer.RegisterSelf();
            Uzbek.UzbekPhonemizer.RegisterSelf();
            Punjabi.PunjabiPhonemizer.RegisterSelf();
            Saraiki.SaraikiPhonemizer.RegisterSelf();
            Persian.PersianPhonemizer.RegisterSelf();
            Tajik.TajikPhonemizer.RegisterSelf();
            Thai.ThaiPhonemizer.RegisterSelf();
            Tigrinya.TigrinyaPhonemizer.RegisterSelf();
            Marathi.MarathiPhonemizer.RegisterSelf();
            Telugu.TeluguPhonemizer.RegisterSelf();
            Hausa.HausaPhonemizer.RegisterSelf();
            Turkish.TurkishPhonemizer.RegisterSelf();
            Tamil.TamilPhonemizer.RegisterSelf();
            Swahili.SwahiliPhonemizer.RegisterSelf();
            Tagalog.TagalogPhonemizer.RegisterSelf();
            Cantonese.CantonesePhonemizer.RegisterSelf();
            Vietnamese.VietnamesePhonemizer.RegisterSelf();
            Korean.KoreanPhonemizer.RegisterSelf();
            Javanese.JavanesePhonemizer.RegisterSelf();
            Italian.ItalianPhonemizer.RegisterSelf();
            Gujarati.GujaratiPhonemizer.RegisterSelf();
            Polish.PolishPhonemizer.RegisterSelf();
            Quechua.QuechuaPhonemizer.RegisterSelf();
            Ukrainian.UkrainianPhonemizer.RegisterSelf();
            Romanian.RomanianPhonemizer.RegisterSelf();
            Dutch.DutchPhonemizer.RegisterSelf();
            Hungarian.HungarianPhonemizer.RegisterSelf();
            Yoruba.YorubaPhonemizer.RegisterSelf();
            Burmese.BurmesePhonemizer.RegisterSelf();
            Lingala.LingalaPhonemizer.RegisterSelf();
            Pashto.PashtoPhonemizer.RegisterSelf();
            Sindhi.SindhiPhonemizer.RegisterSelf();
            Fula.FulaPhonemizer.RegisterSelf();
            Lao.LaoPhonemizer.RegisterSelf();
            Zulu.ZuluPhonemizer.RegisterSelf();
            Xhosa.XhosaPhonemizer.RegisterSelf();
            Akan.AkanPhonemizer.RegisterSelf();
            Tibetan.TibetanPhonemizer.RegisterSelf();
            Wu.WuPhonemizer.RegisterSelf();
            Nepali.NepaliPhonemizer.RegisterSelf();
            MinNan.MinNanPhonemizer.RegisterSelf();
            Jin.JinPhonemizer.RegisterSelf();
            Xiang.XiangPhonemizer.RegisterSelf();
            Gan.GanPhonemizer.RegisterSelf();
            Hakka.HakkaPhonemizer.RegisterSelf();
            Khmer.KhmerPhonemizer.RegisterSelf();
            Sinhala.SinhalaPhonemizer.RegisterSelf();
            Zhuang.ZhuangPhonemizer.RegisterSelf();
            Chichewa.ChichewaPhonemizer.RegisterSelf();
            Kazakh.KazakhPhonemizer.RegisterSelf();
            Madurese.MaduresePhonemizer.RegisterSelf();
            Shona.ShonaPhonemizer.RegisterSelf();
            Sylheti.SylhetiPhonemizer.RegisterSelf();
            Uyghur.UyghurPhonemizer.RegisterSelf();
            Catalan.CatalanPhonemizer.RegisterSelf();
            Czech.CzechPhonemizer.RegisterSelf();
            Hebrew.HebrewPhonemizer.RegisterSelf();
            Kurmanji.KurmanjiPhonemizer.RegisterSelf();
            Serbian.SerbianPhonemizer.RegisterSelf();
            Croatian.CroatianPhonemizer.RegisterSelf();
            Bosnian.BosnianPhonemizer.RegisterSelf();
            Swedish.SwedishPhonemizer.RegisterSelf();
            Armenian.Armenian.RegisterSelf();
            Haitian.HaitianPhonemizer.RegisterSelf();
            Kinyarwanda.KinyarwandaPhonemizer.RegisterSelf();
            Slovenian.SlovenianPhonemizer.RegisterSelf();
            Danish.DanishPhonemizer.RegisterSelf();
            Rangpuri.RangpuriPhonemizer.RegisterSelf();
            Bavarian.BavarianPhonemizer.RegisterSelf();
            Bambara.BambaraPhonemizer.RegisterSelf();
            AncientGreek.AncientGreekPhonemizer.RegisterSelf();
            Latin.LatinPhonemizer.RegisterSelf();
            Mongolian.MongolianPhonemizer.RegisterSelf();
            Setswana.SetswanaPhonemizer.RegisterSelf();
            Sesotho.SesothoPhonemizer.RegisterSelf();
            Sepedi.SepediPhonemizer.RegisterSelf();
            Wolof.WolofPhonemizer.RegisterSelf();
            Finnish.FinnishPhonemizer.RegisterSelf();
            Luganda.LugandaPhonemizer.RegisterSelf();
            Kirundi.KirundiPhonemizer.RegisterSelf();
            Abkhaz.AbkhazPhonemizer.RegisterSelf();
            Albanian.AlbanianPhonemizer.RegisterSelf();
            Aragonese.AragonesePhonemizer.RegisterSelf();
            Aromanian.AromanianPhonemizer.RegisterSelf();
        }
    }
}
