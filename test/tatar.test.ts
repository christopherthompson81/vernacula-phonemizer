import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/tatar/tatar.ts";

// Canonical-IPA goldens for Standard Tatar (tt) — Татар теле, Kipchak Turkic, CYRILLIC (official), the fleet's first
// Tatar. Signature: VOWEL-HARMONY backing of ⟨к г⟩ — [q]/[ʁ] next to a BACK vowel (ак→ɑq) but [k]/[ɡ] next to a
// FRONT vowel (мәктәп→mæktæp); the special letters ⟨ә⟩→[æ], ⟨ө⟩→[ø], ⟨ү⟩→[y], ⟨ы⟩→[ɨ], ⟨җ⟩→[ʑ], ⟨ң⟩→[ŋ], ⟨һ⟩→[h];
// ⟨а⟩ fronts to [a] in a front-harmony word. Word-final (oxytone) stress. THIN single-source (kaikki, 69) referee —
// the folded % is deflated by loan noise; validated on the native subset. See docs/investigations/tt_native_bringup_investigation.md.
describe("Tatar (Татар теле) canonical IPA", () => {
    test("vowel-harmony backing of ⟨к г⟩: [q ʁ] (back) vs [k ɡ] (front)", () => {
        expect(phonemizeWord("ак")).toBe("ˈɑq"); // 'white' — BACK word: ⟨а⟩→ɑ, ⟨к⟩→q
        expect(phonemizeWord("мәктәп")).toBe("mækˈtæp"); // 'school' — FRONT word (⟨ә⟩): ⟨к⟩→k
        expect(phonemizeWord("балык")).toBe("bɑˈlɨq"); // 'fish' — BACK: ⟨ы⟩→ɨ, ⟨к⟩→q
        expect(phonemizeWord("көз")).toBe("ˈkøz"); // 'autumn' — FRONT: ⟨ө⟩→ø, ⟨к⟩→k
    });

    test("the special letters ⟨ә ө ү җ ң⟩ + iotated ⟨я⟩", () => {
        expect(phonemizeWord("дүшәмбе")).toBe("dyʃæmˈbe"); // 'Monday' — ⟨ү⟩→y, ⟨ә⟩→æ
        expect(phonemizeWord("вөҗдан")).toBe("vøʑˈdan"); // 'conscience' — ⟨ө⟩→ø, ⟨җ⟩→ʑ, ⟨а⟩→a (front word)
        expect(phonemizeWord("якшәмбе")).toBe("jɑqʃæmˈbe"); // 'Sunday' — ⟨я⟩→jɑ, ⟨к⟩→q (local, next to я)
        expect(phonemizeWord("шимбә")).toBe("ʃimˈbæ"); // 'Saturday' — ⟨ә⟩→æ
    });

    test("harmony of ⟨а⟩: back [ɑ] vs front-word [a]", () => {
        expect(phonemizeWord("татар")).toBe("tɑˈtɑr"); // 'Tatar' — BACK word: ⟨а⟩→ɑ
        expect(phonemizeWord("ана")).toBe("ɑˈnɑ"); // 'mother' — BACK: ⟨а⟩→ɑ
        expect(phonemizeWord("китап")).toBe("kiˈtap"); // 'book' — FRONT word (⟨и⟩): ⟨а⟩→a, ⟨к⟩→k
    });

    test("⟨ч⟩→[ɕ] (Kazan deaffrication), ⟨г⟩ neutral-⟨а⟩, initial ⟨е⟩→[je], loan-cluster stress", () => {
        expect(phonemizeWord("чәч")).toBe("ˈɕæɕ"); // 'hair' — ⟨ч⟩ is the fricative [ɕ] (Kazan standard, like ⟨җ⟩→ʑ)
        expect(phonemizeWord("гаилә")).toBe("ɡaiˈlæ"); // 'family' — front word: ⟨г⟩→ɡ (⟨а⟩ is harmony-neutral for backing)
        expect(phonemizeWord("елга")).toBe("jelˈɡa"); // 'river' — word-initial ⟨е⟩→[je]
        expect(phonemizeWord("спорт")).toBe("ˈsport"); // loan — ˈ before the whole ⟨sp⟩ onset (max-onset)
    });
});
