import { describe, expect, it } from "vitest";
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
        expect(phonemizeWordSegmental("十")).toBe("d͡ʑɯᵝɯᵝ"); // youon blocks same-vowel coalescence
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
