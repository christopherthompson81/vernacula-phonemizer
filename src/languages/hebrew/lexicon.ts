/**
 * Hebrew (he) pronunciation lexicon — a LOOKUP layer for the unvocalized (neural) path. A known skeleton maps to a
 * stored niqqud (vocalized) reading, which we render through the rule g2p (`phonemizeWord`) — so the lexicon
 * output is always in OUR canonical convention and auto-tracks g2p rule changes (the glottal rule etc.), never
 * importing an external IPA convention. Homographs and OOV words are NOT in the lexicon and fall through to the
 * context-aware tagger. See he-lexicon.tsv + tools/hebrew/build-lexicon.py.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeWord } from "./hebrew.ts";

let cache: Map<string, string> | undefined; // skeleton → niqqud

function load(): Map<string, string> {
    if (cache) return cache;
    cache = new Map();
    try {
        const path = join(dirname(fileURLToPath(import.meta.url)), "he-lexicon.tsv");
        for (const line of readFileSync(path, "utf8").split("\n")) {
            if (!line || line.startsWith("#")) continue;
            const [skel, niqqud] = line.split("\t");
            if (skel && niqqud) cache.set(skel, niqqud);
        }
    } catch { /* no lexicon shipped → empty (every lookup misses, tagger handles all) */ }
    return cache;
}

/** The lexicon reading of an unvocalized word in OUR convention, or undefined if not a known non-homograph word. */
export function lexiconLookup(skeleton: string): string | undefined {
    const niqqud = load().get(skeleton);
    return niqqud === undefined ? undefined : phonemizeWord(niqqud);
}
