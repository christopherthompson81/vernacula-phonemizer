import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeBasque } from "../src/languages/basque/normalize.ts";

import { phonemizeWord, createBasque } from "../src/languages/basque/basque.ts";

// Canonical-IPA goldens for Basque (eu) — euskara, a LANGUAGE ISOLATE, Latin script. The hallmark is the THREE-WAY
// SIBILANT / affricate system: laminal ⟨z⟩→[s̻] / ⟨tz⟩→[t͡s̻], apical ⟨s⟩→[s̺] / ⟨ts⟩→[t͡s̺], postalveolar ⟨x⟩→[ʃ] /
// ⟨tx⟩→[t͡ʃ]. Plus the ⟨r⟩ tap/trill split and the palatal digraphs. Referee: wikipron eus_latn broad + narrow.
describe("Basque (euskara) canonical IPA", () => {
    test("THE HALLMARK — the three-way sibilant contrast (laminal / apical / postalveolar)", () => {
        expect(phonemizeWord("zu")).toBe("s̻u"); // 'you' — ⟨z⟩→[s̻] laminal
        expect(phonemizeWord("su")).toBe("s̺u"); // 'fire' — ⟨s⟩→[s̺] apical (a MINIMAL PAIR with zu)
        expect(phonemizeWord("xede")).toBe("ʃede"); // ⟨x⟩→[ʃ] postalveolar
        expect(phonemizeWord("gizon")).toBe("ɡis̻on"); // 'man' — ⟨z⟩→[s̻]
    });

    test("the three-way AFFRICATE contrast (⟨tz ts tx⟩)", () => {
        expect(phonemizeWord("atzo")).toBe("at͡s̻o"); // 'yesterday' — ⟨tz⟩→[t͡s̻] laminal
        expect(phonemizeWord("hots")).toBe("hot͡s̺"); // 'sound' — ⟨ts⟩→[t͡s̺] apical
        expect(phonemizeWord("etxe")).toBe("et͡ʃe"); // 'house' — ⟨tx⟩→[t͡ʃ] postalveolar
        expect(phonemizeWord("hotz")).toBe("hot͡s̻"); // 'cold' — ⟨tz⟩→[t͡s̻] (vs hots's ⟨ts⟩)
    });

    test("⟨r⟩ — tap [ɾ] between vowels, trill [r] finally / before a consonant / doubled", () => {
        expect(phonemizeWord("udare")).toBe("udaɾe"); // intervocalic single ⟨r⟩ → [ɾ] tap
        expect(phonemizeWord("hartu")).toBe("hartu"); // ⟨r⟩ before a consonant → [r] trill
        expect(phonemizeWord("herri")).toBe("heri"); // ⟨rr⟩ → [r] trill
        expect(phonemizeWord("lur")).toBe("lur"); // word-final ⟨r⟩ → [r] trill
    });

    test("palatal digraphs + ⟨j⟩ + ⟨g⟩", () => {
        expect(phonemizeWord("onddo")).toBe("onɟo"); // ⟨dd⟩→[ɟ] palatal stop
        expect(phonemizeWord("jan")).toBe("xan"); // ⟨j⟩→[x]
        expect(phonemizeWord("gizon")).toContain("ɡ"); // ⟨g⟩→[ɡ] always (no soft g)
        expect(phonemizeWord("euskara")).toBe("eus̺kaɾa"); // the endonym — ⟨s⟩→[s̺], intervocalic ⟨r⟩→[ɾ]
    });

    test("the VIGESIMAL (base-20) number system", () => {
        const eu = createBasque();
        expect(eu.text("20")).toBe("hoɡei"); // one score
        expect(eu.text("30")).toBe("hoɡeita hamar"); // 20 + connective -ta + 10
        expect(eu.text("40")).toBe("beroɡei"); // 2×20 — ⟨rr⟩→[r] trill
        expect(eu.text("60")).toBe("hiɾuɾoɡei"); // 3×20 — single ⟨r⟩→[ɾ] tap (contrast with 40's trill)
        expect(eu.text("80")).toBe("lauɾoɡei"); // 4×20
        expect(eu.text("99")).toBe("lauɾoɡeita hemeɾet͡s̻i"); // 4×20 + 19
        expect(eu.text("101")).toBe("ehun eta bat"); // hundreds take the free connective ⟨eta⟩
        expect(eu.text("234")).toBe("berehun eta hoɡeita hamalau"); // 200 eta (20+14)
        expect(eu.text("2025")).toBe("bi mila eta hoɡeita bos̺t"); // 2 thousand eta (20+5)
    });

    // 10⁹ was out of range and leaked the raw digits. Basque is LONG-SCALE: ⟨bilioi⟩ is 10¹², and 10⁹ is said
    // ⟨mila milioi⟩ "a thousand million" — Berria Estilo Liburua (the Euskaltzaindia-aligned style manual):
    // "45.000 milioi [45 mila milioi]". The vigesimal 20-99 core is untouched.
    test("the milioi / mila milioi scales (long scale — 10⁹ is NOT bilioi)", () => {
        const eu = createBasque();
        expect(eu.text("7")).toBe("s̻as̻pi"); // zazpi — units
        expect(eu.text("12345")).toBe("hamabi mila hiɾuɾehun eta beroɡeita bos̺t"); // thousands
        expect(eu.text("100000")).toBe("ehun mila"); // ehun mila
        expect(eu.text("1000000")).toBe("milioi bat"); // milioi bat — "bat" FOLLOWS milioi
        expect(eu.text("2000000")).toBe("bi milioi"); // bi milioi
        expect(eu.text("1000000000")).toBe("mila milioi"); // was a DIGIT-LEAK
        expect(eu.text("2000000000")).toBe("bi mila milioi");
    });
});


