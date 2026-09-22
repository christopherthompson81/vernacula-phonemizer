/**
 * Measure PARADIGM CONSISTENCY in the generated en-GB lexical sets: a regular inflection whose lemma is
 * in a set but which is not, so one sentence can carry both vowels for one word (#1390).
 *
 * ⚠ IT WORKS BACKWARDS, FROM THE INFLECTION TO THE LEMMA, and that is not a style choice. Generating
 * forms from a lemma has to reproduce e-drop, y→ies and consonant doubling and gets them wrong in both
 * directions; stripping a suffix and asking the DICTIONARY whether the result is a word lets the
 * dictionary arbitrate. `bating` proposes `bat`, `bate` and `bating`; only the ones the dict carries
 * count, and a wrong proposal simply finds nothing.
 *
 *   npx tsx tools/referee-eval/engb-paradigm-audit.mts [--list bath]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GB = join(HERE, "..", "..", "data", "languages", "english-gb");
const words = (f: string): string[] =>
    readFileSync(join(GB, f), "utf8").split("\n")
        .filter((l) => l.includes("\t") && !l.startsWith("#")).map((l) => l.split("\t")[0]!);

const SETS = ["bath", "cloth", "yod", "palm", "lotr"] as const;

/**
 * ⚠ NOTHING HERE MAY READ A FILE AT MODULE SCOPE. `build-en-gb-sets.ts` imports `lemmaCandidates` from
 * this module, and that builder is what GENERATES the five set files — it documents that "AN ABSENT SET
 * FILE IS LEGITIMATE … so this must REPORT it, not die with an ENOENT trace". A module-scope
 * `readFileSync` of the sets made merely importing the helper crash the generator on a tree where one of
 * its own outputs is missing, before any of its code ran.
 */

/** Candidate LEMMAS for a surface form, by stripping ONE regular inflectional suffix. Over-generates on
 *  purpose — the dictionary filters. Deliberately no -er/-est: agentive -er is DERIVATIONAL and may
 *  legitimately change the vowel, and nothing in the spelling separates the two. */
export function lemmaCandidates(w: string): string[] {
    const out: string[] = [];
    const push = (s: string): void => { if (s.length >= 3 && s !== w) out.push(s); };
    const dbl = (stem: string): void => {
        // running → run: a doubled final consonant before the suffix
        if (stem.length >= 3 && stem.at(-1) === stem.at(-2) && !"aeiou".includes(stem.at(-1)!)) push(stem.slice(0, -1));
    };
    if (w.endsWith("ies")) push(`${w.slice(0, -3)}y`);
    if (w.endsWith("ied")) push(`${w.slice(0, -3)}y`);
    if (w.endsWith("es")) { push(w.slice(0, -2)); push(w.slice(0, -1)); }
    if (w.endsWith("s")) push(w.slice(0, -1));
    if (w.endsWith("ed")) { push(w.slice(0, -2)); push(w.slice(0, -1)); dbl(w.slice(0, -2)); }
    if (w.endsWith("ing")) { push(w.slice(0, -3)); push(`${w.slice(0, -3)}e`); dbl(w.slice(0, -3)); }
    // ⚠ DEDUPED, BECAUSE THE `-es` RULES OVERLAP: `causes` proposes `caus`, `cause` and `cause` again.
    // The audit `break`s on the first hit so it never noticed, but the builder indexes EVERY candidate into
    // `inflectionsOf`, so a duplicate made the propagation loop visit that word twice — harmless for the
    // membership (`inSomeSet` catches it) and NOT harmless for the counters, which double-reported every
    // `-es` word that was vetoed or declined.
    return [...new Set(out)];
}

/**
 * ⚠ MEMBERSHIP IS NOT THE DEFECT — THE READING IS, and counting memberships over-reports it badly.
 * `bog` is CLOTH and `bogs` is not, which looks like a split; the product reads `bˈɒɡ` and `bˈɒɡz`,
 * consistently, because CMUdict itself is inconsistent (`B AO1 G` against `B AA1 G Z`) and the general LOT
 * rule lands the inflection on `ɒ` without any set membership at all. Same for `accost`/`accosted`,
 * `alcohol`/`alcohols`. So the honest instrument is the SHIPPED reading of both members, and the
 * membership count is kept only as the thing that motivated looking.
 */
const DIAGNOSTIC: Record<string, (lemma: string, infl: string) => boolean> = {
    bath: (l, i) => l.includes("\u0251\u02d0") && i.includes("\u00e6"),
    cloth: (l, i) => l.includes("\u0252") && i.includes("\u0254\u02d0"),
    palm: (l, i) => l.includes("\u0251\u02d0") && i.includes("\u0252"),
    lotr: (l, i) => /\u0252\u0279/u.test(l) && /[\u0251\u0254]\u02d0\u0279/u.test(i),
    yod: (l, i) => /[tdnsz\u03b8l]\u02b0?[\u02c8\u02cc]*j/u.test(l)
        && /[tdnsz\u03b8l]\u02b0?[\u02c8\u02cc]*u\u02d0/u.test(i) && !/[tdnsz\u03b8l]\u02b0?[\u02c8\u02cc]*j/u.test(i),
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { phonemizeWord } = await import("../../src/languages/english-gb/english-gb.ts");
    const dict = new Set(
        readFileSync(join(HERE, "..", "..", "data", "languages", "english", "g2p-dict.tsv"), "utf8")
            .split("\n").filter((l) => l.includes("\t") && !l.startsWith("#")).map((l) => l.split("\t")[0]!),
    );
    const listing = process.argv.includes("--list") ? process.argv[process.argv.indexOf("--list") + 1] : undefined;
    let members = 0, product = 0;
    for (const s of SETS) {
        const set = new Set(words(`en-gb-${s}.tsv`));
        const split: [string, string][] = [];
        const real: [string, string, string, string][] = [];
        for (const w of dict) {
            if (set.has(w)) continue;
            for (const l of lemmaCandidates(w)) {
                if (!dict.has(l) || !set.has(l)) continue;
                split.push([l, w]);
                const [lr, ir] = [phonemizeWord(l), phonemizeWord(w)];
                if (DIAGNOSTIC[s]!(lr, ir)) real.push([l, lr, w, ir]);
                break;
            }
        }
        members += split.length; product += real.length;
        console.log(`  ${s.padEnd(6)} members ${String(set.size).padStart(4)}   outside the set ${String(split.length).padStart(4)}   READING ACTUALLY SPLIT ${String(real.length).padStart(4)}`);
        if (listing === s) for (const [l, lr, w, ir] of real.slice(0, 40)) console.log(`      ${l} ${lr}  vs  ${w} ${ir}`);
    }
    console.log(`membership splits ${members}   ⚠ PRODUCT splits ${product}`);
}
