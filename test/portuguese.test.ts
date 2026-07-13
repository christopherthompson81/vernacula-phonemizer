import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/portuguese/portuguese.ts";

// Canonical-IPA goldens for European Portuguese (pt-PT), espeak-independent. Rule-based g2p → stress → the EP
// vowel-REDUCTION pass (unstressed a→ɐ, e→ɨ, o→u) → sibilant voicing. Convention: nasal ɐ̃/ẽ/ĩ/õ/ũ + diphthongs
// ɐ̃w̃/ɐ̃j̃/õj̃, r single→ɾ / strong→ʁ, coda s/z→ʃ, coda l→ɫ, ç/ss/soft-c fixed /s/. Stressed open/close mid
// vowels (rosa→ɔ, dorme→ɔ) and grapheme x (exame→z) are the deferred lexical axes — close/ʃ defaults here.
describe("european portuguese canonical IPA", () => {
    test("vowel reduction (the EP signature)", () => {
        expect(phonemizeWord("casa")).toBe("kˈazɐ"); // final a → ɐ, intervocalic s → z
        expect(phonemizeWord("gato")).toBe("ɡˈatu"); // final o → u
        expect(phonemizeWord("pequeno")).toBe("pɨkˈenu"); // pretonic e → ɨ, final o → u
        expect(phonemizeWord("professor")).toBe("pɾufɨsˈoɾ"); // o→u, e→ɨ, final r → ɾ
    });

    test("consonant digraphs + soft c/g", () => {
        expect(phonemizeWord("trabalho")).toBe("tɾɐbˈaʎu"); // lh → ʎ
        expect(phonemizeWord("senhora")).toBe("sɨɲˈoɾɐ"); // nh → ɲ (not a nasal coda)
        expect(phonemizeWord("cidade")).toBe("sidˈadɨ"); // soft c → s
        expect(phonemizeWord("você")).toBe("vusˈe"); // soft c stays s (no intervocalic voicing)
        expect(phonemizeWord("filho")).toBe("fˈiʎu");
    });

    test("nasal vowels + diphthongs", () => {
        expect(phonemizeWord("coração")).toBe("kuɾɐsˈɐ̃w̃"); // ç → s, ão → ɐ̃w̃
        expect(phonemizeWord("não")).toBe("nˈɐ̃w̃");
        expect(phonemizeWord("também")).toBe("tɐ̃bˈɐ̃j̃"); // stressed -ém → ɐ̃j̃
        expect(phonemizeWord("homem")).toBe("ˈɔmɐ̃j̃"); // unstressed final -em → ɐ̃j̃ (open o from lexicon)
        expect(phonemizeWord("falam")).toBe("fˈalɐ̃w̃"); // -am → ɐ̃w̃
        expect(phonemizeWord("bom")).toBe("bˈõ");
        expect(phonemizeWord("vinte")).toBe("vˈĩtɨ");
    });

    test("codas: s/z → ʃ, l → ɫ", () => {
        expect(phonemizeWord("luz")).toBe("lˈuʃ"); // final z → ʃ
        expect(phonemizeWord("mesmo")).toBe("mˈeʒmu"); // coda s before voiced → ʒ
        expect(phonemizeWord("difícil")).toBe("difˈisiɫ"); // soft c → s, coda l → ɫ
        expect(phonemizeWord("português")).toBe("puɾtuɡˈeʃ");
    });

    test("stress: written accent, oxytone vs paroxytone", () => {
        expect(phonemizeWord("difícil")).toBe("difˈisiɫ"); // accent wins (antepenult)
        expect(phonemizeWord("estudante")).toBe("iʃtudˈɐ̃tɨ"); // paroxytone; word-initial e → i
        expect(phonemizeWord("animal")).toBe("ɐnimˈaɫ"); // oxytone: ends in -l
    });

    test("falling diphthong vs stressed hiatus (final C ≠ s)", () => {
        expect(phonemizeWord("mais")).toBe("mˈajʃ"); // ai + final s → diphthong
        expect(phonemizeWord("dois")).toBe("dˈojʃ");
        expect(phonemizeWord("baixo")).toBe("bˈajʃu"); // ai before C+V → diphthong
        expect(phonemizeWord("raiz")).toBe("ʁɐˈiʃ"); // i + final z → hiatus nucleus (stressed)
        expect(phonemizeWord("sair")).toBe("sɐˈiɾ");
        expect(phonemizeWord("país")).toBe("pɐˈiʃ"); // accent forces the hiatus
    });

    test("rising glides (onglide), ou monophthong, cluster hiatus", () => {
        expect(phonemizeWord("história")).toBe("iʃtˈɔɾjɐ"); // unstressed i before vowel → j
        expect(phonemizeWord("água")).toBe("ˈaɡwɐ"); // u before vowel → w
        expect(phonemizeWord("leonardo")).toBe("ljunˈaɾdu"); // e before vowel → j
        expect(phonemizeWord("dia")).toBe("dˈiɐ"); // stressed i stays a nucleus
        expect(phonemizeWord("crianças")).toBe("kɾiˈɐ̃sɐʃ"); // i after obstruent+liquid cluster stays a nucleus
        expect(phonemizeWord("souto")).toBe("sˈotu"); // ou → monophthong o
        expect(phonemizeWord("ouvir")).toBe("ovˈiɾ"); // ou-derived o does not reduce
        expect(phonemizeWord("ceilão")).toBe("sejlˈɐ̃w̃"); // diphthong nucleus not reduced
        expect(phonemizeWord("sansão")).toBe("sɐ̃sˈɐ̃w̃"); // s after a nasal vowel does not voice
    });

    test("lexical corrections: open stressed vowels + grapheme x", () => {
        expect(phonemizeWord("ela")).toBe("ˈɛlɐ"); // stressed e opens (lexicon)
        expect(phonemizeWord("agora")).toBe("ɐɡˈɔɾɐ"); // stressed o opens (lexicon)
        expect(phonemizeWord("velho")).toBe("vˈɛʎu");
        expect(phonemizeWord("próximo")).toBe("pɾˈɔsimu"); // x → s (+ ó → ɔ)
        expect(phonemizeWord("táxi")).toBe("tˈaksi"); // x → ks
        expect(phonemizeWord("gato")).toBe("ɡˈatu"); // not in the table → close-vowel default holds
    });

    test("numbers (European convention, 'e' connector)", () => {
        expect(phonemize("21", "pt")).toBe("vˈĩtɨ e ũ");
        expect(phonemize("342", "pt")).toBe("tɾɨzˈẽtuʃ e kwɐɾˈẽtɐ e dˈojʃ");
        expect(phonemize("100", "pt")).toBe("sˈɐ̃j̃"); // cem
        expect(phonemize("1000001", "pt")).toBe("ũ miʎˈɐ̃w̃ e ũ"); // milhão e um (connector)
        expect(phonemizeWord("jardins")).toBe("ʒɐɾdˈĩʃ"); // -ins plural stays oxytone
    });

    // Independent adjudicated micro-gold (tools/pt-gold.tsv) — hand-transcribed EP, not Wiktionary-derived.
    // Locks the engine against regressions; the lone known miss is the contested metaphonic pair neto (ˈnetu).
    test("adjudicated micro-gold (independent referee)", () => {
        const rows = readFileSync(
            new URL("../tools/pt-gold.tsv", import.meta.url),
            "utf8",
        ).split("\n");
        let match = 0,
            total = 0;
        for (const line of rows) {
            if (line === "" || line.startsWith("#") || !line.includes("\t"))
                continue;
            const [word, gold] = line.split("\t");
            total++;
            if (phonemizeWord(word!) === gold!.trim()) match++;
        }
        expect(total).toBeGreaterThan(160);
        expect(match / total).toBeGreaterThanOrEqual(0.98); // ≥ 98% (allows the contested neto)
    });

    test("text: reduction + destressed clitics + punctuation", () => {
        expect(phonemize("O gato preto dorme na casa.", "pt")).toBe(
            "o ɡˈatu pɾˈetu dˈoɾmɨ na kˈazɐ .",
        );
        expect(phonemize("Bom dia, como está?", "pt")).toBe(
            "bˈõ dˈiɐ , kˈomu iʃtˈa ?",
        );
    });
});
