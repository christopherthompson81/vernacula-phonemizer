import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/hiligaynon/hiligaynon.ts";

// Canonical-IPA goldens for Hiligaynon / Ilonggo (hil) — Austronesian (Western Bisayan), Latin, near-phonemic.
// A shallow rule g2p (the Cebuano/Tagalog pattern) validated against wikipron hil_latn (94.4%) + kaikki hil (94.1%),
// both human. Shares the Bisayan core with Cebuano; the deltas are the Spanish-loan letters ⟨j⟩→[h] and ⟨f⟩→[p].
// Stress (penultimate default) is phonemic-but-unwritten (folded by the eval); the word-final glottal and the
// Spanish rising diphthongs are deferred residuals. See docs/investigations/hil_native_bringup_investigation.md.
describe("Hiligaynon canonical IPA — Bisayan rule g2p", () => {
    test("glottal stops: word-initial + hiatus; ⟨ng⟩→ŋ", () => {
        expect(phonemizeWord("anak")).toBe("ʔˈanak"); // word-initial glottal onset
        expect(phonemizeWord("daan")).toBe("dˈaʔan"); // hiatus glottal between the two a's
        expect(phonemizeWord("mango")).toBe("mˈaŋo"); // ⟨ng⟩→ŋ (word-final glottal [maŋoʔ] deferred)
        expect(phonemizeWord("balay")).toBe("bˈalaj"); // ⟨ay⟩ glide → aj
    });

    test("the Spanish-loan deltas from Cebuano: ⟨j⟩→h, ⟨f⟩→p", () => {
        expect(phonemizeWord("Bermejo")).toBe("beɾmˈeho"); // ⟨j⟩ → h (Spanish jota, NOT Cebuano's d͡ʒ)
        expect(phonemizeWord("Demafeliz")).toBe("demapˈelis"); // ⟨f⟩ → p (nativised), ⟨z⟩ → s
    });

    test("native vocabulary (the Cebuano core)", () => {
        expect(phonemizeWord("kalibutan")).toBe("kalibˈutan"); // "world" — plain CV
        expect(phonemizeWord("ginhawa")).toBe("ɡinhˈawa"); // "breath/ease"
    });
});
