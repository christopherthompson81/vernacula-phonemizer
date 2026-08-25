/**
 * Generate a parity golden for an ACCENT VARIANT from its base language's golden.
 *
 * ⚠ THIS IS NOT `tools/gen_parity_goldens.mts`. That script — the corpus-sourcing generator the parity
 * runner's header refers to — is not in this repo, and the per-language FLEURS splits it reads are not
 * checked in either. This one does the narrow thing a variant needs and nothing more: it takes the SOURCE
 * TEXT of an existing golden and re-renders it through the variant's engine.
 *
 * ⚠ SO THE TEXT IS THE BASE LANGUAGE'S CORPUS, and the golden it writes pins C#↔TS PARITY for the variant.
 * It is not a claim of coverage over the variant's own corpus (es_419, en_gb, …). Say so wherever the
 * resulting file is described, rather than letting "it has a golden" imply more than it does.
 *
 * ⚠ ASYNC MODE, per the goldens' own convention — see the warning at the top of tools/parity/Program.cs.
 * Rendering with the sync entry point produces different IPA for every neural language and the gate would
 * report hundreds of phantom failures.
 *
 *   npx tsx tools/gen_variant_golden.mts es es-419      # csharp/goldens/es.tsv → csharp/goldens/es-419.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeAsync } from "../src/index.ts";

const [baseCode, variantCode] = process.argv.slice(2);
if (baseCode === undefined || variantCode === undefined) {
    console.error("usage: gen_variant_golden.mts <base-code> <variant-code>");
    process.exit(2);
}
const src = `csharp/goldens/${baseCode}.tsv`;
const dst = `csharp/goldens/${variantCode}.tsv`;
const texts = readFileSync(src, "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => l.split("\t")[0]!);

const out: string[] = [];
for (const t of texts) out.push(`${t}\t${await phonemizeAsync(t, variantCode)}`);
writeFileSync(dst, out.join("\n") + "\n");
console.log(`${dst}: ${out.length} rows from ${src}`);
