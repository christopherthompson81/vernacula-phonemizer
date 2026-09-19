/**
 * Build `en-nasal-seam.tsv` — the dictionary words where an `N` before `K`/`G` must NOT assimilate to
 * [ŋ], because the boundary between them is a COMPOUND SEAM rather than a syllable contact.
 *
 * ⚠ THIS FILE EXISTS BECAUSE THE RULE IS NOT LEARNABLE, and that was measured rather than assumed.
 * `makeArpabetToIpa` assimilates `N`+velar unless a TRANSPARENT PREFIX intervenes, which repairs ~33
 * CMUdict slips (`anglophile`, `ankh`, `gangrene`, `drinkable`) and destroys ~298 CMUdict statements
 * (`pancake`, `raincoat`, `mankind`, `vancouver`). Two discriminators were built and both failed:
 *   • a SPLITTER (does the word divide at the boundary into two dictionary words?) is 31:2 on the
 *     labelled seams but also claims `benghazi`, `hangul`, `pangloss`, `panchromatic`, `vainglorious`;
 *   • a MORPHEME LIST derived from the labelled data has `corn` 3, `green` 3, `pan` 3, `man` 2, `on` 2,
 *     `turn` 2 and then thirty morphemes with ONE attestation each — a word list wearing a rule's
 *     clothes, and `pan` alone reaches `pancreas`, `pangloss` and `panchromatic`.
 * The converter's own comment guessed this ("the real discriminator is PREFIXED versus COMPOUND, which
 * needs a morphological inventory this module does not have"). It is right. So this is LEXIS, and it
 * ships the way `en-syllabic.tsv` ships lexis: a per-word table of PHONE INDICES injected into the
 * data-free converter. docs/investigations/en/en_moby_source_audit_investigation.md, Run 27.
 *
 * ⚠ A ROW IS EARNED, NOT ASSERTED. It needs the dictionary to say `N`, the engine to be about to say
 * [ŋ] anyway, and EVERY referee that covers the word to say [n] — with at least two of them covering it
 * where the word is not a plain compound of two dictionary words. Single-source rows are admitted only
 * for a transparent compound, where the second element is itself a dictionary word ≥3 letters: there the
 * seam is visible in the spelling and one careful transcription is enough to confirm it.
 *
 * ⚠ THE en-GB REFEREE IS ADMISSIBLE HERE AND NOWHERE ELSE IN THE ENGLISH AUDIT. [ŋ] versus [n] is a
 * CONSONANT, so it is untouched by the RP delta — non-rhoticity and the RP vowel set cannot reach it.
 * That makes wikipron-UK a genuine second source for a GenAm lexical fact, and it is the only reason
 * this table has two-source backing at all.
 *
 *   npx tsx tools/gen/build-en-nasal-seam.mts            print the census
 *   npx tsx tools/gen/build-en-nasal-seam.mts --write    rewrite the table
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA = join(REPO, "data", "languages", "english");
const REF = join(REPO, "tools", "referee-eval", "referees");
const write = process.argv.includes("--write");

/** Mirrors `TRANSPARENT_PREFIX` in src/languages/english/englishArpabet.ts — a word the converter already
 *  protects needs no row here, and a row for one would be dead weight the next reader has to re-derive. */
const TRANSPARENT_PREFIX = /^(?:dis|re|mis|over|under|pre|post)?(?:un|in|non|con|en|syn|down|trans)/u;

const readRef = (f: string): Map<string, string[]> => {
    const m = new Map<string, string[]>();
    for (const l of readFileSync(join(REF, f), "utf8").split("\n")) {
        if (!l || l.startsWith("#")) continue;
        const a = l.split("\t");
        if (a.length < 2 || !a[0] || !a[1]) continue;
        m.set(a[0]!.toLowerCase(), a.slice(1).filter(Boolean).map((s) => s.replace(/\s+/gu, "")));
    }
    return m;
};
const refs: [string, Map<string, string[]>][] = [
    ["moby", new Map([...readRef("en.moby-lexicon.tsv"), ...readRef("en.moby-oov.tsv")])],
    ["us", readRef("en.wikipron-eng-latn-us-broad.tsv")],
    ["uk", readRef("en-gb.wikipron-uk.tsv")],
];

/** The referee's own verdict at the site: the nasal it writes before a /k/ or /ɡ/, or null if its
 *  readings disagree with each other or it has no such site at all. */
const verdict = (reads: string[]): string | null => {
    const v = new Set<string>();
    for (const r of reads) {
        const m = r.match(/([nŋ])(?=[kɡ])/u);
        if (m) v.add(m[1]!);
    }
    return v.size === 1 ? [...v][0]! : null;
};

const dict = new Map<string, string[]>();
for (const l of readFileSync(join(DATA, "g2p-dict.tsv"), "utf8").split("\n")) {
    const [w, ph] = l.split("\t");
    if (w && ph && /^[a-z]+$/u.test(w)) dict.set(w, ph.split(" "));
}

