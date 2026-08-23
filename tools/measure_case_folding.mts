/**
 * Measure JS's simple-case-fold equivalence classes over the BMP, for the C# port's fold table.
 *
 * ⚠ WHY MEASURED AND NOT WRITTEN DOWN. Under /iu JS folds with scf(), and .NET's IgnoreCase uses a
 * different (smaller) equivalence: /[a-z]/iu matches U+017F LATIN SMALL LETTER LONG S in Node and
 * nothing in .NET. Core/JsRegex.cs widens classes to close that gap, and a hand-written list of "the
 * cases we noticed" would be wrong in exactly the places nobody thought to look. This emits the whole
 * relation; JsRegexFoldTests re-derives the .NET side at test time and checks the port against it, so
 * a runtime upgrade that changes .NET's casing surfaces as a failing test rather than a wrong phoneme.
 *
 * The grouping key is toUpperCase().toLowerCase(), which is scf for every case in Unicode's BMP fold
 * table — pairs whose members do not share that key would be missed, so this is a lower bound.
 *
 *   npx tsx tools/measure_case_folding.mts
 */
import { writeFileSync } from "node:fs";

const key = (c: string) => c.toUpperCase().toLowerCase();
const byKey = new Map<string, string[]>();
for (let cp = 0; cp <= 0xffff; cp++) {
  if (cp >= 0xd800 && cp <= 0xdfff) continue;
  const c = String.fromCodePoint(cp);
  const k = key(c);
  if (k.length !== 1) continue; // multi-char uppercase (ß→SS) cannot be a class member anyway
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k)!.push(c);
}

const pairs: [number, number][] = [];
for (const members of byKey.values()) {
  if (members.length < 2) continue;
  for (const a of members) {
    let re: RegExp;
    try { re = new RegExp(`[${a.replace(/[\\\]^-]/g, (m) => "\\" + m)}]`, "iu"); } catch { continue; }
    for (const b of members) if (a !== b && re.test(b)) pairs.push([a.codePointAt(0)!, b.codePointAt(0)!]);
  }
}
writeFileSync("csharp/fold-pairs.json", JSON.stringify(pairs) + "\n", "utf8");
console.log(`${pairs.length} ordered pairs that JS /iu treats as equal`);
