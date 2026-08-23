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
   // ⚠ TRAILING // comments too, or their PROSE is scanned for regex literals: "/ bhf → w/v"
   // and three like it were extracted as v-flag patterns and reported as harness refusals. A
   // real literal always escapes an inner slash outside a class, so `//` here is a comment.
   .replace(/(^|[^\\:])\/\/.*$/gm, "$1")
   .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
   .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
   .replace(/`(?:[^`\\]|\\.)*`/g, "``");
const LITERAL = /(?<![\w)\]])\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/([dgimsuvy]*)/g;

const PROBES: string[] = ["abc def", "ABC DEF", "hello, world.", "  spaced  out  ", "123 456", "1.5", "1,500", "10:08", "2026-08-23", "007", "٢٠٢٤ ٣", "৩৫ ২৪", "१२३", "๑๒๓", "café naïve", "ÅNGSTRÖM", "Grüße", "İstanbul", "ĳsselmeer", "Ελληνικά", "Русский", "עברית", "العربية", "हिन्दी", "ไทย", "中文", "日本語", "한국어", "ǀclick ǁtwo", "kʼeʼ ɓaɗ", "ˈstrʌk.tʃɚ", "tʰˈɛn əklˈɑːk", "<b>tag</b>", "a&amp;b", "km<sup>2</sup>", "{en:five}", "h5n1", "covid19", "", " ", "\t", "a\nb", "-", "—", "…", "'’‘", "\"quoted\"", "\u017f\u212a\u2126\u1e9e\u0131\u0345", "\u00df\u0130i\u0307", "\u{1E950}\u{1E94F}", "\u{20001}\u{2B740}\u{1F600}"];

// A non-u pattern can match HALF a surrogate pair, and JSON cannot carry a lone surrogate (the C#
// reader rejects it outright). Encode those code units as a sentinel the harness decodes back —
// dropping them would hide the one behaviour where both engines really are UTF-16 unit machines.
const enc = (s: string) =>
  [...s].map((ch) => {
    const u = ch.charCodeAt(0);
    return ch.length === 1 && u >= 0xd800 && u <= 0xdfff
      ? `\u0000S${u.toString(16).padStart(4, "0")}`
      : ch;
  }).join("");

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
        matches.push([p, got.map(enc)]);
      } catch { /* a probe this pattern rejects is not evidence */ }
    }
    rows.push(JSON.stringify({ pattern, flags, file: f, matches }));
  }
}
writeFileSync("csharp/regex-corpus.jsonl", rows.join("\n") + "\n", "utf8");
console.log(`${rows.length} distinct patterns from ${files} files (${unparseable} unparseable, dropped)`);
