import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords, phonemizeWord } from "../src/languages/albanian/albanian.ts";

// Canonical-IPA goldens for Standard Albanian (sq) — Shqip (Tosk-based), Latin script, its own Indo-European
// branch. Signature: a rich DIGRAPH system — ⟨dh th sh zh xh⟩→[ð θ ʃ ʒ d͡ʒ], the PALATALS ⟨gj⟩→[ɟ]
// / ⟨q⟩→[c], ⟨nj⟩→[ɲ], ⟨ll⟩→[ɫ] (dark l), ⟨rr⟩→[r] (trill) vs ⟨r⟩→[ɾ] (tap); ⟨c⟩→[t͡s], ⟨ç⟩→[t͡ʃ], ⟨x⟩→[d͡z];
// the 7-vowel system ⟨e⟩→[ɛ], ⟨y⟩→[y], ⟨ë⟩→[ə]. Penultimate stress. Referees: kaikki + epitran sqi-Latn.
describe("Albanian (Shqip) canonical IPA", () => {
    test("the digraph fricatives ⟨dh th sh zh xh⟩", () => {
        expect(phonemizeWord("dhe")).toBe("ˈðɛ"); // 'and/earth' — ⟨dh⟩→ð, ⟨e⟩→ɛ
        expect(phonemizeWord("thikë")).toBe("ˈθikə"); // 'knife' — ⟨th⟩→θ, ⟨ë⟩→ə
        expect(phonemizeWord("xhaxha")).toBe("ˈd͡ʒad͡ʒa"); // 'uncle' — ⟨xh⟩→d͡ʒ
    });

    test("the palatals ⟨gj⟩→ɟ, ⟨q⟩→c, ⟨nj⟩→ɲ; ⟨ll⟩→ɫ, ⟨rr⟩→r", () => {
        expect(phonemizeWord("gjuha")).toBe("ˈɟuha"); // 'the tongue/language' — ⟨gj⟩→ɟ (voiced palatal stop)
        expect(phonemizeWord("shqip")).toBe("ˈʃcip"); // 'Albanian' — ⟨sh⟩→ʃ, ⟨q⟩→c; stress before the whole ⟨ʃc⟩ onset
        expect(phonemizeWord("rrugë")).toBe("ˈruɡə"); // 'street' — ⟨rr⟩→r (trill)
        expect(phonemizeWord("llullë")).toBe("ˈɫuɫə"); // 'pipe' — ⟨ll⟩→ɫ (dark l)
    });

    test("the affricates ⟨c ç x⟩ and the 7-vowel system", () => {
        expect(phonemizeWord("çaj")).toBe("ˈt͡ʃaj"); // 'tea' — ⟨ç⟩→t͡ʃ
        expect(phonemizeWord("xixë")).toBe("ˈd͡zid͡zə"); // 'spark' — ⟨x⟩→d͡z
        expect(phonemizeWord("gjysh")).toBe("ˈɟyʃ"); // 'grandfather' — ⟨y⟩→y (front rounded)
        expect(phonemizeWord("ëmbël")).toBe("ˈəmbəl"); // 'sweet' — ⟨ë⟩→ə (schwa)
    });

    test("penultimate stress + maximal-onset syllabification", () => {
        expect(phonemizeWord("Shqipëri")).toBe("ʃciˈpəɾi"); // 'Albania' — stress on the penult ⟨ë⟩→ə, single ⟨r⟩→ɾ tap
        expect(phonemizeWord("qumësht")).toBe("ˈcuməʃt"); // 'milk'
        expect(phonemizeWord("flamur")).toBe("ˈflamuɾ"); // 'flag' — ˈ before the whole ⟨fl⟩ onset, not fˈl
        expect(phonemizeWord("vendlindja")).toBe("vɛndˈlindja"); // 'birthplace' — ⟨dl⟩ is not an onset, so ˈ before ⟨l⟩ (nd is coda)
    });
});

