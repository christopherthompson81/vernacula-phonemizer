import { describe, expect, test } from "vitest";

import { phonemizeWord, createAbkhaz } from "../src/languages/abkhaz/abkhaz.ts";

// Canonical-IPA goldens for Abkhaz (ab) — аҧсуа бызшәа, a Northwest Caucasian language (the fleet's first) with one of
// the world's largest consonant inventories and just 2 vowels (⟨а⟩→[a], ⟨ы⟩→[ə]). The Cyrillic writes consonants with
// base letters + MODIFIER letters: ⟨ь⟩ palatalizes, ⟨ә⟩ labializes, ⟨'⟩ pharyngealizes. Three-way voiced/aspirated/
// ejective stops. Referee: wikipron abk_cyrl broad + kaikki. See docs/investigations/ab_native_bringup_investigation.md.
describe("Abkhaz (аҧсуа бызшәа) canonical IPA", () => {
    test("★ the THREE-WAY stop/affricate series (voiced / aspirated / ejective)", () => {
        expect(phonemizeWord("акы")).toBe("akʼə"); // ⟨к⟩→[kʼ] EJECTIVE; ⟨ы⟩→[ə]
        expect(phonemizeWord("аӡын")).toBe("ad͡zən"); // ⟨ӡ⟩→[d͡z] voiced affricate
        expect(phonemizeWord("аҵла")).toBe("at͡sʼla"); // ⟨ҵ⟩→[t͡sʼ] ejective affricate
        expect(phonemizeWord("аҷкәын")).toBe("at͡ʃʼkʼʷən"); // ⟨ҷ⟩→[t͡ʃʼ], ⟨кә⟩→[kʼʷ] labialized ejective
        expect(phonemizeWord("аҳ")).toBe("aħ"); // ⟨ҳ⟩→[ħ] pharyngeal
    });

    test("★ the MODIFIERS — ⟨ь⟩ palatal, ⟨ә⟩ labial, ⟨'⟩ pharyngeal", () => {
        expect(phonemizeWord("аҟәа")).toBe("aqʼʷa"); // 'Sukhum' — ⟨ҟә⟩→[qʼʷ] labialized uvular ejective
        expect(phonemizeWord("ажәабжь")).toBe("aʒʷabʒ"); // ⟨жә⟩→[ʒʷ], ⟨жь⟩→[ʒ]
        expect(phonemizeWord("ахәыҷ")).toBe("aχʷət͡ʃʼ"); // ⟨хә⟩→[χʷ]
        expect(phonemizeWord("аҭаацәа")).toBe("atʰaat͡ɕʷʰa"); // ⟨ҭ⟩→[tʰ], ⟨цә⟩→[t͡ɕʷʰ]
    });

    test("the endonym + base letters", () => {
        expect(phonemizeWord("аҧсуа")).toBe("apʰswa"); // 'Abkhaz' — ⟨ҧ⟩→[pʰ] aspirated
        expect(phonemizeWord("бызшәа")).toBe("bəzʃʷa"); // 'language' — ⟨шә⟩→[ʃʷ]
    });

    test("palatalized dorsals (dorsal + ʲ) + the ⟨у⟩/⟨и⟩ glide rule", () => {
        expect(phonemizeWord("зегьы")).toBe("zeɡʲə"); // ⟨гь⟩→[ɡʲ] (VOICED dorsal+ʲ, not the voiceless palatal [c])
        expect(phonemizeWord("аи")).toBe("aj"); // ⟨и⟩ next to a vowel → the glide [j]
        expect(phonemizeWord("иҭабуп")).toBe("itʰabupʼ"); // ⟨у⟩ between consonants → syllabic [u] (not the glide [w])
        expect(phonemizeWord("х’а")).toBe("χˤa"); // the CURLY apostrophe ’ still pharyngealizes ⟨х⟩→[χˤ]
    });

    // ★ VIGESIMAL cardinal numbers (numbers.ts). 20–99 is score·20 + a 1–19 remainder, the score in its -и
    // connective form (ҩажәа → ҩажәи); the same -и marks a non-final hundred (шәкы → шәи акы). Thousands are FUSED
    // for a multiplier of 1–10. The NON-HUMAN / abstract class series is the bare-numeral citation form.
    test("★ cardinal numbers are VIGESIMAL: score·20 + remainder with the -и connective", () => {
        const ab = createAbkhaz();
        expect(ab.text("7").trim()).toBe("bəʒba"); // быжьба
        expect(ab.text("20").trim()).toBe("ɥaʒʷa"); // ҩажәа — the bare score
        expect(ab.text("21").trim()).toBe("ɥaʒʷi akʼə"); // ҩажәи акы = 20 + 1
        expect(ab.text("30").trim()).toBe("ɥaʒʷi ʒʷaba"); // ҩажәи жәаба = 20 + 10 (no "thirty" word)
        expect(ab.text("45").trim()).toBe("ɥənɥaʒʷi χʷba"); // ҩынҩажәи хәба = 2×20 + 5
        expect(ab.text("50").trim()).toBe("ɥənɥaʒʷi ʒʷaba"); // ҩынҩажәи жәаба = 2×20 + 10
        expect(ab.text("67").trim()).toBe("χənɥaʒʷi bəʒba"); // хынҩажәи быжьба = 3×20 + 7
        expect(ab.text("89").trim()).toBe("pʰʃənɥaʒʷi ʒʷba"); // ԥшьынҩажәи жәба = 4×20 + 9
        expect(ab.text("99").trim()).toBe("pʰʃənɥaʒʷi zejʒʷ"); // ԥшьынҩажәи зеижә = 4×20 + 19 (a TEEN attaches too)
    });

    test("cardinal numbers: hundreds with the -и connective, FUSED thousands, millions", () => {
        const ab = createAbkhaz();
        expect(ab.text("100").trim()).toBe("ʃʷkʼə"); // шәкы
        expect(ab.text("101").trim()).toBe("ʃʷi akʼə"); // ★ шәи акы — the hundred takes -и before a remainder
        expect(ab.text("999").trim()).toBe("ʒʷʃʷi pʰʃənɥaʒʷi zejʒʷ"); // жәшәи ԥшьынҩажәи зеижә
        expect(ab.text("1000").trim()).toBe("zkʰʲə"); // зқьы
        expect(ab.text("1001").trim()).toBe("zkʰʲə akʼə"); // зқьы акы — the thousand does NOT take -и
        expect(ab.text("2000").trim()).toBe("ɥnəzkʰʲ"); // ★ ҩнызқь — FUSED multiplier+нызқь
        expect(ab.text("100000").trim()).toBe("ʃʷnəzkʰʲ"); // ★ шәнызқь — likewise fused
        expect(ab.text("12345").trim()).toBe("ʒʷaɥa nəzkʰʲ χəʃʷi ɥənɥaʒʷi χʷba"); // жәаҩа нызқь хышәи ҩынҩажәи хәба
        expect(ab.text("1000000").trim()).toBe("milljon"); // миллион (Russian loan)
        expect(ab.text("1000000000").trim()).toBe("milljard"); // миллиард
    });
});
