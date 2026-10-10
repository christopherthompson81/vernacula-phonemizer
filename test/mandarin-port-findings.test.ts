/**
 * Mandarin defects the Rust port found by reading (#1463), fixed TS-first, plus the review round on them.
 * Expected strings were taken from the fixed engine's own output, not typed.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize, phonemizeTrace } from "../src/index.ts";
import { foldHanCompatibility } from "../src/core/unicode.ts";
import { normalizeMandarin } from "../src/languages/mandarin/normalize.ts";
import { MANIFEST } from "../src/languages/mandarin/manifest.ts";
import { createPinyinPhonemizer } from "../src/languages/mandarin/mandarin.ts";
import { makeStrictPinyinToIpa } from "../src/languages/mandarin/pinyinToIpa.ts";
import { loadTsvMap } from "../src/core/loadTsv.ts";

const HAN = /\p{Script=Han}/u;
const cmn = (s: string): string => phonemize(s, "cmn");

describe("no raw Han reaches the IPA", () => {
    test("a Han code point with no reading is dropped, and the rest of the run still reads", () => {
        expect(cmn("𠮷野家")).toBe("jiɛ˨˩˦ t͡ɕiɑ˥˥");
        expect(cmn("𪛖")).toBe("");
        // The cdo golden's case: a Min dialect character reached Mandarin through the script router.
        expect(phonemize("復加𡅏北韓", "cdo")).not.toMatch(HAN);
    });

    test("a Kangxi radical or a compatibility ideograph reads as the ideograph NFKC folds it to", () => {
        expect(cmn("⼀")).toBe(cmn("一"));
        expect(cmn("⼀个")).toBe("ji˧˥ kɤ˥˩");
        expect(cmn("\u{F900}")).toBe(cmn("\u{F900}".normalize("NFKC")));
        expect(cmn("\u{F900}")).not.toMatch(HAN);
    });

    test("foldHanCompatibility folds every Han code point NFKC changes, each to one Han character", () => {
        let folded = 0;
        for (let cp = 0; cp <= 0x3ffff; cp++) {
            if (cp >= 0xd800 && cp <= 0xdfff) continue;
            const c = String.fromCodePoint(cp);
            if (!HAN.test(c) || c.normalize("NFKC") === c) {
                if (HAN.test(c)) expect(foldHanCompatibility(c)).toBe(c);
                continue;
            }
            expect(foldHanCompatibility(c)).toBe(c.normalize("NFKC"));
            expect(foldHanCompatibility(c)).toMatch(/^\p{Script=Han}$/u);
            folded++;
        }
        expect(folded).toBe(1221);
        expect(foldHanCompatibility("a⼀b〸")).toBe("a一b十");
    });

    test("the iteration marks 々 and 〻 repeat the character before them, and are dropped with nothing to repeat", () => {
        expect(cmn("人々")).toBe(cmn("人人"));
        expect(cmn("人〻")).toBe(cmn("人人"));
        expect(cmn("時々刻々")).toBe("ʂʐ̩˧˥ ʂʐ̩˧˥ kʰɤ˥˩ kʰɤ˥˩");
        expect(cmn("⼀々")).toBe(cmn("一一"));
        expect(cmn("々")).toBe("");
        expect(normalizeMandarin("人々")).toBe("人人");
    });

    test("the iteration rewrite is traced: one token, one group per hanzi", () => {
        const t = phonemizeTrace("人々好", "cmn");
        expect(t.normalized).toBe("人人好");
        expect(t.tokens).toHaveLength(1);
        const [a, b] = t.tokens[0]!.ipaSpan!;
        expect(t.ipa.slice(a, b).split(" ")).toHaveLength(3);
    });

    test("an unparseable pinyin token is dropped, not emitted as text", () => {
        const py = createPinyinPhonemizer();
        expect(py("ni3 xyz9 hao3")).toBe("ni˨˩˦ xɑᵘ˨˩˦");
        expect(py("ni3 hao3")).toBe("ni˧˥ xɑᵘ˨˩˦");
    });
});

describe("every chars.tsv reading is a syllable the converter can read", () => {
    // ⚠ A GAP HERE IS SILENT: the converter drops a token it cannot read, so a character whose reading has no
    // syllable-ipa.tsv key reads as nothing. The allowlist is every gap known today; a new one fails this test.
    //   ê1–ê4 — the interjection ê (欸, 誒), never their first reading; syllable-ipa.tsv has no `ê`.
    //   wong4 — not a Mandarin syllable (𥦷's only reading, 𥥈's second): a pypinyin data error.
    const ALLOWED = new Set(["ê1", "ê2", "ê3", "ê4", "wong4"]);
    test("no reading outside the allowlist is unreadable", () => {
        const meta = new URL("../src/languages/mandarin/mandarin.ts", import.meta.url).href;
        const st = MANIFEST.sandhi.thirdThird;
        const strict = makeStrictPinyinToIpa({
            syllableIpa: loadTsvMap(meta, "syllable-ipa.tsv"),
            tones: MANIFEST.tones,
            thirdToneSandhi: { from: Number(st.from), before: Number(st.before), to: Number(st.to) },
        });
        const missing = new Set<string>();
        const chars = loadTsvMap(meta, "chars.tsv", (v) => v.split(","));
        for (const readings of chars.values()) for (const r of readings) if (strict(r) === null) missing.add(r);
        for (const py of loadTsvMap(meta, "phrases.tsv").values())
            for (const r of py.split(" ")) if (strict(r) === null) missing.add(r);
        expect([...missing].sort()).toEqual([...ALLOWED].sort());
        expect(readFileSync(new URL("../data/languages/mandarin/chars.tsv", import.meta.url), "utf8")).toContain("𥦷\twong4");
    });
});

describe("the fraction guards are mirrors", () => {
    test("a decimal declines on either side; a thousands group declines on either side", () => {
        expect(normalizeMandarin("1/2.5")).toBe("1/2.5");
        expect(normalizeMandarin("1.5/2")).toBe("1.5/2");
        expect(normalizeMandarin("1/1,000,000")).toBe("1/1,000,000");
        expect(normalizeMandarin("5,000/10,000")).toBe("5,000/10,000");
    });
    test("any other comma is a list separator, on either side", () => {
        expect(normalizeMandarin("1/2,3/4")).toBe("2分之1,4分之3");
        expect(normalizeMandarin("3/4,5")).toBe("4分之3,5");
        expect(normalizeMandarin("3,4/5")).toBe("3,5分之4");
        expect(normalizeMandarin("好,1/2")).toBe("好,2分之1");
    });
    test("a fraction before sentence punctuation still reads", () => {
        expect(normalizeMandarin("1/2")).toBe("2分之1");
        expect(normalizeMandarin("1/2.")).toBe("2分之1.");
        expect(normalizeMandarin("1/2, 好")).toBe("2分之1, 好");
        expect(cmn("1/2,3/4")).toBe("ər˥˩ fən˥˥ ʈ͡ʂʐ̩˥˥ ji˥˥ , sɹ̩˥˩ fən˥˥ ʈ͡ʂʐ̩˥˥ san˥˥");
        expect(cmn("1/2.5")).toBe("ji˥˥ ər˥˩ tiɛn˧˥ wu˨˩˦");
    });
});

describe("the direct pinyin path takes only real syllables, all or nothing", () => {
    test("a lowercase alphanumeric that is not pinyin takes the scanner: letters to English, digits to a numeral", () => {
        expect(cmn("mp3")).toBe("ˌɛmpˈiː san˥˥");
        expect(cmn("web3")).toBe("wˈɛb san˥˥");
        expect(cmn("a4 paper")).toBe("ˈə sɹ̩˥˩ pʰˈeᶦpɚ");
        for (const t of ["mp3", "ipv4", "web3", "a4 paper"]) expect(cmn(t)).not.toMatch(/[a-z]\d/u);
    });
    test("one stray token declines the whole text", () => {
        expect(cmn("ni3 hao3 xyz")).toBe("nˈiː san˥˥ hˈaᶷ san˥˥ zˈaᶦz");
    });
    test("erhua r is the rhotic suffix of the syllable before it, outside the tone sequence", () => {
        expect(cmn("yi1 dian3 r5")).toBe("ji˥˥ tiɛnr˨˩˦");
        expect(cmn("yi1 dian3 r")).toBe(cmn("yi1 dian3 r5"));
        expect(cmn("dian3 r5 hao3")).toBe("tiɛnr˧˥ xɑᵘ˨˩˦"); // 3-3 sandhi across the suffix
        expect(cmn("r5")).toBe("ər"); // nothing to attach to: the syllable er
    });
    test("real pinyin is unchanged", () => {
        expect(cmn("ni3 hao3")).toBe("ni˧˥ xɑᵘ˨˩˦");
        expect(cmn("ni3 hao")).toBe("ni˨˩˦ xɑᵘ");
        expect(cmn("lv4")).toBe("ly˥˩");
        expect(cmn("er2")).toBe("ər˧˥");
        expect(cmn("a4")).toBe("ɑ˥˩"); // a real syllable (à): still pinyin
    });
});

test("the manifest type admits the position cmn.jsonc declares", () => {
    // Checked by `npm run typecheck`: against the old `"before" | "after"` this assignment does not compile.
    const declared: typeof MANIFEST.symbolTier.exponentWords.position = "compound";
    expect(MANIFEST.symbolTier.exponentWords.position).toBe(declared);
});
