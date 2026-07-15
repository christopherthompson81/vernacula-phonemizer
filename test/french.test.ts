import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/french/french.ts";
import { toIpa } from "../src/languages/french/g2p.ts";

// Canonical-IPA goldens for French (fr) — standard/Parisian. Primary path is the Lexique 3.83 pronunciation
// LEXICON (~125k forms, carries every irregular); the rule-based g2p (toIpa) is the OOV fallback. Convention:
// nasals ɑ̃ɔ̃ɛ̃œ̃, r→ʁ, gn→ɲ, glides j/ɥ/w, eu→ø/œ, silent finals, -ille→ij. French has no lexical stress →
// one phrase-final accent per rhythmic group in text().
describe("french canonical IPA", () => {
    // g2p engine (the OOV fallback), tested directly via toIpa.
    test("g2p: vowel digraphs, nasals, glides", () => {
        expect(toIpa("beau")).toBe("bo"); // eau → o
        expect(toIpa("chien")).toBe("ʃjɛ̃"); // ch → ʃ, ien → jɛ̃
        expect(toIpa("temps")).toBe("tɑ̃"); // em → ɑ̃, silent ps
        expect(toIpa("oiseau")).toBe("wazo"); // oi → wa, s → z, eau → o
        expect(toIpa("lui")).toBe("lɥi"); // u before vowel → glide ɥ (census gap)
        expect(toIpa("gagner")).toBe("ɡaɲe"); // gn → ɲ, -er → e
    });

    test("g2p: eu/œu open vs closed, silent finals, geminates", () => {
        expect(toIpa("deux")).toBe("dø"); // open eu → ø
        expect(toIpa("peur")).toBe("pœʁ"); // closed eu → œ, r → ʁ
        expect(toIpa("corps")).toBe("kɔʁ"); // r sounded, ps silent
        expect(toIpa("homme")).toBe("ɔm"); // geminate mm → m
        expect(toIpa("fille")).toBe("fij"); // -ille → ij
        expect(toIpa("parc")).toBe("paʁk"); // word-final c not softened
        expect(toIpa("mer")).toBe("mɛʁ"); // monosyllable -er → ɛʁ
        expect(toIpa("laine")).toBe("lɛn"); // ai before nasal coda → ɛ
    });

    // Lexicon (Lexique) — irregulars resolved as data, not rules.
    test("lexicon: irregular pronunciations", () => {
        expect(phonemizeWord("monsieur")).toBe("məsjø");
        expect(phonemizeWord("femme")).toBe("fam");
        expect(phonemizeWord("oignon")).toBe("ɔɲɔ̃");
        expect(phonemizeWord("choline")).toBe("kɔlin"); // Greek ch → k
        expect(phonemizeWord("aujourd'hui")).toBe("oʒuʁdɥi");
    });

    test("numbers (vigesimal 70/80/90)", () => {
        expect(phonemize("21", "fr")).toBe("vɛ̃ e ˈœ̃"); // vingt et un
        expect(phonemize("342", "fr")).toBe("tʁwa sɑ̃ kaʁɑ̃t dˈø"); // trois cent quarante deux
    });

    test("text: phrase-final stress + punctuation, monosyllable le → lə", () => {
        expect(phonemize("Bonjour le monde.", "fr")).toBe("bɔ̃ʒuʁ lə mˈɔ̃d .");
        expect(phonemize("Je mange une pomme.", "fr")).toBe("ʒə mɑ̃ʒ yn pˈɔm .");
    });

    // Liaison: a latent final consonant surfaces as the onset of a following vowel-initial word (z/n/t);
    // h aspiré blocks it. Elision (l', c') is handled by the tokenizer + lexicon.
    test("liaison across words, h aspiré blocks", () => {
        expect(phonemize("les amis", "fr")).toBe("le zamˈi"); // z-liaison
        expect(phonemize("un ami", "fr")).toBe("œ̃ namˈi"); // n-liaison (nasal)
        expect(phonemize("petit ami", "fr")).toBe("pəti tamˈi"); // t-liaison
        expect(phonemize("c'est ici", "fr")).toBe("sɛ tisˈi"); // elided c'est → s, t-liaison
        expect(phonemize("deux ans", "fr")).toBe("dø zˈɑ̃"); // number liaison
        expect(phonemize("les héros", "fr")).toBe("le eʁˈo"); // h aspiré → NO liaison
        expect(phonemize("les homards", "fr")).toBe("le ɔmˈaʁ"); // h aspiré, no liaison; standard ⟨o⟩→ɔ (homard=ɔmaʁ)
        expect(phonemize("les hommes", "fr")).toBe("le zˈɔm"); // h muet → liaison DOES fire
        expect(phonemize("les chats", "fr")).toBe("le ʃˈa"); // consonant-initial → no liaison
        expect(phonemize("cet homme", "fr")).toBe("sɛ tˈɔm"); // latent t not doubled (cet→sɛt)
        expect(phonemize("six ans", "fr")).toBe("si zˈɑ̃"); // latent s→z not doubled (six→sis)
    });

    // g2p OOV convention aligned to the lexicon (Lexique): o open/closed, citation schwa, obstruent+liquid onset.
    test("g2p OOV o/ɔ loi de position (standard: ⟨o⟩→ɔ by default; [o] only final-open/before-z)", () => {
        expect(toIpa("comment")).toBe("kɔmɑ̃"); // geminate closes → ɔ (standard, not Lexique's [o])
        expect(toIpa("problème")).toBe("pʁɔblɛm"); // bare ⟨o⟩ → ɔ even in an open onset syllable
        expect(toIpa("hommes")).toBe("ɔm"); // geminate coda → closed ɔ
        expect(toIpa("choses")).toBe("ʃoz"); // before z (-ses→z) → [o]
        expect(toIpa("croire")).toBe("kʁwaʁ"); // wa nucleus recognised → final e silent (not schwa)
    });
});
