/**
 * Dump the TRACE of every golden row, for the cross-port trace gate (#1419).
 *
 * ⚠ `check-goldens` AND `parity` COMPARE IPA STRINGS. `PhonemizeTrace` — `span`, `inputSpan`, `ipaSpan`,
 * the token list — is in NEITHER, so a port divergence in the trace cannot fail any gate. That is not
 * hypothetical: it is how #1408 got out. The first `PhonemizeTrace` of `ja` in a C# process returned
 * every `inputSpan` null while TypeScript was correct cold and warm, and it reached a downstream
 * consumer before anything here noticed — parity stayed green throughout, correctly, because the
 * READINGS never differed.
 *
 * ⚠ NOTHING IS COMMITTED. A full dump is ~15 MiB, so this writes to a working path and
 * `csharp/tools/trace-parity` consumes it in its own process; the expected values are the other port's,
 * not a recorded artifact that could rot.
 *
 * ⚠ ONE PROCESS PER SIDE, COLD. #1408 established that a warm process hides the whole cold-init class
 * and that an assembly-resident check is VACUOUS against it — both a poison sweep over 189 languages
 * and a direct span assertion passed inside `dotnet test` with the defect fully present.
 *
 *   npx tsx tools/dump-traces.mts <out.tsv> [codes…]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { phonemizeTrace } from "../src/index.ts";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: dump-traces.mts <out.tsv> [codes…]");
const only = new Set(process.argv.slice(3));

/** One token as `span:inputSpan:ipaSpan`, each `a-b`, empty when the span is absent. */
const pair = (s: readonly [number, number] | undefined): string => (s === undefined ? "" : `${s[0]}-${s[1]}`);

const lines: string[] = [];
let rows = 0;
for (const f of readdirSync("csharp/goldens").sort()) {
    if (!f.endsWith(".tsv")) continue;
    const code = f.slice(0, -4);
    if (only.size > 0 && !only.has(code)) continue;
    let row = 0;
    for (const line of readFileSync(`csharp/goldens/${f}`, "utf8").split("\n")) {
        const text = line.split("\t")[0];
        if (!text) continue;
        row++;
        let t;
        // ⚠ A THROW IS RECORDED, NOT SKIPPED. "this row threw" is itself a fact the two ports must
        // agree on; swallowing it would let one engine throw and the other not, silently.
        try { t = phonemizeTrace(text, code); }
        catch { lines.push(`${code}\t${row}\tTHREW`); rows++; continue; }
        const toks = t.tokens.map((k) => `${pair(k.span)}:${pair(k.inputSpan)}:${pair(k.ipaSpan)}`).join(" ");
        lines.push(`${code}\t${row}\t${t.traced ? "T" : "F"}\t${t.tokens.length}\t${toks}`);
        rows++;
    }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n") + "\n");
console.log(`trace dump: ${rows} rows -> ${out}`);
