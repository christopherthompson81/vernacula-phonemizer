/**
 * Four Mandarin defects the Rust port found by reading (#1463), fixed TS-first. Expected strings were taken
 * from the fixed engine's own output, not typed.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeMandarin } from "../src/languages/mandarin/normalize.ts";
import { MANIFEST } from "../src/languages/mandarin/manifest.ts";
import { createPinyinPhonemizer } from "../src/languages/mandarin/mandarin.ts";

const HAN = /\p{Script=Han}/u;

describe("no raw Han reaches the IPA", () => {
    test("a Han code point with no reading is dropped, and the rest of the run still reads", () => {
        expect(phonemize("𠮷野家", "cmn")).toBe("jiɛ˨˩˦ t͡ɕiɑ˥˥");
        expect(phonemize("𪛖", "cmn")).toBe("");
        // The cdo golden's case: a Min dialect character reached Mandarin through the script router.
        expect(phonemize("復加𡅏北韓", "cdo")).not.toMatch(HAN);
    });

    test("a Kangxi radical or a compatibility ideograph reads as the ideograph NFKC folds it to", () => {
        expect(phonemize("⼀", "cmn")).toBe(phonemize("一", "cmn"));
        expect(phonemize("⼀个", "cmn")).toBe(phonemize("一个", "cmn"));
        expect(phonemize("⼀个", "cmn")).toBe("ji˧˥ kɤ˥˩");
        expect(phonemize("\u{F900}", "cmn")).toBe(phonemize("\u{F900}".normalize("NFKC"), "cmn"));
        expect(phonemize("\u{F900}", "cmn")).not.toMatch(HAN);
    });

    test("the iteration mark repeats the character before it, and is dropped with nothing to repeat", () => {
        expect(phonemize("人々", "cmn")).toBe(phonemize("人人", "cmn"));
        expect(phonemize("時々刻々", "cmn")).toBe("ʂʐ̩˧˥ ʂʐ̩˧˥ kʰɤ˥˩ kʰɤ˥˩");
        expect(phonemize("々", "cmn")).toBe("");
    });

    test("an unparseable pinyin token is dropped, not emitted as text", () => {
        const py = createPinyinPhonemizer();
        expect(py("ni3 xyz9 hao3")).toBe("ni˨˩˦ xɑᵘ˨˩˦");
        expect(py("ni3 hao3")).toBe("ni˧˥ xɑᵘ˨˩˦");
    });
});

describe("the fraction guards agree on both sides", () => {
    test("a decimal or a grouped number on the right declines, as on the left", () => {
        expect(normalizeMandarin("1/2.5")).toBe("1/2.5");
        expect(normalizeMandarin("3/4,5")).toBe("3/4,5");
        expect(normalizeMandarin("1.5/2")).toBe("1.5/2");
        expect(normalizeMandarin("3,4/5")).toBe("3,4/5");
    });
    test("a fraction before sentence punctuation still reads", () => {
        expect(normalizeMandarin("1/2")).toBe("2分之1");
        expect(normalizeMandarin("1/2.")).toBe("2分之1.");
        expect(normalizeMandarin("1/2, 好")).toBe("2分之1, 好");
        expect(phonemize("1/2.5", "cmn")).toBe("ji˥˥ ər˥˩ tiɛn˧˥ wu˨˩˦");
    });
});

describe("the direct pinyin path takes only real syllables", () => {
    test("a lowercase alphanumeric that is not pinyin takes the scanner: letters to English, digits to a numeral", () => {
        expect(phonemize("mp3", "cmn")).toBe("ˌɛmpˈiː san˥˥");
        expect(phonemize("mp3", "cmn")).toBe(phonemize("我有mp3", "cmn").replace(/^wo˧˥ jioᵘ˨˩˦ /u, ""));
        expect(phonemize("web3", "cmn")).toBe("wˈɛb san˥˥");
        expect(phonemize("a4 paper", "cmn")).toBe("ˈə sɹ̩˥˩ pʰˈeᶦpɚ");
        for (const t of ["mp3", "ipv4", "web3", "a4 paper"]) expect(phonemize(t, "cmn")).not.toMatch(/[a-z]\d/u);
    });
    test("real pinyin is unchanged", () => {
        expect(phonemize("ni3 hao3", "cmn")).toBe("ni˧˥ xɑᵘ˨˩˦");
        expect(phonemize("ni3 hao", "cmn")).toBe("ni˨˩˦ xɑᵘ");
        expect(phonemize("lv4", "cmn")).toBe("ly˥˩");
        expect(phonemize("a4", "cmn")).toBe("ɑ˥˩"); // a real syllable (à): still pinyin
    });
});

test("the manifest type admits the position cmn.jsonc declares", () => {
    // Checked by `npm run typecheck`: against the old `"before" | "after"` this assignment does not compile.
    const declared: typeof MANIFEST.symbolTier.exponentWords.position = "compound";
    expect(MANIFEST.symbolTier.exponentWords.position).toBe(declared);
});
