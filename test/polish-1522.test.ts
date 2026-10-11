// #1522 — Polish defects found by the Rust port. Expectations were derived by running the fixed engine; where a
// relation says more than a string (a capitalised head reads like the lowercase one), the relation is asserted.
// Mirrored in csharp/…/Polish1522Tests.cs and rust/…/polish/polish.rs.
import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/polish/polish.ts";
import { normalizePolish as n } from "../src/languages/polish/normalize.ts";

describe("#1522 Polish", () => {
    test("1. the clock needs a left boundary: no time is read out of a longer digit run", () => {
        expect(n("Wynik 123:45 i 21:01:05.")).toBe("Wynik 123:45 i 21:01:05.");
        expect(n("Spotkanie o 12:30 i 7:05.")).toBe("Spotkanie o dwunastej 30 i siódma 05."); // still reads
    });

    test("2. a capitalised decade head inflects like the lowercase one", () => {
        for (const t of ["Lata 90. były dobre.", "W Latach 20. było cicho.", "Latach 30. i"]) {
            const lower = t.replace(/L/u, "l");
            expect(n(lower)).not.toBe(lower); // the lowercase head is read
            expect(n(t)).toBe(n(lower).replace(/l/u, "L"));
        }
        expect(n("Lata 90. były dobre.")).toBe("Lata dziewięćdziesiąte były dobre.");
        expect(n("Lata 90. Potem")).toBe("Lata 90. Potem"); // an uppercase follower is still a sentence period
    });

    test("3. ą/ę before a labial fricative is the [w̃] glide; a velar fricative keeps [ŋ]", () => {
        expect(phonemizeWord("trąf")).toBe("trˈɔw̃f");
        expect(phonemizeWord("jąwszy")).toBe("jˈɔw̃fʂɨ");
        expect(phonemizeWord("kąpać")).toBe("kˈɔmpat͡ɕ"); // a labial STOP keeps [m]
        expect(phonemizeWord("wąchać")).toBe("vˈɔŋxat͡ɕ");
    });

    test("5. a fraction before a sentence or clause stop is read; decimals and chains still decline", () => {
        expect(n("To 1/5 i 1/2.")).toBe("To jedna piąta i jedna druga.");
        expect(n("Pół to 1/2, a ćwierć 1/4.")).toBe("Pół to jedna druga, a ćwierć jedna czwarta.");
        expect(n("3/1/2 i 1/2,5 oraz 1,5/2")).toBe("3/1/2 i 1/2,5 oraz 1,5/2");
    });
});