// CARDINAL NUMBERS (src/languages/albanian/numbers.ts). Source: Newmark, Hubbard & Prifti, *Standard Albanian:
// A Reference Grammar for Students* (1982), the cardinal-numeral section. Decimal and regular; the one thing
// that keeps it off the shared Western composer is the obligatory ⟨e⟩ "and" connector between groups
// (njëzet e një). ⟨njëzet⟩/⟨dyzet⟩ are vigesimal fossils but round-ten words here. Citation form for 3: ⟨tre⟩.
describe("Albanian numbers", () => {
    for (const [n, expected] of [
        [0, "zero"],
        [1, "një"],
        [3, "tre"],                                      // MASCULINE citation form (feminine ⟨tri⟩ unused)
        [4, "katër"],
        [10, "dhjetë"],
        [11, "njëmbëdhjetë"],
        [13, "trembëdhjetë"],
        [20, "njëzet"],
        [21, "njëzet e një"],                            // the obligatory ⟨e⟩ connector
        [30, "tridhjetë"],
        [40, "dyzet"],
        [42, "dyzet e dy"],
        [99, "nëntëdhjetë e nëntë"],
        [100, "njëqind"],                                // round hundreds are FUSED
        [101, "njëqind e një"],
        [300, "treqind"],
        [555, "pesëqind e pesëdhjetë e pesë"],
        [1000, "një mijë"],                              // the "one" is KEPT (no bare *mijë)
        [1001, "një mijë e një"],
        [2000, "dy mijë"],                               // ⟨mijë⟩ is invariant
        [12345, "dymbëdhjetë mijë e treqind e dyzet e pesë"],
        [1000000, "një milion"],
        [2000000, "dy milionë"],                         // ⟨milion⟩ takes the plural ⟨-ë⟩ above one
        [1000000000, "një miliard"],
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no digit leak, sentinel or gap across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/u);
    });

    test("end-to-end: the numeral is phonemized, not spelled out digit-wise", () => {
        expect(phonemize("21", "sq")).toBe("ˈɲəzɛt ˈɛ ˈɲə"); // njëzet e një — ⟨e⟩ is its own word [ˈɛ]
        expect(phonemize("1000000", "sq")).toBe("ˈɲə miˈlion"); // një milion
    });

    /**
     * ⚠ THE CENTRAL PROBLEM: Albanian mixes THREE grouping conventions with TWO decimal conventions, and both
     * the comma and the period serve both roles. The discriminator was read off the corpus, not assumed — all
     * 51 ambiguous `,\d{3}` sites were checked by hand and 50 are groupings. Three digits after the separator
     * means grouping; one or two means decimal. The wiki states it definitionally: *"me ose pa presje ose
     * ndonjëherë një pikë që ndan shifrat e mijërave: 1.000"*.
     */
    test("three digits after the separator is a group; one or two is a decimal", () => {
        // comma grouping — the value was being read as TWO numbers with a pause between them
        expect(phonemize("110,994 kilometra", "sq").trim()).toBe("ˈɲəcind ˈɛ ˈðjɛtə ˈmijə ˈɛ nəˈntəcind ˈɛ nəntəˈðjɛtə ˈɛ ˈkatəɾ kiloˈmɛtɾa");
        // period grouping, and `000` was reading as a single *zero*
        expect(phonemize("300.000 vjet", "sq").trim()).toBe("ˈtɾɛcind ˈmijə ˈvjɛt");
        // space grouping
        expect(phonemize("20 000", "sq").trim()).toBe("ˈɲəzɛt ˈmijə");
        // ...and one or two digits is a decimal, through either mark
        expect(phonemize("41.33", "sq").trim()).toContain("ˈpɾɛsja");
        expect(phonemize("38,3", "sq").trim()).toContain("ˈpɾɛsja");
    });

    /**
     * ⚠ TRAP 58 IN THE DE-GROUPING RULE ITSELF, and the first cut of it broke three things at once. A group is
     * mis-segmented only if a further DIGIT follows, so that is the only thing the trailing guard rejects — a
     * clause mark and the figure's own decimal tail both have to pass.
     */
    test("a group survives a clause mark and its own decimal tail", () => {
        expect(phonemize("50 000.", "sq").trim()).toBe("pɛsəˈðjɛtə ˈmijə .");
        expect(phonemize("1,110.03 km²", "sq").trim()).toContain("ˈpɾɛsja");
        // ⚠ A DOTTED DATE needs no special case: de-grouping wants three-digit groups and the decimal rule's
        // trailing guard refuses `30.04` because a period follows. It survives untouched.
        expect(phonemize("30.04.1993", "sq").trim()).not.toContain("ˈpɾɛsja");
    });

    /**
     * ⚠ `-38,3 °C` CARRIED FOUR DEFECTS AT ONCE — the minus dropped so a record LOW read as a high, the comma
     * taken for a clause pause, the degree sign dropped, and ⟨C⟩ read as Albanian /t͡s/, a legal syllable no
     * gate can see (trap 56).
     */
    test("the sign, the separator, the degree and its scale all survive one figure", () => {
        expect(phonemize("-38,3 °C", "sq").trim()).toBe("ˈminus tɾiˈðjɛtə ˈɛ ˈtɛtə ˈpɾɛsja ˈtɾɛ ˈɡɾadə t͡sɛlˈsius");
        // ⚠ DO NOT SAY IT TWICE (trap 12): the corpus writes the scale name as a word beside the sign, and the
        // scale letter needs a LETTER BOUNDARY or it eats the ⟨C⟩ of *Celsius* and adds a second one.
        expect(phonemize("+7° Celsius", "sq").trim()).toBe("ˈplus ˈʃtatə ˈɡɾadə t͡sɛlˈsius");
    });

    test("signs and units: percent is postposed, and the unit is not a fake word", () => {
        expect(phonemize("75 %", "sq").trim()).toBe("ʃtatəˈðjɛtə ˈɛ ˈpɛsə ˈpəɾ ˈcind");
        expect(phonemize("25 cm", "sq").trim()).toBe("ˈɲəzɛt ˈɛ ˈpɛsə t͡sɛntiˈmɛtɾa");
        expect(phonemize("€2", "sq").trim()).toBe("ˈdy ɛˈuɾo");
        expect(phonemize("45-55°", "sq").trim()).toContain("ˈdɛɾi");
        // ⟨km2⟩ is ⟨km²⟩ with the superscript lost — unfolded, the unit fails and `km` reaches the IPA raw
        expect(phonemize("349,223 km2", "sq").trim()).toContain("kiloˈmɛtɾa kaˈtɾoɾə");
        expect(phonemize("999 ‰ ar", "sq").trim()).toContain("ˈpəɾ ˈmijə");
    });

    /** ⚠ A leading zero in the fraction is spoken, or `5.09` and `5.9` become byte-identical (the eu defect). */
    test("a leading zero in the fraction is not swallowed", () => {
        expect(phonemize("5.09", "sq").trim()).not.toBe(phonemize("5.9", "sq").trim());
    });

    /**
     * ⚠ REGRESSION GUARDS FROM REVIEW OF #820. Each spoke a figure wrong, and none was visible to a gate.
     */
    test("a zero-headed figure is a decimal, never a thousands group", () => {
        // `\d{1,3}` as the group head made `0,375` de-group to `0375`, which the number path reads as 375 —
        // a probability or precision figure spoken a THOUSAND times too large, with nothing leaked.
        expect(phonemize("0,375", "sq").trim()).toContain("ˈpɾɛsja");
        expect(phonemize("p = 0,001", "sq").trim()).toContain("ˈpɾɛsja");
        expect(phonemize("0.500 g", "sq").trim()).toContain("ˈpɾɛsja");
    });

    test("any separator surviving de-grouping is a decimal, whatever the fraction's length", () => {
        // a 1–2 digit guard dropped π, which then read as two numbers with a sentence break between them
        expect(phonemize("3.14159", "sq").trim().split(/\s+/u)).not.toContain(".");
        expect(phonemize("3.14159", "sq").trim()).toContain("ˈpɾɛsja");
    });

    /**
     * ⚠ NO FORM TO TAKE, ONLY ONE TO INVENT — the standard this file applies to `±` and had broken here.
     * `megabajtë` is `absent` in the attestation artifact (0 tok / 0 arts) and the corpus writes the SINGULAR
     * after every count (*deri në 50 megabajt*, *1024 megabajt*), so both count forms are the singular.
     */
    test("the loan units take their attested singular, not an invented plural", () => {
        expect(phonemize("32MB", "sq").trim()).toBe("tɾiˈðjɛtə ˈɛ ˈdy mɛˈɡabajt");
        expect(phonemize("714 MHz", "sq").trim()).toContain("mɛˈɡahɛɾt͡s");
    });

    /** ⚠ The plus rule must CONSUME the space it looks over, or it emits the SLOT-GAP double space. */
    test("a spaced plus leaves no gap", () => {
        expect(phonemize("+ 24° Celsius", "sq").trim()).toBe("ˈplus ˈɲəzɛt ˈɛ ˈkatəɾ ˈɡɾadə t͡sɛlˈsius");
    });
});
