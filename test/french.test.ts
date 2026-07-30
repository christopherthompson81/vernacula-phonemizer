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
        // The sub-100 group is ONE hyphenated word, so it resolves against the Lexique compounds and
        // the compound-internal liaison survives. These two expectations previously pinned the
        // space-separated readings, which phonemized each piece in isolation and lost it.
        expect(phonemize("21", "fr")).toBe("vɛ̃teˈœ̃"); // vingt-et-un — the t liaison, per Lexique vɛ̃teœ̃
        expect(phonemize("342", "fr")).toBe("tʁwa sɑ̃ kaʁɑ̃tdˈø"); // trois cent quarante-deux
    });

    test("compound numerals join as Lexique attests them", () => {
        // 17/18/19 were the clearest defect: as "dix sept" the pieces gave [dis sɛt] with a doubled s,
        // and 18/19 came out VOICELESS where French voices the compound-internal x.
        expect(phonemize("17", "fr")).toBe("disˈɛt"); // dix-sept    disɛt
        expect(phonemize("18", "fr")).toBe("dizɥˈit"); // dix-huit   dizɥit — z, not s
        expect(phonemize("19", "fr")).toBe("diznˈœf"); // dix-neuf   diznœf
        expect(phonemize("90", "fr")).toBe("katʁəvɛ̃dˈis"); // quatre-vingt-dix katʁəvɛ̃dis
        expect(phonemize("97", "fr")).toBe("katʁəvɛ̃disˈɛt"); // quatre-vingt-dix-sept
        // A compound Lexique does NOT attest falls to per-part concatenation, which gives the same shape
        // as the attested trente-et-un (tʁɑ̃teœ̃) — a hyphen is not a word boundary for pronunciation.
        expect(phonemize("41", "fr")).toBe("kaʁɑ̃teˈœ̃"); // quarante-et-un
        // ...and the same tokenizer change makes ordinary hyphenated words resolve as one word.
        expect(phonemize("peut-être", "fr")).toBe("pøtˈɛtʁ"); // the t liaison, lost when split
    });

    test("ordinals from digit notation", () => {
        // What the corpus actually contains: 1er, 37e, 190e, 60e, 5e, 3e, 11e, 15e. Each of these used to
        // read the bare suffix as a stray word ("37e" → [tʁɑ̃t sɛt ø], "thirty-seven uh").
        expect(phonemize("le 1er janvier", "fr")).toBe("lə pʁømje ʒɑ̃vjˈe"); // premier
        expect(phonemize("la 1re fois", "fr")).toBe("la pʁømjɛʁ fwˈa"); // première — feminine indicator
        expect(phonemize("les 1ers jours", "fr")).toBe("le pʁømje ʒˈuʁ"); // premiers
        expect(phonemize("le 2e jour", "fr")).toBe("lə døzjɛm ʒˈuʁ"); // deuxième
        expect(phonemize("le 2ème jour", "fr")).toBe("lə døzjɛm ʒˈuʁ"); // the -ème spelling
        // Unbounded: the old table stopped at 20, so anything past it fell through entirely.
        expect(phonemize("le 37e", "fr")).toBe("lə tʁɑ̃tsɛtjˈɛm"); // trente-septième
        expect(phonemize("le 21e siècle", "fr")).toBe("lə vɛ̃teynjɛm sjˈɛkl"); // vingt-et-unième (unième, not premier)
        expect(phonemize("le 190e", "fr")).toBe("lə sɑ̃ katʁəvɛ̃dizjˈɛm"); // cent quatre-vingt-dixième
        // second/seconde is licensed only at 2 — "3d" is 3-D and must stay a cardinal + letter.
        expect(phonemize("le 2d violon", "fr")).toBe("lə səɡɔ̃ vjɔlˈɔ̃");
        expect(phonemize("le 3d", "fr")).not.toContain("tʁwazjɛm");
    });

    test("ordinal notation does not fire on homographs", () => {
        // "Roman letters + ordinal suffix" matches de/les/le/des/ce/vie/dire/lire thousands of times in
        // the corpus; the veto is Lexique membership, so each of these stays an ordinary word.
        expect(phonemize("la vie", "fr")).toBe("la vˈi"); // not VI = 6
        expect(phonemize("de la mie de pain", "fr")).toBe("də la mi də pˈɛ̃"); // not DI / MI
        expect(phonemize("un vieux livre", "fr")).toBe("œ̃ vjø lˈivʁ");
        // ...and an accented word must not be split at the accent: siècle parses as siè + cle (CL = 150)
        // for any pattern that trusts \b, which is defined on ASCII word characters.
        expect(phonemize("le siècle", "fr")).toBe("lə sjˈɛkl");
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
