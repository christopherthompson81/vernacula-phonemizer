import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/portuguese/portuguese.ts";

// Canonical-IPA goldens for European Portuguese (pt-PT), espeak-independent. Rule-based g2p → stress → the EP
// vowel-REDUCTION pass (unstressed a→ɐ, e→ɨ, o→u) → sibilant voicing. Convention: nasal ɐ̃/ẽ/ĩ/õ/ũ + diphthongs
// ɐ̃w̃/ɐ̃j̃/õj̃, r single→ɾ / strong→ʁ, coda s/z→ʃ, coda l→ɫ, ç/ss/soft-c fixed /s/. Stressed open/close mid
// vowels (rosa→ɔ, dorme→ɔ) and grapheme x (exame→z) are the deferred lexical axes — close/ʃ defaults here.
describe("european portuguese canonical IPA", () => {
  test("vowel reduction (the EP signature)", () => {
    expect(phonemizeWord("casa")).toBe("kˈazɐ");        // final a → ɐ, intervocalic s → z
    expect(phonemizeWord("gato")).toBe("ɡˈatu");        // final o → u
    expect(phonemizeWord("pequeno")).toBe("pɨkˈenu");   // pretonic e → ɨ, final o → u
    expect(phonemizeWord("professor")).toBe("pɾufɨsˈoɾ"); // o→u, e→ɨ, final r → ɾ
  });

  test("consonant digraphs + soft c/g", () => {
    expect(phonemizeWord("trabalho")).toBe("tɾɐbˈaʎu"); // lh → ʎ
    expect(phonemizeWord("senhora")).toBe("sɨɲˈoɾɐ");   // nh → ɲ (not a nasal coda)
    expect(phonemizeWord("cidade")).toBe("sidˈadɨ");    // soft c → s
    expect(phonemizeWord("você")).toBe("vusˈe");        // soft c stays s (no intervocalic voicing)
    expect(phonemizeWord("filho")).toBe("fˈiʎu");
  });

  test("nasal vowels + diphthongs", () => {
    expect(phonemizeWord("coração")).toBe("kuɾɐsˈɐ̃w̃"); // ç → s, ão → ɐ̃w̃
    expect(phonemizeWord("não")).toBe("nˈɐ̃w̃");
    expect(phonemizeWord("também")).toBe("tɐ̃bˈɐ̃j̃");   // stressed -ém → ɐ̃j̃
    expect(phonemizeWord("homem")).toBe("ˈomɐ̃j̃");      // unstressed final -em → ɐ̃j̃
    expect(phonemizeWord("falam")).toBe("fˈalɐ̃w̃");     // -am → ɐ̃w̃
    expect(phonemizeWord("bom")).toBe("bˈõ");
    expect(phonemizeWord("vinte")).toBe("vˈĩtɨ");
  });

  test("codas: s/z → ʃ, l → ɫ", () => {
    expect(phonemizeWord("luz")).toBe("lˈuʃ");          // final z → ʃ
    expect(phonemizeWord("mesmo")).toBe("mˈeʒmu");      // coda s before voiced → ʒ
    expect(phonemizeWord("difícil")).toBe("difˈisiɫ"); // soft c → s, coda l → ɫ
    expect(phonemizeWord("português")).toBe("puɾtuɡˈeʃ");
  });

  test("stress: written accent, oxytone vs paroxytone", () => {
    expect(phonemizeWord("difícil")).toBe("difˈisiɫ"); // accent wins (antepenult)
    expect(phonemizeWord("estudante")).toBe("ɨʃtudˈɐ̃tɨ"); // paroxytone
    expect(phonemizeWord("animal")).toBe("ɐnimˈaɫ");   // oxytone: ends in -l
  });

  test("numbers (European convention, 'e' connector)", () => {
    expect(phonemize("21", "pt")).toBe("vˈĩtɨ e ũ");
    expect(phonemize("342", "pt")).toBe("tɾɨzˈẽtuʃ e kwɐɾˈẽtɐ e dˈojʃ");
    expect(phonemize("100", "pt")).toBe("sˈɐ̃j̃");     // cem
  });

  test("text: reduction + destressed clitics + punctuation", () => {
    expect(phonemize("O gato preto dorme na casa.", "pt")).toBe("o ɡˈatu pɾˈetu dˈoɾmɨ na kˈazɐ .");
    expect(phonemize("Bom dia, como está?", "pt")).toBe("bˈõ dˈiɐ , kˈomu ɨʃtˈa ?");
  });
});