// TEXT NORMALIZATION (eu) — src/languages/basque/normalize.ts. Every word's source is cited at its
// declaration there. These pin the rules' BRANCHES rather than the corpus's instances (playbook trap 13),
// so several cases below are shapes tools/corpus/mined/eu.jsonc does not contain, and several are shapes it
// does contain that the layer must REFUSE.
describe("Basque text normalization — the period groups, the comma divides, the suffix glues", () => {
    test("the grouping PERIOD is not a sentence break", () => {
        expect(normalizeBasque("42.262.142")).toBe("42262142");
        expect(normalizeBasque("1.000")).toBe("1000");
        // ⚠ a dotted CITATION is not a grouped number — its components are one and two digits
        expect(normalizeBasque("Am 2.18.19-26")).toBe("Am 2.18.19-26");
        // trap 58: a clause mark after a grouped figure is not a continuation of it
        expect(normalizeBasque("41.000 urteko")).toBe("41000 urteko");
    });

    test("the decimal COMMA is `koma`, from espeak's own `_dpt`", () => {
        expect(phonemize("93,55", "eu").trim()).toBe("lauɾoɡeita hamahiɾu koma beroɡeita hamabos̺t");
        expect(normalizeBasque("93,55.")).toBe("93 koma 55."); // still a decimal at a sentence end
    });

    test("percent is PREFIXED, which the wiki states outright", () => {
        expect(phonemize("% 32,1", "eu").trim()).toBe("ehuneko hoɡeita hamabi koma bat");
        expect(phonemize("%7a", "eu").trim()).toBe("ehuneko s̻as̻pia"); // sign, figure and article together
    });

    test("units, the squared modifier and the rate denominator", () => {
        expect(phonemize("5 km", "eu").trim()).toBe("bos̺t kilometro");
        expect(normalizeBasque("42.262.142 km²")).toBe("42262142 kilometro karratu");
        expect(normalizeBasque("5 km³")).toBe("5 kilometro kubiko");
        expect(phonemize("120 km/h", "eu").trim()).toBe("ehun eta hoɡei kilometro orduko");
    });

    test("the degree sign takes its SCALE, and a bare one is refused", () => {
        expect(phonemize("56,7 ° C", "eu").trim()).toBe("beroɡeita hamas̺ei koma s̻as̻pi ɡradu kels̺ius̺");
        expect(normalizeBasque("26 °F")).toBe("26 gradu Fahrenheit");
        // ⚠ THE REFUSAL: `gradu` in this corpus is the ANGULAR degree, so a bare sign is not claimed —
        // reading it would put a temperature word on a latitude.
        expect(normalizeBasque("23,4° ingurukoa")).toBe("23 koma 4° ingurukoa");
    });

    test("the glued case ending attaches to the LAST spoken word, and is not derived", () => {
        expect(phonemize("1980an", "eu").trim()).toBe("mila bedeɾat͡s̻iehun eta lauɾoɡeian");
        expect(phonemize("1980ko", "eu").trim()).toBe("mila bedeɾat͡s̻iehun eta lauɾoɡeiko");
        expect(phonemize("25ean", "eu").trim()).toBe("hoɡeita bos̺tean");
        // a figure may carry BOTH a sign and an ending — the tier claims the `%`, this step the ending
        expect(normalizeBasque("% 80ko")).toBe("ehuneko 80ko".replace("80ko", "laurogeiko"));
        // ⚠ and a DECIMAL may carry one too — the case that fell between the two rules
        expect(phonemize("% 93,55a", "eu").trim())
            .toBe("ehuneko lauɾoɡeita hamahiɾu koma beroɡeita hamabos̺ta");
        // ⚠ THE ENDING LIST IS CLOSED: these are a unit and a multiplication, not case endings
        expect(normalizeBasque("2x3")).toBe("2x3");
    });

    test("the ending also glues to the UNIT, and only where the writer marked the boundary", () => {
        expect(normalizeBasque("44.579.000 km²ko eremua")).toBe("44579000 kilometro karratuko eremua");
        expect(normalizeBasque("40 091 km-koa")).toBe("40091 kilometrokoa"); // space-grouped too
        expect(normalizeBasque("kg-ko")).toBe("kilogramoko");
        // ⚠ THE GUARD: a hyphen or an exponent must be present, or a one-letter key plus a two-letter
        // ending would claim ordinary words. These must survive untouched.
        expect(normalizeBasque("man")).toBe("man");
        expect(normalizeBasque("gizonak eta emakumeak")).toBe("gizonak eta emakumeak");
    });

    test("a magnitude word between the figure and its unit keeps them adjacent", () => {
        expect(normalizeBasque("44 milioi km²")).toBe("44 milioi kilometro karratu");
        expect(normalizeBasque("399 milioi km-koa")).toBe("399 milioi kilometrokoa");
    });

    test("population density is refused whole — its numerator is a NOUN", () => {
        // the entire residual `km` leak, one shape, one per country stub. `bizt.` is *biztanle*, and no unit
        // table can name a common-noun numerator (the playbook's `Eihwohna/km²` case).
        expect(normalizeBasque("(141 bizt./km²)")).toBe("(141 bizt./km²)");
    });
});
