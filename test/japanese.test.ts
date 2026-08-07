import { describe, expect, it, test } from "vitest";
import { phonemize } from "../src/index.ts";

const phonemizeText = (t: string): string => phonemize(t, "ja");
import {
    phonemizeWord,
    phonemizeWordSegmental,
} from "../src/languages/japanese/japanese.ts";

describe("Japanese kana → IPA", () => {
    it("core kana, youon, sokuon, long vowels, moraic ん", () => {
        const cases: [string, string][] = [
            ["です", "de̞sɯᵝ"],
            ["する", "sɯᵝɾɯᵝ"],
            ["ありがとう", "äɾiɡäto̞ː"], // おう → o̞ː
            ["がっこう", "ɡäkko̞ː"], // sokuon geminate + おう
            ["きょう", "kʲo̞ː"], // youon
            ["とうきょう", "to̞ːkʲo̞ː"],
            ["コーヒー", "ko̞ːçiː"], // katakana + long mark
            ["いい", "iː"], // same-vowel coalescence
        ];
        for (const [w, exp] of cases)
            expect(phonemizeWordSegmental(w)).toBe(exp);
    });

    it("moraic ん place assimilation (n / ŋ / m / ɴ)", () => {
        expect(phonemizeWordSegmental("こんにちは")).toBe("ko̞nnit͡ɕihä"); // n before coronal
        expect(phonemizeWordSegmental("にほんご")).toBe("niho̞ŋɡo̞"); // ŋ before velar
        expect(phonemizeWordSegmental("さんぽ")).toBe("sämpo̞"); // m before labial
        expect(phonemizeWordSegmental("にほん")).toBe("niho̞ɴ"); // ɴ word-finally
    });

    it("extended (foreign-sound) katakana", () => {
        expect(phonemizeWordSegmental("チェック")).toBe("t͡ɕe̞kkɯᵝ");
        expect(phonemizeWordSegmental("ファン")).toBe("ɸäɴ");
        expect(phonemizeWordSegmental("メディア")).toBe("me̞diä");
    });

    it("numbers", () => {
        expect(phonemize("0", "ja")).toBe("ɾe̞ː");
        expect(phonemize("4", "ja")).toBe("jo̞ɴ");
        expect(phonemize("300", "ja")).toBe("sämbʲäkɯᵝ"); // rendaku ひゃく→びゃく + ん→m
    });

    it("sentence: clause punctuation → pause marks", () => {
        expect(phonemize("これはペンです。", "ja")).toBe("ko̞ɾe̞wä pe̞nde̞sɯᵝ .");
    });

    it("kanji → kana readings", () => {
        expect(phonemizeWordSegmental("日本語")).toBe("niho̞ŋɡo̞");
        expect(phonemizeWordSegmental("東京")).toBe("to̞ːkʲo̞ː");
        expect(phonemizeWordSegmental("食べる")).toBe("täbe̞ɾɯᵝ");
        expect(phonemizeWordSegmental("十")).toBe("d͡ʑɯᵝː"); // じゅう → long vowel ː (preferred notation, even after youon)
    });

    it("bunsetsu segmentation of spaceless kanji text", () => {
        // 私は | 学生です — the particle は attaches to the preceding kanji head, one space at the bunsetsu boundary.
        expect(phonemize("私は学生です", "ja")).toBe("wätäɕiwä ɡäkɯᵝse̞ːde̞sɯᵝ");
        // 語を stays ɡo̞o̞ (を is a distinct kana, no same-vowel fold across the particle).
        expect(phonemize("日本語を", "ja")).toBe("niho̞ŋɡo̞o̞");
    });
});

