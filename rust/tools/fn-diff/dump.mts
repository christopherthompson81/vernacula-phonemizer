// Dump TypeScript outputs for one module-level function over a probe set, as JSONL, for the Rust replay
// in src/main.rs. Strings are encoded as arrays of UTF-16 code units so a lone surrogate survives.
//
//   npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/rust/<name>.jsonl
import { MANIFEST } from "../../../src/languages/english/manifest.ts";
import { makeArpabetToIpa } from "../../../src/languages/english/englishArpabet.ts";
import { loadTsvMap } from "../../../src/core/loadTsv.ts";

const units = (s: string): number[] => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i));
const emit = (input: unknown, output: string): void => {
    process.stdout.write(JSON.stringify({ input, output: units(output) }) + "\n");
};
const ENGLISH = new URL("../../../src/languages/english/english.ts", import.meta.url).href;

const dumps: Record<string, () => void> = {
    // Every g2p-dict row through the arpabet converter with the shipped syllabic / nasal-seam tables.
    arpabet() {
        const slots = (v: string): number[] => v.split(",").map(Number).filter((n) => Number.isInteger(n));
        const syllabic = loadTsvMap(ENGLISH, "en-syllabic.tsv", slots);
        const nasalSeam = loadTsvMap(ENGLISH, "en-nasal-seam.tsv", slots);
        const conv = makeArpabetToIpa(MANIFEST.arpabet, syllabic, nasalSeam);
        const dict = loadTsvMap(ENGLISH, "g2p-dict.tsv", (v) => v.split(" "));
        for (const [word, phones] of dict) emit({ word: units(word), phones }, conv(phones, word));
        // Also with no word (the tagger's call shape: makeArpabetToIpa(MANIFEST.arpabet)(phones)).
        const bare = makeArpabetToIpa(MANIFEST.arpabet);
        for (const [, phones] of [...dict].slice(0, 5000)) emit({ word: [], phones, bare: true }, bare(phones));
    },
};

const name = process.argv[2] ?? "";
const run = dumps[name];
if (run === undefined) {
    console.error(`unknown dump "${name}"; known: ${Object.keys(dumps).join(", ")}`);
    process.exit(2);
}
run();
