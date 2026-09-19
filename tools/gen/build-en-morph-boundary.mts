/**
 * Build `en-morph-boundary.tsv` — where a dictionary word's MORPHEME BOUNDARIES fall, in PHONE indices,
 * and what KIND of boundary each one is.
 *
 * ⚠ THE KIND IS THE WHOLE POINT, and it is what this repo could not derive for itself. Compounding,
 * prefixing and suffixing are the same operation — concatenate two morphemes — but their phonological
 * consequences differ per process, and the difference is not recoverable from spelling:
 *
 *                            geminate collapse   velar assimilation   compound stress
 *   compound  pan·cake             blocked            blocked            fore-stress
 *   prefix    pan-chromatic        blocked          NOT blocked        stem keeps primary
 *   confix    Anglo·phile          blocked          NOT blocked        stem keeps primary
 *   suffix    thin·ness            blocked              n/a            stem keeps primary
 *
 * `pan·cake` against `pan-chromatic` is the pair that defeated three home-grown discriminators — a
 * spelling splitter, dictionary-membership splitting, and a morpheme list mined out of referee labels
 * (Run 27 of docs/investigations/en/en_moby_source_audit_investigation.md). Measured on the referee-
 * labelled velar sites, the `compound` label is 12 for 12 with no false positives and not one of the 17
 * known assimilating words is a compound. See Run 34.
 *
 * SOURCE: English Wiktionary via kaikki.org (wiktextract), CC BY-SA 4.0 / GFDL. Only the ETYMOLOGY
 * TEMPLATE arguments are read — the morpheme split and its kind — and only for words our own dictionary
 * already contains. No definitions, no pronunciations, nothing that could make this circular with a
 * referee. See en-morph-boundary.PROVENANCE.md.
 *
 *   npx tsx tools/gen/build-en-morph-boundary.mts --kaikki <english.jsonl>
 *   npx tsx tools/gen/build-en-morph-boundary.mts --kaikki <english.jsonl> --write
 */
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA = join(REPO, "data", "languages", "english");
/** ⚠ THE OUTPUT LIVES UNDER tools/, NOT data/. It is CC-BY-SA share-alike and has NO runtime consumer —
 *  only `build-en-nasal-seam.mts` reads it — so shipping it inside the `vernacula-phonemizer-data`
 *  package would put share-alike bytes in the runtime distributable and change the licence stratum of
 *  an English data directory that is otherwise CMUdict/public-domain. Same shape as
 *  `tools/gen/de-consonant-curated.tsv`. See LICENSES/PROVENANCE.md §3. */
const OUT = join(REPO, "tools", "gen");
// ⚠ `--kaikki <path>`, matching build-cs/cy/th-kaikki-dict.mts. The dump is 3.0 GB and is not in the repo.
const kArg = process.argv.indexOf("--kaikki");
const KAIKKI = kArg > 0 ? (process.argv[kArg + 1] ?? "") : "";
if (!KAIKKI) throw new Error("pass --kaikki <kaikki.org-dictionary-English.jsonl>");
const write = process.argv.includes("--write");

/** Etymology templates that state a morpheme split. */
const TPL = new Set(["compound", "af", "affix", "surf", "com", "blend", "univerbation",
                     "ety", "prefix", "suffix", "confix", "con"]);
/**
 * ⚠ THE LANGUAGE CODE IS DROPPED BY VALUE, NOT BY SHAPE, and the first version dropped it by shape:
 * any 2-3 letter arg. English morphemes are frequently 2-3 letters, so that silently deleted `cob` from
 * `corn·cob`, `pan` from `pan·cake`, `gun`, `key`, `man`, `ear`, `bar` — every short element, which is
 * to say most of the compounds worth having. These templates are only ever read off English entries, so
 * the only code that appears is `en`.
 */
const isLangCode = (v: string) => v === "en";

/**
 * The parts of a template, in order.
 *
 * ⚠ A LEADING HYPHEN MARKS A SUFFIX EXACTLY AS A TRAILING ONE MARKS A PREFIX, and the first version of
 * this dropped every arg beginning with `-`. That deletes the second element of EVERY suffix
 * decomposition, which made the `-ness`/`-ly` class look like a coverage hole needing its own rule when
 * it is fully present in the source. Only `:`/`+` control values and bare language codes are dropped.
 */
