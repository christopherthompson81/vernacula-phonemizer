/**
 * Build the Sawndip glyph → Standard-Zhuang reading dictionary from the kaikki Zhuang extract, and MEASURE
 * self-consistency: does routing each glyph's chosen reading through the `za` Latin engine reproduce the glyph's
 * kaikki Standard-Zhuang IPA (segmentally, tones folded)?
 *
 * Source (not committed — too big): /mnt/data/kaikki-Zhuang.jsonl (kaikki.org-dictionary-Zhuang.jsonl).
 * Output (committed): src/languages/zhuang/sawndip-readings.tsv  (glyph \t reading).
 *
 * Polyphonic glyphs (one glyph → several Standard-Zhuang words) get a MOST-COMMON DEFAULT via a salience proxy —
 * the candidate word with the most senses, tie-broken by shorter reading then alphabetical (deterministic). This is
 * a reference-parity default, NOT context disambiguation (Sawndip has no labelled corpus). See
 * docs/investigations/za_sawndip_investigation.md.
 *
 * Usage: npx tsx tools/gen/build-za-sawndip.ts [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWord as za } from "../../src/languages/zhuang/zhuang.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = "/mnt/data/kaikki-Zhuang.jsonl";
const OUT = join(HERE, "../../src/languages/zhuang/sawndip-readings.tsv");

interface Cand { reading: string; ipa: string; senses: number }
const byGlyph = new Map<string, Cand[]>();

for (const line of readFileSync(SRC, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.lang_code !== "za" || !r.word) continue;
    const ipa = (r.sounds ?? []).find((s: { tags?: string[]; ipa?: string }) => (s.tags ?? []).includes("Standard-Zhuang") && s.ipa)?.ipa ?? "";
    const senses = (r.senses ?? []).length;
    for (const f of r.forms ?? []) {
        // Keep only SINGLE-CODEPOINT encoded glyphs → one syllable each (the front-end looks up per character, so a
        // multi-char Sawndip word is read syllable-by-syllable). This drops Ideographic Description Sequences (⿰⿱…,
        // Wiktionary's notation for UNENCODED glyphs) and multi-char whole-word forms (which za would mis-syllabify).
        if ((f.tags ?? []).includes("Sawndip") && f.form && [...f.form].length === 1 && !/[⿰-⿿]/u.test(f.form) && !/\s/u.test(r.word)) {
            const list = byGlyph.get(f.form) ?? [];
            // Collapse duplicate readings (same word can appear twice); keep the max senses.
            const existing = list.find((c) => c.reading === r.word);
            if (existing) existing.senses = Math.max(existing.senses, senses);
            else list.push({ reading: r.word, ipa, senses });
            byGlyph.set(f.form, list);
        }
    }
}

/** Deterministic most-common default: most senses, then shortest reading, then alphabetical. */
function pick(cands: Cand[]): Cand {
    return [...cands].sort((a, b) => b.senses - a.senses || a.reading.length - b.reading.length || a.reading.localeCompare(b.reading))[0]!;
}

// Fold to the segmental skeleton (drop Chao tones, LENGTH ː, slashes, brackets, spaces, ties) for the self-consistency
// check — za's length notation vs kaikki's is a za-vs-kaikki calibration matter (folded in za's own eval), not Sawndip.
const seg = (s: string): string => s.replace(/[\/\[\]ˈˌ.\sː˥˦˧˨˩̚˦̯]/gu, "").replace(/͡/gu, "").normalize("NFC");

const rows: [string, string][] = [];
let consistent = 0, checked = 0;
const misses: string[] = [];
for (const [glyph, cands] of [...byGlyph.entries()].sort()) {
    const chosen = pick(cands);
    rows.push([glyph, chosen.reading]);
    if (chosen.ipa) {
        checked++;
        const ours = seg(za(chosen.reading));
        const ref = seg(chosen.ipa);
        if (ours === ref) consistent++;
        else if (misses.length < 20) misses.push(`${glyph} ${chosen.reading}: ours ${seg(za(chosen.reading))}  ≠  ref ${seg(chosen.ipa)}  (za=${za(chosen.reading)}, kaikki=${chosen.ipa})`);
    }
}

const poly = [...byGlyph.values()].filter((c) => c.length > 1).length;
console.log(`glyphs: ${rows.length}  (polyphonic: ${poly})`);
console.log(`self-consistency (za(reading) == kaikki Standard-Zhuang IPA, segmental): ${consistent}/${checked} = ${(100 * consistent / checked).toFixed(1)}%`);
console.log("sample misses:");
for (const m of misses.slice(0, 15)) console.log("  " + m);

if (process.argv.includes("--write")) {
    const header = "# Sawndip glyph → Standard-Zhuang reading (Latin). Built by tools/gen/build-za-sawndip.ts from the\n# kaikki Zhuang extract. Polyphonic glyphs use a most-common default (most senses); routed through the za engine.\n";
    writeFileSync(OUT, header + rows.map(([g, r]) => `${g}\t${r}`).join("\n") + "\n");
    console.log(`\nwrote ${rows.length} rows → ${OUT}`);
}
