/**
 * Import Moby headwords this dictionary LACKS, where misaki gold independently agrees.
 *
 *   MOBY=… GOLD=… npx tsx tools/english/en_import_moby.mts [--write]
 *
 * ⚠ THE DICTIONARY IS 117,482 CURATED ROWS AND THIS ADDS ~16,000, so the bar is the same two-source
 * standard every one of #1334–#1341's corrections had to clear: Moby and gold must AGREE, after both are
 * converted and folded to this engine's conventions. 57,503 Moby headwords are absent from the dict; gold
 * has no reading for 33,691 of them and disagrees on 7,414. What is left is what ships.
 *
 * ⚠ AND THE CONVERSION IS THE OPPOSITE OF THE REFEREE'S, WHICH IS THE WHOLE POINT OF DOING IT HERE.
 * `tools/gen/build-en-moby-referee.mts` deliberately does NOT fold marry–merry or the conservative yod,
 * so the referee can still catch a regression on them. A row entering the LEXICON has to go the other way:
 * it must arrive in this engine's conventions, so it is fully modernised — FORCE→NORTH, yod-dropping, and
 * æɹ→ɛɹ — or it would contradict the 402 marry–merry rows and the yod work in the dictionary it joins.
 *
 * ⚠ THE MANIFEST IS THE POINT, NOT A LOG. `en_g2p_ngram.ts --emit` REGENERATES g2p-dict.tsv FROM $CMUDICT
 * and would silently drop every row below — exactly the hazard `g2p-curated.tsv` exists for. This file is
 * the record that makes that loss visible and re-appliable, and `build-en-moby-referee.mts` READS IT to
 * exclude these words from both referee corpora: having imported Moby's reading, scoring ourselves against
 * Moby on the same word would be a mirror.
 *
 * ⚠ THESE WORDS ARE ALL OUTSIDE THE 40k FREQUENCY LIST — measured, 0 of 57,503 are in it — because the
 * dictionary was built to cover that list, so anything missing from it is rare by construction. The win is
 * coverage of the proper-noun / rare tail the OOV tier guesses at, not frequency-weighted quality.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOBY_DEFECTIVE, MOBY_DEFECTIVE_READING, mobyToArpabet, goldToArpabet, modernise, normalise } from "./en_source_compare.mts";
import { americanSpelling } from "../../src/languages/english/spellingVariants.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EN = join(REPO, "data/languages/english");
/**
 * `--no-gold`: ALSO import the headwords gold has no reading for at all — Moby as a SINGLE source.
 *
 * ⚠ THIS DROPS THE TWO-SOURCE BAR, AND THE ONLY REASON IT IS DEFENSIBLE IS THAT THE ALTERNATIVE IS NOT
 * A CORRECT READING BUT OUR OWN GUESS. Measured on the out-of-dictionary words an INDEPENDENT referee
 * can arbitrate — Moby is independent of CMUdict, our OOV model is not:
 *
 *     arbiter             n       Moby    our OOV tier   Moby-only right   OOV-only right
 *     wikipron US       352      46.6%        34.4%              77              34
 *     wikipron UK     6,416      30.9%        21.1%             949             322
 *
 * ⚠ AND JUDGING THEM AGAINST **GOLD** SAYS THE OPPOSITE — Moby 23.0% against our 36.9% over 6,184 words.
 * That is a CONFOUND, not a contradiction: gold is CMUdict-derived and so is our OOV model, so gold
 * scores its own descendant. The independent arbiters are the ones that answer the question, and they
 * agree with each other at roughly 3:1 on the rows that discriminate.
 *
 * ⚠ IT COSTS THE OOV REFEREE, DELIBERATELY. `build-en-moby-referee.mts` excludes imported words from
 * both corpora, so the OOV corpus falls 39,881 → ~6,200. That is still larger than English's own PRIMARY
 * referee (4,558 rows) and than Norwegian, Swedish, German or French, and above the 75th percentile of
 * the fleet's 257 referee files — but it is a real loss of GRANULARITY: the grapheme mining that found
 * Moby's `-ness` defect needed thousands of rows to make a 1,590-row class visible.
 *
 * ⚠ AND MOBY'S KNOWN TAIL DEFECTS MUST BE REPAIRED ON THE WAY IN, because there is no second source to
 * catch them here. In this bucket: 921 of 968 `-ness` rows carry Moby's spurious full `EH`, 32 of 318
 * `-ing` rows its `IY`, 439 rows a geminate consonant English does not have, and one an initial `/dZ/`
 * where the palatal glide belongs. Same repairs, same evidence, as tools/gen/build-en-moby-referee.mts.
 */