describe("Japanese counters (助数詞)", () => {
    it("gemination + handaku/rendaku on h-counters", () => {
        expect(phonemize("1本", "ja")).toBe("iꜜppo̞ɴ"); // いっぽん
        expect(phonemize("3本", "ja")).toBe("säꜜmbo̞ɴ"); // さんぼん (rendaku after ん)
        expect(phonemize("10本", "ja")).toBe("d͡ʑɯᵝppo̞ɴ"); // じゅっぽん
        expect(phonemize("4分", "ja")).toBe("jo̞mpɯᵝɴ"); // よんぷん (four-form handaku)
        expect(phonemize("3分", "ja")).toBe("sämpɯᵝɴ"); // さんぷん
    });
    it("Sino number readings for 4/7/9 on some counters", () => {
        expect(phonemize("4時", "ja")).toBe("jo̞ꜜd͡ʑi"); // よじ, not よんじ
        expect(phonemize("8月", "ja")).toBe("hät͡ɕiɡät͡sɯᵝ"); // はちがつ
    });
    it("wholly-irregular readings (人 1/2)", () => {
        expect(phonemize("1人", "ja")).toBe("çito̞ꜜɾi"); // ひとり
        expect(phonemize("2人", "ja")).toBe("ɸɯᵝtäɾi"); // ふたり
    });
    it("digit-3-only rendaku: 3階 rendakus but 1000階 does not", () => {
        expect(phonemize("3階", "ja")).toBe("säŋɡäi"); // さんがい
        expect(phonemize("1000階", "ja")).toBe("se̞ꜜŋkäi"); // せんかい (no rendaku after せん)
    });
    it("irregular hundreds geminate (びゃく/ぴゃく, not just ひゃく)", () => {
        expect(phonemize("300本", "ja")).toBe("sämbʲäppo̞ɴ"); // さんびゃっぽん
        expect(phonemize("600本", "ja")).toBe("ɾo̞ppʲäppo̞ɴ"); // ろっぴゃっぽん
        expect(phonemize("800本", "ja")).toBe("häppʲäppo̞ɴ"); // はっぴゃっぽん
    });
    it("internal は/へ in a counter reading is not particle-converted (2泊→にはく)", () => {
        expect(phonemize("2泊", "ja")).toBe("nihäkɯᵝ"); // にはく, not にわく
    });
    it("does not fuse when the counter kanji heads a compound; still fuses before a verb", () => {
        expect(phonemize("3時間", "ja")).toBe("säɴ d͡ʑikäɴ"); // さん じかん, not さんじ+間
        expect(phonemize("3年生", "ja")).toBe("säɴ ne̞nse̞ː"); // さん ねんせい, not さんねん+生
        expect(phonemize("1冊読む", "ja")).toBe("issät͡sɯᵝ jo̞ꜜmɯᵝ"); // いっさつ (euphony kept before a verb kanji)
    });
});

describe("Japanese pitch accent", () => {
    it("contrastive minimal pair via downstep ꜜ", () => {
        expect(phonemizeWord("箸")).toBe("häꜜɕi"); // chopsticks, accent 1
        expect(phonemizeWord("端")).toBe("häɕi"); // edge, heiban (no mark)
        expect(phonemizeWord("橋")).toBe("häɕiꜜ"); // bridge, accent 2
    });

    it("bunsetsu: accent on the content stem, particle/copula stripped", () => {
        // 今日 accent-2 (kʲo̞ꜜː) survives the topic は; 天気 accent-1 survives です.
        expect(phonemize("今日は天気がいい", "ja")).toBe(
            "kʲo̞ꜜːhä te̞ꜜŋkiɡä iꜜː",
        );
    });
});

// long-vowel coalescence used to run across MORPHEME boundaries, absorbing the next morpheme's initial
// vowel into the previous one's length (経営 けい|えい → ke̞ːːː instead of ke̞ːe̞ː). Readings now carry their
// boundaries (applyReadingSegments) and coalescence is confined to a segment. A compound whose stored reading
// is NOT the sum of its characters' readings finds no alignment and stays fused — which is exactly the set
// that legitimately DOES coalesce, so no exception list is needed.
describe("Japanese morpheme-boundary coalescence", () => {
    test("a boundary vowel is no longer absorbed into the preceding length", () => {
        expect(phonemizeWord("経営")).toBe("ke̞ːe̞ː"); // けい|えい — was ke̞ːːː
        expect(phonemizeWord("聖域")).toBe("se̞ːiki"); // せい|いき — was se̞ːːki
        expect(phonemizeWord("東欧")).toBe("to̞ːo̞ː"); // とう|おう — was to̞ːːː
    });

    test("compounds whose reading is NOT the sum of their parts stay fused", () => {
        expect(phonemizeWord("小売")).toBe("ko̞ːɾi"); // 売 has no reading うり → no split → kōri, correct
        expect(phonemizeWord("大人")).toBe("o̞to̞nä"); // おとな ≠ おお+ひと
        expect(phonemizeWord("今日")).toBe("kʲo̞ꜜː"); // きょう ≠ いま+ひ (accent on mora 1, hence the ꜜ)
    });

    test("EXPRESSIVE lengthening is preserved — it is author intent, not an artifact", () => {
        expect(phonemizeWord("ああああ")).toBe("äːːː");
        expect(phonemizeWord("スーーパー")).toBe("sɯᵝːːpäː");
    });

    test("sokuon っ still geminates ACROSS a segment boundary", () => {
        // same shape as the ん case: per-segment conversion hid the next onset from a segment-final っ,
        // degrading gemination to a glottal stop (吹っ切れ ふ|っ|き|れ → ɸɯᵝʔkiɾe̞).
        expect(phonemizeWord("吹っ切れ")).toBe("ɸɯᵝkkiɾe̞");
        expect(phonemizeWord("引っ越し")).toBe("çikko̞ɕi");
        expect(phonemizeWord("学校")).toBe("ɡäkko̞ː"); // within one segment — unchanged
    });

    test("moraic ん still assimilates ACROSS a segment boundary", () => {
        // per-segment conversion hid the next onset from a segment-final ん (健康 けん|こう → ke̞ɴko̞ː);
        // assimilation re-runs over the joined morae.
        expect(phonemizeWord("健康")).toBe("ke̞ŋko̞ː");
        expect(phonemizeWord("日本語")).toBe("niho̞ŋɡo̞");
        expect(phonemizeWord("散歩")).toBe("sämpo̞");
    });

    test("coalescence still fires WITHIN a kana run", () => {
        expect(phonemizeWord("おおさか")).toBe("o̞ːsäkä");
        expect(phonemizeWord("とうきょう")).toBe("to̞ːkʲo̞ː");
    });
});

