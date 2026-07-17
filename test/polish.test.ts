import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/polish/polish.ts";

// Canonical-IPA goldens for Polish (pl) — West Slavic rule g2p, penultimate stress. Digraphs (ch→x, cz→t͡ʂ, sz→ʂ,
// rz→ʐ, dz/dź/dż), the ⟨i⟩ palatalizer, nasal vowels ą/ę (homorganic nasal by place; ą-final→ɔw̃, ę-final→ɛ),
// regressive voicing + final devoicing, progressive w/rz devoicing. 98.2% vs wikipron (human, 130k). See
// docs/investigations/pl_native_bringup_investigation.md.
describe("Polish canonical IPA", () => {
    test("digraphs, palatalization, voicing, nasals", () => {
        const cases: [string, string][] = [
            ["kot", "kˈɔt"],
            ["chleb", "xlˈɛp"], // ch→x, final b→p (devoicing)
            ["pies", "pjˈɛs"], // labial + i + V → pj glide
            ["kiedy", "kjˈɛdɨ"], // velar + i + V → kj (not kʲ)
            ["nogi", "nˈɔɡi"], // velar + i + end → ɡi
            ["siano", "ɕˈanɔ"], // si + V → ɕ (i silent)
            ["zima", "ʑˈima"], // zi + C → ʑi
            ["dzień", "d͡ʑˈɛɲ"], // dź→d͡ʑ, ń→ɲ
            ["cześć", "t͡ʂˈɛɕt͡ɕ"], // cz→t͡ʂ, ść→ɕt͡ɕ
            ["przez", "pʂˈɛs"], // rz→ʂ after voiceless p; final z→s
            ["świat", "ɕfjˈat"], // ś→ɕ, w→f after voiceless, i→j
            ["także", "tˈaɡʐɛ"], // ż triggers regressive voicing k→ɡ
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("nasal vowels ą/ę by following-consonant place", () => {
        expect(phonemizeWord("ząb")).toBe("zˈɔmp"); // ą + labial → ɔm
        expect(phonemizeWord("kąt")).toBe("kˈɔnt"); // ą + dental → ɔn
        expect(phonemizeWord("ręka")).toBe("rˈɛŋka"); // ę + velar → ɛŋ
        expect(phonemizeWord("wąs")).toBe("vˈɔns"); // ą + fricative → ɔn
        expect(phonemizeWord("gęś")).toBe("ɡˈɛw̃ɕ"); // ę + palatal fricative → ɛw̃ (nasal glide)
        expect(phonemizeWord("są")).toBe("sˈɔw̃"); // ą word-final → ɔw̃
        expect(phonemizeWord("imię")).toBe("ˈimjɛ"); // ę word-final → ɛ (denasalized)
    });

    test("au: diphthong in loans, hiatus after na-/za- prefix", () => {
        expect(phonemizeWord("auto")).toBe("ˈawtɔ"); // loan diphthong au→aw
        expect(phonemizeWord("pauza")).toBe("pˈawza");
        expect(phonemizeWord("nauka")).toBe("naˈuka"); // na-uka prefix hiatus (NOT nawka), stress on u
        expect(phonemizeWord("zaufanie")).toBe("zaufˈaɲɛ");
    });

    test("text", () => {
        expect(phonemize("dzień dobry", "pl")).toBe("d͡ʑˈɛɲ dˈɔbrɨ");
    });
});
