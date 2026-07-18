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
import { describe, expect, it } from "vitest";
import { phonemizeWord } from "../src/languages/spanish-419/spanish-419.ts";

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
