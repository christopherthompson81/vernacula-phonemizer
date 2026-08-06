import { describe, expect, test } from "vitest";

import { phonemizeWord, createMalagasy } from "../src/languages/malagasy/malagasy.ts";

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
