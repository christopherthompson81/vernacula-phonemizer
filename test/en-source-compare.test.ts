/**
 * THE NORMALISATION IS THE INSTRUMENT, and three successive versions of it gave 1,005, 663 and 609
 * candidates before it was right. Each wrong version would have produced hundreds of false "fixes" that
 * looked exactly like real ones, so every step is pinned here rather than left to a comment.
 *
 * tools/english/en_source_compare.mts — the triple-source audit over `dict ∩ gold ∩ moby`.
 */
import { describe, expect, test } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalise, goldToArpabet, mobyToArpabet, modernise, audit,
    MOBY_DEFECTIVE, MOBY_DEFECTIVE_READING, MOBY_DEFECTIVE_READING_WHY } from "../tools/english/en_source_compare.mts";

describe("the triple-source comparison form", () => {
    // ⚠ STEP 1. Keeping stress made the top-frequency hits almost entirely FUNCTION WORDS differing only in
    // the digit. This engine de-accents those at the PHRASE layer (english.jsonc `unstressedWords`), so the
    // dictionary's stress-1 IS the correct citation form and the difference is not a defect.
    test("stress is stripped, so a function word's citation stress is not a difference", () => {
        expect(normalise(["AH1", "V"])).toBe(normalise(["AH0", "V"]));          // of
        expect(normalise(["T", "UW1"])).toBe(normalise(["T", "UW0"]));          // to
        expect(normalise(["W", "IH1", "DH"])).toBe(normalise(["W", "IH0", "DH"])); // with
    });

    // ⚠ STEP 2. AH/IH is this engine's declared weak-vowel convention — it writes AH0 where gold and Moby
    // write IH0 and renders it `ᵻ`. Leaving them apart buries the real signal under one settled axis.
    test("AH and IH merge, because that pair is the declared ᵻ convention", () => {
        expect(normalise(["M", "EH1", "S", "AH0", "JH"])).toBe(normalise(["M", "EH1", "S", "IH0", "JH"]));
        expect(normalise(["P", "AE1", "K", "AH0", "JH"])).toBe(normalise(["P", "AE1", "K", "IH0", "JH"]));
    });

    // ⚠ ER IS NOT IN THAT MERGE. `ɚ` against `ə` is a real distinction, not a notation one.
    test("ER does not merge with schwa", () => {
        expect(normalise(["B", "ER0"])).not.toBe(normalise(["B", "AH0"]));
    });

    // ⚠ AND REAL DIFFERENCES MUST SURVIVE BOTH STEPS, or the instrument reports nothing.
    test("genuine segmental differences survive", () => {
        expect(normalise(["P", "UW1", "R"])).not.toBe(normalise(["P", "UH1", "R"]));       // poor
        expect(normalise(["W", "IH0", "TH", "AW1", "T"]))
            .not.toBe(normalise(["W", "IH0", "DH", "AW1", "T"]));                          // without
        expect(normalise(["R", "IH1", "L", "IY0"]))
            .not.toBe(normalise(["R", "IY1", "AH0", "L", "IY0"]));                         // really
    });
});

