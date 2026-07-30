/**
 * es-419 (Latin-American / "neutral" Spanish) accent DIAGNOSTIC GOLD — the quality anchor. es-419 = the
 * Castilian `es` engine + two categorical, pan-American mergers (seseo θ→s, yeísmo ʎ→ʝ). The referee number
 * (92.6% vs wikipron spa_latn_la, matching the ✅ es parent's 92.5%) is NOT the story — the residual is entirely
 * inherited coda-obstruent-voicing allophony (shared with es). This gold verifies the two mergers are exact on
 * the vocabulary that distinguishes Latin-American from Castilian.
 *
 * NOT included (shared-es lexical exception): ⟨x⟩=[x] in Nahuatl-origin names (México→[ˈmexiko]) — the es engine
 * gives [ks] in both dialects, a shared gap, not es-419-specific.
 */
import { describe, expect, it, test } from "vitest";
import { phonemizeWord } from "../src/languages/spanish-419/spanish-419.ts";
import { phonemize } from "../src/index.ts";
import { ROMAN_POLICY as ES_POLICY } from "../src/languages/spanish/romanOrdinals.ts";
import { ROMAN_POLICY } from "../src/languages/spanish-419/romanOrdinals.ts";

const GOLD: [string, string][] = [
    // SESEO — ⟨c⟩ before e/i and ⟨z⟩ → [s] (Castilian [θ])
    ["cielo", "sjˈelo"], ["cena", "sˈena"], ["cinco", "sˈinko"], ["zapato", "sapˈato"], ["zorro", "sˈoro"],
    ["azúcar", "asˈukaɾ"], ["cabeza", "kaβˈesa"], ["cerveza", "seɾβˈesa"], ["corazón", "koɾasˈon"],
    ["gracias", "ɡɾˈasjas"], ["ciudad", "sjuðˈað"], ["plaza", "plˈasa"], ["luz", "lˈus"],
    // YEÍSMO — ⟨ll⟩ → [ʝ], merging with ⟨y⟩ (Castilian [ʎ])
    ["calle", "kˈaʝe"], ["llave", "ʝˈaβe"], ["llamar", "ʝamˈaɾ"], ["pollo", "pˈoʝo"], ["caballo", "kaβˈaʝo"],
    ["ella", "ˈeʝa"], ["yo", "ʝˈo"], ["yema", "ʝˈema"], ["mayo", "mˈaʝo"], ["ayer", "aʝˈeɾ"], ["playa", "plˈaʝa"],
    // unchanged from Castilian (no θ/ʎ) — sanity that the rest of the engine is intact
    ["casa", "kˈasa"], ["perro", "pˈero"], ["gato", "ɡˈato"], ["agua", "ˈaɣwa"], ["españa", "espˈaɲa"],
    ["niño", "nˈiɲo"], ["español", "espaɲˈol"], ["mujer", "muxˈeɾ"], ["gente", "xˈente"], ["jamón", "xamˈon"],
];

describe("es-419 (Latin-American) seseo + yeísmo", () => {
    for (const [word, ipa] of GOLD) {
        it(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});

// ── Roman-numeral policy (src/languages/spanish-419/romanOrdinals.ts) ──
// A CENTURY IS A CARDINAL in es-419 (the RAE Ortografía is co-published with ASALE, so the pan-Hispanic reading applies) — the shared Roman→digits pass is already right and the policy
// must not change that. What the policy adds is the PRENOMINAL ordinal of event names, which is ordinal at ANY
// value (XL/L aniversari·o → the -ésimo / -è series), where the cardinal would be the wrong register.
describe("es-419 Roman-numeral policy — centuries cardinal, prenominal events ordinal", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal(n);

    test("a century stays a CARDINAL (the century noun is not a trigger)", () => {
        expect(ROMAN_POLICY.ordinalBefore).toBeUndefined();
        expect(ROMAN_POLICY.ordinalAfter?.test("siglo")).toBe(false);
        expect(phonemize("siglo xix", "es-419")).toBe('sˈiɣlo djesinwˈeβe');
    });

    test("a bare numeral, with no ordinal context, stays a CARDINAL", () => {
        expect(phonemize("xix", "es-419")).toBe('djesinwˈeβe');
    });

    test("prenominal event context is ordinal, and unbounded — XL / L / above L", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("aniversario")).toBe(true);
        expect(ord(40)).toBe('cuadragésimo');
        expect(ord(50)).toBe('quincuagésimo');
        expect(ord(60)).toBe('sexagésimo');
        expect(phonemize('quincuagésimo aniversario', "es-419")).toBe('kinkwaxˈesimo aniβeɾsˈaɾjo');
    });

    test("feminine heads are deliberately NOT triggered (the series is masculine)", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("edición")).toBe(false);
    });

    test("es-419 re-exports the es policy verbatim (no drift)", () => {
        expect(ROMAN_POLICY).toBe(ES_POLICY);
    });
});
