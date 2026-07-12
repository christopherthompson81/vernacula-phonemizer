import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/french/french.ts";

// Canonical-IPA goldens for French (fr) — standard/Parisian, rule-based g2p + exception lexicon. Convention:
// nasals ɑ̃ ɔ̃ ɛ̃ œ̃, r → ʁ, gn → ɲ, glides j/ɥ/w, eu → ø(open)/œ(closed), silent finals, -ille → ij. Validated
// vs wikipron fra (97k gold): 78.9% exact on the 3000 most-frequent words (residual = e/ɛ convention noise
// + a lexical tail). French has no lexical stress → one phrase-final accent per rhythmic group in text().
describe("french canonical IPA", () => {
  test("vowel digraphs, nasals, glides", () => {
    expect(phonemizeWord("beau")).toBe("bo");        // eau → o
    expect(phonemizeWord("chien")).toBe("ʃjɛ̃");     // ch → ʃ, ien → jɛ̃
    expect(phonemizeWord("temps")).toBe("tɑ̃");      // em → ɑ̃, silent ps
    expect(phonemizeWord("pain")).toBe("pɛ̃");       // ain → ɛ̃
    expect(phonemizeWord("oiseau")).toBe("wazo");    // oi → wa, s → z, eau → o
    expect(phonemizeWord("lui")).toBe("lɥi");        // u before vowel → glide ɥ (census gap)
    expect(phonemizeWord("gagner")).toBe("ɡaɲe");    // gn → ɲ, -er → e
  });

  test("eu/œu open vs closed, silent finals, geminates", () => {
    expect(phonemizeWord("deux")).toBe("dø");        // open eu → ø
    expect(phonemizeWord("peur")).toBe("pœʁ");       // closed eu → œ, r → ʁ
    expect(phonemizeWord("seul")).toBe("sœl");
    expect(phonemizeWord("corps")).toBe("kɔʁ");      // r sounded, ps silent
    expect(phonemizeWord("homme")).toBe("ɔm");       // geminate mm → m, final e silent
    expect(phonemizeWord("fille")).toBe("fij");      // -ille → ij
  });

  test("exception lexicon (irregulars)", () => {
    expect(phonemizeWord("monsieur")).toBe("məsjø");
    expect(phonemizeWord("femme")).toBe("fam");
    expect(phonemizeWord("ville")).toBe("vil");
    expect(phonemizeWord("oignon")).toBe("ɔɲɔ̃");
  });

  test("numbers (vigesimal 70/80/90)", () => {
    expect(phonemize("21", "fr")).toBe("vɛ̃ e ˈœ̃");                  // vingt et un
    expect(phonemize("quatre-vingt-dix", "fr")).toBe("katʁ vɛ̃ dˈis"); // 90 as words
    expect(phonemize("342", "fr")).toBe("tʁwa sɑ̃ kaʁɑ̃t dˈø");     // trois cent quarante deux
  });

  test("text: phrase-final stress + punctuation, monosyllable le → lə", () => {
    expect(phonemize("Bonjour le monde.", "fr")).toBe("bɔ̃ʒuʁ lə mˈɔ̃d .");
    expect(phonemize("Je mange une pomme.", "fr")).toBe("ʒə mɑ̃ʒ yn pˈɔm .");
  });

  // Regression tests for review-caught defects.
  test("word-final c/g not softened; -er sounded in monosyllables", () => {
    expect(phonemizeWord("parc")).toBe("paʁk");   // was paʁs (the "".includes("") trap)
    expect(phonemizeWord("avec")).toBe("avɛk");
    expect(phonemizeWord("mer")).toBe("mɛʁ");     // was me (-er verb rule over-applied)
    expect(phonemizeWord("manger")).toBe("mɑ̃ʒe"); // polysyllable -er → e stays
  });

  test("ai before nasal coda → ɛ; hiatus + word-initial schwa handled", () => {
    expect(phonemizeWord("laine")).toBe("lɛn");        // ai closed → ɛ (was raw a+i)
    expect(phonemizeWord("aimer")).toBe("eme");        // ai open → e
    expect(phonemizeWord("aboiement")).toBe("abwamɑ̃"); // hiatus schwa deleted (wa ends in a vowel)
    expect(phonemizeWord("petit")).toBe("pəti");       // word-initial schwa kept
  });
});
