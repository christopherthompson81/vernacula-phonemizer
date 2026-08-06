import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordRules } from "../src/languages/akan/akan.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Akan / Akan kasa (ak) — a Kwa (Niger-Congo) language of Ghana, the fleet's FIRST Kwa
// language. Shallow, well-standardised Latin orthography (Asante/Akuapem Twi + Fante). Segmental signature: the
// consonant DIGRAPH system (palatal ⟨ky gy hy ny⟩ → t͡ɕ d͡ʑ ɕ ɲ + labialised ⟨tw dw kw gw hw nw⟩ → t͡ɕʷ d͡ʑʷ kʷ ɡʷ ɕʷ
// ŋʷ), Glide Formation (boa→bwa), coda-nasal + Labial Nasalization (Paster 2010), and ATR harmony. TONE (H/L) and
// vowel nasality are lexical (unwritten) → carried by a mined lexicon on the SHIPPED phonemizeWord (Chao letters
// H→˥/L→˩); phonemizeWordRules is the tone-free segmental path. Authored from Dolphyne (1988)/Paster (2010),
// anchored on kaikki.
describe("Akan (Twi) canonical IPA", () => {
    test("palatal digraph series ⟨ky gy hy ny⟩", () => {
        expect(phonemizeWordRules("kyerɛ")).toBe("t͡ɕɪrɛ"); // ky → t͡ɕ; ⟨e⟩ → [ɪ] via ATR harmony (−ATR word)
        expect(phonemizeWordRules("gyina")).toBe("d͡ʑina"); // gy → d͡ʑ ("stand")
        expect(phonemizeWordRules("ɔhyɛ")).toBe("ɔɕɛ"); // hy → ɕ
        expect(phonemizeWordRules("nyansa")).toBe("ɲansa"); // ny → ɲ ("wisdom")
    });

    test("labialised digraph series ⟨tw dw kw hw⟩ — the signature Akan labial-palatalisation", () => {
        expect(phonemizeWordRules("twi")).toBe("t͡ɕʷi"); // the language's own name
        expect(phonemizeWordRules("dwom")).toBe("d͡ʑʷom"); // dw → d͡ʑʷ ("song")
        expect(phonemizeWordRules("kwan")).toBe("kʷan"); // kw → kʷ ("road/way")
        expect(phonemizeWordRules("hwɛ")).toBe("ɕʷɛ"); // hw → ɕʷ ("look")
        expect(phonemizeWordRules("akwaaba")).toBe("akʷaaba"); // "welcome"
    });

    test("Glide Formation + Labial Nasalization + coda assimilation (Paster 2010)", () => {
        expect(phonemizeWordRules("boa")).toBe("bwa"); // round V before another V → w ("help")
        expect(phonemizeWordRules("mba")).toBe("mma"); // /b/ → [m] after a nasal (Labial Nasalization)
        expect(phonemizeWordRules("nkran")).toBe("ŋkran"); // n → ŋ before k (Accra)
    });

    test("ATR harmony resolves ⟨e⟩/⟨o⟩ (the unwritten [+ATR]/[−ATR] merger)", () => {
        expect(phonemizeWordRules("bisa")).toBe("bisa"); // +ATR (has i) — ⟨a⟩ neutral
        expect(phonemizeWordRules("ɔkɔtɔ")).toBe("ɔkɔtɔ"); // −ATR (ɔ), no ambiguous mid
        expect(phonemizeWordRules("obue")).toBe("obwe"); // +ATR (has u) → ⟨o⟩→o, ⟨e⟩→e, + glide formation
    });

    test("TONE (H/L) + vowel nasality — lexical, from the mined lexicon (shipped path)", () => {
        expect(phonemizeWord("papa")).toBe("pa˩pa˥"); // L H
        expect(phonemizeWord("ɔkɔtɔ")).toBe("ɔ˩kɔ˥tɔ˩"); // L H L ("crab")
        expect(phonemizeWord("huu")).toBe("hu˥u˩"); // H L
        expect(phonemizeWord("mifi")).toBe("mĩ˩fi˥"); // L H, first vowel NASAL
        expect(phonemizeWordRules("papa")).toBe("papa"); // rule path stays tone-free (non-circular)
    });

    test("numbers — Twi cardinals through the g2p", () => {
        const ak = getPhonemizer("ak");
        expect(ak.text("12").trim()).toBe("du mmienu"); // du + mmienu
        expect(ak.text("100").trim()).toBe("ɔha");
    });

    // Source for the magnitude words: Omniglot "Numbers in Twi" (omniglot.com/language/numbers/twi.htm) —
    // apem 10³, ɔpepem 10⁶, ɔpepepem 10⁹; the plurals take the regular ɔ-/a- → m- change (ɔha→aha, apem→mpem).
    test("numbers — units, 21–99 compounds, hundreds, thousands, millions, billions", () => {
        const ak = getPhonemizer("ak");
        expect(ak.text("4").trim()).toBe("nnan"); // ennan/nnan — the ⟨nn⟩ unit
        expect(ak.text("40").trim()).toBe("adwanan"); // aduanan
        expect(ak.text("44").trim()).toBe("adwanan nnan");
        expect(ak.text("21").trim()).toBe("adwonu baako"); // aduonu baako
        expect(ak.text("555").trim()).toBe("ahanum adwonum nnum"); // ahanum aduonum nnum
        expect(ak.text("1000").trim()).toBe("apem");
        expect(ak.text("2000").trim()).toBe("mpem mmienu");
        // REGRESSION: numberWords had no 10⁶/10⁹ branch, so the multiplier hit hundreds[9] and 1000000 came out
        // as the stringified sentinel "mpem undefined".
        expect(ak.text("1000000").trim()).toBe("ɔpɪpɪm"); // ɔpepem (⟨e⟩ → ɪ by −ATR harmony)
        expect(ak.text("1000000000").trim()).toBe("ɔpɪpɪpɪm"); // ɔpepepem
    });

    test("full text via the registry", () => {
        expect(getPhonemizer("ak").text("Akwaaba, wo ho te sɛn?")).toBeTruthy();
    });
});
