/**
 * The two discriminators that decide whether a dropped symbol is THIS language's defect.
 *
 * ⚠ WHY THEY EXIST. The artifact scan reported a hard failure for two things that were not Khmer reading gaps: a
 * currency sign inside the ENGLISH half of a bilingual cell (`SGD$8.5 million to build`, with 0 Khmer letters
 * either side), and an `=` whose silence is a refusal argued at length in the language's own file. The first is a
 * fact about English; the second was already recorded in `ACCEPTED_SIGN_SILENCE`, which this scan did not consult —
 * the same inconsistency #586 fixed between `coverage.ts` and `review.ts`, one level up.
 *
 * Both are easy to get wrong in the direction of HIDING real defects, so what is pinned here is mostly the
 * negative cases: a sign in the native half of a bilingual line, a line mixing an accepted sign with a read one,
 * a Latin-script language (where the foreign test must be inert), and a missing script (which must fail toward
 * reporting).
 */
import { describe, expect, test } from "vitest";

import { acceptedSignClass, allOccurrencesForeign, inForeignSpan } from "./defects.ts";

describe("a symbol in a FOREIGN-language span is not this language's defect", () => {
    // Mined artifacts contain BILINGUAL lines — legitimately, since most of such a line IS the language — and a
    // symbol sitting in the English half of one tests English. km's gate failed on `SGD$8.5 million to build`
    // inside a cell with 0 Khmer letters either side of the sign, which asked the author to source a Khmer reading
    // for English prose. This is the sub-sentence analogue of scripts.ts's whole-segment native filter.
    const KHMER = /\p{Script=Khmer}/u;
    const bilingual = "ឧទ្យាន ប៊ីសេន សាងសង់នៅ។ It was also envisioned as a leisure destination, costing SGD$8.5 million to build";

    test("the English half of a bilingual line is recognised as foreign", () => {
        expect(inForeignSpan(bilingual, bilingual.indexOf("$"), KHMER)).toBe(true);
    });

    test("⚠ a sign in the NATIVE half is NOT foreign, even in the same bilingual line", () => {
        // The discrimination has to be local, or one English clause would excuse every drop in the line. km's
        // `CN¥117,500` sits in a Khmer sentence and remains a genuine, reported gap.
        const khmerSpan = "ជាមួយនឹងចំនួនប្រជាជន ៤១.៥ លាននាក់ ហ្វូជៀន គិតត្រឹមឆ្នាំ២០២១ជីឌីភី របស់ហ្វូជៀននៅ CN¥117,500 (ប្រហាក់ប្រហែល";
        expect(inForeignSpan(khmerSpan, khmerSpan.indexOf("¥"), KHMER)).toBe(false);
    });

    test("ALL occurrences must be foreign — one native-context instance keeps it a defect", () => {
        const mixed = `${bilingual} និងតម្លៃ ១០០$ ក្នុងមួយខែបូកតម្លៃ`;
        expect(allOccurrencesForeign(mixed, /[$]/gu, KHMER)).toBe(false);
        expect(allOccurrencesForeign(bilingual, /[$]/gu, KHMER)).toBe(true);
    });

    test("⚠ it is INERT for a Latin-script language, and must be", () => {
        // There the native script IS Latin, so Latin can never outnumber it — the test cannot fire and a Latin
        // language's drops are all reported, as they must be.
        const en = "The park, costing SGD$8.5 million to build, is one of the largest";
        expect(inForeignSpan(en, en.indexOf("$"), /\p{sc=Latn}/u)).toBe(false);
    });

    test("no native script (thin evidence or a two-script mix) fails toward REPORTING", () => {
        expect(allOccurrencesForeign(bilingual, /[$]/gu, undefined)).toBe(false);
    });
});

describe("a CLASS-level refusal is not a per-line defect either", () => {
    // DROPPABLE is coarse — `math-sign` covers + ± × ÷ = < > — while ACCEPTED_SIGN_SILENCE is per SIGN. The scan
    // consulted the per-instance table but not the per-class one, so km's `=` was simultaneously a documented
    // refusal (1,348 glosses and 1,057 code-shaped against 109 real arithmetic) and a hard scan failure.
    test("km's documented `=` refusal covers a math-sign drop on a line containing only `=`", () => {
        expect(acceptedSignClass("km", "math-sign", "រណបភព(ចក្រវាឡរណប=satellite)របស់វា")).toBe(true);
    });

    test("⚠ a line mixing an accepted sign with a READ one is still a defect", () => {
        // km reads × (គុណ, 46 corpus instances). A line with both must keep reporting, because the × may be the
        // one being dropped — accepting it would hide a real gap behind an unrelated refusal.
        expect(acceptedSignClass("km", "math-sign", "៣×៥ ហើយ ៤=៤")).toBe(false);
    });

    test("a language with no declared class refusal is unaffected", () => {
        expect(acceptedSignClass("cs", "math-sign", "4 = 4")).toBe(false);
    });
});
