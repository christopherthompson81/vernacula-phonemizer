/**
 * PER-LANGUAGE OUTPUT-SPAN COVERAGE (#1150 stage 3) — the twin of `tools/provenance-coverage.mts`.
 *
 * `inputSpan` says which characters the reader typed; `ipaSpan` says which characters of the reading they
 * became. This ranks languages by tokens missing the SECOND half, and checks the two agree: a token's
 * `ipaSpan` must actually contain the reading it reported emitting.
 */
import { readFileSync, readdirSync } from "node:fs";
import { phonemizeTrace } from "../src/index.ts";

const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith("-")));
const full = process.argv.includes("--full");
interface Row { lang: string; tok: number; mapped: number; wrong: number }
const rows: Row[] = [];
for (const f of readdirSync("csharp/goldens").filter((x) => x.endsWith(".tsv"))) {
    const lang = f.replace(/\.tsv$/u, "");
    if (only.size > 0 && !only.has(lang)) continue;
    const lines = readFileSync(`csharp/goldens/${f}`, "utf8").split("\n").filter(Boolean);
    const stride = full ? 1 : Math.max(1, Math.ceil(lines.length / 8));
    const r: Row = { lang, tok: 0, mapped: 0, wrong: 0 };
    for (let i = 0; i < lines.length; i += stride) {
        const text = lines[i]!.split("\t")[0];
        if (!text) continue;
        let t;
        try { t = phonemizeTrace(text, lang); } catch { continue; }
        const rewritten = t.rewrites.some((x) => x.stage !== "normalize");
        for (const k of t.tokens) {
            if (k.emitted.length === 0) continue; // punctuation contributes nothing to locate
            r.tok++;
            if (k.ipaSpan === undefined) continue;
            r.mapped++;
            // ⚠ THE CHECK DEPENDS ON WHETHER A POST-ASSEMBLY PASS RAN, and getting that wrong reads as 5,754
            // bad spans that are in fact correct. With no such pass the token's `emitted` IS a substring of
            // the reading, so containment is the strong check. After a POSITIONAL pass it is not — Spanish
            // emits ɡˈato and the sentence reads ɣˈato — so what survives is the width: one character for
            // one means the span still covers exactly as much as the token contributed.
            const slice = t.ipa.slice(k.ipaSpan[0], k.ipaSpan[1]);
            if (k.ipaSpan[1] > t.ipa.length) { r.wrong++; continue; }
            if (rewritten) {
                const want = k.emitted.reduce((a, e) => a + e.length, 0) + k.emitted.length - 1;
                if (slice.length !== want) r.wrong++;
            } else if (!k.emitted.every((e) => slice.includes(e))) r.wrong++;
        }
    }
    if (r.tok > 0) rows.push(r);
}
const tok = rows.reduce((a, r) => a + r.tok, 0);
const mapped = rows.reduce((a, r) => a + r.mapped, 0);
const wrong = rows.reduce((a, r) => a + r.wrong, 0);
console.log(`${rows.length} languages · tokens with ipaSpan ${mapped}/${tok} (${(100 * mapped / tok).toFixed(1)}%)`);
console.log(`⚠ spans that do not contain what the token emitted: ${wrong}\n`);
console.log("lost   %mapped  wrong  lang");
for (const r of rows.filter((x) => x.mapped < x.tok || x.wrong > 0).sort((a, b) => b.tok - b.mapped - (a.tok - a.mapped)))
    console.log(`${String(r.tok - r.mapped).padStart(5)}  ${(100 * r.mapped / r.tok).toFixed(0).padStart(5)}%  ${String(r.wrong).padStart(5)}  ${r.lang}`);
