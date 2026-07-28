import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/abkhaz/abkhaz.ts";

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
});
