import { describe, expect, test } from "vitest";

import { phonemizeWord, createBelarusian } from "../src/languages/belarusian/belarusian.ts";

// Belarusian (be) — East Slavic, Cyrillic. Rule g2p mirroring Ukrainian's iotated/palatalisation machinery, plus
// Belarusian signatures: г→ɣ, retroflex ж/ш/ч→ʐ/ʂ/t͡ʂ, ⟨і⟩ iotated (Іван→jivan), ⟨ў⟩→u̯/w, дз/дж affricates, dark
// л→ɫ, and — unlike Ukrainian — regressive voicing + final devoicing (akanne is spelled → no stress dict). Scored
// 97.2% folded on wikipron bel_cyrl narrow (HUMAN, 7259). See docs/investigations/be_native_bringup_investigation.md.
describe("Belarusian canonical IPA — rule g2p (Standard Belarusian)", () => {
    test("core segments: г→ɣ, dark л→ɫ, ы→ɨ, retroflex ч→t͡ʂ", () => {
        expect(phonemizeWord("вада")).toBe("vada"); // akanne spelled → no reduction
        expect(phonemizeWord("галава")).toBe("ɣaɫava"); // г→ɣ, dark ɫ
        expect(phonemizeWord("чалавек")).toBe("t͡ʂaɫavʲek"); // ч→t͡ʂ (retroflex), в→vʲ before е
        expect(phonemizeWord("яблык")).toBe("jabɫɨk"); // я→ja (initial), ы→ɨ
    });

    test("⟨і⟩ is iotated (word-initial → ji); soft vowels palatalise", () => {
        expect(phonemizeWord("Іван")).toBe("jivan"); // і → ji word-initial
        expect(phonemizeWord("ён")).toBe("jon"); // ё → jo word-initial
        expect(phonemizeWord("дзень")).toBe("d͡zʲenʲ"); // дз→d͡zʲ (soft), нь→nʲ
        expect(phonemizeWord("люблю")).toBe("lʲublʲu"); // soft л before ю
    });

    test("⟨ў⟩→u̯/w; apostrophe separates (jV)", () => {
        expect(phonemizeWord("воўк")).toBe("vou̯k"); // ў → u̯ after a vowel
        expect(phonemizeWord("ўзяць")).toBe("wzʲat͡sʲ"); // ў → w word-initial, зя→zʲa, ць→t͡sʲ
        expect(phonemizeWord("сям'я")).toBe("sʲamja"); // ся→sʲa, apostrophe → я=ja
    });

    test("voicing: final devoicing + regressive palatalisation", () => {
        expect(phonemizeWord("горад")).toBe("ɣorat"); // final д → t
        expect(phonemizeWord("хлеб")).toBe("xlʲep"); // final б → p
        expect(phonemizeWord("снег")).toBe("sʲnʲex"); // regressive с→sʲ before nʲ; final г→x
        expect(phonemizeWord("везці")).toBe("vʲesʲt͡sʲi"); // с softens before the palatalised affricate t͡sʲ
        expect(phonemizeWord("абразлівы")).toBe("abrazʲlʲivɨ"); // з softens before soft л
        expect(phonemizeWord("нерв")).toBe("nʲerv"); // в does NOT devoice to [f] (it vocalises, unlike Russian)
    });

    test("cardinal numbers", () => {
        const be = createBelarusian();
        expect(be.text("0").trim()).toBe("nulʲ");
        expect(be.text("5").trim()).toBe("pʲat͡sʲ"); // пяць
        expect(be.text("21").trim()).toBe("dvat͡sːat͡sʲ ad͡zʲin"); // дваццаць адзін (geminate цц)
        expect(be.text("100").trim()).toBe("sto");
        expect(be.text("1000").trim()).toBe("tɨsʲat͡ʂa"); // тысяча — bare (no leading "адзін"), via westernNumberWords
    });

    test("text: words + clause punctuation", () => {
        expect(createBelarusian().text("Мова жыве.")).toBe("mova ʐɨvʲe  . ");
    });
});