function partsOf(t: { args?: Record<string, string> }): { parts: string[]; stated?: Kind } {
    const a = t.args ?? {};
    const out: string[] = [];
    let stated: Kind | undefined;
    for (let k = 1; k <= 8; k++) {
        const v = a[String(k)];
        if (!v || typeof v !== "string") continue;
        // ⚠ THE CONTROL ARG IS THE KIND, AND THROWING IT AWAY DEFAULTED EVERYTHING TO `compound`.
        // `{{surf}}` states the kind in arg 1, BEFORE the language code — `incomparable` is
        // `{1:'+pre', 2:'en', 3:'in', 4:'comparable'}` — and the split it gives is unhyphenated, so
        // with the control dropped `kindOf` saw two bare morphemes and fell through to its default.
        // 17 `+pre` rows and 46 `+suf` rows shipped as `compound`. `pancake` was right by luck.
        if (v[0] === "+") { stated = STATED[v.slice(1)] ?? stated; continue; }
        if (v[0] === ":") { stated = STATED[v.slice(1)] ?? stated; continue; }
        if (v.includes(":")) continue;              // `la:ātricapillus` — a cognate arg, not a part
        if (isLangCode(v)) continue;
        out.push(v);
    }
    return { parts: out, ...(stated ? { stated } : {}) };
}
/** The kind a `+`/`:` control arg states outright, which always beats the hyphen heuristic. */
const STATED: Record<string, Kind> = {
    com: "compound", compound: "compound",
    pre: "prefix", prefix: "prefix",
    suf: "suffix", suffix: "suffix",
    con: "confix", confix: "confix", af: "affix-unknown" as Kind,
};

type Kind = "compound" | "prefix" | "suffix" | "confix";
/**
 * ⚠ `compound` IS THE DEFAULT AND THAT MAKES EVERY GAP HERE A FALSE COMPOUND — the one label that
 * changes engine output. A stated control arg wins; then the template name; then the hyphens.
 * ⚠ `con` IS THE `confix` SHORTCUT and was in the template set but not here, so `tri·angle` and
 * `pre·fix` shipped as compounds.
 */
const kindOf = (name: string, parts: string[], stated?: Kind): Kind => {
    if (stated && stated !== ("affix-unknown" as Kind)) return stated;
    if (name === "confix" || name === "con") return "confix";
    if (name === "prefix" || parts.some((p) => p.replace(/<[^>]*>/gu, "").endsWith("-"))) return "prefix";
    if (name === "suffix" || parts.some((p) => p.replace(/<[^>]*>/gu, "").startsWith("-"))) return "suffix";
    return "compound";
};
const clean = (p: string) => p.replace(/<[^>]*>/gu, "").replace(/[-‐]/gu, "").toLowerCase().trim();

const dict = new Map<string, string[]>();
for (const l of readFileSync(join(DATA, "g2p-dict.tsv"), "utf8").split("\n")) {
    const [w, ph] = l.split("\t");
    if (w && ph && /^[a-z]+$/u.test(w)) dict.set(w, ph.split(" "));
}
const bare = (p: string) => p.replace(/[0-2]$/u, "");

/** word → the split we accepted, so a second sense cannot silently overwrite the first. */
const found = new Map<string, { parts: string[]; kind: Kind }>();
let lines = 0, considered = 0;
const rl = createInterface({ input: createReadStream(KAIKKI, { encoding: "utf8" }), crlfDelay: Infinity });
for await (const line of rl) {
    lines++;
    if (!line || line[0] !== "{") continue;
    if (!line.includes("etymology_templates")) continue;           // cheap prefilter, 3 GB of JSON
    let d: { word?: string; lang_code?: string; etymology_templates?: { name?: string; args?: Record<string, string> }[] };
    try { d = JSON.parse(line); } catch { continue; }
    if (d.lang_code !== "en" || !d.word) continue;
    const w = d.word.toLowerCase();
    if (!dict.has(w) || found.has(w)) continue;
    considered++;
    for (const t of d.etymology_templates ?? []) {
        if (!t.name || !TPL.has(t.name)) continue;
        const { parts: raw, stated } = partsOf(t);
        if (raw.length < 2) continue;
        found.set(w, { parts: raw, kind: kindOf(t.name, raw, stated) });
        break;
    }
}

