import { describe, expect, test } from "vitest";

import { phonemizeWord, createCebuano } from "../src/languages/cebuano/cebuano.ts";

// Canonical-IPA goldens for Cebuano / Sinugboanon (ceb) — Philippine (Central Bisayan), the Tagalog near-phonemic
// pattern: the digraph ⟨ng⟩→ŋ, a WORD-INITIAL glottal [ʔ] before a vowel, a HIATUS glottal between two vowels
// (kaon→kaʔon), a hyphen→[ʔ], ⟨y⟩→j, penultimate stress (phonemic but unwritten → folded by the eval). The
// unwritten word-final glottal (bata child [bataʔ] vs robe [bata]) is deferred. Validated at 87.3% vs wikipron
// ceb broad (native core ~100%; residual is Spanish-surname proper nouns) + 70.0% vs epitran. See
// docs/investigations/ceb_native_bringup_investigation.md.
describe("Cebuano canonical IPA", () => {
    test("word-initial + hiatus glottal stop; ng→ŋ; penult stress", () => {
        expect(phonemizeWord("adlaw")).toBe("ʔˈadlaw"); // word-initial ʔ
        expect(phonemizeWord("inom")).toBe("ʔˈinom"); // word-initial ʔ
        expect(phonemizeWord("kaon")).toBe("kˈaʔon"); // hiatus ʔ
        expect(phonemizeWord("maayo")).toBe("maʔˈajo"); // hiatus ʔ, penult stress
        expect(phonemizeWord("langit")).toBe("lˈaŋit"); // ng → ŋ
    });

    test("y→j; penult stress; hyphen→ʔ", () => {
        expect(phonemizeWord("gugma")).toBe("ɡˈuɡma"); // penult stress
        expect(phonemizeWord("balay")).toBe("bˈalaj"); // y → j
        expect(phonemizeWord("salamat")).toBe("salˈamat"); // penult stress
        expect(phonemizeWord("pag-asa")).toBe("paɡʔˈasa"); // hyphen → ʔ
    });

    test("numbers (tens-first with ug; ka ligature) + mga", () => {
        const d = createCebuano();
        expect(d.text("11").trim()).toBe("napˈulo ʔˈuɡ ʔˈusa"); // napulo ug usa
        expect(d.text("21").trim()).toBe("kaluhˈaʔan ʔˈuɡ ʔˈusa"); // kaluhaan ug usa
        expect(d.text("100").trim()).toBe("ʔˈusa kˈa ɡˈatos"); // usa ka gatos
        expect(d.text("mga").trim()).toBe("mˈaŋa"); // mga → maŋa
    });
});
