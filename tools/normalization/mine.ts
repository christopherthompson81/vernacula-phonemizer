/**
 * MINE a normalization hard-set from running text (#585) — build the corpus the diff gate needs for a
 * language that has no FLEURS corpus.
 *
 * WHY SELECTION AND NOT A DUMP. An exhaustive dump is the wrong target: most sentences exercise nothing the
 * normalizer does, and size is not the property we want. The property we want is COVERAGE of the pattern
 * inventory below, which is not invented here — it is the empirical shape of the 338 numbered rules across
 * the 37 languages already treated under #562. Each cell of that inventory exists because a real corpus
 * instance broke an engine. So the corpus is complete when every cell holds a few real examples, which
 * gives a stopping criterion that does not depend on how much text was fetched.
 *
 * ⚠ THE SELECTORS ARE NOT ASCII-ONLY, AND THIS IS THE WHOLE TRAP. `\d` under the `u` flag matches ASCII
 * 0-9 and nothing else, so a selector built on it silently returns an empty hard-set for Burmese (၀-၉),
 * Devanagari (०-९), Thai (๐-๙), Bengali (০-৯) and Arabic-Indic (٠-٩) — i.e. for exactly the languages most
 * likely to need one, while appearing to work. Measured on Burmese: 902 digit-run matches, of which an
 * ASCII-only selector finds 14. Every pattern here uses `\p{Nd}`; `--audit-ascii` keeps the cost visible.
 * Same trap family as `\b` being ASCII-defined, which bit the initialism pass repeatedly.
 *
 * TWO TIERS, because selection destroys frequency. `--sample N` additionally emits a uniform random sample,
 * which the mined set cannot substitute for: on a selected set an instance count means nothing (the
 * Vietnamese `ây` gap was worth fixing because it was 22.1% OF THE CORPUS), and a hard-cases-only corpus
 * proves the rules fire without proving ordinary text still survives.
 *
 * ★ FILLING HOLES IS A TARGETED FETCH, NOT MORE RANDOM TEXT. The first Burmese run left six cells empty and
 * the natural reading — "Burmese does not write those" — was WRONG. A CirrusSearch `insource:` regex query
 * found 944 articles containing a native-digit percentage, 326 with a clock and 22 with a temperature; none
 * had surfaced because random sampling reads INTROS, and intros are biographical while percentages live in
 * demographics and results sections. So an empty cell is a query to run, not a fact about the language.
 * `fetch --fill` issues one `insource:` search per empty cell and pulls those articles' FULL text.
 *
 * Usage:
 *   npx tsx tools/normalization/mine.ts fetch --wiki my --out raw.txt [--random 500] [--digits ၀-၉]
 *        [--fill percent,clock,degrees] [--per-cell-articles 20] [--concurrency 4]
 *   npx tsx tools/normalization/mine.ts mine  --in raw.txt --out my.hard.tsv [--per-cell 8] [--sample 200]
 *        [--terminators "။"] [--terms months.txt] [--audit-ascii]
 */
import { readFileSync, writeFileSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DROPPABLE, LEAK_CLASSES, dropsIn, isAcceptedSilent, makeContribution } from "./defects.ts";
import { CELLS, type Cell } from "./cells.ts";

// NOT A CELL, though it was tried: "a bound suffix written with a SPACE" (Oromo #602, `bara 1945 tti`).
// Every per-sentence regex for it — `\p{Nd} \p{Ll}{1,4}` and narrower — also matches `5 km`, `3 hari`,
// every measure phrase in every language, so the cell reports COVERED everywhere and says nothing. The
// finding is real and general (playbook trap 15); the evidence for it is a corpus-level statistic — the
// same morpheme appearing both glued and detached — which is not the shape a cell can hold.

const asciiVariant = (re: RegExp): RegExp => new RegExp(re.source.replace(/\\p\{Nd\}/gu, "\\d"), re.flags);

export type SegmentMode = "sentence" | "paragraph";

