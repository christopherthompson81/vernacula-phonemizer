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
/**
 * ⚠ `IY2` COUNTS TOO, AND LEAVING IT OUT HID FAMILY MEMBERS ON THE VERY AXIS UNDER REPAIR. `precipitous`
 * and `precipitousness` are reduced while `precipitously` is `P R IY2` — a SECONDARY-stressed tense
 * prefix, which is the same tense/reduced contrast wearing a different digit. A first pass loaded only
 * `IY0` and therefore reported `pre:precipitou` as fixed while the third member stayed split.
 * ⚠ `IY1` IS NOT HERE: a PRIMARY-stressed prefix is a different word shape (`preface`), not this class.
 */
const TENSE = new Set(["IY0", "IY2"]);
const REDUCED = new Set(["IH0", "AH0"]);
export const isTense = (v: string): boolean => TENSE.has(v);

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
        if (!TENSE.has(v) && !REDUCED.has(v)) continue;
        out.push({ word: w!, phones, prefix, vowel: v });
    }
    return out;
}

/** ⚠ A LOOP WITH A FLOOR OF prefix + 4. One strip lands elsewhere depending on the suffix, which is what
 *  split `precarious` from `precariousness`; and without the floor `revivalist` reaches `revivify`. */
/**
 * ⚠ A MISSING SUFFIX ORPHANS A PARADIGM MEMBER, AND AN ORPHAN IS WORSE THAN A MISS. Without `ist` and
 * `ative` the first pass moved `prescriptive`, `prescriptively` and `prescriptiveness` to reduced and
 * left `prescriptivist` tense — so a change whose every note reads "family consistency" INTRODUCED a
 * split that did not exist before it. Same for `preventative`/`preventatives` against `prevent`.
 * The `familiesStayConsistent` check below is the guard that now makes that impossible to ship.
 */
const SUFFIXES = ["ativeness", "atives", "ative", "ists", "ivity", "ology", "ness", "ment", "ions",
    "ing", "ers", "est", "ion", "ive", "ial", "ist", "ies", "ed", "es",
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

/**
 * ⚠ THIS CANNOT FIRE WHEN CALLED ON A WORD'S OWN STEM, AND AN EARLIER COMMENT HERE CLAIMED IT WAS "the
 * fourth definition's whole content". Measured: 0 of 2,979 words are filtered, because `familyKey`
 * derives the stem from the word by stripping exactly this suffix list in exactly this order, so the
 * remainder always strips back to "". **What actually keeps `debar` from swallowing `debark` is the
 * `prefix + 4` FLOOR in `familyKey`** — they key to `de:debar` and `de:debark` and never meet.
 * ⚠ SO DO NOT RELAX THE FLOOR ON THE BELIEF THAT THIS IS THE BACKSTOP. It is kept because it is the
 * right test for a member against a DIFFERENT word's stem, which is how the family validation below
 * uses it — comparing every member against the family's shortest member rather than against itself.
 */
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

/**
 * ⚠ THE GUARD, AND IT CHECKS PAIRS RATHER THAN FAMILIES BECAUSE FAMILIES HAVE A HOLE. A first version
 * asked only that every family with 2+ members stay internally consistent — and `prescriptivist` keys to
 * a family of ONE (`pre:prescriptiv`, because `ist` strips before `ive` can), so it could never be
 * reported as split while `prescriptive`/`prescriptively`/`prescriptiveness` moved away from it. A
 * one-member family cannot be inconsistent, which is exactly how an orphan hides.
 *
 * So the test is over PAIRS: for every word this change touches, any other prefix word that is a
 * plausible inflection of it — or of which it is one — must end on the same side of the contrast.
 * A change whose every note reads "family consistency" must not create a split anywhere.
 */
/**
 * ⚠ AND IT HAS TO SEE THROUGH THE e-DROP, WHICH DEFEATED THE FIRST THREE VERSIONS OF THIS CHECK.
 * `prescriptivist` is `prescriptiv` + `ist`, so it does NOT start with `prescriptive` — a bare
 * `startsWith` reports them unrelated and the orphan goes on hiding. Both forms are tried with a
 * trailing `e` removed, which is the same allowance `familyKey` makes when it strips one.
 */
export function relatedForms(a: string, b: string): boolean {
    const cut = (x: string): string[] => (x.endsWith("e") ? [x, x.slice(0, -1)] : [x]);
    for (const x of cut(a)) for (const y of cut(b))
        if (isPlausibleInflection(x, y) || isPlausibleInflection(y, x)) return true;
    return false;
}

export function orphansAfter(words: Word[], after: Map<string, string>): string[] {
    const bad: string[] = [];
    const val = (w: Word): "T" | "R" => (isTense(after.get(w.word) ?? w.vowel) ? "T" : "R");
    const touched = words.filter((w) => after.has(w.word));
    for (const c of touched)
        for (const o of words) {
            if (o.word === c.word || o.prefix !== c.prefix) continue;
            const related = relatedForms(o.word, c.word);
            if (related && val(o) !== val(c)) bad.push(`${c.word} ${val(c)} vs ${o.word} ${val(o)}`);
        }
    return [...new Set(bad)];
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
    const split = multi.filter(([, m]) => new Set(m.map((x) => (isTense(x.vowel) ? "T" : "R"))).size > 1);
    console.log(`de-/re-/pre- words with an unstressed prefix vowel   ${words.length}`);
    console.log(`families with 2+ members                            ${multi.length}`);
    console.log(`⚠ INTERNALLY SPLIT on tense vs reduced               ${split.length}  (${split.reduce((n, [, m]) => n + m.length, 0)} words)`);
    if (process.argv.includes("--print"))
        for (const [k, m] of split.sort((a, b) => (a[0] < b[0] ? -1 : 1)))
            console.log(`  ${k}\n      ${m.map((x) => `${x.word} ${x.vowel}`).join("   ")}`);
}
