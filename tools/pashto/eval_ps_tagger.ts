/**
 * Score the ps harakat tagger against a referee, beside the two paths it would have to beat.
 *
 * ⚠ THE GATE IS THE REFEREE, NOT A HELD-OUT SLICE OF THE SILVER. The tagger is trained on espeak-derived
 * labels, and 910 of wikipron's 1,414 words are IN that silver, so an overall number is substantially
 * memorization. The OOV column is the one that says whether Pashto GENERALIZED.
 *
 *   BARE    phonemizeWordCore — the g2p with no lexicon, the floor
 *   SYNC    phonemizeWord — lexicon + g2p, what ships today
 *   TAGGER  the tagger's vocalization through the same g2p
 *
 *   npx tsx tools/pashto/eval_ps_tagger.ts <tagged.tsv> <referee.tsv>
 */
import { readFileSync } from "node:fs";
import { phonemizeWord, phonemizeWordCore } from "../../src/languages/pashto/pashto.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";

const fold = makeFold(CONFIG["ps"]!);
const [taggedPath, refPath] = process.argv.slice(2);
const tagged = new Map<string, { voc: string; bucket: string }>();
for (const l of readFileSync(taggedPath!, "utf8").split("\n")) {
    const [w, voc, flag] = l.split("\t");
    if (w && voc) tagged.set(w, { voc, bucket: flag?.trim() ?? "" });
}
const ref: [string, string][] = [];
for (const l of readFileSync(refPath!, "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const [w, ipa] = l.split("\t");
    // ⚠ EXCLUDE SINGLE-CHARACTER HEADWORDS. wikipron carries the alphabet's LETTER NAMES as entries, and the
    // prior investigation scored "ex letter-names, 1306 words" for the same reason: they are an orthographic
    // fact, not a word's pronunciation, and a restorer is graded on the wrong thing by them.
    if (w && ipa && [...w.trim()].length > 1) ref.push([w.trim(), ipa.trim()]);
}

const BUCKETS = ["TRAIN", "HELDOUT", "UNREACHABLE"] as const;
const tot: Record<string, number> = { all: 0, TRAIN: 0, HELDOUT: 0, UNREACHABLE: 0 };
const hit: Record<string, Record<string, number>> = {
    bare: { all: 0, TRAIN: 0, HELDOUT: 0, UNREACHABLE: 0 },
    sync: { all: 0, TRAIN: 0, HELDOUT: 0, UNREACHABLE: 0 },
    tag: { all: 0, TRAIN: 0, HELDOUT: 0, UNREACHABLE: 0 },
};
for (const [w, ipa] of ref) {
    const t = tagged.get(w);
    if (!t) continue;
    const target = fold(ipa);
    tot["all"]!++; tot[t.bucket] = (tot[t.bucket] ?? 0) + 1;
    const paths: [string, string][] = [
        ["bare", phonemizeWordCore(w)], ["sync", phonemizeWord(w)], ["tag", phonemizeWordCore(t.voc)],
    ];
    for (const [k, out] of paths) {
        if (fold(out) === target) { hit[k]!["all"]!++; hit[k]![t.bucket] = (hit[k]![t.bucket] ?? 0) + 1; }
    }
}
const pc = (n: number, d: number): string => `${n}/${d} (${(100 * n / (d || 1)).toFixed(1)}%)`;
console.log(`referee ${refPath}`);
console.log(`  ALL          BARE ${pc(hit["bare"]!["all"]!, tot["all"]!)}   SYNC ${pc(hit["sync"]!["all"]!, tot["all"]!)}   TAGGER ${pc(hit["tag"]!["all"]!, tot["all"]!)}`);
for (const b of BUCKETS) {
    const note = b === "HELDOUT" ? "   <- the fair generalization test"
        : b === "UNREACHABLE" ? "   <- no vowel assignment can win these; not a vowel problem" : "";
    console.log(`  ${b.padEnd(12)}BARE ${pc(hit["bare"]![b]!, tot[b]!)}   SYNC ${pc(hit["sync"]![b]!, tot[b]!)}   TAGGER ${pc(hit["tag"]![b]!, tot[b]!)}${note}`);
}
