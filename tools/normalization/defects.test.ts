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

import { CITED_WORDS, DROPPABLE, acceptedSignClass, allOccurrencesForeign, inForeignSpan } from "./defects.ts";

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

describe("a citation is sourcing, but only if a reader could go and check it", () => {
    // CITED_WORDS is the `sourcing` gate's only escape hatch, and it exists because a corpus cannot attest how a
    // SYMBOL is spoken: writers type `2.5` and never write out how they say it, so Igbo's `ntụkpọ` scores 0 in a
    // 559k-line dump and is still the right word. The risk is that the hatch becomes a way to quiet the gate, so
    // these tests pin the properties that keep it narrow.
    const entries = Object.entries(CITED_WORDS).flatMap(([lang, ws]) => Object.entries(ws).map(([w, c]) => [lang, w, c] as const));

    test("every citation NAMES ITS SOURCE — a vague one is a TODO in a citation's clothes", () => {
        // "a dictionary" or "standard usage" is not checkable and must not pass review. The test is deliberately
        // crude (length + a named work) because the real check is human; what it forbids is a one-word placeholder.
        for (const [lang, word, cite] of entries) {
            expect(cite.length, `${lang}/${word}`).toBeGreaterThan(80);
            expect(cite, `${lang}/${word}`).toMatch(/\p{Lu}/u);   // a proper noun: the work, the author, or the site
        }
    });

    test("⚠ the cited word is the word, not a description of it", () => {
        // A key here is matched against the needle `review.ts` extracts from the manifest, so a mismatch would
        // silently do nothing — the gate would report the word unattested and the entry would look applied.
        for (const [lang, word] of entries) {
            expect(word.trim(), `${lang}: keys must be bare words`).toBe(word);
            expect(word, `${lang}/${word}`).toMatch(/^[\p{L}\p{M}][\p{L}\p{M}'’ʻ·-]*$/u);
        }
    });

    test("igbo's decimal word is cited, and the citation records that the corpus says nothing", () => {
        const cite = CITED_WORDS["ig"]?.["ntụkpọ"];
        expect(cite).toBeDefined();
        expect(cite).toMatch(/Nkọwa okwu/u);
        // The zero is part of the claim, not an omission from it — see the playbook's corpus-silence trap.
        expect(cite).toMatch(/ZERO/u);
    });
});

describe("⚠ a superscript with nothing before it is not an exponent", () => {
    const RE = new Map(DROPPABLE).get("exponent")!;
    const hits = (s: string): string[] => { RE.lastIndex = 0; return [...s.matchAll(new RegExp(RE.source, RE.flags))].map((m) => m[0]); };

    test("isotope notation is not flagged — the superscript is a MASS NUMBER before the element", () => {
        // Yoruba's residual gate failure was one English sentence about carbon isotopes. `normalizeSymbols.ts`
        // is right not to read `⁸C`: its own BARE_EXPONENT requires a base. The class was looser than the reader.
        expect(hits("the shortest-lived of these is ⁸C which decays")).toEqual([]);
        expect(hits("³He and ¹⁴C dating")).toEqual([]);
    });

    test("a real exponent IS flagged, run and all", () => {
        // ⚠ THE WHOLE RUN. A superscript digit is \p{No}, not \p{Nd}, so a per-character pattern anchored on a
        // base matched only the first character of `10¹⁵` and shortened the sign's extent, which changes what the
        // differential drop test compares.
        expect(hits("10¹⁵ formigues")).toEqual(["¹⁵"]);
        expect(hits("250 km²")).toEqual(["²"]);
        // Spaced, as corpora write it — and the negative exponent's run begins with the superscript minus.
        expect(hits("16000km ² of land")).toEqual(["²"]);
        expect(hits("6.67 × 10 −11 N m² kg⁻²")).toEqual(["²", "⁻²"]);
    });

    test("a bare footnote marker with no base is not flagged", () => {
        expect(hits("¹¹ ཚུནི་ཡིས")).toEqual([]);
    });
});
