/**
 * Kanji → kana reading conversion + bunsetsu segmentation.
 * Ported from src/languages/japanese/kanji.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public sealed class KanjiFallback
{
    public string? On;
    public string? Kun;
    public string? Rendaku;
}

public static class Kanji
{
    private sealed class ReadingsData
    {
        public required Dictionary<string, string> Map;
        public required int MaxKeyLength;      // longest word-key, code points
        public required Dictionary<string, KanjiFallback> Fallback;
        public required HashSet<string> Adverbs;
        public required int MaxUnitLength;     // longest of (map keys ∪ adverbs), scan bound for segmentation
    }

    private static ReadingsData? READINGS;

    private static ReadingsData Readings()
    {
        if (READINGS is null)
        {
            var map = LoadTsv.LoadTsvMap("languages/japanese", "readings.tsv");
            var fallback = LoadTsv.LoadTsvMap<KanjiFallback>("languages/japanese", "fallback.tsv", (rest, _) =>
            {
                var cols = rest.Split('\t');
                var fb = new KanjiFallback();
                if (cols.Length > 0 && cols[0].Length > 0) fb.On = cols[0];
                if (cols.Length > 1 && cols[1].Length > 0) fb.Kun = cols[1];
                if (cols.Length > 2 && cols[2].Length > 0) fb.Rendaku = cols[2];
                return fb;
            });
            var adverbs = new HashSet<string>(LoadTsv.LoadLines("languages/japanese", "adverbs.txt"), StringComparer.Ordinal);
            var maxKeyLength = map.Keys.Aggregate(0, (m, k) => Math.Max(m, Js.CodePoints(k).Count));
            var maxUnitLength = adverbs.Aggregate(maxKeyLength, (m, a) => Math.Max(m, Js.CodePoints(a).Count));
            READINGS = new ReadingsData
            {
                Map = map, MaxKeyLength = maxKeyLength, Fallback = fallback,
                Adverbs = adverbs, MaxUnitLength = maxUnitLength,
            };
        }
        return READINGS;
    }

    private static readonly JsRe HIRAGANA_RE = JsRegex.Compile("[ぁ-ゖ]", "u");
    private static readonly JsRe KANJI_RE = JsRegex.Compile("[㐀-鿿\\u{20000}-\\u{2a6df}々]", "u");
    private static readonly JsRe KANA_RE = JsRegex.Compile("[ぁ-ゖァ-ヿー]", "u");

    private static bool IsHiragana(string ch) => HIRAGANA_RE.IsMatch(ch);
    private static bool IsKanji(string ch) => KANJI_RE.IsMatch(ch);
    private static bool IsKana(string ch) => KANA_RE.IsMatch(ch);

    /** The longest key matching at chars[i], scanning from min(maxKeyLength, remaining) down to minLen. */
    private static (string Unit, int Len)? LongestKeyMatch(
        IReadOnlyList<string> chars, int i, int maxKeyLength, int minLen, Func<string, bool> inKeyset)
    {
        var maxLen = Math.Min(maxKeyLength, chars.Count - i);
        for (var len = maxLen; len >= minLen; len--)
        {
            var sub = string.Concat(chars.Skip(i).Take(len));
            if (inKeyset(sub)) return (sub, len);
        }
        return null;
    }

    /**
     * Split a dictionary compound's reading at its MORPHEME boundaries, by aligning the stored flat reading
     * against each character's own known readings (fallback.tsv on/kun/rendaku; a kana must match literally).
     * Returns null when no alignment exists — the conservative outcome for a compound whose reading is not the
     * sum of its parts, which then stays fused as one segment.
     */
    private static List<string>? AlignCompoundReading(
        string unit, string reading, IReadOnlyDictionary<string, KanjiFallback> fallback)
    {
        var chars = Js.CodePoints(unit);
        if (chars.Count < 2) return null;
        List<string>? Solve(int ci, int ri)
        {
            if (ci == chars.Count) return ri == reading.Length ? new List<string>() : null;
            var ch = chars[ci];
            var cands = new List<string>();
            if (IsKanji(ch))
            {
                var fb = fallback.GetValueOrDefault(ch);
                foreach (var r in new[] { fb?.On, fb?.Kun, fb?.Rendaku })
                    if (!string.IsNullOrEmpty(r))
                        cands.Add(r);
            }
            else cands.Add(ch); // kana (okurigana) must match itself
            foreach (var cand in cands)
            {
                if (cand == "" || !MatchesAt(reading, cand, ri)) continue;
                var rest = Solve(ci + 1, ri + cand.Length);
                if (rest is not null)
                {
                    rest.Insert(0, cand);
                    return rest;
                }
            }
            return null;
        }
        return Solve(0, 0);
    }

    /** TS `reading.startsWith(cand, ri)`. */
    private static bool MatchesAt(string s, string sub, int at) =>
        at + sub.Length <= s.Length && string.CompareOrdinal(s, at, sub, 0, sub.Length) == 0;

    /**
     * Longest-match kanji→kana substitution over a single token, returned as SEGMENTS — one element per kanji
     * reading, with a run of literal kana kept together as a single element. The boundaries matter downstream:
     * long-vowel coalescence must not run ACROSS a reading boundary, so do not flatten this to one string.
     */
    public static List<string> ApplyReadingSegments(string word)
    {
        var r = Readings();
        var chars = Js.CodePoints(word);
        var segs = new List<string>();
        var kanaRun = "";
        void FlushKana()
        {
            if (kanaRun != "")
            {
                segs.Add(kanaRun);
                kanaRun = "";
            }
        }
        void PushReading(string rd)
        {
            FlushKana();
            segs.Add(rd);
        }
        int i = 0;
        var prevKanjiReading = "";
        var prevWasKanji = false;
        while (i < chars.Count)
        {
            if ((chars[i] == "々" || chars[i] == "〻") && prevKanjiReading != "")
            {
                PushReading(prevKanjiReading);
                i++;
                continue;
            }
            var m = LongestKeyMatch(chars, i, r.MaxKeyLength, 1, k => r.Map.ContainsKey(k));
            if (m is not null)
            {
                var reading = r.Map[m.Value.Unit];
                var single = m.Value.Len == 1 && IsKanji(m.Value.Unit);
                if (single && prevWasKanji)
                {
                    var fb0 = r.Fallback.GetValueOrDefault(m.Value.Unit);
                    if (fb0?.Rendaku is not null && reading == fb0.Kun) reading = fb0.Rendaku;
                }
                var parts = single ? null : AlignCompoundReading(m.Value.Unit, reading, r.Fallback);
                if (parts is null) PushReading(reading);
                else foreach (var part in parts) PushReading(part);
                prevKanjiReading = single ? reading : "";
                prevWasKanji = Js.CodePoints(m.Value.Unit).Any(IsKanji);
                i += m.Value.Len;
                continue;
            }
            var fb = r.Fallback.GetValueOrDefault(chars[i]);
            if (fb is not null)
            {
                string reading;
                if (prevWasKanji && fb.Rendaku is not null) reading = fb.Rendaku;
                else
                {
                    var next = i + 1 < chars.Count ? chars[i + 1] : null;
                    var wantKun = next is not null && IsHiragana(next);
                    reading = (wantKun ? (fb.Kun ?? fb.On) : (fb.On ?? fb.Kun)) ?? chars[i];
                }
                PushReading(reading);
                prevKanjiReading = reading;
                prevWasKanji = true;
                i++;
                continue;
            }
            kanaRun += chars[i];
            prevKanjiReading = "";
            prevWasKanji = false;
            i++;
        }
        FlushKana();
        return segs;
    }

    /** The flattened reading (segments joined) — for callers that do not need the morpheme boundaries. */
    public static string ApplyReadings(string word) => string.Concat(ApplyReadingSegments(word));

    /**
     * True if a whole-word reading entry of length ≥2 starts at the head of `text` — i.e. the leading kanji
     * heads a dictionary compound (時間, 年生). Used by the number+counter fusion so 3時間 stays さんじかん.
     * ⚠ The second character must also be a KANJI: many reading keys start with a counter kanji and continue
     * in kana (分かつ, 本の), and an unguarded match suppressed the fusion in 1本のペン.
     */
    public static bool HeadsCompound(string text)
    {
        var r = Readings();
        return LongestKeyMatch(Js.CodePoints(text), 0, r.MaxKeyLength, 2,
            k => r.Map.ContainsKey(k) && IsKanji(Js.CodePoints(k)[1])) is not null;
    }

    /** Insert spaces at bunsetsu boundaries in a spaceless Japanese run (see module header). */
    private static readonly IReadOnlySet<string> SINGLE_PARTICLES =
        new HashSet<string>(new[] { "が", "を", "に", "の", "と", "も", "や", "で" }, StringComparer.Ordinal);
    private static readonly string[] MULTI_PARTICLES = { "から", "まで", "など" };
    private static readonly string[] DEMONSTRATIVES = { "この", "その", "あの", "どの" };

    private static readonly JsRe KATAKANA_ONE = JsRegex.Compile("^[\\u30a1-\\u30fc]$", "");
    private static readonly JsRe DIGIT_ONE = JsRegex.Compile("\\d", "u");

    public static string SegmentText(string text)
    {
        var r = Readings();
        var chars = Js.CodePoints(text);
        var @out = "";
        string? prev = null;
        bool prevAdv = false, prevParticle = false;
        var i = 0;
        while (i < chars.Count)
        {
            var ch = chars[i];
            if (!IsKanji(ch) && !IsKana(ch))
            {
                @out += ch;
                prev = ch;
                prevAdv = false;
                prevParticle = false;
                i++;
                continue;
            }
            var m = LongestKeyMatch(chars, i, r.MaxUnitLength, 2, k => r.Map.ContainsKey(k) || r.Adverbs.Contains(k));
            var unit = m?.Unit ?? ch;
            var forcedParticle = false;
            if (m is null)
            {
                if (prev is not null && (IsKanji(prev) || KATAKANA_ONE.IsMatch(prev)))
                {
                    foreach (var mp in MULTI_PARTICLES)
                    {
                        if (string.Concat(chars.Skip(i).Take(mp.Length)) == mp)
                        {
                            unit = mp;
                            forcedParticle = true;
                            break;
                        }
                    }
                }
                if (!forcedParticle && (prev is null || prevParticle || @out == "" || @out.EndsWith(" ", StringComparison.Ordinal)))
                {
                    foreach (var dm in DEMONSTRATIVES)
                    {
                        if (string.Concat(chars.Skip(i).Take(dm.Length)) == dm)
                        {
                            unit = dm;
                            forcedParticle = true; // reuse the boundary-after mechanism
                            break;
                        }
                    }
                }
            }
            if (!forcedParticle && prev is not null && (IsKanji(prev) || KATAKANA_ONE.IsMatch(prev))
                && MULTI_PARTICLES.Contains(unit))
                forcedParticle = true;
            if (!forcedParticle && unit == "を" && prev is not null) forcedParticle = true;
            var isAdv = r.Adverbs.Contains(unit);
            var u = Js.CodePoints(unit);
            var isKanaAdverb = isAdv && u.All(IsKana);
            // ⚠ `unit[0]` IS A UTF-16 UNIT IN THE TS, not a code point, while `u` above is code points. The
            // difference is load-bearing for an astral kanji (Ext-B, U+20000+), whose first unit is a lone
            // surrogate that `IsKanji` does NOT match. Reproduced exactly rather than "corrected".
            var unitHead = unit.Length > 0 ? unit[0].ToString() : "";
            var headKanji = IsKanji(unitHead);
            var teFormAux = unitHead == "い" && (prev == "て" || prev == "で");
            // The "current unit is itself a particle" test must be computed BEFORE the boundary decision, so a
            // particle CHAIN (では, での, までは, などを) stays attached.
            var chainedParticle =
                (SINGLE_PARTICLES.Contains(unit) || unit == "は" || unit == "へ" || MULTI_PARTICLES.Contains(unit))
                && u.All(IsKana);
            var boundary =
                (prev is not null &&
                    ((IsKana(prev) && headKanji) ||
                     (prevAdv && headKanji && u.Count >= 2) ||
                     isKanaAdverb)) ||
                (prevParticle && !chainedParticle) ||
                teFormAux;
            if (boundary) @out += " ";
            var nxCh = i + 1 < chars.Count ? chars[i + 1] : null;
            var copulaDe = unit == "で" && (nxCh == "す" || nxCh == "し" || nxCh == "き");
            var particle =
                forcedParticle ||
                (prevParticle && chainedParticle) ||
                (u.Count == 1 &&
                 !copulaDe &&
                 prev is not null &&
                 ((SINGLE_PARTICLES.Contains(unit) && IsKanji(prev)) ||
                  ((unit == "は" || unit == "へ") &&
                   (IsKanji(prev) || IsKana(prev) || DIGIT_ONE.IsMatch(prev)))));
            @out += particle && unit == "は"
                ? "わ"
                : particle && unit == "へ"
                  ? "え"
                  : unit;
            prevParticle = particle;
            prev = u[^1];
            prevAdv = isAdv;
            i += u.Count;
        }
        return @out;
    }
}
