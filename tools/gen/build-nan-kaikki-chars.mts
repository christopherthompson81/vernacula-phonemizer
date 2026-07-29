/**
 * Extract single-character Hokkien (Min Nan) Tâi-lô readings from the kaikki.org Wiktionary
 * Chinese extract (kaikki.org-dictionary-Chinese.jsonl, ~1.2 GB, streamed) — the SUPPLEMENT tier
 * for src/languages/minnan/dict-chars.tsv (see build-nan-chhoetaigi.mts, which consumes this
 * output as its lowest-priority char source).
 *
 * License: Wiktionary → CC-BY-SA (same fence as the gan/hakka/jin/xiang dicts).
 * CAVEAT (stated in dict.PROVENANCE.md): the nan referee (wikipron Hokkien) is ALSO
 * Wiktionary-derived, so referee-eval numbers for chars sourced from this tier are not
 * independent. Quality assurance for this tier comes from the taihoa/itaigi cross-validation in
 * the builder, not the referee score.
 *
 * Usage: npx tsx tools/gen/build-nan-kaikki-chars.mts <kaikki-Chinese.jsonl> <out.tsv>
 */
import { createReadStream } from "node:fs";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const [dump, out] = process.argv.slice(2);
if (!dump || !out) {
    console.error("usage: build-nan-kaikki-chars.mts <kaikki-Chinese.jsonl> <out.tsv>");
    process.exit(1);
}

const HAN1 = /^\p{Script=Han}$/u;
// Prefer a general (un-located) Hokkien Tai-lo; fall back to the first located one.
const readings = new Map<string, { general?: string; located?: string }>();

const rl = createInterface({ input: createReadStream(dump), crlfDelay: Infinity });
let n = 0;
rl.on("line", (line) => {
    n++;
    // cheap prefilter before JSON.parse
    if (!line.includes("Hokkien") || !line.includes("Tai-lo")) return;
    let r: any;
    try { r = JSON.parse(line); } catch { return; }
    const w: string = r.word ?? "";
    if (!HAN1.test(w)) return;
    for (const s of r.sounds ?? []) {
        const tags: string[] = s.tags ?? [];
        if (!tags.includes("Hokkien") || !tags.includes("Tai-lo")) continue;
        const v: string = (s.zh_pron ?? "").trim();
        if (!v || /[/\s]/.test(v)) continue; // skip multi-variant strings; single syllable expected
        const slot = readings.get(w) ?? {};
        // "General Taiwanese" (raw_tags) marks the pan-Taiwan reading; else any located Tai-lo.
        const general = (s.raw_tags ?? []).includes("General Taiwanese");
        if (general && slot.general === undefined) slot.general = v;
        else if (!general && slot.located === undefined) slot.located = v;
        readings.set(w, slot);
    }
});
rl.on("close", () => {
    const rows = [...readings.entries()]
        .map(([ch, r]) => [ch, r.general ?? r.located!] as const)
        .filter(([, v]) => v)
        .sort();
    writeFileSync(out, rows.map(([k, v]) => `${k}\t${v}`).join("\n") + "\n");
    console.log(`${dump}: ${n} lines scanned, ${rows.length} single-char Hokkien Tai-lo readings -> ${out}`);
});
