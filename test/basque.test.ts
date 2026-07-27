import { describe, expect, test } from "vitest";

import { phonemizeWord, createBasque } from "../src/languages/basque/basque.ts";

// Canonical-IPA goldens for Basque (eu) — euskara, a LANGUAGE ISOLATE, Latin script. The hallmark is the THREE-WAY
// SIBILANT / affricate system: laminal ⟨z⟩→[s̻] / ⟨tz⟩→[t͡s̻], apical ⟨s⟩→[s̺] / ⟨ts⟩→[t͡s̺], postalveolar ⟨x⟩→[ʃ] /
// ⟨tx⟩→[t͡ʃ]. Plus the ⟨r⟩ tap/trill split and the palatal digraphs. Referee: wikipron eus_latn broad + narrow.
// See docs/investigations/eu_native_bringup_investigation.md.
describe("Basque (euskara) canonical IPA", () => {
    test("★ THE HALLMARK — the three-way sibilant contrast (laminal / apical / postalveolar)", () => {
        expect(phonemizeWord("zu")).toBe("s̻u"); // 'you' — ⟨z⟩→[s̻] laminal
        expect(phonemizeWord("su")).toBe("s̺u"); // 'fire' — ⟨s⟩→[s̺] apical (a MINIMAL PAIR with zu)
        expect(phonemizeWord("xede")).toBe("ʃede"); // ⟨x⟩→[ʃ] postalveolar
        expect(phonemizeWord("gizon")).toBe("ɡis̻on"); // 'man' — ⟨z⟩→[s̻]
    });

    test("★ the three-way AFFRICATE contrast (⟨tz ts tx⟩)", () => {
        expect(phonemizeWord("atzo")).toBe("at͡s̻o"); // 'yesterday' — ⟨tz⟩→[t͡s̻] laminal
        expect(phonemizeWord("hots")).toBe("hot͡s̺"); // 'sound' — ⟨ts⟩→[t͡s̺] apical
        expect(phonemizeWord("etxe")).toBe("et͡ʃe"); // 'house' — ⟨tx⟩→[t͡ʃ] postalveolar
        expect(phonemizeWord("hotz")).toBe("hot͡s̻"); // 'cold' — ⟨tz⟩→[t͡s̻] (vs hots's ⟨ts⟩)
    });

    test("★ ⟨r⟩ — tap [ɾ] between vowels, trill [r] finally / before a consonant / doubled", () => {
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

    test("★ the VIGESIMAL (base-20) number system", () => {
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
});
