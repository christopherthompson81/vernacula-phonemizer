/**
 * Japanese (Tokyo) lexical pitch accent.
 * Ported from src/languages/japanese/pitch.ts — see that file for the corpus evidence.
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

    private static int? Get(string k)
    {
        var m = Lex();
        if (m.TryGetValue(k, out var direct)) return direct;
        var folded = KATAKANA_RANGE.Replace(k, c => char.ConvertFromUtf32(Js.CodePointAt0(c.Value) - 0x60));
        return m.TryGetValue(folded, out var v) ? v : null;
    }

    /**
     * Whether the pitch lexicon has an entry for a surface/reading key (with the katakana→hiragana fold that
     * Get applies). An OOV word renders heiban (0), so the eval needs this to tell a real heiban hit from an
     * OOV default.
     */
    public static bool PitchLexiconHas(string key) => Get(key) is not null;

    private static readonly JsRe HAN_END = JsRegex.Compile("\\p{Script=Han}$", "u");
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
