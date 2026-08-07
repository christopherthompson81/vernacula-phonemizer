import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/quechua/numbers.ts";
import { phonemizeWord } from "../src/languages/quechua/quechua.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Quechua / Runasimi (qu) — Southern Quechua (Cusco-Collao + Ayacucho), the standardised
// trilingual Latin orthography. Signature: a 3-vowel system ⟨a i u⟩ (NO uvular
// lowering emitted — the phonemic norm, matching the kaikki referee) and a THREE-WAY stop series written overtly —
// plain ⟨p t k q ch⟩, aspirated with ⟨h⟩ (⟨ph th kh qh chh⟩), ejective with an apostrophe (⟨p' t' k' q' ch'⟩);
// uvular ⟨q⟩→[q]; ⟨ll⟩→ʎ, ⟨ñ⟩→ɲ, ⟨r⟩→ɾ (tap). Regular PENULTIMATE stress. Validated at 93.0% (97.6% symbol) vs the
// kaikki Quechua human referee (172); 88.3% skeleton agreement with epitran quy-Latn.
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

// ---------------------------------------------------------------------------------------------------------
// Cardinal numbers. Southern Quechua is DECIMAL and regular; the one non-Western feature is the LINKING
// SUFFIX -yuq ~ -niyuq 'having' that attaches a remainder to a round base (chunka hukniyuq = 11). Source:
// English Wiktionary Quechua cardinal numerals — every base word and every compound below 100 is a lemma
// there, and the `cardinalbox` chains give 101 / 1,001 / 999 / 999,999 verbatim. See numbers.ts.
describe("Quechua numbers", () => {
    for (const [n, expected] of [
        [0, "ch'usaq"],
        [1, "huk"],
        [7, "qanchis"],
        [10, "chunka"],
        [11, "chunka hukniyuq"],            // -niyuq after a CONSONANT-final unit
        [13, "chunka kimsayuq"],            // -yuq after a VOWEL-final unit
        [20, "iskay chunka"],               // the tens are themselves two words
        [21, "iskay chunka hukniyuq"],      // Wiktionary lemma ⟨iskay chunka hukniyuq⟩
        [42, "tawa chunka iskayniyuq"],
        [99, "isqun chunka isqunniyuq"],
        [100, "pachak"],                    // bare magnitude — no leading ⟨huk⟩
        [101, "pachak hukniyuq"],           // Wiktionary's ⟨pachak⟩ cardinalbox successor
        [555, "pichqa pachak pichqa chunka pichqayuq"],
        [999, "isqun pachak isqun chunka isqunniyuq"], // verbatim from the ⟨pachak⟩/⟨waranqa⟩ boxes
        [1000, "waranqa"],
        [1001, "waranqa hukniyuq"],         // verbatim from the ⟨waranqa⟩ cardinalbox
        [12345, "chunka iskayniyuq waranqa kimsa pachak tawa chunka pichqayuq"],
        [999999, "isqun pachak isqun chunka isqunniyuq waranqa isqun pachak isqun chunka isqunniyuq"],
        [1000000, "hunu"],
        [1000001, "hunu hukniyuq"],         // verbatim from the ⟨hunu⟩ cardinalbox
        [1000000000, "lluna"],              // the highest attested magnitude
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no gaps or sentinels across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/);
    });

    // 10^12 and above has no attested magnitude word → digit-by-digit, deliberately (see numbers.ts).
    test("above the attested range → digit-by-digit", () => {
        expect(numberToWords(1e12)).toBe("huk ch'usaq ch'usaq ch'usaq ch'usaq ch'usaq ch'usaq ch'usaq ch'usaq ch'usaq ch'usaq ch'usaq ch'usaq");
    });

    test("end-to-end: the numeral is phonemized, not passed through as digits", () => {
        expect(phonemize("21", "qu")).toBe("ˈiskaj ˈt͡ʃunka hukˈnijuq");
        expect(phonemize("100", "qu")).toBe("ˈpat͡ʃak");
    });
});
