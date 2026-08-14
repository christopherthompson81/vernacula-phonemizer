import { describe, expect, test } from "vitest";

import { phonemizeWord, createArmenian } from "../src/languages/armenian/armenian.ts";
import { normalizeArmenian, ordinalWords } from "../src/languages/armenian/normalize.ts";

// Armenian (hy) — Indo-European (own branch), own alphabet. EASTERN Armenian (Yerevan). Left-to-right greedy scan +
// the ⟨ու⟩=u digraph, word-initial glides (ե→je, ո→vo, և→jev), and schwa epenthesis (word-initial/final clusters).
// Signatures: the three-way stop/affricate system (b/p/pʰ …), uvulars խ→χ/ղ→ʁ, tap ր→ɾ vs trill ռ→r.
// Referee: wikipron hye_armn_e broad (human).
describe("Armenian canonical IPA — rule g2p (Eastern Armenian)", () => {
    test("three-way stops/affricates + uvulars", () => {
        expect(phonemizeWord("բարև")).toBe("bɑɾev"); // բ=b, ր=ɾ (tap), և=ev
        expect(phonemizeWord("գիրք")).toBe("ɡiɾkʰ"); // գ=ɡ, ք=kʰ (aspirated)
        expect(phonemizeWord("քաղաք")).toBe("kʰɑʁɑkʰ"); // ք=kʰ, ղ=ʁ (uvular)
        expect(phonemizeWord("ձուկ")).toBe("d͡zuk"); // ձ=d͡z, ու=u
        expect(phonemizeWord("չար")).toBe("t͡ʃʰɑɾ"); // չ=t͡ʃʰ (aspirated affricate)
    });

    test("ու=u digraph + word-initial glides ե→je, ո→vo, և→jev", () => {
        expect(phonemizeWord("ուս")).toBe("us"); // ու → u
        expect(phonemizeWord("Երևան")).toBe("jeɾevɑn"); // ե→je (initial), և→ev (medial)
        expect(phonemizeWord("որդի")).toBe("voɾdi"); // ո→vo (initial)
        expect(phonemizeWord("ով")).toBe("ov"); // ո before վ → o (haplology, not *vov)
        expect(phonemizeWord("ջուր")).toBe("d͡ʒuɾ"); // ջ=d͡ʒ, ու=u
    });

    test("schwa epenthesis (initial/final clusters; s+stop kept)", () => {
        expect(phonemizeWord("գնալ")).toBe("ɡənɑl"); // #գն → ɡən
        expect(phonemizeWord("խնդիր")).toBe("χəndiɾ"); // #խն → χən
        expect(phonemizeWord("եզր")).toBe("jezəɾ"); // final զր (rising) → zəɾ
        expect(phonemizeWord("սպանել")).toBe("spɑnel"); // #սպ = s+stop kept as onset
        expect(phonemizeWord("ընկեր")).toBe("ənkeɾ"); // written ը = ə
        expect(phonemizeWord("կոմունիզմ")).toBe("komunizm"); // final -զմ stays bare (no ə before /m/)
    });

    test("cardinal numbers", () => {
        const hy = createArmenian();
        expect(hy.text("0").trim()).toBe("zəɾo"); // զրո
        expect(hy.text("2").trim()).toBe("jeɾku"); // երկու
        expect(hy.text("15").trim()).toBe("tɑsnhinɡ"); // տասնհինգ
        expect(hy.text("21").trim()).toBe("kʰəsɑn mek"); // քսան մեկ
        expect(hy.text("1000").trim()).toBe("hɑzɑɾ"); // հազար — bare (no leading "մեկ"), via westernNumberWords
    });

    test("text: words + Armenian clause punctuation (։)", () => {
        expect(createArmenian().text("Բարև ձեզ։")).toBe("bɑɾev d͡zez .");
    });
    // ─── NORMALIZATION ──────────────────────────────────────────────────────────────────────────────
    // Evidence and refusals: src/languages/armenian/normalize.ts and
    // docs/investigations/hy_normalization_investigation.md.

    // Trap 13: pin the RULE'S BRANCHES, not the corpus's instances. The ordinal has an irregular TABLE
    // (1–4), a composition (everything else) and a boundary between them, and the corpus only writes a
    // handful — 22 is the case that proves the table does not reach inside a compound.
    test("ordinal: the irregular table, the composition, and the boundary between them", () => {
        expect(ordinalWords(1)).toBe("առաջին"); //   table
        expect(ordinalWords(4)).toBe("չորրորդ"); //  table, its last member
        expect(ordinalWords(5)).toBe("հինգերորդ"); // the FIRST composed value — the boundary
        expect(ordinalWords(9)).toBe("իններորդ"); //  ինը → ինն- : the ORDINAL's ը→ն, attested
        expect(ordinalWords(10)).toBe("տասներորդ"); // տասը → տասն-
        expect(ordinalWords(11)).toBe("տասնմեկերորդ");
        expect(ordinalWords(20)).toBe("քսաներորդ");
        // ⚠ 22 takes երկու+երորդ, NOT the standalone irregular երկրորդ (`քսաներկուերորդ` ×13/12 on
        // hy.wikipedia). The suffix lands on the LAST word, which is what "Հարյուր հիսուներորդ" shows.
        expect(ordinalWords(22)).toBe("քսան երկուերորդ");
        expect(ordinalWords(100)).toBe("հարյուրերորդ");
        expect(ordinalWords(150)).toBe("հարյուր հիսուներորդ");
        expect(ordinalWords(1000)).toBe("հազարերորդ");
    });

    // Trap 14. A digit cannot take a suffix, so the operand becomes WORDS inside the rule; and the two
    // stem changes are attested independently of each other (երկուսի/երկուսը vs տասին).
    test("bound case suffix: one Armenian word, not two", () => {
        expect(normalizeArmenian("5-ին")).toBe("հինգին");
        expect(normalizeArmenian("2-ից")).toBe("երկուսից"); // suppletive oblique stem երկուս-
        expect(normalizeArmenian("9-ին")).toBe("ինին"); //     a final ը DROPS for a CASE suffix …
        expect(normalizeArmenian("9-րդ")).toBe("իններորդ"); // … but becomes ն for the ORDINAL
        expect(normalizeArmenian("1991-ից")).toBe("հազար իննհարյուր իննսուն մեկից");
        expect(normalizeArmenian("1950-ական")).toBe("հազար իննհարյուր հիսունական");
        expect(normalizeArmenian("250 000-ը")).toBe("երկուհարյուր հիսուն հազարը"); // de-grouped first
        // ⚠ The digit class ENDS IN A DIGIT, so a trailing clause comma survives (Welsh's hazard).
        expect(normalizeArmenian("1995-ին, ")).toBe("հազար իննհարյուր իննսուն հինգին, ");
    });

    test("de-grouping: hy writes space, period AND comma groups, and two of them also mark the decimal", () => {
        expect(normalizeArmenian("1 500 000")).toBe("1500000"); // `mek hinɡhɑɾjuɾ zəɾo` before this
        expect(normalizeArmenian("3.018.854")).toBe("3018854"); // ≥2 groups is unambiguous
        expect(normalizeArmenian("4.090 մետր")).toBe("4090 մետր"); // one group, no decimal signal
        expect(normalizeArmenian("0,624 կմ²")).toBe("0 ամբողջ 624 կմ²"); // leading 0 → decimal
        expect(normalizeArmenian("2.095 մլրդ")).toBe("2 ամբողջ զրո 95 միլիարդ"); // magnitude → decimal
        // ⚠ the leading zero is SPELLED and the rest stays digits: without it `0,012` reads as 0.12 —
        // a well-formed Armenian numeral, ten times too big, and no leak class can see it (trap 56).
        expect(normalizeArmenian("0,012 կգ")).toBe("0 ամբողջ զրո 12 կգ");
        expect(normalizeArmenian("35,6")).toBe("35 ամբողջ 6"); // 1–2 digits is always a decimal
    });

    // The refusals, pinned as invariants so a later widening has to argue with the measurement.
    test("refusals: a bare colon is not a clock, a year-slash is not a fraction, a plus is not read", () => {
        expect(normalizeArmenian("00:39:26")).toBe("00:39:26"); // a film DURATION — 9 of 13 retained
        expect(normalizeArmenian("3/14")).toBe("3/14"); //         a US-format date, denominator > 10
        expect(normalizeArmenian("1877/78")).toBe("1877/78"); //   an academic year
        expect(normalizeArmenian("+15,2")).toBe("+15 ամբողջ 2"); // omitting a measurement plus is lossless
        expect(normalizeArmenian("3/4")).toBe("երեք չորրորդ"); //  …and the real fraction still reads
    });

    test("minus: read only where the corpus's four true negatives are — before a percent or a degree", () => {
        expect(normalizeArmenian("-4.9 %")).toBe("մինուս 4 ամբողջ 9 %");
        expect(normalizeArmenian("-20 °C")).toBe("մինուս 20 Ցելսիուսի աստիճան");
        expect(normalizeArmenian("(1985 - 2005)")).toBe("(1985, 2005)"); // a RANGE, not a negative
    });

    test("through the phonemizer: the defects the layer exists to close", () => {
        const hy = createArmenian();
        expect(hy.text("5%").trim()).toBe("hinɡ tokos"); //                    was `hinɡ`
        expect(hy.text("36 կմ").trim()).toBe("jeɾesun vet͡sʰ kilometəɾ"); //    was `… kmə`
        expect(hy.text("5 կմ²").trim()).toBe("hinɡ kʰɑrɑkusi kilometəɾ"); //   was `hinɡ kmə`
        expect(hy.text("20 °C").trim()).toBe("kʰəsɑn t͡sʰelsiusi ɑstit͡ʃɑn"); // was `kʰəsɑn sˈiː` (English ⟨C⟩)
        expect(hy.text("42-րդ").trim()).toBe("kʰɑrɑsun jeɾkueɾoɾd"); //        was `kʰɑrɑsun jeɾku ɾdə`
        expect(hy.text("մ.թ.ա. 550").trim()) //                               was `mə . tʰə . ɑ . …`
            .toBe("meɾ tʰəvɑɾkutʰjunit͡sʰ ɑrɑd͡ʒ hinɡhɑɾjuɾ hisun");
        expect(hy.text("28.11.1953").trim()) //                               was three numbers, two false stops
            .toBe("hɑzɑɾ innhɑɾjuɾ hisun jeɾekʰ tʰəvɑkɑni nojembeɾi kʰəsɑn utʰ");
    });
});
