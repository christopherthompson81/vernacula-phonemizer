/**
 * Japanese (Tokyo) lexical pitch accent. Accent is lexical and
 * contrastive (箸 haꜜɕi "chopsticks" vs 端 haɕi "edge"); the accent NUCLEUS is marked with the IPA downstep
 * ꜜ (U+A71C) placed AFTER the nucleus mora. Heiban (accentless, nucleus 0) words carry no mark.
 *
 * The nucleus is looked up per bunsetsu: the SURFACE (kanji) first, so homographs the reading collapses are
 * disambiguated (はし→箸=1), then the READING (kana). A bunsetsu is a content word + trailing case/topic
 * particles or copula (橋を, 天気です); the accent sits on the content stem, so we strip those to recover it and
 * apply the nucleus to the full reading. Data: pitch-accent.tsv (merged consensus > inflected > base).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public static class Pitch
{
    private static Dictionary<string, int>? LEX;
    private static Dictionary<string, int> Lex() =>
        LEX ??= LoadTsv.LoadTsvMapV<int>("languages/japanese", "pitch-accent.tsv", (v, _) =>
        {
            return int.TryParse(v, System.Globalization.NumberStyles.Integer,
                System.Globalization.CultureInfo.InvariantCulture, out var n) && n >= 0
                ? n
                : null;
        });

    private static readonly JsRe KATAKANA_RANGE = JsRegex.Compile("[ァ-ヶ]", "gu");

    // Raw key, then a katakana→hiragana FOLDED fallback (UniDic/OpenJTalk layers are hiragana-keyed; the NHK
    // consensus layer stores katakana surfaces UNFOLDED, so the raw lookup hits those first).
    private static int? Get(string k)
    {
        var m = Lex();
        if (m.TryGetValue(k, out var direct)) return direct;
        var folded = KATAKANA_RANGE.Replace(k, c => char.ConvertFromUtf32(Js.CodePointAt0(c.Value) - 0x60));
        return m.TryGetValue(folded, out var v) ? v : null;
    }

    /** Whether the pitch lexicon has an entry for a surface/reading key (with the katakana→hiragana fold get() applies).
     *  For the pitch eval's OOV tracking: an out-of-lexicon word renders heiban (0), indistinguishable from a real
     *  heiban hit, so the eval must be able to tell a genuine agreement from an OOV-defaulted-flat coincidence. */
    public static bool PitchLexiconHas(string key) => Get(key) is not null;

    private static readonly JsRe HAN_END = JsRegex.Compile("\\p{Script=Han}$", "u");
    // Trailing affixes to strip to recover a noun bunsetsu's content word (whose accent governs the phrase):
    // case/topic particles (橋を→橋), and the copula + optional sentence-final particle (天気です→天気). The affix
    // sets are DATA (japanese.jsonc → pitchStrip); the strip logic is here.
    private static PitchStripDef PS => Manifest.MANIFEST.PitchStrip;
    private static readonly JsRe[] STRIPS =
    {
        JsRegex.Compile($"[{Manifest.MANIFEST.PitchStrip.Particles}]+$", "u"),
        JsRegex.Compile(
            $"(?:{string.Join("|", Manifest.MANIFEST.PitchStrip.Copula)})(?:[{Manifest.MANIFEST.PitchStrip.CopulaFinalParticles}])?$",
            "u"),
    };

    private static readonly IReadOnlySet<string> PARTICLE_TOKENS = new HashSet<string>(new[]
    {
        "は", "が", "を", "に", "で", "と", "の", "も", "や", "へ", "わ", "え",
        "から", "まで", "など", "には", "では", "でわ", "とは", "とわ", "への", "からの", "までの", "にわ",
    }, StringComparer.Ordinal);

    /** Resolve the accent nucleus (mora index, 0 = heiban) for a bunsetsu: surface first, then reading. */
    public static int AccentNucleus(string surface, string reading)
    {
        // A bare PARTICLE token is always unaccented (heiban). Particles reach here as their own tokens when
        // the preceding content is digits or katakana (二時に, ビザを) — the pitch dictionary must not put a
        // downstep on them (85 で → de̞ꜜ was audible nonsense in the corpus).
        if (PARTICLE_TOKENS.Contains(surface)) return 0;
        var n = Get(surface); // 1. exact surface (disambiguates homographs the reading collapses)
        if (n is null)
        {
            foreach (var re in STRIPS)
            {
                var m = re.Match(surface);
                if (!m.Success) continue;
                var ks = surface[..^m.Value.Length]; // 2. surface content-kanji stem (橋 / 天気), noun bunsetsu only
                if (ks == "" || !HAN_END.IsMatch(ks)) continue;
                n = Get(ks);
                if (n is null && reading.EndsWith(m.Value, StringComparison.Ordinal))
                {
                    var rs = reading[..^m.Value.Length]; // 3. reading content stem, same suffix (はしを→はし)
                    if (rs != "") n = Get(rs);
                }
                if (n is not null) break;
            }
        }
        if (n is null) n = Get(reading); // 4. exact reading (はし)
        return n ?? 0;
    }

    /** Place ꜜ after the nucleus-th mora of a pre-segmented mora list (1-based; ≤0 = heiban, no mark). */
    public static string PlaceDownstep(IReadOnlyList<string> morae, int nucleus)
    {
        if (nucleus <= 0 || morae.Count == 0) return string.Concat(morae);
        var n = Math.Min(nucleus, morae.Count);
        return string.Concat(morae.Take(n)) + "ꜜ" + string.Concat(morae.Skip(n));
    }
}