/**
 * THE SPLITTER MUST NOT EAT THE ABBREVIATION DOT, and this destroyed three whole cells before it was
 * noticed. `.` is a sentence terminator, so `U.S.` split into `U.` and `S.` — each below the minimum
 * length, so both were discarded — and `dotted`, `era-marker` and `abbrev` reported ZERO across 786k
 * Burmese sentences while grepping the same text found 1437 dotted forms. Those are exactly the three
 * cells that depend on a period.
 *
 * Two defences. First, `paragraph` mode, which is the RIGHT segmentation whenever the target is the dot
 * itself: a sentence splitter has to decide what a period means, and that decision is the thing under
 * test, whereas a paragraph boundary needs no such decision. Second, in `sentence` mode the abbreviation
 * dots are protected before splitting and restored after. Under-splitting is harmless — the length cap
 * bounds a segment anyway — whereas over-splitting silently deletes the evidence.
 */
const DOT_SENTINEL = "";
const PROTECT: RegExp[] = [
    /(?<![\p{L}\p{M}])(?:\p{L}\.){2,}/gu, // U.S., M.Ö., ಕ್ರಿ.ಪೂ
    /(?<![\p{L}\p{M}])\p{L}\.(?=\s*[\p{Nd}\p{Lu}])/gu, // a lone initial: J. S. Bach, S. 42
    /(?<![\p{L}\p{M}])\p{L}{2,4}\.(?=\s+\p{Lu})/gu, // Dr. Smith
];

/** Bounds per mode. A fragment below the minimum carries no context for a rule to be judged in; above the
 *  maximum it is usually a table or list that survived plain-text extraction. */
const BOUNDS: Record<SegmentMode, [number, number]> = { sentence: [20, 400], paragraph: [40, 1200] };

export function segment(raw: string, mode: SegmentMode, terminators: string): string[] {
    const [min, max] = BOUNDS[mode];
    let text = raw;
    let pieces: string[];
    if (mode === "paragraph") {
        // The extractor writes one paragraph per line, so the boundary is already decided and no dot is
        // ever interpreted.
        pieces = text.split("\n");
    } else {
        for (const p of PROTECT) text = text.replace(p, (m) => m.replace(/\./gu, DOT_SENTINEL));
        const esc = (s: string): string => s.replace(/[\\\]^-]/gu, "\\$&");
        const splitter = new RegExp(`[^${esc(terminators)}]+[${esc(terminators)}]*`, "gu");
        pieces = [...text.matchAll(splitter)].map((m) => m[0]);
    }
    return [...new Set(
        pieces
            .map((s) => s.split(DOT_SENTINEL).join(".").replace(/\s+/gu, " ").trim())
            .filter((s) => s.length >= min && s.length <= max),
    )];
}

export interface CellSelection {
    picked: { cell: string; text: string }[];
    counts: Record<string, number>;
    asciiCounts: Record<string, number>;
}

