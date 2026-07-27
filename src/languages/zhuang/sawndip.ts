/**
 * Sawndip (古壮字, the Han-derived LOGOGRAPHIC script for Zhuang) → Standard-Zhuang reading front-end — the second-script
 * pattern (Adlam/Tifinagh), but glyph→READING via a DICTIONARY (Sawndip is logographic, not alphabetic). Each Sawndip
 * character is one syllable; we look up its Standard-Zhuang Latin reading and route it through the existing `za` g2p
 * (so Sawndip inherits za's validated phonology + tones). Self-consistency: za(reading) reproduces the glyph's kaikki
 * Standard-Zhuang IPA at 100% (2411/2411, segmental).
 *
 * HONEST SCOPE (🔷 reference-parity, covered-subset, DEFAULT-reading):
 *  - Coverage is the ~2412 Wiktionary-documented single-codepoint glyphs; real manuscripts use idiosyncratic/unencoded
 *    (PUA / Ideographic-Description) forms → OOV, which are dropped (unreadable).
 *  - Sawndip is POLYPHONIC (~8% of covered glyphs have >1 reading — mostly tonal variants of one root). We ship a
 *    MOST-COMMON DEFAULT (no context disambiguation — Sawndip has no labelled corpus, unlike the cmn homograph case);
 *    a text relying on an alternative reading silently gets the default (the Han-homograph 行 xíng/háng situation).
 * See docs/investigations/za_sawndip_investigation.md.
 */
import { loadTsvMap } from "../../core/loadTsv.ts";

let READINGS: ReadonlyMap<string, string> | undefined;
/** Lazy: the glyph→reading dict is only read on first Sawndip use (the registry imports za eagerly). */
function readings(): ReadonlyMap<string, string> {
    return (READINGS ??= loadTsvMap(import.meta.url, "sawndip-readings.tsv"));
}

/** Is `cp` a CJK ideograph code point (the blocks Sawndip draws on: Unified + Ext A–G + Compatibility)? */
function isIdeograph(cp: number): boolean {
    return (
        (cp >= 0x3400 && cp <= 0x4dbf) || // Ext A
        (cp >= 0x4e00 && cp <= 0x9fff) || // Unified
        (cp >= 0xf900 && cp <= 0xfaff) || // Compatibility
        (cp >= 0x20000 && cp <= 0x2ebef) || // Ext B–F
        (cp >= 0x2f800 && cp <= 0x2fa1f) || // Compatibility Supplement
        (cp >= 0x30000 && cp <= 0x323af) // Ext G–H
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
