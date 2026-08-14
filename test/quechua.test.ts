import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/quechua/numbers.ts";
import { normalizeQuechua } from "../src/languages/quechua/normalize.ts";
import { phonemizeWord } from "../src/languages/quechua/quechua.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Quechua / Runasimi (qu) — Southern Quechua (Cusco-Collao + Ayacucho), the standardised
// trilingual Latin orthography. Signature: a 3-vowel system ⟨a i u⟩ (NO uvular
// lowering emitted — the phonemic norm, matching the kaikki referee) and a THREE-WAY stop series written overtly —
// plain ⟨p t k q ch⟩, aspirated with ⟨h⟩ (⟨ph th kh qh chh⟩), ejective with an apostrophe (⟨p' t' k' q' ch'⟩);
// uvular ⟨q⟩→[q]; ⟨ll⟩→ʎ, ⟨ñ⟩→ɲ, ⟨r⟩→ɾ (tap). Regular PENULTIMATE stress.
// Referees: kaikki Quechua (human, 172) + epitran quy-Latn, the latter compared on the consonant skeleton only.
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

// ---------------------------------------------------------------------------------------------------------
// TEXT NORMALIZATION (src/languages/quechua/normalize.ts). The tests below pin the rule's BRANCHES rather
// than the corpus's instances (playbook trap 13): a de-grouping arm per separator convention, the decimal
// case that must NOT de-group, the version shape the unit guard must reject, and one case from each unit
// family — including the `cm`/`km` pair, whose collision is invisible to every leak class.
//
// ⚠ WHICH QUECHUA: Southern (Cusco-Collao + Ayacucho), matching the engine. qu.wikipedia is Southern by
// 63:1 on the locative (-pi ×505 vs Ancash -chaw ×8); every word asserted here is sourced from a Southern
// instance and cited in normalize.ts's header.
describe("Quechua text normalization", () => {
    // ── de-grouping: three conventions, because qu.wikipedia writes all three ──────────────────────────
    test("thousands de-grouping — period, comma and space, all attested in this corpus", () => {
        expect(normalizeQuechua("3.426.000 runakuna")).toBe("3426000 runakuna");     // ×88, the commonest
        expect(normalizeQuechua("1,077,900,000 matikiti")).toBe("1077900000 matikiti"); // ×12
        expect(normalizeQuechua("28 549 745 runa")).toBe("28549745 runa");           // ×14
        expect(normalizeQuechua("5 000")).toBe("5000");
    });

    test("a DECIMAL is not a grouped thousand — the block length is the only discriminator", () => {
        // Two digits after the separator: never a group. Both conventions occur in this corpus.
        expect(normalizeQuechua("44.5 km²")).toBe("44 5 t'asra kilumitru");
        expect(normalizeQuechua("27,59 km²")).toBe("27 59 t'asra kilumitru");
        // A leading-zero head is never a grouped thousand either, even at exactly three digits.
        expect(normalizeQuechua("0.500 mitru")).toBe("0 500 mitru");
        // ⚠ THE BRANCH THE CORPUS EXERCISES ONLY ONCE: a grouped figure whose tail is a decimal. The
        // trailing guard is a bare `(?!\d)` precisely so this de-groups the head and leaves the tail.
        expect(normalizeQuechua("5 311.09 km²-yuq")).toBe("5311 09 t'asra kilumitru-yuq");
    });

    // ── the unit tier ────────────────────────────────────────────────────────────────────────────────
    test("units read, and ⟨cm⟩ IS NOT ⟨km⟩ — playbook trap 56, the defect no counter sees", () => {
        // quechua.jsonc maps ⟨c⟩→/k/, so an UNDECLARED `cm` came out byte-identical to `km`: `28 cm` and
        // `250 km` produced the same phoneme string, and every leak class scored it as one raw `km`.
        expect(normalizeQuechua("28 cm")).toBe("28 sintimitru");
        expect(normalizeQuechua("250 km")).toBe("250 kilumitru");
        expect(phonemizeWord("sintimitru")).not.toBe(phonemizeWord("kilumitru"));
        expect(normalizeQuechua("6880&nbsp;m")).toBe("6880 mitru");   // the entity is the adjacency
        expect(normalizeQuechua("85mm")).toBe("85 milimitru");
        expect(normalizeQuechua("3.4nm")).toBe("3 4 nanumitru");
        expect(normalizeQuechua("30 kg")).toBe("30 kilugramu");
        expect(normalizeQuechua("10 Å")).toBe("10 angstrom");
    });

    test("the version guard rejects a dotted designation — trap 52, and the OUTPUT is read", () => {
        // A lookbehind rejects a POSITION, not a string: `NOT_VERSION` must stop the engine matching from
        // the FRACTIONAL part as well. Asserting `802.11m` is untouched by the unit step is the check —
        // the reading must never contain `mitru`. (The decimal step then spaces the dot, which is why the
        // expectation is `802 11m` and not `802.11m`.)
        expect(normalizeQuechua("802.11m")).toBe("802 11m");
        expect(normalizeQuechua("802.11n")).toBe("802 11n");
        // …while a genuine glued decimal quantity still reads, which is what the guard must not cost.
        expect(normalizeQuechua("12.5km")).toBe("12 5 kilumitru");
        expect(normalizeQuechua("4.145m")).toBe("4145 mitru");
    });

    test("squared and cubed — the measure word goes BEFORE its noun", () => {
        expect(normalizeQuechua("56 km²")).toBe("56 t'asra kilumitru");
        expect(normalizeQuechua("120 m³")).toBe("120 machina mitru");
        // The ASCII exponent, which is what a refusal would have read as the NUMBER TWO (trap 53) — and
        // this shape also needs the magnitude hop, since the corpus writes `1.28 hunu km2`.
        expect(normalizeQuechua("1.28 hunu km2")).toBe("1 28 hunu t'asra kilumitru");
        // The HTML entity form of the same square, ×1 in the corpus and in the AREA slot.
        expect(normalizeQuechua("2.766.890 km&sup2;")).toBe("2766890 t'asra kilumitru");
    });

    test("rates take the DATIVE denominator, declared as whole keys (trap 44)", () => {
        // qu.wikipedia's SI article: "Utqa kay v - Mitru sikunduman m/s". Not an "A per B" idiom, so
        // `unitPer` cannot express it and each rate is one key.
        expect(normalizeQuechua("217 km/s")).toBe("217 kilumitru sikunduman");
        expect(normalizeQuechua("14 m³/s")).toBe("14 machina mitru sikunduman");
    });

    // ── the degree sign ──────────────────────────────────────────────────────────────────────────────
    test("the degree sign reads `k'atma`, is not doubled, and refuses a scale letter", () => {
        expect(normalizeQuechua("90°")).toBe("90 k'atma");
        // ⚠ TRAP 12: this corpus's own sentences write the word AND the sign. The word wins; the sign goes.
        expect(normalizeQuechua("isqun chunka k'atma (90° Ch / 90° N)"))
            .toBe("isqun chunka k'atma (90 Ch / 90 N)");
        // ⚠ NO CELSIUS WORD IS SOURCED (`°C` is ×0 in this corpus and `sources.ts` says scale-names NONE),
        // so the WHOLE match is refused rather than half of it — `20 °C` must read exactly as it did
        // before, never as "twenty degrees" plus a stranded ⟨C⟩ that this engine would voice as /k/.
        expect(normalizeQuechua("20 °C")).toBe("20 °C");
    });

    // ── currency and the ampersand ───────────────────────────────────────────────────────────────────
    test("the dollar sign, and the trap-12 suppression when the sentence already says the word", () => {
        expect(normalizeQuechua("$350.000.000")).toBe("350000000 thular");
        expect(normalizeQuechua("US$ 49,600")).toBe("49600 thular");
        // The corpus's own shape: the sign AND the word, in the other attested spelling. Declaring both
        // spellings is what keeps this from reading "twenty million dollar dollars".
        expect(normalizeQuechua("$20 hunu dular qullqita")).toBe("20 hunu dular qullqita");
    });

    test("`&` → `wan`, the corpus's own free conjunction between two names", () => {
        expect(normalizeQuechua("Ames & C.Schweinf.")).toBe("Ames wan C.Schweinf.");
    });

    // ── the deliberate silences ──────────────────────────────────────────────────────────────────────
    test("the percent sign is left ALONE — no word is sourceable, so none is invented", () => {
        // `pachakmanta` is "N hundred" in 12 of its 13 wiki hits; `pursintu`/`porsyentu` are ×0. The sign
        // stays where the RAWMARK/DROP gates can see it (SymbolData.percent is optional for exactly this).
        expect(normalizeQuechua("86.4% iwrupa")).toBe("86 4% iwrupa");
    });

    test("a common-noun rate numerator is NOT claimed — trap 54, nothing the unit table can name", () => {
        expect(normalizeQuechua("8,76 runa/km²")).toBe("8 76 runa/km²");
    });

    test("ranges keep their hyphen — the joiner is a BOUND SUFFIX and cannot apply to digits", () => {
        // Quechua says `-manta … -kama`, which the corpus writes in prose (`380-manta 780-kama nanumitru`)
        // and which trap 14 says cannot be glued to a digit run. Counted and declined, not overlooked.
        expect(normalizeQuechua("1990-1995")).toBe("1990-1995");
        expect(normalizeQuechua("0-500 msnm")).toBe("0-500 msnm");
    });

    test("a zero-width inside a word is stripped, so the word stays one token", () => {
        expect(normalizeQuechua("Churinkuna:​ wan​ Francisco")).toBe("Churinkuna: wan Francisco");
    });

    // ── end-to-end, through the real phonemizer ──────────────────────────────────────────────────────
    test("end-to-end: the emitted words reach the g2p, not the phoneme sink (trap 6)", () => {
        expect(phonemize("250 km", "qu")).toBe("ˈiskaj ˈpat͡ʃak ˈpit͡ʃqa ˈt͡ʃunka kiluˈmitɾu");
        expect(phonemize("5 km²", "qu")).toBe("ˈpit͡ʃqa ˈtʼasɾa kiluˈmitɾu");
        expect(phonemize("90°", "qu")).toBe("ˈisqun ˈt͡ʃunka ˈkʼatma");
        // ⚠ ROMAN NUMERALS ARE ALREADY DIGITS BY THIS POINT — qu is not in `ROMAN_NATIVE`, so registry.ts
        // converts them before text() runs. Pinned on a VOWEL-LESS operand, which is what trap 16 asks for.
        expect(phonemize("XV", "qu")).toBe("ˈt͡ʃunka pit͡ʃˈqajuq");
    });
});
