import { describe, expect, test } from "vitest";

import { phonemizeWord, createGeorgian } from "../src/languages/georgian/georgian.ts";

// Canonical-IPA goldens for Georgian / ქართული (ka) — Kartvelian, the Mkhedruli script, Georgia (~4M). A greedy g2p
// over the 33-letter one-letter-one-phoneme alphabet + ONE context rule (word-final voiced-stop devoicing). Scored
// 99.8% folded / 100% symbol against the wikipron kat_geor_narrow referee (HUMAN, 20,894 words) — the folds strip the
// referee's narrow allophony (ä/e̞/o̞, dark ɫ, the ვ labialisation ʷ, ⟨ყ⟩'s [χʼ]). Signatures: the three-way
// VOICED / ASPIRATED / EJECTIVE stop contrast, uvulars ღ=ʁ / ხ=χ / ყ=qʼ, and 5 vowels a ɛ i ɔ u. Stress not marked.
// See docs/investigations/ka_bringup_investigation.md.
describe("Georgian canonical IPA — greedy g2p (Mkhedruli, three-way stop contrast)", () => {
    test("the three-way stop contrast VOICED / ASPIRATED / EJECTIVE", () => {
        expect(phonemizeWord("ბუ")).toBe("bu"); // ⟨ბ⟩ voiced b
        expect(phonemizeWord("ფული")).toBe("pʰuli"); // ⟨ფ⟩ aspirated pʰ ("money")
        expect(phonemizeWord("პური")).toBe("pʼuɾi"); // ⟨პ⟩ ejective pʼ ("bread")
        expect(phonemizeWord("თბილისი")).toBe("tʰbilisi"); // ⟨თ⟩ aspirated tʰ (Tbilisi); ⟨ტ⟩ ejective, ⟨დ⟩ voiced
        expect(phonemizeWord("კაცი")).toBe("kʼat͡sʰi"); // ⟨კ⟩ ejective kʼ, ⟨ც⟩ aspirated affricate t͡sʰ ("man")
    });

    test("uvulars: ღ=ʁ (voiced), ხ=χ (voiceless), ყ=qʼ (ejective)", () => {
        expect(phonemizeWord("ღვინო")).toBe("ʁvinɔ"); // "wine" — ⟨ღ⟩ voiced uvular fricative ʁ
        expect(phonemizeWord("ხაჭაპური")).toBe("χat͡ʃʼapʼuɾi"); // "khachapuri" — ⟨ხ⟩ χ, ⟨ჭ⟩ ejective t͡ʃʼ, ⟨პ⟩ pʼ
        expect(phonemizeWord("წყალი")).toBe("t͡sʼqʼali"); // "water" — ⟨წ⟩ ejective t͡sʼ, ⟨ყ⟩ uvular ejective qʼ
    });

    test("affricates (voiced / aspirated / ejective) + ⟨ჯ⟩ ⟨ჟ⟩ ⟨შ⟩", () => {
        expect(phonemizeWord("გამარჯობა")).toBe("ɡamaɾd͡ʒɔba"); // "hello" — ⟨ჯ⟩ d͡ʒ
        expect(phonemizeWord("ძაღლი")).toBe("d͡zaʁli"); // "dog" — ⟨ძ⟩ voiced affricate d͡z, ⟨ღ⟩ ʁ
        expect(phonemizeWord("ბავშვი")).toBe("bavʃvi"); // "child" — ⟨შ⟩ ʃ
    });

    test("5 vowels a ɛ i ɔ u; ⟨ღ⟩/⟨ხ⟩ places", () => {
        expect(phonemizeWord("საქართველო")).toBe("sakʰaɾtʰvɛlɔ"); // "Georgia" — a, ɛ, ɔ; ⟨ქ⟩ kʰ, ⟨თ⟩ tʰ
        expect(phonemizeWord("დედა")).toBe("dɛda"); // "mother" — ⟨ე⟩ ɛ, ⟨დ⟩ d
        expect(phonemizeWord("ქართული")).toBe("kʰaɾtʰuli"); // "Georgian" — u, i
    });

    test("word-final voiced-stop devoicing: ⟨ბ დ გ⟩ → pʰ tʰ kʰ (the one context rule)", () => {
        expect(phonemizeWord("კარგად")).toBe("kʼaɾɡatʰ"); // "well" — final ⟨დ⟩ devoices to tʰ (the -ad adverbial)
        expect(phonemizeWord("მადლობად")).toBe("madlɔbatʰ"); // final ⟨დ⟩→tʰ; a non-final ⟨დ⟩ stays d
        expect(phonemizeWord("გუდა")).toBe("ɡuda"); // non-final ⟨დ⟩ stays voiced (d) — the rule is word-final only
    });

    test("clause assembly: words + punctuation (incl. the ჻ paragraph separator)", () => {
        expect(createGeorgian().text("გამარჯობა, საქართველო!").trim()).toBe("ɡamaɾd͡ʒɔba  ,  sakʰaɾtʰvɛlɔ  !");
        expect(createGeorgian().text("სახლი჻ ბაღი").trim()).toBe("saχli  .  baʁi"); // ჻ → sentence pause
    });

    test("Mtavruli titlecase (all-caps) lowercases to Mkhedruli — not silently dropped", () => {
        expect(phonemizeWord("ᲓᲐᲕᲔ")).toBe(phonemizeWord("დავე")); // U+1C90-block → the U+10D0 table keys
        expect(phonemizeWord("ᲡᲐᲥᲐᲠᲗᲕᲔᲚᲝ")).toBe("sakʰaɾtʰvɛlɔ"); // all-caps "Georgia"
    });
});
