/**
 * Extract every regex literal in src/ for the JS-vs-.NET differential harness.
 *
 * ⚠ THE TRANSLATOR IS THE PORT'S LARGEST UNTESTED ASSUMPTION. ~7,000 patterns funnel through
 * Core/JsRegex.cs, and a dialect mismatch there is SILENT: the pattern compiles, matches slightly
 * different text, and the damage surfaces later as a wrong phoneme with no trace back to the regex.
 * One harness over all the literals covers the whole surface at once, which is why it is worth more
 * than any per-language test.
 *
 * Emits csharp/regex-corpus.jsonl — {pattern, flags, file, matches} where `matches` is what NODE
 * produces on a shared probe set. The C# side replays each pattern through JsRegex and diffs.
 *
 * ⚠ THE PROBES COVER THE DIALECT GAP, not plausible text: ASCII vs non-ASCII digits is the \d
 * hazard (1,914 uses), non-Latin scripts are the \p{Script=} hazard, and the empty/space/newline
 * rows are \b's. A probe set of ordinary words would pass while the gap stayed open.
 *
 *   npx tsx tools/extract_regexes.mts
 */
import { globSync, readFileSync, writeFileSync } from "node:fs";

// ⚠ STRINGS ARE STRIPPED BEFORE SCANNING, and the first run is why: `import … from "./languages/x"`
//    yielded a "pattern" of `languages`. A regex literal never lives inside a string literal, so
//    removing strings kills that whole false-positive class without touching a real pattern.
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "")
   .replace(/^\s*\/\/.*$/gm, "")
   .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
   .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
   .replace(/`(?:[^`\\]|\\.)*`/g, "``");
const LITERAL = /(?<![\w)\]])\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/([dgimsuvy]*)/g;

const PROBES: string[] = ["abc def", "ABC DEF", "hello, world.", "  spaced  out  ", "123 456", "1.5", "1,500", "10:08", "2026-08-23", "007", "٢٠٢٤ ٣", "৩৫ ২৪", "१२३", "๑๒๓", "café naïve", "ÅNGSTRÖM", "Grüße", "İstanbul", "ĳsselmeer", "Ελληνικά", "Русский", "עברית", "العربية", "हिन्दी", "ไทย", "中文", "日本語", "한국어", "ǀclick ǁtwo", "kʼeʼ ɓaɗ", "ˈstrʌk.tʃɚ", "tʰˈɛn əklˈɑːk", "<b>tag</b>", "a&amp;b", "km<sup>2</sup>", "{en:five}", "h5n1", "covid19", "", " ", "\t", "a\nb", "-", "—", "…", "'’‘", "\"quoted\""];

const rows: string[] = [];
const seen = new Set<string>();
let files = 0, unparseable = 0;
for (const f of globSync("src/**/*.ts")) {
  files++;
  for (const m of strip(readFileSync(f, "utf8")).matchAll(LITERAL)) {
    const [, pattern, flags] = m;
    const key = `${pattern}\u0000${flags}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = flags.replace(/[dgy]/g, "");
    try { new RegExp(pattern, base); } catch { unparseable++; continue; }  // a division, not a regex
    const matches: [string, string[]][] = [];
    for (const p of PROBES) {
      try {
        const got = flags.includes("g")
          ? [...p.matchAll(new RegExp(pattern, base + "g"))].map((x) => x[0])
          : [p.match(new RegExp(pattern, base))?.[0] ?? "\u0000null"];
        matches.push([p, got]);
      } catch { /* a probe this pattern rejects is not evidence */ }
    }
    rows.push(JSON.stringify({ pattern, flags, file: f, matches }));
  }
}
writeFileSync("csharp/regex-corpus.jsonl", rows.join("\n") + "\n", "utf8");
console.log(`${rows.length} distinct patterns from ${files} files (${unparseable} unparseable, dropped)`);
