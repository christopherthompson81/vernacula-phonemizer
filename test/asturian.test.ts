import { describe, expect, test } from "vitest";

import { createAsturian, phonemizeWord } from "../src/languages/asturian/asturian.ts";

// Asturian (ast) — asturianu, Astur-Leonese (Ibero-Romance), Asturias/NW Spain (~110k). Beyond-espeak, added for
// FLEURS. Close to Spanish/Galician (distinción c/z→[θ]); the Asturian hallmark is ⟨x⟩→[ʃ]. A greedy Ibero-Romance
// scan, validated against wikipron ast_latn_broad (4170 human headwords) — 97.8% FOLDED / 99.6% symbol, with stress +
// spirantization folded. 🔷 single source. See docs/investigations/ast_native_bringup_investigation.md.
describe("Asturian canonical IPA — Ibero-Romance g2p (x→ʃ, distinción)", () => {
    const ast = createAsturian();

    test("the Asturian hallmark ⟨x⟩→[ʃ]; ⟨g⟩ stays [ɡ], ⟨j⟩→[h]", () => {
        expect(phonemizeWord("xente")).toBe("ʃente"); // ⟨x⟩ → ʃ ("people")
        expect(phonemizeWord("Asturies")).toBe("astuɾjes"); // ⟨i⟩→j glide, no final-consonant deletion
    });

    test("distinción: ⟨c⟩ before e/i → [θ], ⟨z⟩ → [θ]", () => {
        expect(phonemizeWord("cielu")).toBe("θjelu"); // ⟨c⟩ before i → θ ("sky")
        expect(phonemizeWord("zapatu")).toBe("θapatu"); // ⟨z⟩ → θ ("shoe")
    });

    test("the palatal digraphs: ⟨ll⟩→ʎ, ⟨ñ⟩→ɲ, ⟨ch⟩→t͡ʃ, ⟨y⟩→ʝ (onset) / [i] (coda)", () => {
        expect(phonemizeWord("lleche")).toBe("ʎet͡ʃe"); // ⟨ll⟩→ʎ, ⟨ch⟩→t͡ʃ ("milk")
        expect(phonemizeWord("ñeru")).toBe("ɲeɾu"); // ⟨ñ⟩ → ɲ ("nest")
        expect(phonemizeWord("güeyu")).toBe("ɡweʝu"); // ⟨gü⟩→ɡw, ⟨y⟩ onset → ʝ ("eye")
        expect(phonemizeWord("Olay")).toBe("olai"); // ⟨y⟩ coda → [i] (a surname)
    });

    test("⟨qu gu⟩ clusters; ⟨v⟩→b; ⟨h⟩ silent; ⟨n⟩→[m] before a labial; ⟨pt ct⟩ kept", () => {
        expect(phonemizeWord("nueche")).toBe("nwet͡ʃe"); // ⟨u⟩→w glide, ⟨ch⟩→t͡ʃ ("night")
        expect(phonemizeWord("home")).toBe("ome"); // ⟨h⟩ silent ("man")
        expect(phonemizeWord("bienvenida")).toBe("bjembenida"); // ⟨n⟩ → m before [b] ("welcome")
        expect(phonemizeWord("doctor")).toBe("doktoɾ"); // learned ⟨ct⟩ KEEPS the cluster (vocalization is spelled ⟨u⟩)
    });

    test("the ⟨rr⟩ trill vs single ⟨r⟩ tap; the che vaqueira ⟨ḷḷ⟩→[t͡ʂ]", () => {
        expect(phonemizeWord("carru")).toBe("karu"); // ⟨rr⟩ → r trill ("cart")
        expect(phonemizeWord("falar")).toBe("falaɾ"); // single ⟨r⟩ → ɾ tap ("to speak")
        expect(phonemizeWord("abeḷḷugu")).toBe("abet͡ʂuɡu"); // Western ⟨ḷḷ⟩ → t͡ʂ ("shelter")
    });

    test("clause assembly", () => {
        expect(ast.text("Falo asturianu.").trim()).toBe("falo astuɾjanu .");
    });
});
