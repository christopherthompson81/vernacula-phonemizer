/**
 * END-TO-END measurement of the SHIPPED Khmer path, on vocabulary no lexicon tier was allowed to see.
 *
 * Run: npx tsx tools/khmer/eval_shipped_heldout.ts <km/data/lexicon.tsv from google/language-resources>
 *
 * ## The problem this exists to solve
 *
 * Every published km number is the RULES number (`phonemizeWordRules`). What actually ships is `phonemizeWord`,
 * which is dict-first over two tiers, and it has never been measured — because both tiers are constructed
 * against the only referee there is:
 *
 *     referee ∩ exceptions lexicon = 2,822 of 2,822   (it was MINED from the referee — scoring it is circular)
 *     referee ∩ dictionary tier    = 0     of 56,355  (the builder EXCLUDES every referee word by design)
 *
 * So on referee vocabulary the shipped path is "a circular lookup, or the rules" — the dictionary tier cannot
 * contribute a single word, and masking the exceptions lexicon just reproduces the rules number. Neither
 * arrangement can answer "how good is the thing that ships, on a word it has not been built around?".
 *
 * ## The experiment
 *
 * Split the referee's unique words 80/20 and rebuild BOTH tiers as if only the 80% existed:
 *
 *   · exceptions lexicon — drop every entry whose word is in the held-out 20% (it was mined per-word, so
 *     dropping the row is exactly "this word was never mined")
 *   · dictionary tier — re-run the builder's own `convert()` over the raw upstream file with the exclusion gate
 *     seeing only the 80%. This is the load-bearing half: held-out words the dictionary covers now ENTER the
 *     tier, exactly as they would have if the referee had never listed them.
 *
 * Then score the 20% — words that reached neither tier by construction. The comparison is rules vs shipped, on
 * identical folds, so it isolates what the lexicon architecture buys on unseen vocabulary.
 *
 * ⚠ THIS MEASURES THE WORD PATH ONLY. Reading running Khmer also depends on boundary restoration, which has its
 * own honest figure (80.4% against human gold; see khmerPerceptron.ts) and is not re-measured here.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";
import { convert } from "../gen/build-km-dict-lexicon.mts";
import { phonemizeWordRules } from "../../src/languages/khmer/khmer.ts";

const src = process.argv[2];
if (src === undefined) {
    console.error("usage: eval_shipped_heldout.ts <km/data/lexicon.tsv from google/language-resources>");
    process.exit(2);
}

const readTsv = (p: string): [string, string][] =>
    readFileSync(p, "utf8").split("\n")
        .filter((l) => l.trim() && !l.startsWith("#") && l.includes("\t"))
        .map((l) => { const [a, b] = l.split("\t"); return [a!.trim(), b!.trim()] as [string, string]; });

const refRows = readTsv("tools/referee-eval/referees/km.wikipron-khm-broad.tsv");
const words = [...new Set(refRows.map(([w]) => w))];

/** Stable 80/20 split on a hash of the word — deterministic across runs, and independent of file order. */
const heldOut = new Set(
    words.filter((w) => parseInt(createHash("sha1").update(w).digest("hex").slice(0, 8), 16) % 5 === 0),
);

/** Tier 1, as it would have been mined from the 80% only. */
const exceptions = new Map(readTsv("src/languages/khmer/km-lexicon.tsv").filter(([w]) => !heldOut.has(w)));

/** Tier 2, rebuilt with the exclusion gate seeing only the 80% — so held-out words the dictionary covers enter. */
const KHMER_WORD = /^[ក-៓ៜ-៝]{1,}$/u;
const settled = new Set<string>([...words.filter((w) => !heldOut.has(w)), ...exceptions.keys()]);
const dict = new Map<string, string>();
for (const line of readFileSync(src, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.includes("\t")) continue;
    const [w, ipa] = line.split("\t").map((x) => x.trim());
    if (!w || !ipa || !KHMER_WORD.test(w) || settled.has(w)) continue;
    if (!dict.has(w)) dict.set(w, convert(ipa));
}

/** Tier 3 (kaikki). ⚠ WIKIPRON AND KAIKKI ARE ONE LINEAGE (both en.wiktionary), so a held-out word must be
 *  held out of BOTH — otherwise the kaikki tier hands back a near-copy of the answer key (97.7% agreement)
 *  and the experiment measures Wiktionary-vs-Wiktionary. The production tier already contains NO wikipron
 *  word by construction, so filtering held-out words here is a no-op today; it is written down so a future
 *  rebuild against a different wikipron scrape cannot silently break the experiment. */
const kaikki = new Map(readTsv("src/languages/khmer/km-lexicon-kaikki.tsv").filter(([w]) => !heldOut.has(w)));

/** The shipped resolution order, reproduced over the rebuilt tiers: exceptions → kaikki → dictionary → rules. */
const shipped = (w: string): string => exceptions.get(w) ?? kaikki.get(w) ?? dict.get(w) ?? phonemizeWordRules(w);

const fold = makeFold(CONFIG.km!);
/** A referee word may carry several readings; credit a match against any of them, as eval.ts does. */
const gold = new Map<string, string[]>();
for (const [w, ipa] of refRows) gold.set(w, [...(gold.get(w) ?? []), fold(ipa.replace(/\s+/gu, ""))]);

const held = [...heldOut];
let rulesOk = 0, shippedOk = 0, viaExc = 0, viaDict = 0, viaRules = 0, dictOk = 0, dictN = 0;
for (const w of held) {
    const g = gold.get(w)!;
    if (g.includes(fold(phonemizeWordRules(w)))) rulesOk++;
    const hitExc = exceptions.has(w) || kaikki.has(w), hitDict = !hitExc && dict.has(w);
    if (hitExc) viaExc++; else if (hitDict) viaDict++; else viaRules++;
    const ok = g.includes(fold(shipped(w)));
    if (ok) shippedOk++;
    if (hitDict) { dictN++; if (ok) dictOk++; }
}

const pc = (x: number, n: number): string => `${((100 * x) / n).toFixed(1)}%`;
console.log(`referee unique words: ${words.length}   held out (20%): ${held.length}`);
console.log(`rebuilt tiers — exceptions ${exceptions.size} (was ${readTsv("src/languages/khmer/km-lexicon.tsv").length}), dictionary ${dict.size}`);
console.log(`\non the ${held.length} held-out words:`);
console.log(`  rules only            ${String(rulesOk).padStart(5)}  ${pc(rulesOk, held.length)}`);
console.log(`  shipped (dict-first)  ${String(shippedOk).padStart(5)}  ${pc(shippedOk, held.length)}`);
console.log(`\nwhere the shipped answer came from:`);
console.log(`  exceptions tier ${viaExc}   dictionary tier ${viaDict}   rules ${viaRules}`);
if (dictN) console.log(`  dictionary-tier words: ${dictOk}/${dictN} correct (${pc(dictOk, dictN)})`);
