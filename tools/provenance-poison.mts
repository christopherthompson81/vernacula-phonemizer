/**
 * WHERE DOES THE MAPPING DIE? (#1150 stage 2) — the instrument for adopting the seam, and the TypeScript
 * twin of `dotnet run --project csharp/tools/parity -- --poison`.
 *
 *   npx tsx tools/provenance-poison.mts [lang ...]
 *
 * A `rewrite` call handed a string the mapping is not tracking means one of two things, and only the stack
 * can tell them apart: a PIPELINE step that some earlier unconverted step already desynced (fix the earlier
 * step), or a call on a SUBSTRING — a word, a character, a local — which never belonged on the seam at all
 * (revert that site). Static shape cannot distinguish them; this does.
 */
import { readFileSync, readdirSync } from "node:fs";
import { phonemizeTrace } from "../src/index.ts";
import { onPoison } from "../src/core/provenance.ts";

const hits = new Map<string, { n: number; kind: string; sample: string }>();
let frame = "";
onPoison((expected, got) => {
    const stack = (new Error().stack ?? "").split("\n")
        .filter((l) => !l.includes("provenance.ts") && !l.includes("Error"))
        .map((l) => l.trim().replace(/^at /u, ""))
        .filter((l) => l.includes("/src/"));
    frame = stack.slice(0, 3).map((l) => l.replace(/.*\/src\//u, "src/").replace(/\)$/u, "")).join("  <- ");
    // ⚠ THE TWO CLASSES LOOK THE SAME AT THE CALL AND ARE OPPOSITE IN WHAT THEY ASK FOR. A SUBSTRING call
    // (a word, a character, a local) never belonged on the seam and must be reverted; a DESYNC means the
    // subject really is the pipeline string and some earlier step — one that is not a replace at all —
    // changed it unseen, so the site is right and the gap is upstream. Containment separates them.
    // ⚠ CONTAINMENT ALONE MISCLASSIFIES. A local that is not literally a slice of the pipeline string — a
    // lookup key `"$"`, a unit symbol `"km²"`, a word already rewritten — is not "contained", and calling
    // those a desync sent the revert loop after genuine pipeline sites and cost 3 points of coverage. A
    // desync leaves a string of COMPARABLE length; a local is an order of magnitude shorter.
    const kind = (expected.includes(got) && got.length < expected.length) || got.length * 3 < expected.length
        ? "SUBSTRING" : "desync";
    const cur = hits.get(frame);
    if (cur === undefined) hits.set(frame, { n: 1, kind, sample: `tracked=${JSON.stringify(expected.slice(0, 40))} s=${JSON.stringify(got.slice(0, 40))}` });
    else { cur.n++; if (cur.kind !== kind) cur.kind = "mixed"; }
});

const only = process.argv.slice(2);
for (const f of readdirSync("csharp/goldens").filter((x) => x.endsWith(".tsv"))) {
    const lang = f.replace(/\.tsv$/u, "");
    if (only.length > 0 && !only.includes(lang)) continue;
    for (const l of readFileSync(`csharp/goldens/${f}`, "utf8").split("\n").filter(Boolean)) {
        const text = l.split("\t")[0];
        if (!text) continue;
        try { phonemizeTrace(text, lang); } catch { /* the reading is gated elsewhere */ }
    }
}
const sub = [...hits].filter(([, v]) => v.kind !== "desync");
console.log(`distinct poison sites: ${hits.size}  (SUBSTRING ${sub.length}, desync ${hits.size - sub.length})`);
console.log(`\n=== SUBSTRING — revert these to \`.replace\` ===`);
for (const [k, v] of sub.sort((a, b) => b[1].n - a[1].n)) console.log(`${String(v.n).padStart(6)} ${v.kind.padEnd(9)} ${k}`);
console.log(`\n=== desync — the subject IS the pipeline string; the gap is an earlier non-replace step ===`);
for (const [k, v] of [...hits].filter(([, v]) => v.kind === "desync").sort((a, b) => b[1].n - a[1].n))
    console.log(`${String(v.n).padStart(6)}  ${k}\n        ${v.sample}`);