describe("the source converters", () => {
    test("misaki gold's alphabet maps to ARPABET", () => {
        expect(goldToArpabet("kˈɑt")).toEqual(["K", "AA1", "T"]);           // cot
        expect(goldToArpabet("kˈɔt")).toEqual(["K", "AO1", "T"]);           // caught — the pair must differ
        expect(goldToArpabet("ʧˈiz")).toEqual(["CH", "IY1", "Z"]);          // cheese
    });

    // ⚠ OY IS WRITTEN `//Oi//` THROUGHOUT MOBY, never `/OI/`. Un-normalised it tokenises as two empty
    // slash-pairs plus a raw `Oi`, which is where the file's 5,389 stray `//` come from.
    test("Moby's notation maps, including its doubled-slash OY", () => {
        expect(mobyToArpabet("h/@/t", "hut")).toEqual(["HH", "AH0", "T"]);          // hut
        expect(mobyToArpabet("t//Oi//", "toy")).toEqual(["T", "OY0"]);              // toy
        // ⚠ THE NURSE VOWEL CONSUMES ITS FOLLOWING `r`: Moby writes them separately, and not consuming it
        // gave `P ER1 R S AH0 N` — a doubled rhotic in every NURSE word.
        expect(mobyToArpabet("'p/[@]/rs/@/n", "person")).toEqual(["P", "ER1", "S", "AH0", "N"]);
        expect(mobyToArpabet("b/[@]/rd", "bird")).toEqual(["B", "ER0", "D"]);
    });

    // ⚠ THE BARE-DIGRAPH RULES, AND THE ONE THAT NEEDS THE HEADWORD. `sh` and `wh` are decided by Moby's
    // own separator — adjacent is the file lapsing into the spelling, separated is a real seam. `gh`
    // CANNOT be, because the file writes `Leghorn` separated and `leghorn` adjacent for the same word;
    // it is decided by whether the headword spells the ⟨gh⟩ at all.
    test("a bare digraph is read by the rule its own class supports", () => {
        expect(mobyToArpabet("d/&/l'm/eI/sh/@/n", "dalmatian")).toEqual(["D", "AE0", "L", "M", "EY1", "SH", "AH0", "N"]);
        expect(mobyToArpabet("'m/I/s,h/&/p", "mishap")).toEqual(["M", "IH1", "S", "HH", "AE2", "P"]);
        // ⚠ THE REAL BODY, `'wh/I/p/I/t`. An earlier version of this line used `'w/I/p/@/t`, which has no
        // `h` at all — the `wh` branch never fired and the assertion passed through `M_RAW`, so deleting
        // the rule it claims to cover left the test green.
        expect(mobyToArpabet("'wh/I/p/I/t", "whippet")).toEqual(["W", "IH1", "P", "IH0", "T"]);
        // ⚠ THE LOAD-BEARING PAIR. Same digraph, same adjacency, opposite readings — only the spelling
        // separates them, and getting this backwards would break a row that currently passes.
        expect(mobyToArpabet("'gh/i/z/@/", "giza")).toEqual(["G", "IY1", "Z", "AH0"]);
        expect(mobyToArpabet("'l/E/gh/oU/rn", "leghorn")).toEqual(["L", "EH1", "G", "HH", "OW0", "R", "N"]);
        expect(mobyToArpabet("'l/E/g,h/O/rn", "leghorn")).toEqual(["L", "EH1", "G", "HH", "AO2", "R", "N"]);
    });

    // ⚠ A MULTI-WORD ENTRY OR MOBY'S FRENCH SUB-SCHEME RETURNS undefined, so the audit skips it rather than
    // voting on a partial reading.
    test("unmappable entries decline rather than guess", () => {
        expect(mobyToArpabet("'&/b/@/k/@/s_'m/eI//dZ//@/r", "abacus_major")).toBeUndefined(); // multi-word
        expect(mobyToArpabet("AbA'/Z//u/R", "abat-jour")).toBeUndefined();                 // French scheme
    });

    // ⚠ MOBY IS PRE-MERGER and must be folded before it may vote: it keeps FORCE apart from NORTH, which
    // GenAm merged, and the conservative yod. Found by validating it against CMUdict — 694 rows write
    // `OW R` where CMUdict has `AO R`, every one of them `aboard`/`adore`/`airport`-shaped.
    test("modernise folds FORCE→NORTH and the conservative yod", () => {
        expect(modernise(["AH0", "B", "OW1", "R", "D"])).toEqual(["AH0", "B", "AO1", "R", "D"]); // aboard
        expect(modernise(["S", "IY1", "Z", "Y", "UW0", "R"])).toEqual(["S", "IY1", "ZH", "UW0", "R"]); // seizure
        // coalescence REPLACES the coronal — /tj/ is one segment /tʃ/, not two
        expect(modernise(["T", "Y", "UW1", "N"])).toEqual(["CH", "UW1", "N"]); // tune
    });

    test("modernise folds Moby's two-symbol /@/r into ER", () => {
        // ⚠ ocular: Moby writes the unstressed -ər as `/@/r`, which converts to AH0 R. Left unfolded, every
        // word ending in -er/-or/-ar fell out of the audit and the whole -ular family was invisible.
        expect(modernise(["AA1", "K", "Y", "AH0", "L", "AH0", "R"])).toEqual(["AA1", "K", "Y", "AH0", "L", "ER0"]);
        expect(modernise(["P", "ER2", "M", "Y", "AH0", "T", "EY1", "SH", "AH0", "N"]))
            .toEqual(["P", "ER2", "M", "Y", "AH0", "T", "EY1", "SH", "AH0", "N"]); // no R: untouched
    });

    test("modernise leaves a PREVOCALIC r alone", () => {
        // `around` is ə-ɹaʊnd — that r is the next syllable's ONSET, and folding it would give ɚ-aʊnd.
        expect(modernise(["AH0", "R", "AW1", "N", "D"])).toEqual(["AH0", "R", "AW1", "N", "D"]);
    });

    // ⚠ AND IT MUST NOT TOUCH A REAL YOD after a labial, which GenAm keeps.
    test("modernise leaves a labial yod alone", () => {
        expect(modernise(["P", "Y", "UW1", "M", "AH0"])).toEqual(["P", "Y", "UW1", "M", "AH0"]); // puma
    });

    // ⚠ THE TABLE IS KEYED ON THE RAW MOBY BODY, AND THAT IS THE WHOLE POINT. `corporation`'s corrupt
    // reading was `bʊŋɡhi` until the bare-`gh` rule landed and made it `bʊŋɡi`; a declaration keyed on
    // the IPA would have stopped matching at that moment, with no test failing and the defect back in
    // the corpus. Moby's notation is 7-bit, so a stray IPA character is the signature of that mistake.
    test("a defective READING is declared by its Moby body, never by the IPA it produces", () => {
        for (const [w, bodies] of MOBY_DEFECTIVE_READING)
            for (const body of bodies) {
                expect([w, /^[\x20-\x7E]+$/u.test(body)]).toEqual([w, true]);
                // and it must be a body Moby could have written — slashes, letters, stress marks
                expect([w, /[/a-zA-Z]/u.test(body)]).toEqual([w, true]);
            }
    });

    // ⚠ THE TWO TABLES MUST NOT OVERLAP. `MOBY_DEFECTIVE` drops the whole headword, so a word in both
    // would make its per-reading declarations dead code — and dead declarations are exactly what the
    // builder's fired-exactly-once check exists to catch. Better to never create the ambiguity.
    test("no headword is declared defective both wholly and per-reading", () => {
        expect([...MOBY_DEFECTIVE_READING.keys()].filter((w) => MOBY_DEFECTIVE.has(w))).toEqual([]);
    });

    test("every per-reading declaration carries a stated reason", () => {
        for (const [w, bodies] of MOBY_DEFECTIVE_READING)
            for (const body of bodies)
                expect([w, (MOBY_DEFECTIVE_READING_WHY.get(`${w}\t${body}`) ?? "").length > 8]).toEqual([w, true]);
    });

    // ⚠ THE AUDIT'S POPULATION IS `dict ∩ gold ∩ moby`, NOT THE FREQUENCY LIST, and this test exists
    // because it was the frequency list for four blocks. `audit()` used to iterate `g2p-common.txt`,
    // so it compared 19,439 words instead of 46,062 and surfaced 258 candidates instead of 784 — it
    // was blind to 526 rows where gold AND Moby agree against our dictionary, and #1369, #1371, #1372
    // and #1373 each searched for exactly that shape without being able to see them.
    // ⚠ THE BUG IS INVISIBLE FROM THE OUTPUT: a smaller population reports smaller counts and looks
    // like a cleaner dictionary. Nothing in the numbers says rows are missing, which is why this is
    // pinned on behaviour rather than left to the report.
    test("the audit compares a triple-sourced word that is NOT in the frequency list", () => {
        const dir = mkdtempSync(join(tmpdir(), "en-audit-"));
        const f = (n: string, body: string): string => {
            const p = join(dir, n); writeFileSync(p, body); return p;
        };
        // `onlist` is in the frequency file; `offlist` is not. Both are in all three sources, and on
        // both our reading disagrees with the two that agree — so both are candidates, or neither is.
        const dict = f("dict.tsv", "onlist\tK AE1 T\nofflist\tK AE1 T\n");
        const freq = f("freq.txt", "onlist\n");
        const gold = f("gold.json", JSON.stringify({ onlist: "kˈɑt", offlist: "kˈɑt" }));
        const moby = f("moby.unc", "onlist k/A/t\rofflist k/A/t\r");
        const r = audit(dict, freq, gold, moby);
        expect(r.compared).toBe(2);
        expect(r.candidates.map((c) => c.word).sort()).toEqual(["offlist", "onlist"]);
        // ⚠ AND THE OFF-LIST ROW RANKS -1, not 0. Zero is a REAL rank (`the`), so sharing it would make
        // an off-list row indistinguishable from the commonest word in English. (-1 prints FIRST in the
        // ascending report, not last — it disambiguates, it does not demote.)
        expect(r.candidates.find((c) => c.word === "offlist")!.rank).toBe(-1);
        expect(r.candidates.find((c) => c.word === "onlist")!.rank).toBe(0);
        // ⚠ AND THE ORDER IS STABLE. `dict` is insertion-ordered off a file whose order is not
        // guaranteed, so the loop sorts; without it two audits cannot be diffed. Asserted on the raw
        // list rather than a sorted copy, which is what an earlier version of this test compared.
        expect(r.candidates.map((c) => c.word)).toEqual(["offlist", "onlist"]);
    });
});
