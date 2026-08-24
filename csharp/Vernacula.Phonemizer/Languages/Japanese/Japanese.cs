/**
 * Japanese (ja) phonemizer — Standard/Tokyo, canonical IPA.
 *   text → segmentText (bunsetsu spaces) → per run: applyReadings (kanji→kana) → kanaToIpa.
 * PHASE 1: native kana/katakana → IPA (kana.ts) + Sino-Japanese numbers. PHASE 2: kanji → kana via a 60k
 * whole-word reading map + per-kanji on/kun/rendaku fallback (kanji.ts), and orthographic bunsetsu
 * segmentation of spaceless text. Pitch accent (ꜜ) is applied by pitch.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public static class JapanesePhonemizer
{
    private static readonly JsRe HIRAGANA_RANGE = JsRegex.Compile("[ぁ-ゖ]", "gu");

    // Fold hiragana → katakana (kanaToIpa treats them identically). Counter readings are injected as katakana so
    // segmentText's hiragana-specific は→わ / を particle heuristic can't corrupt an internal は/へ (2泊→にはく → にわく).
    private static string ToKatakana(string s) =>
        HIRAGANA_RANGE.Replace(s, c => char.ConvertFromUtf32(Js.CodePointAt0(c.Value) + 0x60));

    // Japanese clause punctuation → canonical pause marks (from japanese.jsonc).
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // A Japanese-script run (kanji incl. Ext-A/B + iteration marks + hiragana + katakana + long mark), a digit
    // run, or clause punctuation. Bunsetsu spaces inserted by segmentText split runs into phrase-sized tokens.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([㐀-鿿\\u{20000}-\\u{2a6df}々〻ぁ-ゖァ-ヺー゛゜]+)|(\\d+)|([。．.！!？?、，,])", "gu");
    private static readonly JsRe KANA_ONLY = JsRegex.Compile("[^ぁ-ゖァ-ヺー]", "gu"); // strip anything the reading pass left un-converted (unresolved kanji)

    // Katakana loans, read by the ordinary kana engine.
    // UNITS moved to normalize.ts, which must resolve them before its decimal and exponent rules break the
    // number-adjacency this tier matches on; see UNIT_KANA there. Percent stays, because nothing reorders it.
    // ⚠ Without a currency declaration the sign is DROPPED outright, so "$5" and "5" read identically. Japanese
    // prose normally writes 円 and ドル as words rather than using a sign, but the reading is not in doubt and a
    // dropped sign is silent content loss wherever one appears.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ Declaring `multiply` HERE is what makes ASCII `x` read like `×`: otherwise `6x6 cm` reads the `x` as a
        // LETTER NAME, and `NxN` is the commoner written form. One word, so `by` defaults to it.
        Multiply = new MultiplyDef { Times = "かける" },
        Percent = new[] { "パーセント" },
        // ⚠ Unread, `&` is DROPPED — `高級B&Bが…` reads *ko̞ːkʲɯː biː biː ɡa*, two initialisms run together with
        // nothing between them. The reading cannot come from text: `&` is written as a GLYPH, so no amount of
        // Japanese prose contains it.
        Ampersand = "アンド",
        // Units and exponent come from the shared tier rather than a local table.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "キロメートル" }, ["cm"] = new[] { "センチメートル" }, ["mm"] = new[] { "ミリメートル" },
            ["nm"] = new[] { "ナノメートル" }, ["m"] = new[] { "メートル" },
            ["kg"] = new[] { "キログラム" }, ["mg"] = new[] { "ミリグラム" }, ["g"] = new[] { "グラム" },
            ["t"] = new[] { "トン" }, ["ha"] = new[] { "ヘクタール" },
            ["ml"] = new[] { "ミリリットル" },
            // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
            // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
            // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
            ["l"] = new[] { "リットル" }, ["L"] = new[] { "リットル" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "平方" }, Cubed = new[] { "立方" }, Position = "compound",
        },
        // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
        // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
        // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
        // they are different words (平方キロメートル but 二十の二乗).
        // ⚠ PROVENANCE, stated because it is weaker than most data here: these are STANDARD MATHEMATICAL REGISTER,
        // not attestations. Power words do not occur in ordinary prose — news and encyclopedia text contains no
        // spoken arithmetic — and the apparent hits in other languages are substring traps (th `กำลัง` is the
        // progressive-aspect marker; fa `توان` and ar `أس` match inside unrelated words).
        // The cardinal is used for the generic power, never the ordinal.
        BareExponent = new BareExponentDef
        {
            Squared = "{n}の二乗", Cubed = "{n}の三乗", Power = "{n}の{e}乗", Negative = "マイナス",
        },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "ドル" }, ["€"] = new[] { "ユーロ" }, ["£"] = new[] { "ポンド" },
            ["¥"] = new[] { "円" }, ["₩"] = new[] { "ウォン" },
        },
        // ⚠ THE TIER'S LETTER-BOUNDARY GUARDS REJECT AN UNSPACED SCRIPT'S ORDINARY CASE: `20℃は暑い` drops the ℃
        // and `50 km²の` loses the exponent, while their punctuation-adjacent twins work. `unspacedScript` is what
        // turns those guards off.
        UnspacedScript = true,
    });

    private static readonly JsRe FULLWIDTH_DIGIT = JsRegex.Compile("[０-９]", "gu");
    private static readonly JsRe COUNTER_FUSION = JsRegex.Compile("(\\d+)(\\p{Script=Han}|つ)", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // SYMBOLS first, because its % rule matches a NUMBER directly before the sign and
            // normalization's decimal rewrite (1.5 → 1点ゴ) removes that adjacency. Normalization then folds
            // the widths, resolves the remaining numeric surface forms, and nativizes embedded Latin so it
            // never reaches the English fallback in core/foreign.ts.
            input = Normalize.NormalizeJapanese(SYMBOLS(input));
            // Normalise full-width digits ０-９ → ASCII so the number path fires (３個 → さんこ, ２０２４年 → …); the \d
            // token and numberToKana are ASCII-only.
            input = FULLWIDTH_DIGIT.Replace(input, d => char.ConvertFromUtf32(Js.CodePointAt0(d.Value) - 0xfee0));
            // Number + counter (助数詞): fuse a digit run + following counter kanji into its euphonic kana reading
            // (1本→いっぽん, 3個→さんこ, 2024年→にせんにじゅうよねん) BEFORE segmentation, so it flows through the kana path.
            // readCounter returns null for a non-counter kanji (or out-of-range n) → the digits pass through unchanged.
            // Suppress the fusion when the counter kanji HEADS a dictionary compound (3時間, 3年生): splitting it off
            // would orphan the trailing kanji into a wrong isolated reading (間→あいだ, 生→なま). See headsCompound.
            var src = input;
            input = COUNTER_FUSION.Replace(src, m =>
            {
                // ⚠ `つ` is listed EXPLICITLY beside Han: it is the one counter written in hiragana, and
                // matching it is what lets 1つ reach readCounter at all. Widening this to kana generally
                // would be wrong — a digit is followed by an ordinary particle constantly (3の, 5は).
                var num = m.Groups[1].Value;
                var ctr = m.Groups[2].Value;
                if (Kanji.HeadsCompound(src[(m.Index + num.Length)..])) return m.Value;
                var reading = Counters.ReadCounter(Js.Number(num), ctr);
                return reading is null ? m.Value : ToKatakana(reading);
            });
            // segmentText inserts bunsetsu spaces first, then assembleClauses runs the standard clause skeleton.
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

    /** One Japanese word/token → canonical IPA (kanji readings + pitch downstep, so kanji tokens work too). */
    public static string PhonemizeWord(string word)
    {
        var segments = ReadingSegments(word);
        var reading = string.Concat(segments);
        var morae = Kana.SegmentsToMorae(segments);
        return morae is null ? "" : Pitch.PlaceDownstep(morae, Pitch.AccentNucleus(word, reading));
    }

    /** Reading segments for a word, with the unresolvable tail dropped from each.
     *
     *  No exception list is needed for compounds that legitimately DO coalesce across the boundary: those are
     *  exactly the ones whose stored reading is NOT the sum of their characters' readings, so
     *  `alignCompoundReading` finds no split and leaves them as a single segment. 小売 こうり stays koːri because
     *  売 has no reading うり; 子牛 こうし splits こ|うし because both parts are attested readings. The mechanism
     *  decides it from the data instead of a hand-maintained list. */
    private static List<string> ReadingSegments(string word) =>
        Kanji.ApplyReadingSegments(word)
            .Select(s => KANA_ONLY.Replace(s, ""))
            .Where(s => s != "")
            .ToList();

    /** One Japanese word/token → canonical IPA, SEGMENTAL only (no pitch downstep) — for segmental validation. */
    public static string PhonemizeWordSegmental(string word) =>
        Kana.KanaToIpa(KANA_ONLY.Replace(Kanji.ApplyReadings(word), "")) ?? "";

    /** Build the Japanese phonemizer (kana + numbers + kanji readings + bunsetsu segmentation). */
    public static ILanguage CreateJapanese() => new Engine();

    internal static void RegisterSelf() => Registry.Register("japanese", () => CreateJapanese());
}
