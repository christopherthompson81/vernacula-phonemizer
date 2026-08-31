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
 * ⚠ AND THE SHARED SET IS HAND-AUTHORED, WHICH IS HOW IT KEEPS MISSING THINGS. It carried an
 * ISOLATED \u017F from the first run and still reported CLEAN on \b throughout, because /iu widens
 * the WORD-CHARACTER set and that divergence lives at the SEAM between a long s and an ASCII letter
 * — a position no probe in the set occupied (#1127). A curated set tests what someone thought of.
 *
 * So the seam probes are DERIVED, not authored: `derivedProbes` reads csharp/fold-pairs.json (the
 * MEASURED case-equivalence table, the same file JsRegex widens classes from) and, for each pattern,
 * emits the fold characters THAT PATTERN CAN REACH in every adjacency — alone, before/after/between
 * their own partner, against an unrelated ASCII letter, and in the dotted-abbreviation shape both
 * #1122 and #1127 lived in. A new entry in the fold table becomes probe coverage with no edit here.
 *
 *   npx tsx tools/extract_regexes.mts
 *
 * ⚠ AND THE CHECKED-IN CORPUS MUST NOT DRIFT BEHIND src/. It did, for long enough that a re-extraction
 * moved 582 lines in languages nobody had touched (#1083) — so `regex-diff` was replaying patterns that
 * no longer existed while the ones that replaced them went untested. That quietly narrows the ONLY gate
 * covering the translator, and the narrowing is invisible: the stale patterns still pass.
 * `test/regex-corpus-fresh.test.ts` fails if this file's output differs from what is committed.
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

const PROBES: string[] = ["abc def", "ABC DEF", "hello, world.", "  spaced  out  ", "123 456", "1.5", "1,500", "10:08", "2026-08-23", "007", "٢٠٢٤ ٣", "৩৫ ২৪", "१२३", "๑๒๓", "café naïve", "ÅNGSTRÖM", "Grüße", "İstanbul", "ĳsselmeer", "Ελληνικά", "Русский", "עברית", "العربية", "हिन्दी", "ไทย", "中文", "日本語", "한국어", "ǀclick ǁtwo", "kʼeʼ ɓaɗ", "ˈstrʌk.tʃɚ", "tʰˈɛn əklˈɑːk", "<b>tag</b>", "a&amp;b", "km<sup>2</sup>", "{en:five}", "h5n1", "covid19", "", " ", "\t", "a\nb", "-", "—", "…", "'’‘", "\"quoted\"", "\u017f\u212a\u2126\u1e9e\u0131\u0345", "\u00df\u0130i\u0307", "\u{1E950}\u{1E94F}", "\u{20001}\u{2B740}\u{1F600}", "\uD800", "\uDC00", "a\uD800b", "a\uDC00b", "ge\uD800\u00e9", "\uD800\uD800", "x\uDBFF"];

/**
 * ⚠ THE FOLD TABLE IS THE PROBE SOURCE. Every ordered pair in csharp/fold-pairs.json is one JS
 * considers case-equivalent under /iu; the pairs with a non-ASCII member are the ones .NET's
 * IgnoreCase can disagree about, and are exactly what JsRegex widens classes for. Deriving from the
 * same table the fix reads means the two cannot drift apart.
 */
const FOLD_PAIRS: [number, number][] = JSON.parse(readFileSync("csharp/fold-pairs.json", "utf8"));
const RISKY: [string, string][] = FOLD_PAIRS
  .filter(([a, b]) => a > 0x7f || b > 0x7f)
  .map(([a, b]) => [String.fromCodePoint(a), String.fromCodePoint(b)] as [string, string]);

/** At most this many fold characters per pattern, so a `\p{L}` that reaches all of them cannot
 *  multiply the corpus by two thousand. Taken in table order, so the choice is deterministic. */
const FOLD_PER_PATTERN = 3;

/**
 * Every adjacency a fold character can sit in, because WHICH ONE MATTERS DEPENDS ON THE CONSTRUCT:
 * a widened CLASS shows up with the character alone, a \b shows up only where it touches a word
 * character, and a table-keyed callback shows up in the dotted-abbreviation shape. `partner` is the
 * character JS folds it onto — the seam most likely to be mis-cased — and `t`/`x` stand in for an
 * unrelated ASCII letter so the seam is not always with the pattern's own alphabet.
 */
function seams(ch: string, partner: string): string[] {
  const other = partner === "t" ? "x" : "t";
  return [ch, partner + ch, ch + partner, partner + ch + partner, ch + other, other + ch,
          ch + ". Foo", ch + " " + ch];
}

/** Probes DERIVED from what this particular pattern can reach. Empty for most patterns, which is
 *  why the corpus stays small: a pattern that cannot match a fold character gets no fold probes. */
function derivedProbes(re: RegExp, source: string): string[] {
  const out: string[] = [];
  // A boundary or \w pattern is fold-sensitive even when it matches neither member on its own —
  // /iu admits U+017F and U+212A into the WORD-CHARACTER set, which moves \b without either
  // character ever appearing in the pattern (#1127). Those two are therefore unconditional here.
  const forced = /\\[bBwW]/u.test(source) ? [["s", "\u017F"], ["k", "\u212A"]] as [string, string][] : [];
  const reached: [string, string][] = [];
  for (const [a, b] of RISKY) {
    if (reached.length >= FOLD_PER_PATTERN) break;
    let hit = false;
    try { hit = re.test(b) || re.test(a); } catch { hit = false; }
    if (hit && !reached.some(([, x]) => x === b)) reached.push([a, b]);
  }
  for (const [a, b] of [...forced, ...reached]) out.push(...seams(b, a));
  return [...new Set(out)];
}

// A non-u pattern can match HALF a surrogate pair, and JSON cannot carry a lone surrogate (the C#
// reader rejects it outright). Encode those code units as a sentinel the harness decodes back —
// dropping them would hide the one behaviour where both engines really are UTF-16 unit machines.
// ⚠ APPLIED TO THE PROBE SUBJECT AS WELL AS THE RESULT (#1227), AND FOR SEVERAL MONTHS IT WAS NOT.
// The encoder existed and was wired only to `got`, so a subject carrying an unpaired half could not be
// written at all — `JsonDocument.GetString` throws "Cannot read incomplete UTF-16 JSON text" on it. That
// made the ONE input class where JsRegex knowingly departs from JS structurally unprobeable: a `u`-mode
// NEGATED CLASS matches a lone surrogate in JS and is translated here so that it does not. The tool whose
// job is to prove the two agree could not ask the question, and reported 0 DIFFER while it stood open.
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
    // ⚠ NON-NULL, and it is safe by construction: LITERAL's two groups are not optional, so a match has
    // both. Written out because this module is now IMPORTED by `test/regex-corpus-fresh.test.ts` and so
    // reaches `tsc` for the first time — the looseness predates that and was simply never typechecked.
    const pattern = m[1]!;
    const flags = m[2]!;
    const key = `${pattern}\u0000${flags}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = flags.replace(/[dgy]/g, "");
    try { new RegExp(pattern, base); } catch { unparseable++; continue; }  // a division, not a regex
    const matches: [string, string[]][] = [];
    // ⚠ `test` on a /g regex is STATEFUL (lastIndex), so the relevance probe gets its own
    // non-global copy; sharing the loop's regex would make the derivation order-dependent.
    for (const p of [...PROBES, ...derivedProbes(new RegExp(pattern, base.replace("g", "")), pattern)]) {
      try {
        const got = flags.includes("g")
          ? [...p.matchAll(new RegExp(pattern, base + "g"))].map((x) => x[0])
          : [p.match(new RegExp(pattern, base))?.[0] ?? "\u0000null"];
        matches.push([enc(p), got.map(enc)]);
      } catch { /* a probe this pattern rejects is not evidence */ }
    }
    rows.push(JSON.stringify({ pattern, flags, file: f, matches }));
  }
}
export const CORPUS = rows.join("\n") + "\n";
export const CORPUS_PATH = "csharp/regex-corpus.jsonl";

/**
 * ⚠ THE WRITE IS GUARDED SO A TEST CAN IMPORT THIS MODULE FOR ITS `CORPUS` WITHOUT REWRITING THE FILE
 * IT IS ABOUT TO COMPARE AGAINST — which would make the comparison vacuous by construction.
 * `test/regex-corpus-fresh.test.ts` is that test; see #1083 for why it exists.
 */
if (process.argv[1]?.endsWith("extract_regexes.mts")) {
    writeFileSync(CORPUS_PATH, CORPUS, "utf8");
    console.log(`${rows.length} distinct patterns from ${files} files (${unparseable} unparseable, dropped)`);
}
