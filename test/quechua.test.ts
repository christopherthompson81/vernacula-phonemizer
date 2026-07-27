import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/quechua/quechua.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Quechua / Runasimi (qu) — Southern Quechua (Cusco-Collao + Ayacucho), the standardised
// trilingual Latin orthography. The fleet's first Quechuan language. Signature: a 3-vowel system ⟨a i u⟩ (NO uvular
// lowering emitted — the phonemic norm, matching the kaikki referee) and a THREE-WAY stop series written overtly —
// plain ⟨p t k q ch⟩, aspirated with ⟨h⟩ (⟨ph th kh qh chh⟩), ejective with an apostrophe (⟨p' t' k' q' ch'⟩);
// uvular ⟨q⟩→[q]; ⟨ll⟩→ʎ, ⟨ñ⟩→ɲ, ⟨r⟩→ɾ (tap). Regular PENULTIMATE stress. Validated at 93.0% (97.6% symbol) vs the
// kaikki Quechua human referee (172); 88.3% skeleton agreement with epitran quy-Latn. See
// docs/investigations/qu_native_bringup_investigation.md.
describe("Quechua (Runasimi) canonical IPA", () => {
    test("3-vowel system + penultimate stress", () => {
        expect(phonemizeWord("runasimi")).toBe("ɾunaˈsimi"); // 'Quechua (people's language)' — r→ɾ, penult stress
        expect(phonemizeWord("wasi")).toBe("ˈwasi"); // 'house'
        expect(phonemizeWord("inti")).toBe("ˈinti"); // 'sun' — onsetless penult
        expect(phonemizeWord("allqu")).toBe("ˈaʎqu"); // 'dog' — ll→ʎ, ⟨u⟩ stays [u] next to ⟨q⟩ (3-vowel norm)
    });

    test("the three-way stop series: plain / aspirated ⟨h⟩ / ejective ⟨'⟩", () => {
        expect(phonemizeWord("tanta")).toBe("ˈtanta"); // plain t — 'gathering'
        expect(phonemizeWord("thanta")).toBe("ˈtʰanta"); // aspirated ⟨th⟩ — 'ragged'
        expect(phonemizeWord("t'anta")).toBe("ˈtʼanta"); // ejective ⟨t'⟩ — 'bread'
        expect(phonemizeWord("qhapaq")).toBe("ˈqʰapaq"); // aspirated uvular ⟨qh⟩ — 'lord'
        expect(phonemizeWord("phaway")).toBe("ˈpʰawaj"); // aspirated ⟨ph⟩, ⟨y⟩→j — 'to fly'
    });

    test("affricates + palatals + uvular", () => {
        expect(phonemizeWord("ch'aska")).toBe("ˈt͡ʃʼaska"); // ejective affricate ⟨ch'⟩ — 'star'
        expect(phonemizeWord("chunka")).toBe("ˈt͡ʃunka"); // plain affricate ⟨ch⟩ — 'ten'
        expect(phonemizeWord("ñuqa")).toBe("ˈɲuqa"); // ⟨ñ⟩→ɲ, uvular ⟨q⟩ — 'I'
        expect(phonemizeWord("llaqta")).toBe("ˈʎaqta"); // ⟨ll⟩→ʎ, coda ⟨q⟩ — 'town'
        expect(phonemizeWord("sunqu")).toBe("ˈsunqu"); // 'heart' — ⟨u⟩ stays [u] (no lowering emitted)
    });

    test("monosyllables still take stress (matching the referee)", () => {
        expect(phonemizeWord("huk")).toBe("ˈhuk"); // 'one'
        expect(phonemizeWord("pay")).toBe("ˈpaj"); // 'he/she' — ⟨y⟩→j
    });
});
