/**
 * Japanese (ja) phonemizer — Standard/Tokyo, canonical IPA.
 * Ported from src/languages/japanese/japanese.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public static class JapanesePhonemizer
{
    private static readonly JsRe HIRAGANA_RANGE = JsRegex.Compile("[ぁ-ゖ]", "gu");

    // Counter readings are injected as KATAKANA so segmentText's hiragana-only は→わ / を particle heuristic
    // cannot corrupt an internal は/へ (2泊 → にはく → *にわく).
    private static string ToKatakana(string s) =>
        HIRAGANA_RANGE.Replace(s, c => char.ConvertFromUtf32(Js.CodePointAt0(c.Value) + 0x60));

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([㐀-鿿\\u{20000}-\\u{2a6df}々〻ぁ-ゖァ-ヺー゛゜]+)|(\\d+)|([。．.！!？?、，,])", "gu");
    private static readonly JsRe KANA_ONLY = JsRegex.Compile("[^ぁ-ゖァ-ヺー]", "gu"); // strip anything the reading pass left un-converted (unresolved kanji)

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        BareExponent = Manifest.MANIFEST.SymbolTier.BareExponent,
        Ampersand = Manifest.MANIFEST.SymbolTier.Ampersand,
        Multiply = Manifest.MANIFEST.SymbolTier.Multiply,
        UnspacedScript = Manifest.MANIFEST.SymbolTier.UnspacedScript,
    });

    private static readonly JsRe FULLWIDTH_DIGIT = JsRegex.Compile("[０-９]", "gu");
    private static readonly JsRe COUNTER_FUSION = JsRegex.Compile("(\\d+)(\\p{Script=Han}|つ)", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // SYMBOLS must run before normalization: its % rule matches a number directly before the sign, and
            // the decimal rewrite (1.5 → 1点ゴ) destroys that adjacency.
            input = Normalize.NormalizeJapanese(SYMBOLS(input));
            input = FULLWIDTH_DIGIT.Replace(input, d => char.ConvertFromUtf32(Js.CodePointAt0(d.Value) - 0xfee0));
            // Counter fusion runs BEFORE segmentation so the fused reading flows through the kana path. The
            // headsCompound guard suppresses it when the counter kanji heads a dictionary compound (3時間,
            // 3年生); splitting there would orphan the trailing kanji into a wrong isolated reading.
            var src = input;
            input = COUNTER_FUSION.Replace(src, m =>
            {
                var num = m.Groups[1].Value;
                var ctr = m.Groups[2].Value;
                if (Kanji.HeadsCompound(src[(m.Index + num.Length)..])) return m.Value;
                var reading = Counters.ReadCounter(Js.Number(num), ctr);
                return reading is null ? m.Value : ToKatakana(reading);
            });
            return Clauses.AssembleClauses(Kanji.SegmentText(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                {
                    var segments = ReadingSegments(m.Groups[1].Value); // kanji → kana per morpheme (boundaries kept)
                    var reading = string.Concat(segments);
                    var morae = Kana.SegmentsToMorae(segments);
                    if (morae is not null)
                        sink.Emit(Pitch.PlaceDownstep(morae, Pitch.AccentNucleus(m.Groups[1].Value, reading))); // pitch: surface m[1] disambiguates
                }
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var ipa = Kana.KanaToIpa(Numbers.NumberToKana(Js.Number(m.Groups[2].Value)));
                    if (!string.IsNullOrEmpty(ipa)) sink.Emit(ipa);
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /**
     * One Japanese word/token → canonical IPA (kanji readings + pitch downstep, so kanji tokens work too).
     */
    public static string PhonemizeWord(string word)
    {
        var segments = ReadingSegments(word);
        var reading = string.Concat(segments);
        var morae = Kana.SegmentsToMorae(segments);
        return morae is null ? "" : Pitch.PlaceDownstep(morae, Pitch.AccentNucleus(word, reading));
    }

    /** Reading segments for a word, with the unresolvable tail dropped from each. */
    private static List<string> ReadingSegments(string word) =>
        Kanji.ApplyReadingSegments(word)
            .Select(s => KANA_ONLY.Replace(s, ""))
            .Where(s => s != "")
            .ToList();

    /**
     * One Japanese word/token → canonical IPA, SEGMENTAL only (no pitch downstep) — for segmental validation.
     */
    public static string PhonemizeWordSegmental(string word) =>
        Kana.KanaToIpa(KANA_ONLY.Replace(Kanji.ApplyReadings(word), "")) ?? "";

    /** Build the Japanese phonemizer (kana + numbers + kanji readings + bunsetsu segmentation). */
    public static ILanguage CreateJapanese() => new Engine();

    internal static void RegisterSelf() => Registry.Register("japanese", () => CreateJapanese());
}
