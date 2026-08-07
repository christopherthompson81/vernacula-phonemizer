import { describe, expect, test } from "vitest";

import { phonemizeWord, createLithuanian } from "../src/languages/lithuanian/lithuanian.ts";

// Canonical-IPA goldens for Lithuanian / lietuvių (lt) — Baltic (Indo-European), Latin script, ~3M. A RULE-based g2p
// (g2p.ts): a left-to-right scan + the hard/soft PALATALIZATION contrast (Cʲ before front vowels / the softening ⟨i⟩,
// spreading leftward through clusters) + regressive VOICING assimilation + n→ŋ before velars. Scored 85.7% folded /
// 98.5% symbol against the wikipron lit_latn_narrow referee (HUMAN, 15,513 words) — the folds strip the lexical PITCH
// accents (¹/²), stress-conditioned length (ː) + vowel quality (ɑ→ɐ, æ→ɛ), and narrow allophony (dark ɫ, v~ʋ, the
// glide j~ɪ̯). Several golds are referee-verified (exact after folds). Stress is lexical → not marked.
describe("Lithuanian canonical IPA — rule g2p (palatalization + voicing)", () => {
    test("PALATALIZATION: consonants → Cʲ before a front vowel ⟨e ę ė i į y⟩", () => {
        expect(phonemizeWord("katinas")).toBe("kɐtʲɪnɐs"); // ⟨t⟩ soft before ⟨i⟩; ⟨k n⟩ hard before ⟨a⟩ (referee-verified)
        expect(phonemizeWord("penki")).toBe("pʲɛŋʲkʲɪ"); // ⟨p⟩ soft before ⟨e⟩, ⟨k⟩ soft before ⟨i⟩, ⟨n⟩→ŋʲ (verified)
        expect(phonemizeWord("šeši")).toBe("ʃʲɛʃʲɪ"); // ⟨š⟩ soft before front vowels — uniform ʲ notation
        expect(phonemizeWord("medis")).toBe("mʲɛdʲɪs"); // "tree" — mʲ, dʲ
    });

    test("VELARS ⟨k ɡ⟩ do NOT receive leftward palatalization spread (soften only DIRECTLY before a front vowel)", () => {
        expect(phonemizeWord("knyga")).toBe("knʲiːɡɐ"); // "book" — ⟨k⟩ HARD before soft ⟨nʲ⟩; ⟨n⟩ soft before ⟨y⟩=iː
        expect(phonemizeWord("naktis")).toBe("nɐktʲɪs"); // ⟨k⟩ HARD before soft ⟨tʲ⟩ (referee-verified)
    });

    test("the softening ⟨i⟩ (⟨Cia Ciu⟩): silent, palatalizes the preceding consonant; ⟨a⟩ then fronts to ɛ", () => {
        expect(phonemizeWord("čia")).toBe("t͡ʃʲɛ"); // "here" — ⟨i⟩ silent, ⟨č⟩ soft, ⟨a⟩→ɛ after the soft consonant
        expect(phonemizeWord("ačiū")).toBe("ɐt͡ʃʲuː"); // "thanks" — ⟨i⟩ silent softener before back ⟨ū⟩
    });

    test("rising diphthongs ⟨ie⟩=iɛ / ⟨uo⟩=uɔ (⟨ie⟩ palatalizes the preceding consonant)", () => {
        expect(phonemizeWord("Dievas")).toBe("dʲiɛʋɐs"); // "God" — ⟨d⟩ soft before ⟨ie⟩ (referee-verified)
        expect(phonemizeWord("lietuva")).toBe("lʲiɛtʊʋɐ"); // "Lithuania" — ⟨l⟩ soft before ⟨ie⟩ (referee-verified)
        expect(phonemizeWord("aštuoni")).toBe("ɐʃtuɔnʲɪ"); // "eight" — ⟨uo⟩=uɔ
    });

    test("regressive VOICING assimilation in obstruent clusters + non-palatalizing back context", () => {
        expect(phonemizeWord("dirbti")).toBe("dʲɪrʲpʲtʲɪ"); // ⟨b⟩→[p] before voiceless ⟨t⟩ (keeps softness: bʲ→pʲ)
        expect(phonemizeWord("žmogus")).toBe("ʒmoːɡʊs"); // "man" — hard before back vowels; ⟨o⟩=oː
        expect(phonemizeWord("kalba")).toBe("kɐlbɐ"); // "language" — all hard (referee-verified)
    });

    test("clause assembly: words + punctuation", () => {
        expect(createLithuanian().text("Labas, Lietuva!").trim()).toBe("lɐbɐs , lʲiɛtʊʋɐ !");
    });

    // Cardinal numbers (numbers.ts + the lithuanian.jsonc table). Lithuanian has NO round-hundred words — the
    // hundred is a counted noun (šimtas / du šimtai) — and every magnitude noun takes the Baltic three-way concord:
    // …1 (not 11) → nom sg, …2–9 (not 12–19) → nom pl, …0 / 11–19 → gen pl.
    test("cardinal numbers: -lika teens + the three-way counted-noun concord", () => {
        const lt = createLithuanian();
        expect(lt.text("7").trim()).toBe("sʲɛpʲtʲiːnʲɪ"); // septyni
        expect(lt.text("15").trim()).toBe("pʲɛŋʲkʲoːlʲɪkɐ"); // penkiolika (the -lika teen, one word)
        expect(lt.text("21").trim()).toBe("dʲʋʲɪdʲɛʃʲɪmt ʋʲiɛnɐs"); // dvidešimt vienas
        expect(lt.text("101").trim()).toBe("ʃʲɪmtɐs ʋʲiɛnɐs"); // šimtas vienas
        expect(lt.text("555").trim()).toBe("pʲɛŋʲkʲɪ ʃʲɪmtɐɪ pʲɛŋʲkʲɛzʲdʲɛʃʲɪmt pʲɛŋʲkʲɪ"); // penki šimtai penkiasdešimt penki
        expect(lt.text("1000").trim()).toBe("tuːkstɐnʲtʲɪs"); // tūkstantis — the numeral "vienas" is dropped
        expect(lt.text("2000").trim()).toBe("dʊ tuːkstɐnʲt͡ʃʲɛɪ"); // du tūkstančiai → NOM PL
        expect(lt.text("10000").trim()).toBe("dʲɛʃʲɪmt tuːkstɐnʲt͡ʃʲuː"); // dešimt tūkstančių → …0 ⇒ GEN PL
        expect(lt.text("21000").trim()).toBe("dʲʋʲɪdʲɛʃʲɪmt ʋʲiɛnɐs tuːkstɐnʲtʲɪs"); // …1 ⇒ NOM SG tūkstantis
        expect(lt.text("100000").trim()).toBe("ʃʲɪmtɐs tuːkstɐnʲt͡ʃʲuː"); // šimtas tūkstančių
        expect(lt.text("12345").trim()).toBe(
            "dʲʋʲiːlʲɪkɐ tuːkstɐnʲt͡ʃʲuː tʲrʲiːs ʃʲɪmtɐɪ kʲɛtʊrʲɛzʲdʲɛʃʲɪmt pʲɛŋʲkʲɪ",
        ); // dvylika tūkstančių (12 ⇒ GEN PL) trys šimtai keturiasdešimt penki
        expect(lt.text("1000000").trim()).toBe("ʋʲiɛnɐs mʲɪlʲɪjoːnɐs"); // vienas milijonas (keeps the numeral)
        expect(lt.text("1000000000").trim()).toBe("ʋʲiɛnɐs mʲɪlʲɪjɛrdɐs"); // vienas milijardas
    });
});