const common = new Set(
    readFileSync(join(DATA, "g2p-common.txt"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean),
);

/**
 * A transparent compound: the spelling divides at the seam into two dictionary words whose SECOND is a
 * COMMON word of four letters or more. NOT a discriminator on its own — see the header — only a licence
 * to accept a single source, so the gate has to be tight.
 *
 * ⚠ THE `common` GATE IS WHAT MAKES IT TIGHT, and it was added after reading the rows it let through.
 * Dictionary membership alone is nearly free — CMUdict carries every surname — so `kalanchoe` parsed as
 * `kalan`+`choe` and `agincourt` as `agin`+`court`, neither of which is a compound. Both happened to
 * have the right answer, which is how a loose gate survives a spot check. `g2p-common.txt` is the same
 * frequency gate the OOV compound splitter uses.
 */
const transparentCompound = (w: string): boolean => {
    for (const m of w.matchAll(/n(?=[ckgq])/gu)) {
        const i = m.index + 1;
        const head = w.slice(0, i), tail = w.slice(i);
        if (i >= 3 && tail.length >= 4 && dict.has(head) && common.has(tail)) return true;
    }
    return false;
};

const rows: [string, number[], string][] = [];
let noSite = 0, protectedByPrefix = 0, refereeSaysVelar = 0, split = 0, thin = 0;
for (const [w, p] of dict) {
    const idx: number[] = [];
    for (let i = 0; i + 1 < p.length; i++) {
        const b = p[i]!.replace(/[0-2]$/u, ""), n = p[i + 1]!.replace(/[0-2]$/u, "");
        if (b === "N" && (n === "K" || n === "G")) idx.push(i);
    }
    if (!idx.length) { noSite++; continue; }
    // The converter's own guard, reproduced: a site it already protects needs no row.
    if (idx.every((i) => i <= 6) && TRANSPARENT_PREFIX.test(w)) { protectedByPrefix++; continue; }
    const seen = refs.map(([, m]) => { const r = m.get(w); return r ? verdict(r) : null; });
    const named = seen.filter((v): v is string => v !== null);
    if (!named.length) { thin++; continue; }
    if (named.some((v) => v !== "n")) { named.every((v) => v === "ŋ") ? refereeSaysVelar++ : split++; continue; }
    if (named.length < 2 && !transparentCompound(w)) { thin++; continue; }
    const src = refs.filter((_, k) => seen[k] !== null).map(([n]) => n).join("+");
    rows.push([w, idx, src]);
}
// ⚠ INFLECTIONS COME ALONG, because a seam is a property of the STEM and no suffix can move it. Without
// this the table shipped `pancake` but not `pancaked`, `sunglass` but not `sunglasses` — the referee
// happened to cover one form and not the other, and the engine would have said the two words differently.
// The site index is unchanged by a suffix, so the stem's indices are simply reused.
const have = new Set(rows.map(([w]) => w));
for (const [w, idx] of [...rows]) {
    for (const suffix of ["s", "es", "d", "ed", "ing", "er", "ers"]) {
        const f = w + suffix;
        if (have.has(f)) continue;
        const p = dict.get(f);
        if (!p || !idx.every((i) => p[i]?.replace(/[0-2]$/u, "") === "N")) continue;
        have.add(f);
        rows.push([f, idx, "inflection of " + w]);
    }
}
rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));

console.log(`dictionary words with an N+velar site the converter would assimilate:`);
console.log(`  protected by a transparent prefix already: ${protectedByPrefix}`);
console.log(`  every covering referee says [n]  → A ROW:  ${rows.length}`);
console.log(`  every covering referee says [ŋ] (a CMUdict slip the rule repairs): ${refereeSaysVelar}`);
console.log(`  referees split, or no referee, or single-source and not a transparent compound: ${split + thin}`);
console.log(`  (words with no N+velar site at all: ${noSite})`);

if (!write) { console.log("\n(run with --write to rewrite the table)"); process.exit(0); }
const header = [
    "# NASAL SEAM SLOTS — which `N` before a `K`/`G` must NOT assimilate to [ŋ], because the boundary",
    "# between them is a COMPOUND SEAM (`pan·cake`, `rain·coat`, `man·kind`, `Van·couver`) and not a",
    "# syllable contact.",
    "#",
    "# Generated by tools/gen/build-en-nasal-seam.mts. See that file for the two discriminators that were",
    "# built and failed, and for why this has to be a word list rather than a rule.",
    "#",
    "# SOURCES: Moby Pronunciator II, wikipron eng_latn_us broad, wikipron UK — a row needs EVERY referee",
    "# that covers the word to write [n], and either two of them or a seam visible in the spelling.",
    "#",
    "# word <TAB> comma-separated indices into the g2p-dict.tsv ARPABET row",
].join("\n");
writeFileSync(join(DATA, "en-nasal-seam.tsv"), `${header}\n${rows.map(([w, i]) => `${w}\t${i.join(",")}`).join("\n")}\n`);
console.log(`\nwrote ${rows.length} rows to en-nasal-seam.tsv`);
