/**
 * DOUBLE-ENCODED UTF-8 REPAIR — the two-byte arms as a general formula, and the PHANTOM SYMBOLS that
 * half-repaired mojibake manufactures.
 *
 * The phantoms are the reason this file exists. Latin-1 punctuation doubles as a UTF-8 continuation byte, and
 * several of those bytes are exactly the signs the normalization audit hunts for — so an unrepaired sequence
 * does not merely fail to read, it INVENTS a symbol for a later pass to reason about:
 *   `Ä°zmir`  = `Ä` + `°`  → a DEGREE sign in a sentence about a city's population
 *   `SÃ£o`    = `Ã` + `£`  → a POUND sign in a Brazilian place name
 * Both were chased as per-language defects before the shared cause was found.
 */
import { describe, expect, test } from "vitest";
import { repairDoubleEncoded } from "../src/core/unicode.ts";

describe("repairDoubleEncoded", () => {
    test("the two-byte arms cover C2 through C5, not just C2/C3", () => {
        // C2: the code point EQUALS the trailing byte, so the repair is to drop the lead.
        expect(repairDoubleEncoded("19.500 kmÂ²")).toBe("19.500 km²");
        expect(repairDoubleEncoded("30Â°C")).toBe("30°C");
        expect(repairDoubleEncoded("Â£5")).toBe("£5");
        // C3: the code point is the trailing byte plus 0x40.
        expect(repairDoubleEncoded("Las CaÃ±itas")).toBe("Las Cañitas");
        expect(repairDoubleEncoded("David KlÃ¶cker")).toBe("David Klöcker");
        expect(repairDoubleEncoded("SÃ£o Paulo")).toBe("São Paulo");
        // C4 — Latin Extended-A, and the case that forced the generalization. `İ` (U+0130) is `C4 B0`, whose
        // trailing byte is the DEGREE SIGN. Measured across all 67 FLEURS corpora: two occurrences, both this
        // one, and lead bytes C6-CF occur zero times — so stopping at C5 costs nothing.
        expect(repairDoubleEncoded("Ä°zmir")).toBe("İzmir");
    });

    test("the three-byte pass still runs FIRST, so its lead is not eaten", () => {
        expect(repairDoubleEncoded("7â€“2")).toBe("7–2");
        // `“` is `E2 80 9C` and 0x9C maps to `œ`, A LETTER — so an opening-quote arm placed before the full
        // decode matched `â€` and stranded the `œ`.
        expect(repairDoubleEncoded("â€œhello")).not.toContain("œ");
    });

    test("clean text is returned untouched", () => {
        for (const s of ["İzmir", "São Paulo", "30°C", "plain ascii", "ধরন", "日本語"])
            expect(repairDoubleEncoded(s)).toBe(s);
    });

    test("the fast path admits every lead byte the arms can repair", () => {
        // The early-out guard was `[ÂÃâ]` while the arm reached C5, so `Ä°zmir` returned EARLY and the
        // generalization silently did nothing. Guard and arms must stay in step.
        expect(repairDoubleEncoded("Ä°")).not.toBe("Ä°");
    });
});
