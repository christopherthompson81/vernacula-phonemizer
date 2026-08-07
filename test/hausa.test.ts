import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeHausa } from "../src/languages/hausa/normalize.ts";
import { phonemizeWord } from "../src/languages/hausa/hausa.ts";
import { numberToWords } from "../src/languages/hausa/numbers.ts";

describe("Hausa g2p (authored, Boko orthography)", () => {
    it("segmental: implosives, ejectives, palatals, ɸ, n-assimilation", () => {
        expect(phonemizeWord("ɓera")).toBe("ɓˈera"); // implosive ɓ
        expect(phonemizeWord("ɗaya")).toBe("ɗˈa˥ja˥"); // implosive ɗ (+ tone)
        expect(phonemizeWord("ƙasa")).toBe("kʼˈa˥sa˥"); // ejective ƙ→kʼ
        expect(phonemizeWord("hankali")).toBe("ha˥ŋkˈa˩li˩"); // n→ŋ before k
        expect(phonemizeWord("kai")).toBe("kˈaⁱ"); // diphthong ai→aⁱ
        expect(phonemizeWord("sau")).toBe("sˈaᵘ"); // diphthong au→aᵘ
        expect(phonemizeWord("faa")).toBe("ɸˈaː"); // f→ɸ, long aa→aː
    });

    it("penultimate stress", () => {
        expect(phonemizeWord("Najeriya")).toBe("na˩d͡ʒe˥rˈi˥ja˩"); // 4 syll → stress 3rd (penult)
        expect(phonemizeWord("mutum")).toBe("mˈu˩tu˥˩m"); // 2 syll → stress 1st
    });

    it("lexical tone overlay (H ˥ / L ˩ / F ˥˩), out-of-lexicon untoned", () => {
        expect(phonemizeWord("ruwa")).toBe("rˈu˥wa˥"); // HH
        expect(phonemizeWord("uku")).toBe("ˈu˥ku˩"); // HL
        expect(phonemizeWord("sannu")).toBe("sˈannu"); // not in lexicon → no tone marks
    });

    // NUMBERS — Hausa is MAGNITUDE-FIRST (the scale word precedes its multiplier: dubu biyu = 2 000). The chain
    // stopped at dubu and fed the whole quotient to below1000(), which indexes ONES[⌊q/100⌋] — undefined for
    // q ≥ 1000 — so 100 000, 10⁶ and 10⁹ ALL collapsed to the same "dubu ɗari …" output. Scales miliyan (10⁶) and
    // biliyan (10⁹) from Omniglot "Numbers in Hausa"; that page also gives 100 000 as the native "zambar ɗari",
    // i.e. thousand-hundred, which is what "dubu ɗari" is here (dubu being this table's word for thousand).
    it("numbers: units, compounds, hundreds, and the miliyan / biliyan scales", () => {
        expect(numberToWords(7)).toBe("bakwai");
        expect(numberToWords(11)).toBe("goma sha ɗaya");
        expect(numberToWords(42)).toBe("arba'in da biyu"); // tens da unit
        expect(numberToWords(101)).toBe("ɗari da ɗaya");
        expect(numberToWords(555)).toBe("ɗari biyar da hamsin da biyar"); // hundred-five da fifty da five
        expect(numberToWords(12345)).toBe("dubu goma sha biyu da ɗari uku da arba'in da biyar");
        expect(numberToWords(100000)).toBe("dubu ɗari"); // thousand-hundred (was shared with 10⁶ and 10⁹)
        expect(numberToWords(1_000_000)).toBe("miliyan");
        expect(numberToWords(2_000_000)).toBe("miliyan biyu"); // multiplier FOLLOWS the scale word
        expect(numberToWords(1_000_000_000)).toBe("biliyan");
        expect(numberToWords(2_000_000_000)).toBe("biliyan biyu");
    });
});

