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
 * ⚠ AND SINCE #1360 THERE IS A SECOND WAY TO EARN A ROW, which is the one that scales: a COMPOUND
 * boundary at the site in `en-morph-boundary.tsv`. Wiktionary states the morpheme split AND its kind,
 * and the kind is what three home-grown discriminators could not recover — measured on the referee-
 * labelled sites, `compound` is 12 for 12 with no false positives and not one of the 17 known
 * assimilating words is a compound (`pan-chromatic` and `syn-carpous` are a prefix and a confix
 * boundary and they assimilate; `pan·cake` and `corn·cob` are compounds and do not).
 * ⚠ `humankind` IS NOT AN EXAMPLE OF EITHER, and naming it as one was a second version of the same
 * mistake: its boundary is a SUFFIX (`-kind`) and it is row 33 below, shipping `hjuːmənkaᶦnd` with an
 * [n] on referee evidence. A suffix boundary is simply not evidence about this process in either
 * direction — only `compound` is — which is why the referee path exists underneath.
 * Of the table's 161 non-compound N+velar boundaries, 155 are prefixes, 3 confixes and 3 suffixes.
 * ⚠ IT IS A CASCADE AND NOT A REPLACEMENT. `vanguard`, `leningrad` and `cancan` are referee-confirmed
 * seams with NO Wiktionary template — from *avant-garde* in `vanguard`'s case, which is why no split
 * exists — so the referee evidence below stays as the recall patch. Neither source alone is the table.
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

/**
 * The referee's own verdict at the site: the nasal it writes before a /k/ or /ɡ/, or null if its
 * readings disagree with each other or it has no such site at all.
 *
 * ⚠ IT READS THE FIRST SITE AND SPEAKS FOR ALL OF THEM, which is wrong in principle and empty in fact:
 * the only dictionary words with TWO N+velar sites are `inconclusive`/`-ly`/`-ness`, and all three are
 * protected by the prefix guard before they reach here. Left as-is rather than fixed speculatively —
 * but a word with two sites whose referee disagrees between them would be mis-licensed, so if this file
 * ever grows a multi-index row, fix this first.
 * ⚠ `ɡ` IS U+0261 AND ASCII `g` IS NOT ACCEPTED. Checked rather than assumed: the phone columns of all
 * four referee files contain zero ASCII `g`.
 */
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
 * `kalan`+`choe`. `g2p-common.txt` is the same frequency gate the OOV compound splitter uses.
 * ⚠ AND THE LENGTH FLOOR IS 3, NOT 4, WHICH IS NOT A ROUNDING CHOICE. At 4 the gate dropped `corncob`
 * — `corn`+`cob`, Moby `kɔɹnkɑb`, as plain a seam as the file contains — while still admitting
 * `agincourt` (`court` is common) and `mankato` (`kato` is in the frequency list, which carries
 * surnames freely). So the floor was costing a true positive and buying neither of the two rows it was
 * supposed to stop. At 3 it admits `corncob` and nothing else; the two survivors are handled by being
 * NAMED rather than by a threshold that does not separate them. Both have the right answer on
 * independent authority, which is how a loose gate passes a spot check — see the census below.
 */
const transparentCompound = (w: string): boolean => {
    // ⚠ THE SPLIT IS NOT TIED TO THE PHONE INDEX IT LICENSES — any spelled `n` that divides the word
    // licenses every site in it. Harmless while every row has one index (see `verdict` above); it becomes
    // wrong at the same moment that does.
    for (const m of w.matchAll(/n(?=[ckgq])/gu)) {
        const i = m.index + 1;
        const head = w.slice(0, i), tail = w.slice(i);
        if (i >= 3 && tail.length >= 3 && dict.has(head) && common.has(tail)) return true;
    }
    return false;
};

/**
 * Words with a COMPOUND boundary at a given phone index, from `en-morph-boundary.tsv`.
 * ⚠ ONLY `compound`. A `prefix`, `suffix` or `confix` boundary is a real boundary and blocks other
 * processes (the geminate collapse, for one) but does NOT block velar assimilation — that is the whole
 * finding, and reading this file as "any boundary blocks" would ship `panchromatic` and `Anglophile`
 * with an [n] they have never had.
 */
const compoundAt = new Map<string, Set<number>>();
try {
    for (const line of readFileSync(join(dirname(fileURLToPath(import.meta.url)), "en-morph-boundary.tsv"), "utf8").split("\n")) {
        if (!line || line.startsWith("#")) continue;
        const tab = line.indexOf("\t");
        if (tab <= 0) continue;
        const set = new Set<number>();
        for (const f of line.slice(tab + 1).trim().split(",")) {
            const [i, k] = f.split(":");
            if (k === "compound" && i && Number.isInteger(+i)) set.add(+i);
        }
        if (set.size) compoundAt.set(line.slice(0, tab), set);
    }
} catch (e) {
    // ⚠ ENOENT ONLY. The boundary table is generated from a 3 GB dump that is not in the repo, so a
    // checkout without it must still rebuild the referee-backed rows rather than fail.
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    console.log("(no en-morph-boundary.tsv — referee evidence only)");
}

