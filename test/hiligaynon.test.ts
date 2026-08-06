import { describe, expect, test } from "vitest";

import { createHiligaynon, phonemizeWord } from "../src/languages/hiligaynon/hiligaynon.ts";

// Canonical-IPA goldens for Hiligaynon / Ilonggo (hil) — Austronesian (Western Bisayan), Latin, near-phonemic.
// A shallow rule g2p (the Cebuano/Tagalog pattern) validated against wikipron hil_latn (94.4%) + kaikki hil (94.1%),
// both human. Shares the Bisayan core with Cebuano; the deltas are the Spanish-loan letters ⟨j⟩→[h] and ⟨f⟩→[p].
// Stress (penultimate default) is phonemic-but-unwritten (folded by the eval); the word-final glottal and the
// Spanish rising diphthongs are deferred residuals.
describe("Hiligaynon canonical IPA — Bisayan rule g2p", () => {
    test("glottal stops: word-initial + hiatus; ⟨ng⟩→ŋ", () => {
        expect(phonemizeWord("anak")).toBe("ʔˈanak"); // word-initial glottal onset
        expect(phonemizeWord("daan")).toBe("dˈaʔan"); // hiatus glottal between the two a's
        expect(phonemizeWord("mango")).toBe("mˈaŋo"); // ⟨ng⟩→ŋ (word-final glottal [maŋoʔ] deferred)
        expect(phonemizeWord("balay")).toBe("bˈalaj"); // ⟨ay⟩ glide → aj
    });

    test("the Spanish-loan deltas from Cebuano: ⟨j⟩→h, ⟨f⟩→p", () => {
        expect(phonemizeWord("Bermejo")).toBe("beɾmˈeho"); // ⟨j⟩ → h (Spanish jota, NOT Cebuano's d͡ʒ)
        expect(phonemizeWord("Demafeliz")).toBe("demapˈelis"); // ⟨f⟩ → p (nativised), ⟨z⟩ → s
    });

    test("native vocabulary (the Cebuano core)", () => {
        expect(phonemizeWord("kalibutan")).toBe("kalibˈutan"); // "world" — plain CV
        expect(phonemizeWord("ginhawa")).toBe("ɡinhˈawa"); // "breath/ease"
    });
});

// Native Hiligaynon cardinal numbers (numbers.ts): tens-first with the "kag" connector and the "ka" ligature before
// a magnitude — the Cebuano/Bisayan shape, and the NATIVE set rather than the co-current Spanish loans (uno, dos,
// baynte), following the tagalog/cebuano precedent. Sources cited in hiligaynon.jsonc + numbers.ts.
describe("Hiligaynon cardinal numbers", () => {
    const hil = createHiligaynon();
    const say = (n: number): string => hil.text(String(n)).trim();

    test("units and the irregular ka-…-an tens", () => {
        expect(say(0)).toBe("sˈeɾo"); // sero (Spanish loan; no native numeral for zero)
        expect(say(5)).toBe("lˈima"); // lima
        expect(say(20)).toBe("kaluhˈaʔan"); // kaluhaan (hiatus glottal)
        expect(say(40)).toBe("kapʔˈatan"); // kap-atan (hyphen → glottal)
    });

    test("compounds 11-99 join tens-first with kag", () => {
        expect(say(11)).toBe("napˈulo kˈaɡ ʔˈisa"); // napulo kag isa
        expect(say(25)).toBe("kaluhˈaʔan kˈaɡ lˈima"); // kaluhaan kag lima
        expect(say(99)).toBe("kasijˈaman kˈaɡ sˈijam"); // kasiyaman kag siyam
    });

    test("hundreds / thousands / millions take the ka ligature", () => {
        expect(say(100)).toBe("ʔˈisa kˈa ɡˈatos"); // isa ka gatos
        expect(say(555)).toBe("lˈima kˈa ɡˈatos kˈaɡ kalˈimʔan kˈaɡ lˈima"); // lima ka gatos kag kalim-an kag lima
        expect(say(1000)).toBe("ʔˈisa kˈa lˈibo"); // isa ka libo
        expect(say(1000000)).toBe("ʔˈisa kˈa mˈiljon"); // isa ka milyon
    });

    test("the native series tops out at milyon → ≥10⁹ reads digit-by-digit", () => {
        expect(say(1000000000).split(" ")).toHaveLength(10); // isa sero sero … (documented fallback)
    });
});
