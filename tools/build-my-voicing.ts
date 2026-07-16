/**
 * Build the Burmese intervocalic-voicing lexicon (src/languages/burmese/voicing-lexicon.tsv) from the kaikki gold.
 *
 * Burmese voicing sandhi is LEXICAL (compound-boundary governed, only ~68% rule-predictable), so it is a per-word
 * lexicon, not a rule. For each kaikki word we SYLLABIFY it with our own g2p, then greedily align our syllables to
 * the folded gold IPA — each onset may optionally VOICE (k→ɡ, s→z, θ→ð, …). If the whole gold is reproduced and at
 * least one syllable had to voice, we emit `word ⇥ flags` (a '0'/'1' per syllable, 1 = voice that onset). Words that
 * need a NON-voicing change to match are skipped (we never guess voicing). Output is the shippable coverage layer;
 * OOV words keep the careful voiceless reading. Source: kaikki mya (Wiktionary, CC-BY-SA) — the derived TSV inherits it.
 *
 *   npx tsx tools/build-my-voicing.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { syllabify } from "../src/languages/burmese/burmese.ts";
import { loadManifest } from "../src/core/loadManifest.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
// The voiceless→voiced pairs are the SINGLE SOURCE in burmese.jsonc "voicing" (also applied at runtime); read them
// here so the mined flags can never drift from the runtime's voicing capability.
const VOICE: Record<string, string> =
    loadManifest<{ voicing: Record<string, string> }>(
        new URL("../src/languages/burmese/burmese.ts", import.meta.url).href, "burmese.jsonc",
    ).voicing;
// Fold to the comparable segmental backbone (same as the referee eval): strip Chao letters + our creaky ˀ + the
// referee's combining tone diacritics, and normalise the nasal coda ɴ~n.
const fold = (x: string): string =>
    x.normalize("NFD").replace(/[˥˦˧˨˩ˀ]/gu, "").replace(/[̀-ͯ]/gu, "").replace(/ɴ/gu, "n").replace(/ /gu, "").normalize("NFC");

const rows: string[] = [];
let seen = 0, emitted = 0, voiceable = 0;
const done = new Set<string>();
for (const line of readFileSync(join(HERE, "referee-eval/referees/my.kaikki-mya.tsv"), "utf8").split("\n")) {
    const [word, ipa] = line.split("\t");
    if (!word || !ipa || done.has(word)) continue;
    done.add(word);
    seen++;
    const gold = fold(ipa);
    const syls = syllabify(word);
    if (syls.length === 0) continue;
    let cursor = 0, pat = "", ok = true, anyVoice = false;
    for (let k = 0; k < syls.length; k++) {
        const syl = syls[k]!;
        const bf = fold(syl.body);
        const plain = fold(syl.onset) + bf;
        if (gold.startsWith(plain, cursor)) { cursor += plain.length; pat += "0"; continue; }
        // Word-INITIAL voicing is only legitimate for a MINOR (reduced ə) syllable (ကစား→ɡəza); a word-initial
        // FULL/monosyllable voiced in the kaikki citation (ကား→ɡá) is a cross-word compound-sandhi artifact, wrong
        // in isolation — refuse it (skip the word) so it keeps its careful voiceless reading.
        const initialFull = k === 0 && !syl.body.endsWith("ə");
        const v = VOICE[syl.onset];
        if (v !== undefined && !initialFull) {
            const voiced = fold(v) + bf;
            if (gold.startsWith(voiced, cursor)) { cursor += voiced.length; pat += "1"; anyVoice = true; continue; }
        }
        ok = false;
        break;
    }
    if (!ok || cursor !== gold.length) continue;
    if (anyVoice) { rows.push(`${word.normalize("NFC")}\t${pat}`); emitted++; }
    voiceable++;
}

rows.sort();
const header =
    "# Burmese intervocalic-voicing lexicon — undiacritized word ⇥ per-syllable voicing flags ('1' = voice onset).\n" +
    "# Mined from the kaikki gold by tools/build-my-voicing.ts (CC-BY-SA). Applied in burmese.ts; OOV → voiceless.\n";
writeFileSync(join(HERE, "..", "src", "languages", "burmese", "voicing-lexicon.tsv"), header + rows.join("\n") + "\n");
console.log(`kaikki words ${seen} · fully-alignable ${voiceable} · with voicing (emitted) ${emitted} → voicing-lexicon.tsv`);
