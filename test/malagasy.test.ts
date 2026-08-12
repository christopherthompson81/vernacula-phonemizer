import { describe, expect, it, test } from "vitest";

import { phonemizeWord, createMalagasy } from "../src/languages/malagasy/malagasy.ts";
import { normalizeMalagasy } from "../src/languages/malagasy/normalize.ts";

// Canonical-IPA goldens for Malagasy / Malagasy (mg) — Standard/Official (Merina), Austronesian, Latin. A shallow
// rule g2p: ⟨o⟩=/u/, ⟨y⟩=final /i/, the retroflex affricates ⟨tr⟩→ʈʂ / ⟨dr⟩→ɖʐ, ⟨j⟩→dz, prenasalized stops
// (mb→ᵐb, nd→ⁿd, ndr→ⁿɖʐ, ng→ᵑɡ, …), penultimate stress. This is a BROAD canonical transcription that KEEPS the
// weak final vowels (which the narrow referees delete). Validated at ~78.6% on the verifiable core (final vowels
// excluded) vs wikipron mlg + kaikki.
describe("Malagasy canonical IPA", () => {
    test("⟨o⟩ → /u/, ⟨y⟩ → /i/, penultimate stress", () => {
        expect(phonemizeWord("olona")).toBe("ulˈuna"); // both o → u, penult stress
        expect(phonemizeWord("vary")).toBe("vˈari"); // y → i
        expect(phonemizeWord("rano")).toBe("rˈanu"); // o → u
        expect(phonemizeWord("telo")).toBe("tˈelu"); // o → u
        expect(phonemizeWord("salama")).toBe("salˈama"); // penult stress
    });

    test("retroflex affricates ⟨tr⟩→ʈʂ, ⟨dr⟩→ɖʐ; ⟨ts⟩→ts, ⟨j⟩→dz", () => {
        expect(phonemizeWord("trano")).toBe("ʈʂˈanu"); // tr → ʈʂ, o → u
        expect(phonemizeWord("zavatra")).toBe("zavˈaʈʂa"); // tr → ʈʂ
        expect(phonemizeWord("fotsy")).toBe("fˈutsi"); // ts → ts, o → u, y → i
        expect(phonemizeWord("tsara")).toBe("tsˈara"); // ts → ts
    });

    test("prenasalized stops (ᵐb, ⁿd, ⁿɖʐ, …)", () => {
        expect(phonemizeWord("mandeha")).toBe("maⁿdˈeha"); // nd → ⁿd
        expect(phonemizeWord("endrika")).toBe("eⁿɖʐˈika"); // ndr → ⁿɖʐ
        expect(phonemizeWord("jamba")).toBe("dzˈaᵐba"); // j → dz, mb → ᵐb
    });

    test("numbers (units-first with amby)", () => {
        const d = createMalagasy();
        expect(d.text("10").trim()).toBe("fˈulu"); // folo
        expect(d.text("21").trim()).toBe("irˈajka ˈaᵐbi ruapˈulu"); // iraika amby roapolo (units first; ⟨ai⟩→[aj])
        expect(d.text("100").trim()).toBe("zˈatu"); // zato
        expect(d.text("1000").trim()).toBe("arˈivu"); // arivo
    });
});

