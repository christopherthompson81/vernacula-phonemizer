/**
 * The de-/re-/pre- PREFIX-VOWEL families (#1397): CMUdict disagrees with ITSELF about whether the
 * unstressed prefix vowel is tense (`IY0` → ɹi) or reduced (`IH0`/`AH0` → ɹᵻ), inside single paradigms.
 *
 *     retrieve R IH0   retriever R IY0   retrieved R IY0   retrieving R IY0
 *     precise  P R IH0                   precision P R IY0
 *
 * ⚠ THE DIFFERENCE IS AUDIBLE — ɹipɹˈiːv against ɹᵻpɹˈiːv — so this is NOT the AH0/IH0 notation pair,
 * which both render `ᵻ` and which `normalise` therefore merges.
 *
 * ⚠ GETTING THE FAMILY BOUNDARY RIGHT IS PART OF THE WORK, NOT A PRELIMINARY TO IT. Four definitions
 * gave 86, 57, 77 and 33 families, and #1397 was FILED on one of the wrong ones:
 *   • strip the prefix, stem once        86 — groups `decant` with `recant`, `deduct` with `reduction`
 *   • keep the prefix, stem once         57 — splits `precarious` from `precariousness`
 *   • keep the prefix, stem in a loop    77 — `debar` swallows `debark` and the surname `debartolo`
 *   • …and require a plausible suffix    33 — the one whose printed families all read as paradigms
 *
 *   npx tsx tools/english/en_prefix_families.mts [--print]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DICT = join(HERE, "..", "..", "data", "languages", "english", "g2p-dict.tsv");

export const PREFIXES = ["pre", "de", "re"] as const;   // `pre` first: it is a superset spelling of `re`
/** The prefix vowel as CMUdict writes it, immediately after the prefix consonant(s). */
const TENSE = "IY0";
const REDUCED = new Set(["IH0", "AH0"]);

export interface Word { word: string; phones: string[]; prefix: string; vowel: string }

export function loadPrefixWords(): Word[] {
    const out: Word[] = [];
    for (const l of readFileSync(DICT, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, ph] = l.split("\t");
        if (!/^[a-z]+$/u.test(w!)) continue;
        const prefix = PREFIXES.find((p) => w!.startsWith(p) && w!.length >= p.length + 4);
        if (prefix === undefined) continue;
        const phones = ph!.split(" ");
        // the prefix vowel is the FIRST vowel, and it must be unstressed
        const vi = phones.findIndex((p) => /\d$/u.test(p));
        if (vi < 0) continue;
        const v = phones[vi]!;
        if (v !== TENSE && !REDUCED.has(v)) continue;
        out.push({ word: w!, phones, prefix, vowel: v });
    }
    return out;
}

/** ⚠ A LOOP WITH A FLOOR OF prefix + 4. One strip lands elsewhere depending on the suffix, which is what
 *  split `precarious` from `precariousness`; and without the floor `revivalist` reaches `revivify`. */
const SUFFIXES = ["ness", "ment", "ions", "ing", "ers", "est", "ion", "ive", "ial", "ies", "ed", "es",
    "er", "or", "al", "ly", "ic", "s", "e", "y"];
export function familyKey(w: string, prefix: string): string {
    const floor = prefix.length + 4;
    let s = w;
    for (let changed = true; changed;) {
        changed = false;
        for (const suf of SUFFIXES) {
            if (s.length - suf.length >= floor && s.endsWith(suf)) { s = s.slice(0, -suf.length); changed = true; break; }
        }
    }
    return `${prefix}:${s}`;
}

/** ⚠ AND THE MEMBER MUST BE THE KEY PLUS A PLAUSIBLE SUFFIX CHAIN. This is the fourth definition's whole
 *  content: without it `debar` swallows `debark` and the surname `debartolo`, which stem to the same key
 *  but are different WORDS. Re-deriving the key from the member is not enough — the remainder is. */
export function isPlausibleInflection(member: string, stem: string): boolean {
    if (member === stem) return true;
    if (!member.startsWith(stem)) return false;
    let rest = member.slice(stem.length);
    for (let changed = true; rest !== "" && changed;) {
        changed = false;
        for (const suf of SUFFIXES) {
            if (rest.endsWith(suf)) { rest = rest.slice(0, -suf.length); changed = true; break; }
        }
    }
    return rest === "";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const words = loadPrefixWords();
    const fams = new Map<string, Word[]>();
    for (const w of words) {
        const key = familyKey(w.word, w.prefix);
        const stem = key.split(":")[1]!;
        if (!isPlausibleInflection(w.word, stem)) continue;
        { const at = fams.get(key); if (at) at.push(w); else fams.set(key, [w]); }
    }
    const multi = [...fams].filter(([, m]) => m.length >= 2);
    const split = multi.filter(([, m]) => new Set(m.map((x) => (x.vowel === TENSE ? "T" : "R"))).size > 1);
    console.log(`de-/re-/pre- words with an unstressed prefix vowel   ${words.length}`);
    console.log(`families with 2+ members                            ${multi.length}`);
    console.log(`⚠ INTERNALLY SPLIT on tense vs reduced               ${split.length}  (${split.reduce((n, [, m]) => n + m.length, 0)} words)`);
    if (process.argv.includes("--print"))
        for (const [k, m] of split.sort((a, b) => (a[0] < b[0] ? -1 : 1)))
            console.log(`  ${k}\n      ${m.map((x) => `${x.word} ${x.vowel}`).join("   ")}`);
}