const noGold = process.argv.includes("--no-gold");

const MOBY = process.env["MOBY"], GOLD = process.env["GOLD"];
if (!MOBY || !GOLD) throw new Error("set MOBY (mobypron.unc) and GOLD (misaki us_gold.json)");

const dict: [string, string][] = [];
const have = new Set<string>();
for (const l of readFileSync(join(EN, "g2p-dict.tsv"), "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const [w, p] = l.split("\t");
    dict.push([w!, p!]); have.add(w!.toLowerCase());
}
const gold: Record<string, unknown> = JSON.parse(readFileSync(GOLD, "utf8"));
const goldOf = (w: string): string | undefined => {
    const v = gold[w] ?? gold[w[0]!.toUpperCase() + w.slice(1)];
    return typeof v === "string" ? v : undefined;
};
/**
 * Reduce every vowel the source ITSELF marks unstressed (ARPABET stress digit 0) to one symbol.
 *
 * ⚠ THIS IS WHAT MOBY AND GOLD MOSTLY DISAGREE ABOUT: whether an unstressed slot carries a FULL vowel
 * or a reduced one. `abstruseness` is `… N EH S` in Moby against gold's `… N AH0 S`; `abstractionism`
 * has `AE` against gold's `AH0`. Found by READING the disagreements rather than counting them — 243 of
 * them differ in the first phone alone and 116 in the last, almost all on this axis.
 * ⚠ IT RUNS IN BOTH DIRECTIONS, WHICH THE FIRST VERSION OF THIS COMMENT GOT WRONG. It claimed "Moby
 * writes a full unstressed vowel where gold reduces"; measured, 488 of the selected rows are the
 * INVERSE — Moby reduced, gold full (`abjection` Moby `AH0` against gold's `AE0`). The axis is real, the
 * direction is not constant, and gold is taken because it is the convention this engine follows, not
 * because it is the reduced one.
 * ⚠ MONOPHTHONGS ONLY. An earlier version folded the DIPHTHONGS too, which is a reading difference and
 * not a notation one: it accepted 501 rows where the two sources disagree `AH0` against `OW0` at an
 * unstressed slot (`acanthocephalan` Moby `TH AH0 S`, gold `TH OW0 S`). A diphthong is a different
 * vowel, not a different way of writing the same one.
 * ⚠ IT IS SAFE BECAUSE IT IS CONDITIONED ON THE SOURCE'S OWN STRESS MARK, not on position or guesswork:
 * a vowel either source writes as stressed is untouched, so no stressed contrast can be merged. It runs
 * BEFORE `normalise`, which strips stress and would otherwise take the condition with it.
 * ⚠ AND IT IS ONLY A COMPARISON FOLD. What gets IMPORTED is gold's reading, never the folded form.
 * ⚠ `ER` IS EXCLUDED, AND QC CAUGHT WHY. `en_source_compare.mts` already states the rule — "ɚ against ə
 * is a real distinction, not a notation one" — and reducing it merged a RHOTIC away: on `squiredom`
 * Moby has `S K W AY1 ER0 D AH0 M` and gold `S K W AY1 AH0 D AH0 M`, i.e. gold simply drops the /r/ of
 * `squire`. Folded together they "agreed" and the import would have taken the r-less reading.
 */
const VOWEL = /^(AA|AE|AH|AO|EH|IH|IY|UH|UW)[0-2]?$/u;
const reduceUnstressed = (a: string[]): string[] =>
    a.map((p) => (VOWEL.test(p) && p.endsWith("0") ? "AH0" : p));

/**
 * Moby's own tail defects, repaired before the comparison so that a defect cannot BLOCK a legitimate
 * agreement — `unilocular` is `JH UW2 …` in Moby, its initial-yod bug, and could never match gold.
 * Each repair and its evidence is argued in tools/gen/build-en-moby-referee.mts.
 *
 * ⚠ THE GEMINATE COLLAPSE IS A MATCHING AID ONLY, NEVER A SHIPPED READING, and the distinction is
 * load-bearing. The sibling tool degeminates in the OOV referee file ONLY, because the DICTIONARY path
 * does not collapse and 144 `g2p-dict.tsv` rows carry a real geminate at a compound seam. Applying it
 * unconditionally here dropped 58 already-shipped words on re-apply — `backcourt` and `blackcap` among
 * them, the two the sibling names as the reason not to. Applying it not at all lost the `-ally` class,
 * where Moby's spurious `L L` is what blocks a legitimate gold match. So BOTH forms are offered to the
 * comparison, and whichever agrees decides — but a row that needed the collapse takes GOLD's reading,
 * so no degeminated Moby reading ever enters the dictionary.
 */
function degeminate(a: string[]): string[] {
    const out: string[] = [];
    for (const p of a) {
        const prev = out[out.length - 1];
        if (prev !== undefined && prev === p && CONSONANT.has(p.replace(/[0-2]$/u, ""))) continue;
        out.push(p);
    }
    return out;
}

/** The consonants, for the geminate collapse — English has no consonant-length contrast. */
const CONSONANT = new Set("B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH".split(" "));

function repairMoby(word: string, a: string[]): string[] {
    let out = [...a];
    // The unstressed suffix vowel, normalised to Moby's OWN majority spelling.
    const last = out.length - 2;
    if (last >= 1) {
        if (/^[a-z]{3,}ness$/u.test(word) && (out[last] === "EH" || out[last] === "EH0")) out[last] = "IH0";
        if (/^[a-z]{3,}ing$/u.test(word) && (out[last] === "IY" || out[last] === "IY0")) out[last] = "IH0";
    }
    // An initial /dZ/ on a vowel-spelled word before /u/–/ʊ/ is the palatal glide.
    if (out[0] === "JH" && /^[aeiou]/u.test(word) && /^(UW|UH)/u.test(out[1] ?? "")) out[0] = "Y";
    return out;
}

/** æɹ → ɛɹ: the marry–merry merger this engine applies (#1336). Moby is unmerged. */
const merge = (a: string[]): string[] =>
    a.map((p, i) => (p.replace(/[0-2]$/u, "") === "AE" && a[i + 1]?.replace(/[0-2]$/u, "") === "R"
        ? p.replace("AE", "EH") : p));

const rows: string[] = [];
const seen = new Set<string>();
let noGoldN = 0, disagree = 0, skipped = 0, shadowed = 0, reduced = 0, single = 0;
for (const line of readFileSync(MOBY, "latin1").split(/\r\n|\r|\n/u)) {
    const sp = line.indexOf(" "); if (sp < 0) continue;
    const w = line.slice(0, sp).toLowerCase();
    if (have.has(w) || seen.has(w)) continue;
    // ⚠ NEVER IMPORT A ROW WHOSE BODY IS A DIFFERENT WORD. See MOBY_DEFECTIVE.
    if (MOBY_DEFECTIVE.has(w)) { skipped++; continue; }
    // ⚠ THIS PATH IS FIRST-WINS, so a corrupt reading that sorts before the good one is what gets
    // IMPORTED INTO THE SHIPPING DICTIONARY. Moby lists `Corporation` before `corporation` and `City`
    // before `city`; both are saved today only by `have.has(w)` already carrying the word.
    if (MOBY_DEFECTIVE_READING.get(w)?.has(line.slice(sp + 1))) { skipped++; continue; }
    // ⚠ ≥3 LETTERS: a one- or two-letter headword is a GLYPH, not a word, and its reading is not constant
    // — the same reason the wikipron referee excludes them (`x` is the letter's SOUND, `m` its NAME).
    if (!/^[a-z]{3,20}$/u.test(w)) { skipped++; continue; }
    const raw = mobyToArpabet(line.slice(sp + 1), w); if (!raw) { skipped++; continue; }
    seen.add(w);
    // ⚠ REPAIRED BEFORE THE COMPARISON, NOT ONLY ON THE SINGLE-SOURCE ARM. A known Moby defect was
    // BLOCKING legitimate two-source agreement: `unilocular` is `JH UW2 …` in Moby — its initial-yod
    // bug — and can never match gold's `jˌunəlˈɑkjələɹ`, so the word fell out as "gold disagrees" and
    // then came back in through `--no-gold` on ONE source when TWO actually agree about it.
    // ⚠ THE REPAIRS ARE MOBY-INTERNAL AND INDEPENDENT OF GOLD — each is argued from Moby's own
    // inconsistency in build-en-moby-referee.mts — so applying them first removes a corruption rather
    // than manufacturing an agreement.
    const m = repairMoby(w, raw);
    const rawOurs = merge(modernise(raw));
    // ⚠ THE CANDIDATES THE COMPARISON MAY USE, widest last. Only the FIRST is a reading Moby earned.
    const candidates = [rawOurs, merge(modernise(m)), merge(modernise(degeminate(m)))];
    const g = goldOf(w);
    const ga = g === undefined ? undefined : goldToArpabet(g);
    if (!ga) {
        noGoldN++;
        if (!noGold) continue;
        // SINGLE SOURCE: Moby alone, with its known tail defects repaired first. See the header.
        if (americanSpelling(w, (x) => have.has(x)) !== undefined) { shadowed++; continue; }
        have.add(w);
        single++;
        rows.push(`${w}\t${merge(modernise(m)).join(" ")}`);
        continue;
    }
    const ours = merge(modernise(m));
    let take = ours, viaFold = false;
    // ⚠ AGREEMENT THE REPAIR PRODUCED IS NOT AGREEMENT MOBY EARNED, and treating it as such defeated the
    // rule below for the exact class it was written for. The `-ness` repair rewrites the very vowel the
    // unstressed fold is about, so the pair agreed OUTRIGHT and Moby's reading was taken — and Moby
    // marks no stress on `blondness`, `crassness`, `dankness`, `lewdness`, which shipped with no primary
    // at all. Only agreement on the RAW reading counts as Moby's; anything the repair or the fold
    // produced takes gold's.
    if (normalise(rawOurs) !== normalise(ga)) {
        if (candidates.some((c) => normalise(c) === normalise(ga))) { take = merge(modernise(ga)); viaFold = true; }
        else {
        // ⚠ AGREEING ONLY AFTER THE REDUCTION FOLD MEANS GOLD'S READING IS THE ONE TO TAKE, not Moby's.
        // The two now differ ONLY in unstressed vowels, and Moby's are the unreliable half — the same
        // conservatism that writes `-ness` as `nɛs` in 1,622 of its own rows. Gold is also the lexicon
        // this engine's conventions follow (#1319 added the reduced slot misaki writes).
            if (!candidates.some((c) => normalise(reduceUnstressed(c)) === normalise(reduceUnstressed(ga)))) { disagree++; continue; }
            // ⚠ FULLY MODERNISED, LIKE THE MOBY BRANCH. A row entering the LEXICON must arrive in this
            // engine's conventions — the header says so — and `merge` alone is only the marry–merry
            // half. Without `modernise`, gold's yod shipped intact: `exudation` as ˌɛksjuːdˈeᶦʃən where
            // the engine coalesces S+j+uː → ʃuː, and `minho` as mˈiːnjuː where it drops the yod after N.
            take = merge(modernise(ga));
            viaFold = true;
        }
    }
    // ⚠ A COMMONWEALTH SPELLING THE FOLD ALREADY RESOLVES MUST NOT BE IMPORTED. `analyse` was not in the
    // dictionary and did not need to be: `americanSpelling` mapped it to `analyze`, which carries this
    // repo's curated reading AND its `en-syllabic.tsv` marking. Giving it its own row SHADOWS the fold —
    // the lookup now hits first — and swaps a curated reading for a raw imported one. 188 rows, caught by
    // english-spelling-variants.test.ts when `analyse` lost its ə̆.
    // ⚠ `have` MUST LEARN THE ROWS THIS RUN ADDS. It is a snapshot of g2p-dict.tsv taken before the
    // loop, so when BOTH the Commonwealth spelling and its American counterpart are new, neither sees
    // the other and neither is skipped — this run shipped `aerogramme`/`aerogram` and
    // `externalisation`/`externalization` that way (the #1344 manifest already carries 22 such pairs).
    // The readings happen to match today, but each Commonwealth row short-circuits the fold, so a later
    // `en-syllabic.tsv` marking or hand correction on the American form never reaches it — exactly the
    // `analyse`/`analyze` failure the note above describes.
    if (americanSpelling(w, (x) => have.has(x)) !== undefined) { shadowed++; continue; }
    have.add(w);
    if (viaFold) reduced++;
    rows.push(`${w}\t${take.join(" ")}`);
}
rows.sort();
console.log(`considered ${seen.size + skipped}  skipped ${skipped}  no gold ${noGoldN}  gold disagrees ${disagree}  shadows a spelling fold ${shadowed}`);
if (noGold) console.log(`  --no-gold: ${single} imported from MOBY ALONE, tail defects repaired`);
console.log(`IMPORTABLE: ${rows.length}  = ${rows.length - single} two-source (${reduced} of them via the unstressed-vowel fold, gold's reading taken) + ${single} single-source`);

if (!process.argv.includes("--write")) { console.log("\n(dry run — pass --write to apply)"); process.exit(0); }

/**
 * ⚠ THE MANIFEST IS THE UNION OF EVERY IMPORT, NOT THE LAST ONE, and the first re-run of this tool
 * proved why. A word imported by an earlier run is in `g2p-dict.tsv`, so `have` skips it and it never
 * reaches `rows` — writing `rows` over the file therefore DELETED all 16,227 rows of the #1344 import,
 * leaving 1,874. Nothing in the dictionary changed, so the loss was silent there; it surfaced as the
 * lexicon referee jumping 35,202 → 51,429, because `build-en-moby-referee.mts` reads this file to
 * exclude imported words and they had stopped being listed.
 * ⚠ THE FILE'S WHOLE PURPOSE IS TO BE RE-APPLIABLE AFTER AN `--emit`, so losing earlier rows loses
 * exactly what it exists to protect.
 */
const dictOf = new Map(dict);
const previous: [string, string][] = [];
try {
    for (const l of readFileSync(join(EN, "moby-import.tsv"), "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, p] = l.split("\t");
        if (!w || !p || rows.some((r) => r.startsWith(`${w}\t`))) continue;
        // ⚠ RECONCILED AGAINST THE DICTIONARY, NOT COPIED. A carried-forward row that someone has since
        // hand-corrected in g2p-dict.tsv would otherwise keep its stale reading here, and the documented
        // "re-apply after an --emit" step would silently revert the correction. A row deleted from the
        // dictionary leaves the manifest with it, so the header count stays honest.
        const current = dictOf.get(w);
        if (current !== undefined) previous.push([w, current]);
    }
} catch (e) {
    // ⚠ ONLY A MISSING FILE IS A FIRST RUN. A bare catch here swallowed every read failure — a
    // permission change, a half-written file, the wrong cwd — and an empty `previous` then writes the
    // new rows OVER the whole manifest, which is the silent deletion this block exists to prevent and is
    // invisible in g2p-dict.tsv because nothing there changes.
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
const manifest = [...previous, ...rows.map((r) => r.split("\t") as [string, string])]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
console.log(`manifest: ${previous.length} carried forward + ${rows.length} new = ${manifest.length}`);

writeFileSync(join(EN, "moby-import.tsv"),
    `# THE MOBY IMPORT LAYER — headwords g2p-dict.tsv lacked, where Moby AND misaki gold agree.\n` +
    `# Moby Pronunciator II (Grady Ward, Project Gutenberg #3205), PUBLIC DOMAIN by grant from the author,\n` +
    `# January 2001. See LICENSES/PROVENANCE.md §5.3 and tools/english/en_import_moby.mts.\n` +
    `#\n` +
    `# ⚠ RE-APPLY THIS AFTER ANY \`en_g2p_ngram.ts --emit\`, which rebuilds g2p-dict.tsv from $CMUDICT and\n` +
    `# carries none of these rows — the same hazard g2p-curated.tsv exists for.\n` +
    `# ⚠ AND tools/gen/build-en-moby-referee.mts READS THIS FILE to exclude these words from both referee\n` +
    `# corpora. Having imported Moby's reading, scoring ourselves against Moby on the same word is a mirror.\n` +
    `#\n# word <TAB> ARPABET (Moby modernised to this engine's conventions where the two agree outright;\n` +
    `# gold's where they agree only after unstressed vowels are folded — see en_import_moby.mts).\n` +
    manifest.map(([w, p]) => `${w}\t${p}`).join("\n") + "\n");

const merged = [...dict, ...rows.map((r) => r.split("\t") as [string, string])]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
writeFileSync(join(EN, "g2p-dict.tsv"),
    `# word <TAB> ARPABET. CMUdict (public domain) → the OOV G2P dict (compound pieces / morph stems),\n` +
    `# plus ${manifest.length} rows imported from Moby Pronunciator II where misaki gold concurs — see\n` +
    `# moby-import.tsv, which is the re-appliable record of that layer.\n` +
    merged.map(([w, p]) => `${w}\t${p}`).join("\n") + "\n");
console.log(`wrote moby-import.tsv (${manifest.length}) and g2p-dict.tsv (${merged.length} rows)`);
