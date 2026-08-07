/**
 * Evaluate a SERIALIZED POS model (the actual shipped artifact, post prune/
 * quantize) via the runtime `PosTagger`, so accuracy reflects what we ship.
 * Also reports coarse verb/noun/past accuracy — the metric that matters for
 * homograph disambiguation — and tags any sentences passed as extra args.
 *
 *   tsx tools/english/en_pos_eval.ts <model.json> <eval.conllu> ["a probe sentence" …]
 */
import { readFileSync } from "node:fs";
import { PosTagger, type PosModel } from "../../src/languages/english/posTagger.ts";

const [modelPath, evalPath, ...probes] = process.argv.slice(2);
if (!modelPath) {
    process.stderr.write('usage: tsx tools/english/en_pos_eval.ts <model.json> <eval.conllu> ["probe" …]\n');
    process.exit(1);
}
const model: PosModel = JSON.parse(readFileSync(modelPath, "utf8"));
const tagger = new PosTagger(model);

function coarse(tag: string): string {
    if (tag === "VBD" || tag === "VBN") return "PAST";
    if (tag.startsWith("VB") || tag === "MD") return "VERB";
    if (tag.startsWith("NN")) return "NOUN";
    if (tag.startsWith("JJ")) return "ADJ";
    return "OTHER";
}

if (evalPath && evalPath.endsWith(".conllu")) {
    const text = readFileSync(evalPath, "utf8");
    let words: string[] = [];
    let gold: string[] = [];
    let fine = 0;
    let crs = 0;
    let total = 0;
    const flush = () => {
        if (!words.length) return;
        const pred = tagger.tag(words);
        for (let i = 0; i < words.length; i++) {
            const p = pred[i] ?? "";
            const g = gold[i] ?? "";
            if (p === g) fine++;
            if (coarse(p) === coarse(g)) crs++;
            total++;
        }
        words = [];
        gold = [];
    };
    for (const line of text.split("\n")) {
        if (line === "") {
            flush();
            continue;
        }
        if (line.startsWith("#")) continue;
        const c = line.split("\t");
        const id = c[0] ?? "";
        if (id.includes("-") || id.includes(".")) continue;
        if (!c[1] || !c[4] || c[4] === "_") continue;
        words.push(c[1]);
        gold.push(c[4]);
    }
    flush();
    process.stdout.write(`fine-grained (PTB): ${((fine / total) * 100).toFixed(2)}%\n`);
    process.stdout.write(`coarse (verb/noun/past/adj/other): ${((crs / total) * 100).toFixed(2)}%\n`);
}

for (const probe of probes) {
    const words = probe
        .replace(/[.,!?;:]/g, " $&")
        .split(/\s+/)
        .filter(Boolean);
    const tags = tagger.tag(words);
    process.stdout.write("\n" + words.map((w, i) => `${w}/${tags[i]}`).join(" ") + "\n");
}
