/**
 * Kanji → kana reading conversion + bunsetsu segmentation. Two passes drive it:
 *   - segmentText: insert spaces at bunsetsu (phrase) boundaries so a spaceless run is phonemized
 *     phrase-by-phrase (kana→kanji transition = new phrase; case particles が/を/に end a phrase; て-form +
 *     auxiliary splits; adverbs are their own bunsetsu).
 *   - applyReadings: longest-match kanji→kana over a 60k whole-word map (日本語 matches the 3-char key, so
 *     on/kun disambiguation is sidestepped), with a per-kanji on/kun/rendaku fallback for uncovered kanji.
 * The whole-word map handles reading choice; no 14MB Viterbi is needed. Data: readings.tsv / fallback.tsv /
 * adverbs.txt.
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
            // 60k whole-word map (kanji-run → kana); a per-kanji on/kun/rendaku fallback (4-column); kana adverbs.
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
            // Longest key (code points) — the segmentation scan bounds. reduce (not Math.max(...spread)) so the
            // ~60k-key readings map can't blow the call-argument limit.
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
     *
     * readings.tsv stores 経営 ⇥ けいえい with no internal boundary, but 経's on-reading is けい and 営's is えい, so
     * the split けい|えい is recoverable and provable — the concatenation reproduces the stored reading exactly.
     * Returns null when NO alignment exists, which is the conservative and correct outcome for a compound whose
     * reading is not the sum of its parts (大人 おとな, 今日 きょう) and for one that genuinely coalesces across the
     * boundary (小売 こうり — 売 has no reading うり, so it stays fused and keeps giving koːri).
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

    /** Longest-match kanji→kana substitution over a single token, returned as SEGMENTS — one element per
     *  kanji reading, with a run of literal kana kept together as a single element.
     *
     *  The segmentation matters downstream: long-vowel coalescence (kanaToMorae) must not run ACROSS a reading
     *  boundary, or the next morpheme's initial vowel is absorbed into the previous one's length — 経営 けい|えい
     *  became ke̞ːːː instead of ke̞ːe̞ː, 聖域 せい|いき became se̞ːːki. Flattening to one string here
     *  destroyed the only evidence of where a morpheme ended. A literal-kana RUN stays one segment so genuine
     *  within-run coalescence still fires (おおさか → o̞ːsäkä). */
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
            // 々/〻 iteration mark: repeat the preceding single-kanji reading (奈々→なな).
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

    /** The flattened reading (segments joined) — unchanged behaviour for callers that do not need boundaries. */
    public static string ApplyReadings(string word) => string.Concat(ApplyReadingSegments(word));

    /** True if a whole-word reading entry of length ≥2 starts at the head of `text` — i.e. the leading kanji heads a
     *  dictionary compound (時間, 年生, 日中, 年間, 分間). Used by the number+counter fusion to avoid splitting a compound
     *  whose first kanji happens to be a counter (3時間 must stay さんじかん, not become さんじ + 間). A standalone counter
     *  before a particle/verb/punctuation does NOT head a compound (冊読 is no word), so its euphonic reading still fires.
     *
     *  ⚠ THE SECOND CHARACTER MUST BE A KANJI, and that guard is the whole difference between the compound this
     *  exists to protect and an ordinary word that merely starts with the same character. Every case above is
     *  kanji+kanji, but the test was "is there ANY ≥2-char entry here", and 126 reading keys begin with a counter
     *  kanji and continue in KANA — overwhelmingly verb conjugations (分かつ, 回す, 着く, 足す, 泊まる) plus a few
     *  noun phrases (日の丸, 年の瀬, 人たち, 本の). None of those readings is available after a DIGIT, which is the
     *  only context this function is consulted from: a numeral cannot precede a verb stem, and `本の` after a
     *  number is the counter 本 plus the particle の, never the adverb ほんの. Unguarded, the entry suppressed the
     *  fusion and `1本のペン` read *it͡ɕi ho̞n* instead of いっぽん — a wrong reading for one of the commonest
     *  shapes in the language. Found while porting to C#. */
    public static bool HeadsCompound(string text)
    {
        var r = Readings();
        return LongestKeyMatch(Js.CodePoints(text), 0, r.MaxKeyLength, 2,
            k => r.Map.ContainsKey(k) && IsKanji(Js.CodePoints(k)[1])) is not null;
    }

    /** Insert spaces at bunsetsu boundaries in a spaceless Japanese run (see module header). */
    // Single-kana case particles boundary-split after a KANJI (see the comment at the use site).
    private static readonly IReadOnlySet<string> SINGLE_PARTICLES =
        new HashSet<string>(new[] { "が", "を", "に", "の", "と", "も", "や", "で" }, StringComparer.Ordinal);
    // Multi-kana particles split after a kanji content word (東京から → とうきょう から). After-kanji only:
    // inside a kana run から may be word-internal (からだ, からあげ), where splitting would be wrong.
    private static readonly string[] MULTI_PARTICLES = { "から", "まで", "など" };
    // The の-demonstratives, recognised only at a RUN START (start of text or right after a boundary): そのうち →
    // その うち, blocking the のう → [noː] fold. Never mid-run — きのこのスープ must not split at its internal この.
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
                // multi-kana particle after kanji or KATAKANA content → its own bunsetsu-final unit
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
                // demonstrative at a run start → boundary after it (blocks そのうち → [so̞no̞ːt͡ɕi])
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
            // A multi-kana particle can also arrive as a DICTIONARY match (から is in the unit maps): treat it as
            // the particle whenever it follows kanji or katakana content. Longest-match protects word-internal
            // hits — からだ matches as its own longer unit before から can.
            if (!forcedParticle && prev is not null && (IsKanji(prev) || KATAKANA_ONE.IsMatch(prev))
                && MULTI_PARTICLES.Contains(unit))
                forcedParticle = true;
            // を is the ONLY use of that kana in modern Japanese — always the particle, after any content.
            if (!forcedParticle && unit == "を" && prev is not null) forcedParticle = true;
            var isAdv = r.Adverbs.Contains(unit);
            var u = Js.CodePoints(unit);
            var isKanaAdverb = isAdv && u.All(IsKana);
            // ⚠ `unit[0]` IS A UTF-16 UNIT IN THE TS, not a code point, while `u` above is code points — the
            // two are spelled differently in the source and the difference is load-bearing for an astral
            // kanji (Ext-B, U+20000+), whose first unit is a lone surrogate that `isKanji` does NOT match.
            // Reproduced exactly rather than "corrected": TOKEN admits Ext-B, so this branch is reachable.
            var unitHead = unit.Length > 0 ? unit[0].ToString() : "";
            var headKanji = IsKanji(unitHead);
            var teFormAux = unitHead == "い" && (prev == "て" || prev == "で");
            // NOTE: the "current unit is itself a particle" check must run BEFORE the boundary decision so a
            // particle CHAIN (では, での, までは, などを) stays attached — see `particle` below for the classification.
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
            // Case particles: a single-mora particle after a content word ends a bunsetsu. は/へ as particles are
            // PRONOUNCED wa/e (not ha/he) — convert them here so the reading pass emits わ/え (私は→わたし わ, 東京へ→
            // とうきょう え). を is already handled in kana.ts; が/を/に pass through unchanged (unambiguous kana). は/へ
            // that START a dictionary word (はな, へや) are matched as a ≥2-mora unit above, so single-char は/へ after
            // content is the particle. が/を/に keep the stricter isKanji(prev) gate the segmenter already relied on.
            // の/と/も/や/で joined the single-particle set for the residual: they are the O/E/A-vowel carriers
            // whose kana can trigger long-vowel coalescence across the bunsetsu boundary when left fused — 東京のうち
            // read のう as [noː] instead of の うち. Safe under the isKanji(prev) gate: no verb okurigana begins with
            // の/と/も/や, and the て-form で (飲んで) is preceded by ん (kana), which the gate excludes.
            // で directly before す/し/き is NOT the case particle: です/でした/でしょう (copula) and できる/できます
            // ("can") — 学生です and 増減できます must stay whole, not 学生 で + orphaned す. (と before し stays a
            // particle: 彼として → 彼と して.)
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
                   // ⚠ A DIGIT COUNTS AS A CONTENT WORD HERE. `7は` is the topic particle just as `私は`
                   // is, but the gate tested only kanji and kana, so the は stayed /ha/ — 「7は3より小さい」
                   // read *nana ha* instead of *nana wa*. Found by the relational rule, which builds
                   // exactly that clause, and pre-existing for any text that topic-marks a bare numeral.
                   // Safe to widen: a counter written with hiragana は immediately after a digit would be
                   // a ≥2-mora unit and is matched before this branch, so single は after a digit is the
                   // particle.
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