/** Pure selection: segments → per-cell counts and up to `perCell` examples each. Deterministic. */
export function selectCells(segments: string[], opts: { perCell: number; terms?: string[] }): CellSelection {
    const terms = opts.terms ?? [];
    // Terms may be scoped to a cell as `cell<TAB>term`; a bare line applies to every lexical cell. Two
    // lexical cells now exist (calendar, ordinal-native) and they need different words, so one flat list
    // would have made each match the other's evidence.
    const build = (list: string[]): RegExp | undefined => list.length === 0
        ? undefined
        : new RegExp(list.map((t) => t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|"), "u");
    const shared: string[] = [];
    const scoped = new Map<string, string[]>();
    for (const line of terms) {
        const tab = line.indexOf("\t");
        if (tab === -1) shared.push(line);
        else {
            const key = line.slice(0, tab).trim();
            if (!scoped.has(key)) scoped.set(key, []);
            scoped.get(key)!.push(line.slice(tab + 1).trim());
        }
    }
    const termRes = new Map<string, RegExp | undefined>(
        CELLS.filter((c) => c.lexical).map((c) => [c.key, build([...(scoped.get(c.key) ?? []), ...shared])]),
    );
    const matches = (c: Cell, s: string): boolean => (c.lexical ? (termRes.get(c.key)?.test(s) ?? false) : c.re.test(s));

    const picked: { cell: string; text: string }[] = [];
    const seen = new Set<string>();
    const counts: Record<string, number> = {};
    const asciiCounts: Record<string, number> = {};
    for (const cell of CELLS) {
        const ascii = cell.lexical ? undefined : asciiVariant(cell.re);
        counts[cell.key] = 0;
        asciiCounts[cell.key] = 0;
        let taken = 0;
        for (const s of segments) {
            if (!matches(cell, s)) continue;
            counts[cell.key]!++;
            if (ascii?.test(s)) asciiCounts[cell.key]!++;
            // Prefer unpicked segments so the set covers CELLS rather than repeating one dense passage.
            if (taken < opts.perCell && !seen.has(s)) {
                picked.push({ cell: cell.key, text: s });
                seen.add(s);
                taken++;
            }
        }
    }
    return { picked, counts, asciiCounts };
}

export interface MinedCorpus {
    language: string;
    source: string;
    segmentMode: SegmentMode;
    totalSegments: number;
    counts: Record<string, number>;
    asciiCounts: Record<string, number>;
    picked: { cell: string; text: string }[];
    sample: string[];
}

/**
 * Render the mined corpus as JSONC — the deliverable. Comments carry the provenance and the two warnings
 * a reader of this file needs (why `hard` is not frequency-representative, and why `sample` exists), so
 * the artifact explains itself without the investigation doc beside it.
 */
export function renderJsonc(c: MinedCorpus): string {
    const cov = CELLS.filter((x) => (c.counts[x.key] ?? 0) > 0).length;
    const rows = CELLS.map((x) => {
        const n = c.counts[x.key] ?? 0, a = c.asciiCounts[x.key] ?? 0;
        const note = x.lexical ? " lexical cell — matched via the term list" : n > 0 && a === 0 ? " ASCII-BLIND: \\d would find NONE of these" : n > a ? ` \\d would miss ${n - a}` : "";
        return `        "${x.key}": ${n},${" ".repeat(Math.max(1, 18 - x.key.length - String(n).length))}//${note || ` in ${x.langs} treated languages`}`;
    }).join("\n");
    const esc = (s: string): string => JSON.stringify(s);
    return `// MINED NORMALIZATION CORPUS — ${c.language} (#585). Generated by tools/normalization/mine.ts.
//
// WHAT THIS IS. Excerpts of running text SELECTED because they challenge the normalization layer, for a
// language with no FLEURS corpus. The cells are the empirical shape of the rules the treated languages
// actually needed, so coverage of them is the completeness criterion — not size.
//
// ⚠ "hard" IS NOT FREQUENCY-REPRESENTATIVE. It is selected adversarially, so an instance count inside it
// means nothing about the language. Use "sample" (uniform, deterministic stride) for anything that needs
// real proportions, and to check that ORDINARY text still survives a change — a hard-set proves the rules
// fire, not that nothing else broke.
//
// ⚠ AN EMPTY CELL IS NOT EVIDENCE. It is a query to run or a tool bug. Both have happened here: random
// sampling read intros and missed 1013 articles with a percentage, and a sentence splitter ate the
// abbreviation dots and emptied three cells that a grep showed were well populated.
//
// source: ${c.source}
// segmentation: ${c.segmentMode}${c.segmentMode === "paragraph" ? " (no dot is ever interpreted — correct when the target IS the period)" : " (abbreviation dots protected before splitting)"}
{
    "language": ${esc(c.language)},
    "source": ${esc(c.source)},
    "segmentMode": ${esc(c.segmentMode)},
    "totalSegments": ${c.totalSegments},
    "cellsCovered": ${cov},
    "cellsTotal": ${CELLS.length},

    // Occurrences across the whole corpus, and what an ASCII-only \\d selector would have found instead.
    "counts": {
${rows}
    },

    // The hard-set: up to N examples per cell.
    "hard": [
${c.picked.map((p) => `        { "cell": ${esc(p.cell)}, "text": ${esc(p.text)} }`).join(",\n")}
    ],

    // The representative tier. Uniform stride over the same segments; keep it alongside the hard-set.
    "sample": [
${c.sample.map((s) => `        ${esc(s)}`).join(",\n")}
    ]
}
`;
}

const argv = process.argv.slice(2);
/** Only dispatch when this file IS the entry point. Without this the whole CLI ran on import and the test
 *  suite died on `process.exit(2)` before a single test collected. */
const IS_CLI = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
const mode = IS_CLI ? argv[0] : "__module__";
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);
const FLEURS_ROOT = "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
const UA = "vernacula-phonemizer-corpus-probe/0.1 (https://github.com/christopherthompson81/vernacula-phonemizer)";

async function api(wiki: string, params: Record<string, string>): Promise<any> {
    const u = new URL(`https://${wiki}.wikipedia.org/w/api.php`);
    for (const [k, v] of Object.entries({ format: "json", ...params })) u.searchParams.set(k, v);
    // A User-Agent is REQUIRED: without one the API returns non-JSON and the fetch silently yields nothing,
    // which reads as "this wiki has no articles" rather than as an error.
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
}

/**
 * Run `fn` over `items` with at most `limit` in flight, PRESERVING RESULT ORDER.
 *
 * WHY THIS EXISTS. The article fetches below are one HTTP round-trip each and were issued serially, because
 * `exlimit` is capped at 1 for a full extract (see the fill loop). For a nine-cell fill that is
 * 9 × (1 search + 20 articles) ≈ 190 sequential round-trips, each asking the server to render a whole article
 * to plaintext — about seven minutes for roughly a megabyte of text. The requests are independent, so the wait
 * was latency, not work.
 *
 * ORDER IS PRESERVED DELIBERATELY. Results are placed back at their own index rather than appended as they
 * land, so the output file is byte-identical to the serial version. That matters because `mine` samples
 * per cell from this file: an interleaved write order would silently change WHICH sentences end up in the
 * artifact, and a re-fetch would no longer reproduce it.
 *
 * MEASURED on a fixed 16-title list from hi.wikipedia, so the search's own instability could not confound it
 * (an `insource:` query returns different totalhits between calls — 33 then 75 for the same cell — which is
 * why a naive before/after of two fetch runs proves nothing):
 *
 *   concurrency  1   9114 ms      concurrency  4   1304 ms  (7.0×)      concurrency  8   784 ms  (11.6×)
 *
 * All three produced byte-identical results in identical order. The default is 4 rather than 8 because the
 * MediaWiki guidance is to keep read concurrency modest and 4 already takes most of the win; `--concurrency`
 * overrides it for a bulk sweep.
 */
export async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
    const out = new Array<R>(items.length);
    let next = 0;
    // NaN IS THE DANGEROUS INPUT, not a large one. `--concurrency abc` gives `Number(...) === NaN`, and
    // `Array.from({ length: NaN })` is the EMPTY array — so zero workers start, `Promise.all([])` resolves at
    // once, and the fetch reports success having downloaded nothing. That is the manufactured-confident-negative
    // failure this tree keeps finding (a missing User-Agent did the same thing), so the floor is applied here
    // rather than at the call site, where the next caller would have to remember it.
    const width = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), items.length)) : 1;
    await Promise.all(Array.from({ length: width }, async () => {
        for (;;) {
            const i = next++;
            if (i >= items.length) return;
            out[i] = await fn(items[i]!, i);
        }
    }));
    return out;
}