// residual — particle-boundary segmentation. Particles left fused to a following word let long-vowel
// coalescence fire across the bunsetsu boundary (東京のうち read のう as [noː]); stranded particles split the
// other way picked up pitch accents from the dictionary (85 で → de̞ꜜ). Three mechanisms: the extended
// single/multi particle sets in segmentText, particle CHAINING (では/での stay attached to their content
// word), and a pitch-layer guard (a bare particle token is always heiban).
describe("Japanese particle segmentation", () => {
    test("coalescence no longer crosses a particle boundary", () => {
        expect(phonemizeText("そのうち")).toBe("so̞no̞ ɯᵝt͡ɕi"); // was so̞no̞ːt͡ɕi
        expect(phonemizeText("東京のうち")).toBe("to̞ːkʲo̞ːno̞ ɯᵝt͡ɕi"); // was …no̞ːt͡ɕi
        expect(phonemizeText("彼とうちに行く")).toContain("ɯᵝt͡ɕini"); // とう not folded
    });

    test("copula and できる forms stay whole", () => {
        expect(phonemizeText("私は学生です")).toBe("wätäɕiwä ɡäkɯᵝse̞ːde̞sɯᵝ");
        expect(phonemizeText("増減できます")).toBe("zo̞ːɡe̞nde̞kimäsɯᵝ");
    });

    test("particle chains attach to their content word — no stranded accented particle", () => {
        expect(phonemizeText("端では")).toBe("häɕide̞wä"); // not häɕide̞ wäꜜ
        expect(phonemizeText("警察での申請")).toBe("ke̞ːsät͡sɯᵝde̞no̞ ɕinse̞ː");
        expect(phonemizeText("本などを読む")).toBe("ho̞nnädo̞o̞ jo̞ꜜmɯᵝ");
    });

    test("a bare particle token is heiban even when isolated by digits/katakana", () => {
        for (const t of ["二時に", "85 で", "ビザ を"]) {
            expect(phonemizeText(t), t).not.toMatch(/(?:^| )(?:no̞|to̞|mo̞|de̞|wä|o̞|ni)ꜜ(?: |$)/u);
        }
    });

    test("word-internal lookalikes never split", () => {
        expect(phonemizeText("きのこのスープ")).toBe("kino̞ko̞no̞sɯᵝːpɯᵝ"); // internal この
        expect(phonemizeText("飲んで")).toBe("no̞ꜜnde̞"); // て-form で after ん
    });
});

/**
 * TEXT NORMALIZATION. Each expectation below is a defect the ja_jp corpus (3,208 utterances) proved
 * was there, with its count; the "was" comment is what the engine actually produced before normalize.ts.
 */
