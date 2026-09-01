/**
 * Sawndip (古壮字, the Han-derived LOGOGRAPHIC script for Zhuang) → Standard-Zhuang reading front-end — the second-script
 * pattern (Adlam/Tifinagh), but glyph→READING via a DICTIONARY (Sawndip is logographic, not alphabetic). Each Sawndip
 * character is one syllable; we look up its Standard-Zhuang Latin reading and route it through the existing `za` g2p
 * (so Sawndip inherits za's validated phonology + tones). Self-consistency: za(reading) reproduces the glyph's kaikki
 * Standard-Zhuang IPA at 100% (2411/2411, segmental).
 *
 * ⚠ HONEST SCOPE — reference-parity over a covered subset, default readings only:
 *  - Coverage is the ~2412 Wiktionary-documented single-codepoint glyphs; real manuscripts use idiosyncratic/unencoded
 *    (PUA / Ideographic-Description) forms → OOV, which are dropped (unreadable).
 *  - Sawndip is POLYPHONIC (~8% of covered glyphs have >1 reading — mostly tonal variants of one root). We ship a
 *    DEFAULT reading chosen by a SALIENCE PROXY (the most-SENSE reading — NOT measured corpus frequency, which we
 *    don't have; so it can miss the iconic reading, e.g. 那→naj not naz), with no context disambiguation — Sawndip
 *    has no labelled corpus, unlike the cmn homograph case. A text relying on an alternative reading silently gets
 *    the default (the Han-homograph 行 xíng/háng situation).
 */
import { loadTsvMap } from "../../core/loadTsv.ts";

let READINGS: ReadonlyMap<string, string> | undefined;
/**
 * Lazy: the glyph→reading dict is only read on first Sawndip use (the registry imports za eagerly).
 *
 * ⚠ EXPORTED SO THE REACHABILITY TEST READS THE DICTIONARY THE ENGINE READS. It used to re-open the file
 * itself through a hand-written `../data/languages/zhuang/…` path — a guess into the asset tree, which
 * `core/dataPath.ts` exists to stop, and which would have let the test pass against a file the engine does
 * not load. It is also the only caller anywhere that asked `loadTsvMap` to resolve from outside `src/`.
 */
export function sawndipReadings(): ReadonlyMap<string, string> {
    return (READINGS ??= loadTsvMap(import.meta.url, "sawndip-readings.tsv"));
}
const readings = sawndipReadings;

/**
 * Is `cp` a Sawndip-capable code point (the blocks the shipped dictionary draws on)?
 *
 * ⚠ THE RANGES ARE ANSWERABLE FROM THE DICTIONARY, AND FOR 24 KEYS THEY WERE WRONG. This predicate is the
 * ONLY gate on the Sawndip front-end — `zhuang.ts`'s TOKEN class and `normalize.ts`'s HAN class are the same
 * set spelled twice more — so a key outside it is a row nobody can ever reach. Sweeping every key of
 * `sawndip-readings.tsv` through `isSawndip` found 24 of 2,412 (1.0%) that no input could reach:
 *
 *     U+3007 〇 (`lingz`)                    — the ideographic number ZERO, which is not in an ideograph
 *                                              block at all (CJK Symbols and Punctuation, category Nl)
 *     U+2ECAD, U+2ECC3                       — CJK Ext I (U+2EBF0–2EE5F), added in Unicode 15.1
 *     U+323B6 … U+32FD9, ×21                 — CJK Ext J (U+323B0–3347F), added in Unicode 17.0
 *
 * The old bounds `0x2ebef` and `0x323af` were the ENDS OF Ext F AND Ext H when this was written; the extract
 * the dictionary is built from has since moved past both. The upper bounds now run to the end of Ext I and
 * Ext J respectively, and `test/zhuang-sawndip.test.ts` asserts EVERY key is reachable, so the next block
 * that appears in the extract fails as a test rather than as 24 silent glyphs.
 */
function isIdeograph(cp: number): boolean {
    return (
        cp === 0x3007 || // 〇 — a numeral, not an ideograph, but a Sawndip reading (`lingz`) all the same
        (cp >= 0x3400 && cp <= 0x4dbf) || // Ext A
        (cp >= 0x4e00 && cp <= 0x9fff) || // Unified
        (cp >= 0xf900 && cp <= 0xfaff) || // Compatibility
        (cp >= 0x20000 && cp <= 0x2ee5f) || // Ext B–F, I
        (cp >= 0x2f800 && cp <= 0x2fa1f) || // Compatibility Supplement
        (cp >= 0x30000 && cp <= 0x3347f) // Ext G–H, J
    );
}

/** Does `s` contain any Sawndip (CJK ideograph) character? za's normal input is Latin, so any ideograph → Sawndip. */
export function isSawndip(s: string): boolean {
    for (const ch of s) if (isIdeograph(ch.codePointAt(0)!)) return true;
    return false;
}

/** Transliterate a run of Sawndip characters → the array of Standard-Zhuang readings (one per glyph). An OOV glyph
 *  (not in the dictionary) is dropped — it is an unencoded/undocumented form we cannot read. */
export function sawndipToReadings(run: string): string[] {
    const dict = readings();
    const out: string[] = [];
    for (const ch of run) {
        const r = dict.get(ch);
        if (r) out.push(r);
    }
    return out;
}