// TEXT NORMALIZATION (src/languages/hausa/normalize.ts) — the pre-tokenizer pass. The defining
// rules are the kashi-prefix percent (kashi 80%), the comma-thousands, the dot-decimal "maki", the na
// safe/na yamma clocks, the B.C./BCE era markers, the rates "a awa", and the letter-spelled initialisms.
describe("Hausa text normalization", () => {
    const ph = (s: string): string => phonemize(s, "ha").trim();

    it("text→text: the kashi percent and the comma-thousands", () => {
        expect(ph("kashi 80%")).toBe("kˈaʃi ta˩mˈa˩ni˥n");
        expect(ph("88%")).toBe("kˈaʃi ta˩mˈa˩ni˥n dˈa tˈa˥kʷa˩s");
        expect(ph("6,387 km")).toBe("dˈu˥bu˥ ʃˈi˥da˩ dˈa ɗˈa˩ri˥ ˈu˥ku˩ dˈa ta˩mˈa˩ni˥n dˈa bˈakʷaⁱ kilomˈita");
        expect(ph("5,000,000")).toBe("milˈijan bˈi˩ja˥r");
    });

    it("the dot is a decimal (maki); the clock reads na safe/na yamma", () => {
        expect(ph("Hoto na 1.1")).toBe("hˈo˩to˥ nˈa ɗˈa˥ja˥ mˈaki ɗˈa˥ja˥");
        expect(ph("8:46 na safe")).toBe("tˈa˥kʷa˩s dˈa a˩rbˈa˩ʔi˥n dˈa ʃˈi˥da˩ nˈa sˈa˥ɸe˥");
        expect(ph("8:30 na yamma")).toBe("tˈa˥kʷa˩s dˈa ta˩lˈa˩ti˥n nˈa jˈa˥˩mma˥");
        expect(ph("15.00 UTC")).toBe("ɡˈo˥ma˩ ʃˈa˥ bˈi˩ja˥r ˈu tˈa t͡ʃˈa˥");
    });

    it("era markers expand; ranges join zuwa; rates use a awa", () => {
        expect(ph("1000 B.C.")).toBe("dˈu˥bu˥ kˈa˩ɸi˩n haⁱhˈuwar jˈesu");
        expect(ph("10,000 BCE")).toBe("dˈu˥bu˥ ɡˈo˥ma˩ kˈa˩ɸi˩n haⁱhˈuwar jˈesu");
        expect(ph("1990-1995")).toContain("zˈu˥wa"); // zuwa
        expect(ph("480 km/h")).toBe("ɗˈa˩ri˥ hˈu˥ɗu˥ dˈa ta˩mˈa˩ni˥n kilomˈita ˈa ˈa˥wa˩");
        expect(ph("133 m/s")).toBe("ɗˈa˩ri˥ dˈa ta˩lˈa˩ti˥n dˈa ˈu˥ku˩ mˈita ˈa da˩kʼˈi˥kʼa˩");
        expect(ph("12.8 km/h")).toBe("ɡˈo˥ma˩ ʃˈa˥ bˈi˥ju˥ mˈaki tˈa˥kʷa˩s kilomˈita ˈa ˈa˥wa˩");
        // trap pins: the decimal-percent (3.5%) and the B.C.kafin dedupe
        expect(ph("3.5%")).toBe("kˈaʃi ˈu˥ku˩ mˈaki bˈi˩ja˥r");
        expect(ph("kashi 3.5%")).toBe("kˈaʃi ˈu˥ku˩ mˈaki bˈi˩ja˥r"); // no double kashi
    });

    it("currency, degrees, fractions and initialisms read their words or letters", () => {
        expect(ph("$11,000")).toBe("dˈu˥bu˥ ɡˈo˥ma˩ ʃˈa˥ ɗˈa˥ja˥ dˈa˩la˥");
        expect(ph("US $ 30")).toBe("dˈa˩la˥ ta˩lˈa˩ti˥n");
        expect(ph("£27")).toBe("a˩ʃˈi˩ri˥n dˈa bˈakʷaⁱ ɸˈa˥˩m"); // fam
        expect(ph("30°C")).toBe("ta˩lˈa˩ti˥n diɡˈiri t͡ʃelsˈius");
        expect(ph("+30°C")).toBe("kʼˈari ta˩lˈa˩ti˥n diɡˈiri t͡ʃelsˈius");
        expect(ph("35°W")).toBe("ta˩lˈa˩ti˥n dˈa bˈi˩ja˥r diɡˈiri jˈa˥˩mma˥"); // digiri yamma
        expect(ph("inci 1/5")).toBe("ˈint͡ʃi ɗˈa˥ja˥ bˈi˥sa˥ bˈi˩ja˥r"); // ɗaya bisa biyar
        expect(ph("A1GP")).toBe("ˈa ɗˈa˥ja˥ ɡˈa pˈa");
        expect(ph("H5N1")).toBe("hˈa bˈi˩ja˥r nˈa ɗˈa˥ja˥"); // ha biyar na ɗaya
        expect(ph("Roe v. Wade")).toBe("rˈoe dˈa wˈade");
    });
});
