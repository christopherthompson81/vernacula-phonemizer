/**
 * FLEET-WIDE NORMALIZATION AUDIT (#562) — probe every registered language for the defect classes that the
 * per-language normalization work kept turning up, so they can be found mechanically instead of one
 * language at a time.
 *
 * Usage:  npx tsx tools/normalization-audit.ts [--verbose]
 *
 * WHY THIS EXISTS. Working through eleven languages by hand, the same three defects recurred:
 *   · SLOT-GAPS from `clausePunctuation` values that were a PADDED copy of the mark (`"।": " । "`), so the
 *     pause reached the output as a double space. Found by hand in Bengali, Urdu and Indonesian; the first
 *     run of this audit found it in 73 languages.
 *   · RAW MARKS — the same block mapping a native mark to ITSELF rather than to canonical ASCII, so a ।, ॥
 *     or … landed in the phoneme string.
 *   · A MISSING SYMBOL TIER, so `%` and currency signs are silently dropped.
 * The first two are pure formatting and were fixed fleet-wide. The third needs per-language WORDS and is
 * reported, not fixed — see the note at the bottom of this file.
 *
 * The probes are deliberately ones every engine can take: ASCII digits and ASCII punctuation, which every
 * language has a number path and a clause path for. A language-specific probe would not generalise.
 *
 * FLAGS
 *   GAP       the punctuation probe produced a double/leading/trailing space
 *   RAWMARK   a native punctuation mark survived into the IPA
 *   DIGIT     an ASCII digit survived into the IPA (the number path declined and leaked its input)
 *   PCT-DROP  "50%" reads exactly like "50" — the percent sign vanished
 *   CUR-DROP  "$5" reads exactly like "5" — the currency sign vanished
 *   CUR-RAW   the currency sign survived into the IPA
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { phonemize } from "../src/index.ts";

const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), "../src/registry.ts");
const codes = [...new Set([...readFileSync(REGISTRY, "utf8").matchAll(/case "([a-zA-Z0-9-]+)":/g)].map((m) => m[1]!))].sort();

const NATIVE_MARK = /[।॥…。，、۔؟،؛។៕။၊።፣꠨꠩៚]/u;
const strip = (s: string): string => s.replace(/[ˈˌ]/gu, "").trim();

interface Row { lang: string; flags: string[]; sample: string }
const rows: Row[] = [];

for (const lang of codes) {
    let punct: string;
    try {
        punct = phonemize("1, 2. 3? 4!", lang);
    } catch (e) {
        rows.push({ lang, flags: ["THROW"], sample: (e as Error).message.slice(0, 50) });
        continue;
    }
    const flags: string[] = [];
    if (/\s{2,}|^\s|\s$/u.test(punct)) flags.push("GAP");
    if (NATIVE_MARK.test(punct)) flags.push("RAWMARK");
    if (/\d/u.test(punct)) flags.push("DIGIT");
    // A dropped sign reads EXACTLY like the bare number; a surviving one shows up as itself.
    try {
        const pct = phonemize("50%", lang), bare = phonemize("50", lang);
        if (/%/u.test(pct)) flags.push("PCT-RAW");
        else if (strip(pct) === strip(bare)) flags.push("PCT-DROP");
    } catch { /* a language without a number path cannot be probed this way */ }
    try {
        const cur = phonemize("$5", lang), bare = phonemize("5", lang);
        if (/\$/u.test(cur)) flags.push("CUR-RAW");
        else if (strip(cur) === strip(bare)) flags.push("CUR-DROP");
    } catch { /* as above */ }
    if (flags.length) rows.push({ lang, flags, sample: punct.slice(0, 46) });
}

const tally = new Map<string, string[]>();
for (const r of rows) for (const f of r.flags) tally.set(f, [...(tally.get(f) ?? []), r.lang]);

console.log(`${rows.length} of ${codes.length} languages flagged\n`);
for (const [flag, langs] of [...tally].sort((a, b) => b[1].length - a[1].length))
    console.log(`${flag.padEnd(9)}${String(langs.length).padStart(4)}   ${langs.join(" ")}`);

if (process.argv.includes("--verbose")) {
    console.log("\nper language:");
    for (const r of rows) console.log(`  ${r.lang.padEnd(8)}${r.flags.join(",").padEnd(26)}${JSON.stringify(r.sample)}`);
}

/*
 * ON THE REMAINING PCT-DROP / CUR-DROP COUNT, deliberately not fixed here.
 *
 * Closing those means giving each language its word for "percent" and its currency names — real per-
 * language data, not a formatting change. Bulk-inventing it across ~138 languages is exactly the kind of
 * mass unverified authoring the provenance posture exists to prevent, and a wrong percent word is worse
 * than a dropped sign because it is confidently wrong rather than merely missing. So this audit REPORTS
 * the list; adding the tier is per-language work, done with a source, the way the eleven treated languages
 * did it.
 */