// The layer's evidence and its counter-examples both live in src/languages/malagasy/normalize.ts; these
// pin the rule BRANCHES rather than the corpus's instances (trap 13).
describe("Malagasy text normalization", () => {
    // The defect with no symptom: a space is the ordinary word separator, so a grouped thousand simply
    // became two numbers — no leaked character, no dropped symbol, no stray pause.
    it("thousands grouped with a SPACE", () => {
        expect(normalizeMalagasy("1 540 metatra")).toBe("1540 metatra");
        expect(normalizeMalagasy("384 403 km")).toBe("384403 kilaometatra");
        expect(normalizeMalagasy("1 000 000 $")).toBe("1000000 dolara");
        // …and a YEAR followed by a three-digit number is not a group: the first run must be 1–3 digits.
        expect(normalizeMalagasy("1947 250 olona")).toBe("1947 250 olona");
        // French convention combines both marks in one number (the speed of light).
        expect(normalizeMalagasy("299 792,458 km/s")).toBe("299792 faingo 4 5 8 kilaometatra/s");
    });

    it("the comma is the decimal at every width", () => {
        expect(normalizeMalagasy("7,6")).toBe("7 faingo 6");
        expect(normalizeMalagasy("83,61 %")).toBe("83 faingo 6 1 isan-jato");
        // ×7 at three digits and six of them are still decimals — no group-size rule here.
        expect(normalizeMalagasy("247,941 kilometatra toradroa")).toBe("247 faingo 9 4 1 kilometatra toradroa");
    });

    it("the period splits on the degree sign, which is the corpus's own discriminator", () => {
        expect(normalizeMalagasy("30.000 eo ho eo")).toBe("30000 eo ho eo"); // a population: thousands
        expect(normalizeMalagasy("47.536° ary")).toBe("47 faingo 5 3 6 degre ary"); // a coordinate: decimal
    });

    it("the percent's bound genitive moves from the SIGN onto the word", () => {
        // The corpus writes `45 %n' ny vahoaka`; spelled out it writes `81 isan-jaton'ny mponina`.
        expect(normalizeMalagasy("45 %n' ny vahoaka")).toBe("45 isan-jaton' ny vahoaka");
        expect(normalizeMalagasy("90%n'ny solosaina")).toBe("90 isan-jaton'ny solosaina");
        expect(normalizeMalagasy("Ny 15 % ny vola")).toBe("Ny 15 isan-jato ny vola");
    });

    it("degrees, both powers, and the ampersand", () => {
        expect(normalizeMalagasy("35°C any")).toBe("35 degre any");
        expect(normalizeMalagasy("4°40' atsimo")).toBe("4 degre 40' atsimo"); // no gluing
        expect(normalizeMalagasy("5 km²")).toBe("5 kilaometatra toradroa");
        expect(normalizeMalagasy("0,93 km³")).toBe("0 faingo 9 3 kilaometatra toratelo");
        expect(normalizeMalagasy("A & B")).toBe("A sy B");
    });

    // Declined, and the reasons are measured in normalize.ts.
    it("a BCE year is not a minus", () => {
        expect(normalizeMalagasy("1 Janoary -596 ary maty")).toBe("1 Janoary -596 ary maty");
    });

    it("`&nbsp;` is what the ampersand cell was really counting", () => {
        // 68 of the 83 `&` in the mined segments are this entity.
        expect(normalizeMalagasy("6&nbsp;% ny PIB")).toBe("6 isan-jato ny PIB");
    });
});

// The review pass — trap 8, and the two findings that came out of reading the corpus diff rather than the
// gates, which were green.
describe("Malagasy normalization: the review pass", () => {
    it("a `faha N°` is an ORDINAL, not a degree", () => {
        // ⟨faha-⟩ is the Malagasy ordinal prefix: `taonjato faha 17°` is "the 17th century". The sign is
        // U+00B0, the real degree sign (U+00BA is ×0 here), so only the preceding `faha` separates them.
        expect(normalizeMalagasy("taonjato faha 17° ; dia")).toBe("taonjato faha 17° ; dia");
        expect(normalizeMalagasy("15° eo")).toBe("15 degre eo"); // …and an ordinary degree still reads
    });

    it("the kilogram is the clipped `kilao`, not `kilograma`", () => {
        // `units` is the class the sourcing gate deliberately excludes, so nothing else would have caught
        // a guess: kilao ×32 on the wiki, kilograma ×0.
        expect(normalizeMalagasy("lafarinina 2 kg")).toBe("lafarinina 2 kilao");
    });
});

// The review pass — trap 8 again. This one is trap 7 as well: the corpus writes the scale letter
// uppercase, so nothing in the corpus or the gates would have caught a case-sensitive class.
describe("Malagasy normalization: the scale letter is case-insensitive", () => {
    it("consumes ⟨c⟩/⟨f⟩ in either case", () => {
        expect(normalizeMalagasy("35°c")).toBe("35 degre"); // was `35 degre c`, the letter reaching the IPA
        expect(normalizeMalagasy("98°f")).toBe("98 degre");
        expect(normalizeMalagasy("35°C any")).toBe("35 degre any");
    });

    it("…but a following WORD is not a scale letter", () => {
        expect(normalizeMalagasy("35° celsius")).toBe("35 degre celsius");
    });
});
