import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/ilocano/ilocano.ts";

// Canonical-IPA goldens for Ilocano / Iloko (ilo) — Austronesian (Northern Luzon, NOT Bisayan), Latin,
// near-phonemic. A shallow rule g2p validated against wikipron ilo_latn (82.7%) + kaikki ilo (84.5%) + epitran
// ilo-Latn (75.9%). The Ilocano-distinctive HIATUS: a HIGH vowel ⟨i u⟩ before another vowel GLIDES (dua→dwa,
// radio→ɾadjo) — unlike Bisayan's uniform glottal hiatus — while non-high hiatus keeps the glottal (tao→taʔo).
// ⟨e⟩→[ɛ] (the 6th vowel [ɯ]~[ɛ], not spelling-predictable → folded). Stress + word-final glottal deferred.
// See docs/investigations/ilo_native_bringup_investigation.md.
describe("Ilocano canonical IPA — Northern Philippine rule g2p", () => {
    test("high-vowel GLIDING hiatus (the split from Bisayan): i→j, u→w before a vowel", () => {
        expect(phonemizeWord("dua")).toBe("dwˈa"); // ⟨u⟩ before a vowel → w
        expect(phonemizeWord("radio")).toBe("ɾˈadjo"); // ⟨i⟩ before o → j
        expect(phonemizeWord("dies")).toBe("djˈɛs"); // ⟨i⟩ before e → j; ⟨e⟩→ɛ
    });

    test("non-high hiatus keeps the glottal; word-initial glottal; ⟨ng⟩→ŋ", () => {
        expect(phonemizeWord("tao")).toBe("tˈaʔo"); // a+o hiatus → glottal (o does not glide word-finally)
        expect(phonemizeWord("naimbag")).toBe("naʔˈimbaɡ"); // "good" — a+i hiatus glottal (i after a vowel)
        expect(phonemizeWord("agtutubo")).toBe("ʔaɡtutˈubo"); // word-initial glottal
    });

    test("native vocabulary (plain CV)", () => {
        expect(phonemizeWord("balik")).toBe("bˈalik");
        expect(phonemizeWord("dakami")).toBe("dakˈami"); // "we/us"
    });
});
