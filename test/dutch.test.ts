import { describe, expect, test } from "vitest";

import { phonemizeWord, createDutch } from "../src/languages/dutch/dutch.ts";

// Canonical-IPA goldens for Dutch / Nederlands (nl) — Northern Standard Dutch, West Germanic, Latin. Cleanroom
// rule-based g2p: open/closed-syllable vowel length, the Dutch diphthongs, g→ɣ (onset) / x (coda), w→ʋ, h→ɦ,
// final devoicing, unstressed ⟨e⟩→schwa. Validated at ~61% vs kaikki nl + wikipron nld broad (both Wiktionary-
// derived, name/loanword-heavy). See docs/investigations/nl_native_bringup_investigation.md.
describe("Dutch canonical IPA", () => {
    test("open/closed syllable vowel length (tense vs lax)", () => {
        expect(phonemizeWord("water")).toBe("ʋˈaːtər"); // open a → aː
        expect(phonemizeWord("dag")).toBe("dˈɑx"); // closed a → ɑ (+ final g → x)
        expect(phonemizeWord("man")).toBe("mˈɑn"); // closed → ɑ
        expect(phonemizeWord("maken")).toBe("mˈaːkən"); // open → aː
    });

    test("Dutch diphthongs (ij/ei→ɛi̯, ui→œy̯, ou/au→ɑu̯, eu→øː, oe→u)", () => {
        expect(phonemizeWord("tijd")).toBe("tˈɛi̯t"); // ij → ɛi̯ (+ final d → t)
        expect(phonemizeWord("huis")).toBe("ɦˈœy̯s"); // ui → œy̯
        expect(phonemizeWord("vrouw")).toBe("vrˈɑu̯"); // ouw → ɑu̯ (w absorbed)
        expect(phonemizeWord("deur")).toBe("dˈøːr"); // eu → øː
        expect(phonemizeWord("boek")).toBe("bˈuk"); // oe → u
        expect(phonemizeWord("mooi")).toBe("mˈoːi̯"); // ooi → oːi̯
        expect(phonemizeWord("nieuw")).toBe("nˈiu̯"); // ieuw → iu̯
    });

    test("g→ɣ (onset) / x (coda); ch→x; sch→sx; w→ʋ; h→ɦ", () => {
        expect(phonemizeWord("geven")).toBe("ɣˈeːvən"); // onset g → ɣ
        expect(phonemizeWord("groot")).toBe("ɣrˈoːt"); // onset cluster gr → ɣr
        expect(phonemizeWord("acht")).toBe("ˈɑxt"); // ch → x
        expect(phonemizeWord("school")).toBe("sxˈoːl"); // sch → sx
        expect(phonemizeWord("weg")).toBe("ʋˈɛx"); // w → ʋ, coda g → x
    });

    test("final devoicing (b/d/v/z/ɣ → p/t/f/s/x)", () => {
        expect(phonemizeWord("hond")).toBe("ɦˈɔnt"); // d → t
        expect(phonemizeWord("goed")).toBe("ɣˈut"); // d → t
        expect(phonemizeWord("huis")).toBe("ɦˈœy̯s"); // (s stays s)
    });

    test("unstressed ⟨e⟩ → schwa; ng/nk", () => {
        expect(phonemizeWord("zeven")).toBe("zˈeːvən"); // 2nd e → ə
        expect(phonemizeWord("over")).toBe("ˈoːvər"); // -er → ər
        expect(phonemizeWord("zingen")).toBe("zˈɪŋən"); // ng → ŋ
        expect(phonemizeWord("bank")).toBe("bˈɑŋk"); // nk → ŋk
    });

    test("native unstressed suffixes (-ig→əx, -lijk→lək, -isch→is)", () => {
        expect(phonemizeWord("twintig")).toBe("tʋˈɪntəx"); // -ig → əx
        expect(phonemizeWord("mogelijk")).toBe("mˈoːɣələk"); // -lijk → lək
        expect(phonemizeWord("typisch")).toBe("tˈipis"); // -isch → is (y → i)
        expect(phonemizeWord("big")).toBe("bˈɪx"); // monosyllable: NOT reduced (guard)
        expect(phonemizeWord("lijk")).toBe("lˈɛi̯k"); // word-initial lijk: NOT the suffix
    });

    test("unstressed prefix: stress shifts + ge-/be-/ver-/te- vowel reduces to schwa", () => {
        expect(phonemizeWord("verkopen")).toBe("vərkˈoːpən"); // ver → vər (reduced), stress → kopen
        expect(phonemizeWord("gemaakt")).toBe("ɣəmˈaːkt"); // ge- participle → ɣə
        expect(phonemizeWord("begin")).toBe("bəɣˈɪn"); // be- → bə
        expect(phonemizeWord("geven")).toBe("ɣˈeːvən"); // ge = ROOT here (nucleus2 is schwa) → stays ɣeː, stress first
        expect(phonemizeWord("geel")).toBe("ɣˈeːl"); // monosyllable → not a prefix
    });

    test("trema ⟨ë⟩ in the -ën plural → schwa (but stressed ë keeps quality)", () => {
        expect(phonemizeWord("knieën")).toBe("knˈiən"); // ie→i, ë→ə
        expect(phonemizeWord("tweeën")).toBe("tʋˈeːən"); // ee→eː, ë→ə
        expect(phonemizeWord("poëzie")).toBe("pˈoːeːzi"); // stressed ë keeps eː (more material after)
    });

    test("function words + numbers", () => {
        const d = createDutch();
        expect(d.text("de kat").trim()).toBe("də kˈɑt"); // de → də (reduced clitic)
        expect(d.text("21").trim()).toBe("ˈeːnəntʋɪntəx"); // eenentwintig
        expect(d.text("100").trim()).toBe("ɦˈɔndərt"); // honderd
    });
});