describe("Japanese text normalization", () => {
    test("comma-grouped thousands were a phrase break plus a second number", () => {
        // ×56, the largest numeric defect: the comma is clause punctuation, so 3,850 read as "さん , 850".
        expect(phonemizeText("3,850")).toBe("sänze̞ɴhäppʲäkɯᵝɡo̞d͡ʑɯᵝː");
        expect(phonemizeText("1,000,000")).toBe("çäkɯᵝmäɴ"); // both separators collapse
        expect(phonemizeText("1,2")).toContain(" , "); // …and a non-grouping comma stays a pause
    });

    // Japanese has no spaces, so a unit is normally followed by kana — and the shared tier's
    // letter-boundary guard was rejecting exactly that, letting the abbreviation reach the phoneme sink
    // verbatim. Measured over ja_jp: 14 utterances, all of this shape.
    test("a unit survives a kana neighbour instead of leaking", () => {
        expect(phonemizeText("35 mmで")).toBe("sänd͡ʑɯᵝːɡo̞ miɾime̞ːto̞ɾɯᵝde̞"); // was a raw `m`
        expect(phonemizeText("5tの車")).toBe("ɡo̞ to̞nno̞ kɯᵝɾɯᵝmä"); // was English *tʰˈiː*
        expect(phonemizeText("50 km²の")).toBe("ɡo̞d͡ʑɯᵝː he̞ːho̞ːkiɾo̞me̞to̞ɾɯᵝno̞"); // 平方キロメートル
        // …and the version suffix must NOT become グラム: 802.11g is read as a letter, not as grams.
        expect(phonemizeText("802.11gとの")).not.toContain("ɾämɯᵝ");
    });

    test("embedded Latin is nativized instead of read as English", () => {
        // The English fallback (core/foreign.ts) injects phonemes Japanese has no inventory for:
        // NASA was [nˈæsə], WHO [dˈʌbəɫjuː ˈeᶦt͡ʃ ˈoᶷ], SNS [ˈɛs ˈɛn ˈɛs]. Corpus-wide this took the
        // utterances carrying a foreign phoneme from 257 to 96 — the rest are mixed-case loanwords.
        expect(phonemizeText("FBI")).toBe("e̞ɸɯᵝbiːäꜜi"); // one accentual phrase, not three
        expect(phonemizeText("SNS")).toBe("e̞sɯᵝe̞nɯᵝe̞ꜜsɯᵝ");
        expect(phonemizeText("NASA")).toBe("näꜜsä"); // the listed word reading, not letters
        // Joining the letter names runs them into kana.ts's long-vowel coalescence, which is a
        // word-INTERNAL rule: CEO as シーイーオー gave [ɕiːːː], a four-mora vowel. A boundary goes in
        // exactly where the next name's bare vowel matches the vowel before it.
        expect(phonemizeText("CEO")).toBe("ɕiꜜː iːo̞ː");
        // …and the same coalescence crossed into the surrounding Japanese: た + ア ran together as [täːi].
        expect(phonemizeText("とらえられたISIS")).toBe("to̞ɾäe̞ɾäɾe̞tä äie̞sɯᵝäie̞ꜜsɯᵝ");
    });

    test("分の is a fraction only between two digits", () => {
        // The counter fusion read 3分 as the MINUTES counter, so 3分の1 was さん*ぷん*の ("three minutes
        // of"). Of the 26 分の in the corpus only 5 are fractions, which is why both digits are required.
        expect(phonemizeText("3分の1")).toBe("säɴ bɯᵝnno̞ it͡ɕi");
        expect(phonemizeText("1/2")).toBe("ni bɯᵝnno̞ it͡ɕi"); // the slash was dropped outright
        expect(phonemizeText("自分の限界")).toBe("d͡ʑibɯᵝnno̞ ɡe̞ŋkäi"); // 自分の — not a fraction
        expect(phonemizeText("7時30分の間")).toBe("ɕit͡ɕid͡ʑisänd͡ʑɯᵝppɯᵝnno̞ äidä"); // real minutes
    });

    test("units, degrees and the squared unit", () => {
        expect(phonemizeText("5kg")).toBe("ɡo̞ kiɾo̞ɡɯᵝꜜɾämɯᵝ"); // was the raw letters [kɡ]
        expect(phonemizeText("3m")).toBe("säɴ me̞ːto̞ɾɯᵝ"); // was the English letter M
        expect(phonemizeText("3,850 km²")).toBe("sänze̞ɴhäppʲäkɯᵝɡo̞d͡ʑɯᵝː he̞ːho̞ːkiɾo̞me̞ꜜto̞ɾɯᵝ");
        expect(phonemizeText("30℃")).toBe("sänd͡ʑɯᵝːdo̞"); // ℃ is one character the symbol tier can't see
    });

    test("decimals, ranges and the clock", () => {
        // The point was clause punctuation too. Japanese reads the fractional digits ONE AT A TIME.
        expect(phonemizeText("6.34")).toBe("ɾo̞kɯᵝ te̞nsäɴjo̞ɴ"); // was "ろく . さんじゅうよん"
        expect(phonemizeText("2～3回")).toBe("ni käɾäsäŋkäi"); // ×37, the mark was silently dropped
        expect(phonemizeText("11:00")).toBe("d͡ʑɯᵝːit͡ɕid͡ʑi"); // :00 drops the minutes
        // The corpus's other colons are a ratio and a UK degree class; two digits of minutes excludes both.
        expect(phonemizeText("3:2")).toBe("säɴ ni");
    });

    test("the ampersand is アンド, and the epenthetic vowel is the proof", () => {
        // wav2vec2: `x oː k ɪ l  b iː a n d ə b iː  ɡ ʊ m o t o …`. Japanese cannot end a syllable in /d/, so
        // a borrowed "and" must surface as /a.n.do/ — the `ə` is the language's phonotactics stamped onto the
        // English word, which is exactly what アンド spells.
        const s = phonemize("高級B&Bが主として寝具と朝食の2つの要素で競争しているのは明らかです。", "ja");
        expect(s).toContain("ändo̞");
        expect(s).not.toBe(phonemize("高級BBが主として寝具と朝食の2つの要素で競争しているのは明らかです。", "ja"));
    });
});
