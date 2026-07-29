import { describe, expect, it, test } from "vitest";
import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordSegmental,
} from "../src/languages/japanese/japanese.ts";

describe("Japanese kana → IPA (Phase 1)", () => {
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

    it("kanji → kana readings (Phase 2)", () => {
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

describe("Japanese pitch accent (Phase 3)", () => {
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

// #552 — long-vowel coalescence used to run across MORPHEME boundaries, absorbing the next morpheme's initial
// vowel into the previous one's length (経営 けい|えい → ke̞ːːː instead of ke̞ːe̞ː). Readings now carry their
// boundaries (applyReadingSegments) and coalescence is confined to a segment. A compound whose stored reading
// is NOT the sum of its characters' readings finds no alignment and stays fused — which is exactly the set
// that legitimately DOES coalesce, so no exception list is needed.
describe("Japanese morpheme-boundary coalescence (#552)", () => {
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
