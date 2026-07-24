/**
 * PHASE B of the Hebrew lexicon build (see build-lexicon.py). Reads `word <TAB> PK_niqqud <TAB> RN_ipa` candidates
 * and emits the shipped `skeleton <TAB> niqqud` lexicon, keeping an entry ONLY when:
 *   1. our g2p rendering of Phonikud's niqqud (phonemizeWord) agrees with ReNikud after canonicalisation — the
 *      independent validation that also drops convention-divergent words (they render differently → excluded), and
 *   2. the skeleton is NOT a homograph in the modern corpus (multiple readings) — those stay with the context tagger.
 *
 *   npx tsx tools/hebrew/finalize-lexicon.ts /tmp/lexicon-candidates.tsv  /path/to/hebrew_diacritized  > he-lexicon.tsv
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { phonemizeWord } from "../../src/languages/hebrew/hebrew.ts";

const NIQ = /[֑-ׇ]/gu;
const canon = (s: string): string => s.replace(/[ˈˌ]/g, "").replace(/͡/g, "").replace(/[.,?!;:…()]/g, "").trim();

const candidates = process.argv[2]!;
const corpusRoot = process.argv[3] ?? "/tmp/hebrew_diacritized";

// homograph skeletons: a skeleton seen with >1 distinct reading (via our g2p) in the modern corpus
const readings = new Map<string, Set<string>>();
const files: string[] = [];
const walk = (d: string): void => { try { for (const e of readdirSync(d)) { const p = join(d, e); statSync(p).isDirectory() ? walk(p) : (e.endsWith(".txt") && files.push(p)); } } catch { /* skip */ } };
for (const h of ["modern/news", "modern/blogs", "test_modern", "dictaTestCorpus", "modern/wiki"]) walk(join(corpusRoot, h));
const CL = /[א-ת][ְ-ׇא-ת]*(?:[ \t]+[א-ת][ְ-ׇא-ת]*)*/gu;
for (const f of files.slice(0, 500)) for (const m of readFileSync(f, "utf8").matchAll(CL)) {
    if (!/[֑-ׇ]/u.test(m[0])) continue;
    for (const w of m[0].split(/[ \t]+/u).filter(Boolean)) {
        const sk = w.replace(NIQ, "");
        (readings.get(sk) ?? readings.set(sk, new Set()).get(sk)!).add(canon(phonemizeWord(w)));
    }
}
const isHomograph = (sk: string): boolean => (readings.get(sk)?.size ?? 0) > 1;

for (const line of readFileSync(candidates, "utf8").split("\n")) {
    if (!line) continue;
    const [w, niqqud, rn] = line.split("\t");
    if (!w || !niqqud || !rn) continue;
    if (isHomograph(w)) continue;                          // homograph → tagger
    if (canon(phonemizeWord(niqqud)) !== canon(rn)) continue; // our-g2p(PK) must agree with ReNikud
    console.log(`${w}\t${niqqud}`);
}
