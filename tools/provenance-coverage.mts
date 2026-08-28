/**
 * PER-LANGUAGE PROVENANCE COVERAGE (#1150 stage 2) — the narrowing instrument, and the TypeScript twin of
 * `dotnet run --project csharp/tools/parity -- --provenance`.
 *
 *   npx tsx tools/provenance-coverage.mts [--full] [lang ...]
 *
 * A fleet-wide number says how much is missing, never where, and acting on it means sweeping every
 * normalizer and measuring the total again. This ranks languages by tokens LOST, so the next fix is chosen
 * rather than searched for, and its effect is visible in one language's row instead of in the third decimal
 * of a fleet average.
 */
import { readFileSync, readdirSync } from "node:fs";
import { phonemizeTrace } from "../src/index.ts";

const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith("-")));
const full = process.argv.includes("--full");
interface Row { lang: string; rows: number; fullRows: number; tok: number; mapped: number }
const rows: Row[] = [];
for (const f of readdirSync("csharp/goldens").filter((x) => x.endsWith(".tsv"))) {
    const lang = f.replace(/\.tsv$/u, "");
    if (only.size > 0 && !only.has(lang)) continue;
    const lines = readFileSync(`csharp/goldens/${f}`, "utf8").split("\n").filter(Boolean);
    const stride = full ? 1 : Math.max(1, Math.ceil(lines.length / 8));
    const r: Row = { lang, rows: 0, fullRows: 0, tok: 0, mapped: 0 };
    for (let i = 0; i < lines.length; i += stride) {
        const text = lines[i]!.split("\t")[0];
        if (!text) continue;
        let t;
        try { t = phonemizeTrace(text, lang); } catch { continue; }
        r.rows++;
        const m = t.tokens.filter((k) => k.inputSpan !== undefined).length;
        r.tok += t.tokens.length; r.mapped += m;
        if (t.tokens.length > 0 && m === t.tokens.length) r.fullRows++;
    }
    if (r.tok > 0) rows.push(r);
}
const tok = rows.reduce((a, r) => a + r.tok, 0);
const mapped = rows.reduce((a, r) => a + r.mapped, 0);
console.log(`${rows.length} languages · tokens ${mapped}/${tok} (${(100 * mapped / tok).toFixed(1)}%)\n`);
console.log("lost   %mapped  rows   lang");
for (const r of rows.filter((x) => x.mapped < x.tok).sort((a, b) => b.tok - b.mapped - (a.tok - a.mapped)))
    console.log(`${String(r.tok - r.mapped).padStart(5)}  ${(100 * r.mapped / r.tok).toFixed(0).padStart(5)}%  ${String(r.fullRows).padStart(3)}/${String(r.rows).padEnd(3)}  ${r.lang}`);