/**
 * Turn a morpheme split into PHONE indices, and drop anything that does not line up exactly.
 *
 * ⚠ THIS IS THE PRECISION GATE, not a formatting step. Two independent checks must both pass: the
 * cleaned parts must CONCATENATE to the headword (so `book`+`keeper` is kept and an etymology with an
 * elided linking vowel is dropped), and the first element's own dictionary phones must be a PREFIX of
 * the word's. Measured on the geminate evidence set, alignment holds for 102 of 109 checkable rows; the
 * 7 that fail are two-step derivations (`guile·less·ly`) where the outer split is the one Wiktionary
 * states, and recursion below recovers them.
 */
const rows: [string, [number, Kind][]][] = [];
let noConcat = 0, noPiece = 0, noAlign = 0;
const boundaries = (w: string, depth = 0): [number, Kind][] => {
    const e = found.get(w);
    if (!e || depth > 2) return [];
    const parts = e.parts.map(clean).filter(Boolean);
    if (parts.length < 2 || parts.join("") !== w) { if (!depth) noConcat++; return []; }
    const head = parts[0]!;
    const hp = dict.get(head);
    if (!hp) { if (!depth) noPiece++; return []; }
    const wp = dict.get(w)!;
    const n = hp.length;
    if (n >= wp.length || !hp.every((p, i) => bare(p) === bare(wp[i]!))) { if (!depth) noAlign++; return []; }
    // ⚠ RECURSE ON THE HEAD, because Wiktionary states the OUTERMOST split and the boundary a caller
    // wants may be one level in: `guilelessly` is `guileless`+`ly`, and its geminate is at `guile|less`.
    return [...boundaries(head, depth + 1), [n, e.kind]];
};
for (const w of found.keys()) {
    const b = boundaries(w);
    if (b.length) rows.push([w, b]);
}
rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));

const byKind = new Map<Kind, number>();
for (const [, bs] of rows) for (const [, k] of bs) byKind.set(k, (byKind.get(k) ?? 0) + 1);
console.log(`kaikki lines ${lines}, English entries whose headword we carry ${considered}`);
console.log(`  a stated morpheme split:            ${found.size}`);
console.log(`  parts do not concatenate to the word: ${noConcat}`);
console.log(`  first element not in our dictionary:  ${noPiece}`);
console.log(`  phones do not align at the boundary:  ${noAlign}`);
console.log(`  → ROWS: ${rows.length}`);
for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`      ${k.padEnd(9)} ${n}`);

if (!write) { console.log("\n(run with --write to rewrite the table)"); process.exit(0); }
const header = [
    "# MORPHEME BOUNDARIES — where a word's morphemes meet, in PHONE indices, and what KIND of boundary",
    "# each one is. The index is the position of the FIRST phone after the boundary.",
    "#",
    "# ⚠ THE KIND IS THE POINT. Compounding, prefixing and suffixing are the same operation, but their",
    "# phonological consequences differ per process: a compound seam blocks velar assimilation and a",
    "# neoclassical prefix does not (`pan·cake` against `pan-chromatic`). A consumer decides which kinds",
    "# it respects; this file does not decide for it.",
    "#",
    "# Generated by tools/gen/build-en-morph-boundary.mts from English Wiktionary via kaikki.org",
    "# (CC BY-SA 4.0 / GFDL) — etymology templates only. See en-morph-boundary.PROVENANCE.md.",
    "#",
    "# word <TAB> comma-separated <phone index>:<compound|prefix|suffix|confix>",
].join("\n");
writeFileSync(join(OUT, "en-morph-boundary.tsv"),
    `${header}\n${rows.map(([w, b]) => `${w}\t${b.map(([i, k]) => `${i}:${k}`).join(",")}`).join("\n")}\n`);
console.log(`\nwrote ${rows.length} rows`);