const rows: [string, number[], string][] = [];
let noSite = 0, protectedByPrefix = 0, refereeSaysVelar = 0, split = 0, thin = 0, byCompound = 0;
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
    // ⚠ A REFEREE THAT SAYS [ŋ] OUTRANKS THE SPLIT, even a compound one. Wiktionary states morphology;
    // the referees state pronunciation, and where they are unanimous against the morphology they win.
    if (named.length && named.every((v) => v === "ŋ")) { refereeSaysVelar++; continue; }
    const comp = compoundAt.get(w);
    // ⚠ `i + 1`, NOT `i`. The boundary table indexes the FIRST PHONE AFTER the boundary and `idx` holds
    // the position of the NASAL, so `rain·coat` is R EY1 N | K OW2 T — nasal at 2, boundary at 3. Matching
    // on `i` finds nothing at all and looks exactly like a source with no coverage.
    const byComp = comp ? idx.filter((i) => comp.has(i + 1)) : [];
    if (byComp.length && !named.some((v) => v !== "n")) {
        byCompound++;
        rows.push([w, byComp, named.length ? `compound+${refs.filter((_, k) => seen[k] !== null).map(([n]) => n).join("+")}` : "compound"]);
        continue;
    }
    if (!named.length) { thin++; continue; }
    if (named.some((v) => v !== "n")) { split++; continue; }
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
        // ⚠ BOTH HALVES OF THE SITE, not just the nasal — `test/en-nasal-seam.test.ts` asserts that every
        // listed index is an N followed by a K or G, so checking only the N here would let the builder
        // emit a row its own gate test rejects. No such form exists today; the check is what keeps it so.
        if (!p) continue;
        const stillASite = (i: number) => {
            const a = p[i]?.replace(/[0-2]$/u, ""), b = p[i + 1]?.replace(/[0-2]$/u, "");
            return a === "N" && (b === "K" || b === "G");
        };
        if (!idx.every(stillASite)) continue;
        have.add(f);
        rows.push([f, idx, "inflection of " + w]);
    }
}
rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));

console.log(`dictionary words with an N+velar site the converter would assimilate:`);
console.log(`  protected by a transparent prefix already: ${protectedByPrefix}`);
console.log(`  a COMPOUND boundary at the site  → A ROW:  ${byCompound}`);
console.log(`  every covering referee says [n]  → A ROW:  ${rows.length - byCompound}`);
console.log(`  every covering referee says [ŋ] (a CMUdict slip the rule repairs): ${refereeSaysVelar}`);
console.log(`  referees split, or no referee, or single-source and not a transparent compound: ${split + thin}`);
console.log(`  (words with no N+velar site at all: ${noSite})`);
// ⚠ THE PER-ROW PROVENANCE IS PRINTED AND NOT SHIPPED, because the TSV's value column is the index list
// and a third column would have to be parsed by three separate loaders. Printed because the SHAPE of the
// evidence is the thing a reader needs to judge the table, and a census says it in one line.
const census = new Map<string, number>();
for (const [, , src] of rows) census.set(src, (census.get(src) ?? 0) + 1);
console.log(`\nby evidence:`);
for (const [src, n] of [...census].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${src}`);
// ⚠ THE SINGLE-SOURCE ROWS ARE THE ONES TO READ, and two of them are not compounds at all: `agincourt`
// (`agin`+`court`) and `mankato` (`kato` is in the frequency list — it carries surnames). Both have the
// right answer on independent authority, so they stay; they are named here because the gate that let
// them in cannot tell them from a real seam, and the next reader should not have to rediscover that.
const single = rows.filter(([, , src]) => !src.includes("+") && !src.startsWith("inflection"));
console.log(`\nsingle-source rows (${single.length}), admitted on a seam visible in the spelling:`);
console.log(`  ${single.map(([w]) => w).join(" ")}`);

if (!write) { console.log("\n(run with --write to rewrite the table)"); process.exit(0); }
const header = [
    "# NASAL SEAM SLOTS — which `N` before a `K`/`G` must NOT assimilate to [ŋ]. Most are a COMPOUND",
    "# SEAM (`pan·cake`, `rain·coat`, `man·kind`, `turn·key`, `Lenin·grad`) rather than a syllable",
    "# contact, which is what the name says.",
    "#",
    "# ⚠ BUT THE BAR IS THE REFEREES, NOT THE MORPHOLOGY, and the difference is visible in the file:",
    "# `hangul`, `melancholy` and `quincuncial` are here and are not compounds of anything. A row means",
    "# `every referee that covers this word writes [n] here`. Do not read the filename as a claim about",
    "# a word's structure, and do not add a row because a word LOOKS like a compound.",
    "#",
    "# ⚠ AND IT IS NOT A LIST OF EVERY SEAM. `Vancouver`, `Dunkirk`, `plainclothes`, `songbook` and some",
    "# three hundred surnames are seams with no row, because no referee arbitrates them — they still",
    "# assimilate. See the provenance file.",
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
