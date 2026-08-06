/**
 * Build the Bengali neural-tagger TRAINING corpus from Google `language-resources/bn` (CC-BY-4.0, ~65k words,
 * non-Wiktionary, retroflex-correct). Emits `word<TAB>ipa` for train_bn_tagger.py. This is the OOV generalisation
 * source: the tagger learns Bengali's ɔ/o raising + inherent-vowel deletion from Google's readings (which Run 12
 * established are NOT cleanly rule-derivable). The authoritative Kolkata gold + cross-source consensus lexicon
 * (bengali-lexicon.tsv) take PRECEDENCE at runtime, so Google's Dhaka-leaning convention only affects the OOV tail
 * — where the tagger's 90.5% ɔ/o beats the rule engine's 62.6% (see bn_native_bringup_investigation.md Run 17-18).
 *
 *   curl -sL https://raw.githubusercontent.com/google/language-resources/master/bn/data/lexicon.tsv -o /tmp/google_bn_lexicon.tsv
 *   npx tsx tools/bengali/build_tagger_data.ts /tmp/bn_tagger_train.tsv
 *   /home/chris/base/bin/python3 tools/bengali/train_bn_tagger.py /tmp/bn_tagger_train.tsv src/languages/bengali
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { googleToIpa, isBengaliWord } from "./googlePhoneMap.ts";

const DUMP = "/tmp/google_bn_lexicon.tsv";
const OUT = process.argv[2] ?? "/tmp/bn_tagger_train.tsv";
if (!existsSync(DUMP)) {
    console.error(
        `missing ${DUMP} — download the Google bn lexicon first (see header)`,
    );
    process.exit(1);
}

// First reading per word (Google lists POS heteronyms as separate rows; the tagger sees whole words, so it learns
// the dominant reading — the lexicon disambiguates the rare heteronym pairs). Bengali-script words ≥2 graphemes;
// drop any word whose Google reading has an UNMAPPED phone (googleToIpa → null) rather than corrupt the label.
const seen = new Set<string>();
const rows: string[] = [];
for (const l of readFileSync(DUMP, "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const p = l.split("\t");
    const w = p[0]!;
    if (seen.has(w) || !isBengaliWord(w)) continue;
    seen.add(w);
    const ipa = googleToIpa(p[1]!);
    if (ipa) rows.push(`${w}\t${ipa}`);
}
writeFileSync(OUT, rows.join("\n") + "\n");
console.error(`wrote ${rows.length} (word, ipa) rows → ${OUT}`);