/** Article plain-text extracts → one line each, wiki heading/link syntax removed. */
function extracts(json: any, intro: boolean): string[] {
    const out: string[] = [];
    for (const p of Object.values<any>(json?.query?.pages ?? {})) {
        const t = String(p.extract ?? "")
            .replace(/^=+.*?=+$/gmu, " ") // == Heading == survives plain-text extraction
            .replace(/\[\[|\]\]/gu, "")
            .replace(/\s+/gu, " ")
            .trim();
        if (t.length > 40) out.push(t);
    }
    return out;
}

if (mode === "fetch") {
    const wiki = arg("wiki"), out = arg("out");
    if (wiki === undefined || out === undefined) throw new Error("fetch needs --wiki and --out");
    const digits = arg("digits", "0-9")!;
    writeFileSync(out, "", "utf8");
    let n = 0;

    const wantRandom = Number(arg("random", "0"));
    for (let i = 0; i < Math.ceil(wantRandom / 20); i++) {
        try {
            const j = await api(wiki, { action: "query", generator: "random", grnnamespace: "0", grnlimit: "20", prop: "extracts", explaintext: "1", exintro: "1", exlimit: "20" });
            const lines = extracts(j, true);
            appendFileSync(out, lines.join("\n") + "\n", "utf8");
            n += lines.length;
        } catch (e) { console.error(`  random batch ${i}: ${(e as Error).message}`); }
    }
    if (wantRandom) console.log(`random: ${n} passages`);

    const fill = (arg("fill") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const perCell = Number(arg("per-cell-articles", "20"));
    const concurrency = Number(arg("concurrency", "4"));
    const termsPath = arg("terms");
    const terms = termsPath !== undefined ? readFileSync(termsPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : [];
    for (const key of fill) {
        const cell = CELLS.find((c) => c.key === key);
        if (cell === undefined) { console.error(`  unknown cell: ${key}`); continue; }
        // A lexical cell is searched by its WORDS; a shape cell by an insource: regex with the language's
        // own digit range substituted for {D}.
        // A cell with neither a term list nor a search pattern cannot be filled — `zero-width` is the case
        // (an invisible character has no queryable shape). Say so rather than throwing on `undefined`.
        if (!cell.lexical && cell.search === undefined) {
            console.error(`  ${key.padEnd(14)} not fillable by query — no search pattern for this cell`);
            continue;
        }
        const srsearch = cell.lexical
            ? terms.filter((t) => t.startsWith(`${key}\t`) || !t.includes("\t"))
                .map((t) => `"${t.split("\t").pop()}"`).slice(0, 12).join(" OR ")
            : `insource:/${cell.search!.replace(/\{D\}/gu, digits)}/`;
        if (srsearch === "") { console.error(`  ${key}: lexical cell needs --terms`); continue; }
        try {
            const s = await api(wiki, { action: "query", list: "search", srsearch, srlimit: String(perCell), srnamespace: "0" });
            const titles = (s?.query?.search ?? []).map((r: any) => r.title);
            const total = s?.query?.searchinfo?.totalhits;
            if (titles.length === 0) { console.log(`  ${key.padEnd(14)} 0 hits — genuinely absent from this wiki`); continue; }
            // FULL text, not the intro: the whole point is that the pattern lives in the body, which is
            // why random intro-sampling missed the cell. `exlimit` is capped at 1 for a FULL extract (it
            // only accepts 20 alongside `exintro`), so the titles are fetched one at a time — batching
            // them silently returns a single article and looks like a wiki with nothing in it.
            // POOLED, and each title's failure is its own. Serially, one bad article threw to the cell's
            // catch and silently abandoned the remaining titles; here it costs that article and nothing else.
            let got = 0, failed = 0;
            const perTitle = await mapPool(titles, concurrency, async (title: string) => {
                try {
                    const j = await api(wiki, { action: "query", titles: title, prop: "extracts", explaintext: "1", exlimit: "1" });
                    return extracts(j, false);
                } catch { failed++; return []; }
            });
            for (const lines of perTitle) {
                if (lines.length > 0) { appendFileSync(out, lines.join("\n") + "\n", "utf8"); got += lines.length; }
            }
            n += got;
            console.log(`  ${key.padEnd(14)} ${String(total).padStart(6)} hits on the wiki → pulled ${got} articles`
                + (failed > 0 ? `  (${failed} article fetch(es) failed)` : ""));
        } catch (e) { console.error(`  ${key}: ${(e as Error).message}`); }
    }
    console.log(`wrote ${n} passages → ${out}`);
    process.exit(0);
}

/**
 * SCAN a mined hard-set for defects. Two families, and the second is the point:
 *
 *   LEAK — a digit, native mark or symbol survived into the IPA. These are the classes
 *   `normalization/corpus-diff.ts` already carries.
 *
 *   DROP — a symbol was SILENTLY DISCARDED. Detected differentially: phonemize the sentence, then
 *   phonemize it again with the symbol deleted, and if the two are identical the symbol contributed
 *   nothing. THE LEAK CLASSES ARE STRUCTURALLY BLIND TO THIS — they can only see a character that
 *   survives, never one that vanishes — which is why the currency drop in #584 went unnoticed through
 *   thirty-seven languages of corpus-driven work. Measured here on a real mined Burmese sentence: `၉၈%`
 *   phonemizes byte-identically with and without the percent sign.
 */
if (mode === "scan") {
    const inPath = arg("in"), lang = arg("lang");
    if (inPath === undefined || lang === undefined) throw new Error("scan needs --in and --lang");
    const { phonemize } = await import(new URL("../../src/index.ts", import.meta.url).href);
    // `say` is the one place this file knows how to phonemize; defects.ts takes it as a callback, so the
    // shared module needs no import of its own and stays independently testable.
    const say = (t: string): string | undefined => {
        try { return phonemize(t, lang) as string; } catch { return undefined; }
    };
    const contribution = makeContribution(say);
    // The defect tables and the REDUNDANT discrimination come from `defects.ts`, shared with
    // `corpus-diff.ts emit` and `coverage.ts`. Three copies had drifted: this one was the only place that
    // knew `math-sign`, and it was blind to `exponent`, `ampersand` and `iteration`, which coverage.ts
    // knew. The shared table is the union — see that file's header.

    const hits = new Map<string, number>();
    const example = new Map<string, string>();
    const alone = new Map<string, string[]>();
    // Reads the JSONC artifact the mine step writes; comments are stripped before parsing.
    const { parseJsonc } = await import(new URL("../../src/core/jsonc.ts", import.meta.url).href);
    const doc = parseJsonc(readFileSync(inPath, "utf8")) as MinedCorpus & { hard: { cell: string; text: string }[] };
    const lines = [...doc.hard.map((h) => h.text), ...(doc.sample ?? [])];
    /** class name → its detector, so an accepted line is matched on the same pattern the drop used. */
    const DROP_RE = new Map(DROPPABLE);
    for (const sentence of lines) {
        let ipa: string;
        try { ipa = phonemize(sentence, lang) as string; } catch { bump("THROW", sentence); continue; }
        // `re.lastIndex = 0` BEFORE EVERY `.test`: these regexes are `/g/` and shared across the whole
        // loop, and `RegExp.prototype.test` ADVANCES lastIndex on a hit — so the next sentence resumed
        // mid-string and the one after that started over. Measured: `re.test(s1), re.test(s2), re.test(s1)`
        // → true, false, true on the same pattern. The scan was therefore skipping about half of its
        // candidate sentences, silently, in both the leak and the drop loop.
        for (const [name, re] of LEAK_CLASSES) { re.lastIndex = 0; if (re.test(ipa)) bump(`LEAK ${name}`, sentence); }
        // REDUNDANT is a permissible drop and is reported as a NOTE, not a defect: where the sentence
        // itself says what the symbol means, the correct reading is byte-identical with and without it.
        for (const d of dropsIn(sentence, ipa, say, contribution)) {
            // ⚠ AN ACCEPTED SILENCE IS NOT A DEFECT HERE EITHER, and this scan was the one place that did not
            // know it. `coverage.ts` has consulted `ACCEPTED_SILENT` since #586, so the SAME sentence was
            // accepted by the audit and failed by `review.ts`, which runs this scan — mr's `चंद्रयान -1` is
            // accepted as a designation in one tool and reported as a `DROP minus` in the other. The baseline
            // is per-LINE and the artifact's line is the same designation the corpus's is, so the check
            // belongs on both paths; disagreeing about it made one of the two gates unreadable.
            if (isAcceptedSilent(lang, d.klass, sentence, DROP_RE.get(d.klass) ?? /$^/u)) {
                bump(`ACCEPTED ${d.klass}`, sentence);
                continue;
            }
            bump(`${d.redundant ? "REDUNDANT" : "DROP"} ${d.klass}`, sentence);
        }
    }
    function bump(k: string, s: string): void {
        hits.set(k, (hits.get(k) ?? 0) + 1);
        if (!example.has(k)) example.set(k, s.slice(0, 80));
    }
    console.log(`scanned ${lines.length} lines of ${inPath} as ${lang}\n`);
    // ⚠ `ACCEPTED` JOINS `REDUNDANT` AS A NOTE RATHER THAN A DEFECT. Both are drops that are CORRECT: redundant
    // because the sentence already says the symbol's word, accepted because the line is a designation whose
    // hyphen is silent in speech (ACCEPTED_SILENT, per instance). Counting either as a defect made `review.ts`
    // report a permanent hard fail for a decision recorded in defects.ts — mr's `चंद्रयान -1` was accepted by
    // coverage.ts and failed here, in the same repo, on the same line.
    const isNote = (k: string): boolean => k.startsWith("REDUNDANT") || k.startsWith("ACCEPTED");
    const defects = [...hits.entries()].filter(([k]) => !isNote(k));
    const notes = [...hits.entries()].filter(([k]) => isNote(k));
    if (defects.length === 0) console.log("no defects");
    for (const [k, v] of defects.sort((a, b) => b[1] - a[1]))
        console.log(`${k.padEnd(18)} ×${String(v).padEnd(5)} e.g. ${example.get(k)}`);
    // Notes, not defects. A symbol whose own word is already in the reading is REDUNDANT, and dropping the
    // sign is the CORRECT reading: the language-idiomatic position is the only one to keep, so
    // "$14.7 billion American dollars" says the currency once, where the language puts it, not twice.
    // Printed anyway — this is also the shape a genuinely SWALLOWED symbol hides behind, and there the word
    // is absent from the reading, which still reports as a DROP (xh `leUS$30`).
    for (const [k, v] of notes.sort((a, b) => b[1] - a[1]))
        console.log(`${k.padEnd(18)} ×${String(v).padEnd(5)} e.g. ${example.get(k)}`);
    process.exit(0);
}

if (mode === "__module__") {
    // imported as a library — export only, run nothing
} else if (mode !== "mine") {
    console.error("usage: fetch --wiki my --out raw.txt [--random N] [--fill cell,cell] [--digits ၀-၉] [--terms f] [--concurrency 4]\n       mine --in raw.txt --out hard.tsv [--per-cell 8] [--sample N] [--terminators \"။\"] [--terms f] [--audit-ascii]");
    process.exit(2);
} else {
    const inPath = arg("in"), outPath = arg("out");
    if (inPath === undefined || outPath === undefined) throw new Error("mine needs --in and --out");
    const perCell = Number(arg("per-cell", "8"));
    const sampleN = Number(arg("sample", "0"));
    const segmentMode = (arg("segment", "sentence") === "paragraph" ? "paragraph" : "sentence") as SegmentMode;
    const terminators = arg("terminators", ".!?။።۔؟।॥…。！？៕")!;
    const termsPath = arg("terms");
    const terms = termsPath !== undefined ? readFileSync(termsPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : [];

    // MULTIPLE SOURCES, MERGED. `--in a,b` reads each and concatenates the segments, which is what a
    // language with a FLEURS corpus but incomplete coverage needs: FLEURS is read-aloud news prose and so
    // is symbol-POOR (#584 — hu_hu contains no `$` at all, and nine treated languages sit below 20/29
    // cells from FLEURS alone), while Wikipedia carries dates, units, eras and month names at far higher
    // rates. Neither source alone covers the inventory; together they do, and merging beats replacing
    // because the FLEURS half is the text the engine was actually built and evaluated against.
    //
    // A `fleurs:` source reads transcripts directly — column 3 is the ORIGINAL cased text; column 4 is
    // lowercased and stripped of exactly the punctuation this layer exists to read. FLEURS is one
    // utterance per line and already sentence-sized, so it is segmented as PARAGRAPHS whatever
    // `--segment` says; re-splitting it would re-open the abbreviation-dot problem for no gain.
    const readSource = (src: string): string =>
        src.startsWith("fleurs:")
            ? (() => {
                const dir = join(FLEURS_ROOT, src.slice("fleurs:".length));
                const seen = new Set<string>();
                for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsv")))
                    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
                        const col = line.split("\t")[2];
                        if (col !== undefined && col !== "") seen.add(col);
                    }
                return [...seen].join("\n");
            })()
            : readFileSync(src, "utf8");

    const sources = inPath.split(",").map((x) => x.trim()).filter(Boolean);
    const segments = [...new Set(
        sources.flatMap((src) =>
            segment(readSource(src), src.startsWith("fleurs:") ? "paragraph" : segmentMode, terminators)),
    )];
    if (sources.length > 1) console.log(`merged ${sources.length} sources: ${sources.join(" + ")}`);

    const result = selectCells(segments, { perCell, terms });

    console.log(`${segments.length} unique ${segmentMode}s\n`);
    console.log("cell             langs   matched   picked   ascii-only");
    for (const c of CELLS) {
        const n = result.counts[c.key] ?? 0, a = result.asciiCounts[c.key] ?? 0;
        const pk = result.picked.filter((p) => p.cell === c.key).length;
        const flag = c.lexical ? "  (lexical)" : n > 0 && a === 0 ? "  ← ASCII BLIND" : n > a ? `  (${n - a} missed)` : "";
        console.log(`${c.key.padEnd(16)} ${String(c.langs).padStart(3)}   ${String(n).padStart(7)}   ${String(pk).padStart(6)}   ${String(a).padStart(9)}${flag}`);
    }
    const empty = CELLS.filter((c) => (result.counts[c.key] ?? 0) === 0).map((c) => c.key);
    console.log(`\ncovered ${CELLS.length - empty.length}/${CELLS.length} cells`);
    if (empty.length > 0) {
        // An empty cell is a QUERY TO RUN OR A TOOL BUG — never evidence on its own. Run 1 read six empty
        // cells as "Burmese does not write those" and a targeted search found 1013 articles with a
        // percentage; later, three dot-bearing cells read empty because the SPLITTER was eating the dots.
        // Print what to do next rather than a conclusion.
        console.log(`EMPTY: ${empty.join(" ")}`);
        console.log(`  → try --segment paragraph, then fetch --fill ${empty.join(",")} --digits <range>`);
    }

    const sample: string[] = [];
    if (sampleN > 0) {
        // Deterministic stride, not a shuffle — reproducible, and no Math.random.
        const stride = Math.max(1, Math.floor(segments.length / sampleN));
        for (let i = 0; i < segments.length && sample.length < sampleN; i += stride) sample.push(segments[i]!);
    }

    const lang = arg("lang", "und")!;
    const source = arg("source", inPath)!;
    writeFileSync(outPath, renderJsonc({
        language: lang,
        source,
        segmentMode,
        totalSegments: segments.length,
        counts: result.counts,
        asciiCounts: result.asciiCounts,
        picked: result.picked,
        sample,
    }), "utf8");
    console.log(`wrote ${result.picked.length} hard + ${sample.length} sample → ${outPath}`);
}
