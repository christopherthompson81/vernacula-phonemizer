/**
 * SEAM-SITE PARITY between the two engines — the count is the instrument.
 *
 * ⚠ THE PORT IS LINE-FOR-LINE, SO THE COUNTS SHOULD BE TOO. Every `rewrite(s, RE, rep)` in a TypeScript
 * normalizer has a `Rewrite(s, RE, rep)` in its C# counterpart, so a per-language disagreement names a site
 * one engine puts on the provenance seam and the other does not — which is exactly a language where one
 * engine's trace can answer "which input characters produced this" and the other's cannot.
 *
 * ⚠ THE GAP IS A SCREEN, NOT A VERDICT, and the RAW column is the one that means blindness. When the
 * TypeScript still carried 384 unconverted `.replace` calls the two columns tracked each other almost
 * exactly and the gap named every outstanding site. Now that both are near zero, a residual difference is
 * usually STRUCTURAL — kazakh reads 36 vs 29 while carrying one raw `.replace` against the C#'s two,
 * because one engine unrolls a list the other loops over. Read the gap to choose a language; read RAW to
 * decide whether anything is actually unreported.
 *
 *   npx tsx tools/seam-parity.mts          every ported language
 *   npx tsx tools/seam-parity.mts --all    including the ones that agree
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";

const CS = "csharp/Vernacula.Phonemizer/Languages";
const csDirs = new Map<string, string>();
for (const d of readdirSync(CS)) if (existsSync(`${CS}/${d}/Normalize.cs`)) csDirs.set(d.toLowerCase(), d);

const showAll = process.argv.includes("--all");
const rows: { dir: string; ts: number; cs: number; tsRaw: number; csRaw: number }[] = [];
let unported = 0;
for (const dir of readdirSync("src/languages")) {
    const tsPath = `src/languages/${dir}/normalize.ts`;
    if (!existsSync(tsPath)) continue;
    const csDir = csDirs.get(dir.replaceAll("-", "").toLowerCase());
    if (csDir === undefined) { unported++; continue; }
    const tsSrc = readFileSync(tsPath, "utf8");
    const csSrc = readFileSync(`${CS}/${csDir}/Normalize.cs`, "utf8");
    rows.push({
        dir,
        ts: (tsSrc.match(/(?<![\w$.])rewrite\(/gu) ?? []).length,
        cs: (csSrc.match(/(?<![\w.])Rewrite\(/gu) ?? []).length,
        tsRaw: (tsSrc.match(/\.replace(?:All)?\(/gu) ?? []).length,
        csRaw: (csSrc.match(/\.Replace\(/gu) ?? []).length,
    });
}
const off = rows.filter((r) => r.ts !== r.cs);
console.log(`${rows.length} ported languages compared · ${off.length} disagree · ${unported} not yet ported to C#`);
console.log(`raw replaces still off the seam: TS ${rows.reduce((a, r) => a + r.tsRaw, 0)}, C# ${rows.reduce((a, r) => a + r.csRaw, 0)}`);
console.log("\ndir                  TS    C#   gap    rawTS rawC#");
for (const r of (showAll ? rows : off).sort((a, b) => a.cs - a.ts - (b.cs - b.ts)))
    console.log(`  ${r.dir.padEnd(19)}${String(r.ts).padEnd(6)}${String(r.cs).padEnd(5)}${((r.cs - r.ts > 0 ? "+" : "") + String(r.cs - r.ts)).padEnd(7)}${String(r.tsRaw).padEnd(6)}${r.csRaw}`);
