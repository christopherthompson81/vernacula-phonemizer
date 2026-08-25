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
            Bengali.Bengali.RegisterSelf();
            Bulgarian.BulgarianPhonemizer.RegisterSelf();
            Cebuano.CebuanoPhonemizer.RegisterSelf();
            English.EnglishFactory.RegisterSelf();
            French.FrenchPhonemizer.RegisterSelf();
            German.GermanPhonemizer.RegisterSelf();
            Greek.GreekPhonemizer.RegisterSelf();
            Hindi.Hindi.RegisterSelf();
            Indonesian.IndonesianPhonemizer.RegisterSelf();
            Japanese.JapanesePhonemizer.RegisterSelf();
            Kalaallisut.KalaallisutPhonemizer.RegisterSelf();
            Kannada.KannadaPhonemizer.RegisterSelf();
            Malayalam.MalayalamPhonemizer.RegisterSelf();
            Mandarin.MandarinPhonemizer.RegisterSelf();
            Malay.MalayPhonemizer.RegisterSelf();
            Maori.MaoriPhonemizer.RegisterSelf();
            Occitan.OccitanPhonemizer.RegisterSelf();
            Odia.OdiaPhonemizer.RegisterSelf();
            Portuguese.PortuguesePhonemizer.RegisterSelf();
            PortugueseBr.PortugueseBr.RegisterSelf();
            Russian.RussianPhonemizer.RegisterSelf();
            Spanish.SpanishPhonemizer.RegisterSelf();
            Spanish419.Spanish419.RegisterSelf();
            Umbundu.UmbunduPhonemizer.RegisterSelf();
            Urdu.UrduPhonemizer.RegisterSelf();
            Punjabi.PunjabiPhonemizer.RegisterSelf();
            Persian.PersianPhonemizer.RegisterSelf();
            Tajik.TajikPhonemizer.RegisterSelf();
            Thai.ThaiPhonemizer.RegisterSelf();
            Marathi.MarathiPhonemizer.RegisterSelf();
            Telugu.TeluguPhonemizer.RegisterSelf();
            Hausa.HausaPhonemizer.RegisterSelf();
            Turkish.TurkishPhonemizer.RegisterSelf();
            Tamil.TamilPhonemizer.RegisterSelf();
            Swahili.SwahiliPhonemizer.RegisterSelf();
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
        }
    }
}
