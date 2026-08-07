/**
 * MINE a normalization hard-set from running text — build the corpus the diff gate needs for a
 * language that has no FLEURS corpus.
 *
 * WHY SELECTION AND NOT A DUMP. An exhaustive dump is the wrong target: most sentences exercise nothing the
 * normalizer does, and size is not the property we want. The property we want is COVERAGE of the pattern
 * inventory below, which is not invented here — it is the empirical shape of the 338 numbered rules across
 * the 37 languages already treated. Each cell of that inventory exists because a real corpus
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
 * ⚠ FILLING HOLES IS A TARGETED FETCH, NOT MORE RANDOM TEXT. The first Burmese run left six cells empty and
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
import { readFileSync, writeFileSync, appendFileSync, readdirSync, openSync, readSync, closeSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DROPPABLE, LEAK_CLASSES, acceptedSignClass, allOccurrencesForeign, allOccurrencesInMarkup, dropsIn, isAcceptedSilent, makeContribution } from "./defects.ts";
import { CELLS, type Cell } from "./cells.ts";
import { dominantScript, isNativeSegment, SCRIPTS } from "./scripts.ts";

// NOT A CELL, though it was tried: "a bound suffix written with a SPACE" (Oromo, `bara 1945 tti`).
// Every per-sentence regex for it — `\p{Nd} \p{Ll}{1,4}` and narrower — also matches `5 km`, `3 hari`,
// every measure phrase in every language, so the cell reports COVERED everywhere and says nothing. The
// finding is real and general — ⚠ the same bound suffix is also written with a space; the evidence for it is a corpus-level statistic — the
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

/**
 * SEGMENT A FILE WITHOUT READING IT INTO ONE STRING.
 *
 * ⚠ NODE CANNOT HOLD A STRING LONGER THAN `0x1fffffe8` CHARACTERS (~512 MB), and four of the mined dumps are
 * bigger than that: `tt` 1,030 MB of extracted text, `arz` 791, `ka` 754, `eu` 583. On those,
 * `readFileSync(path, "utf8")` throws `ERR_STRING_TOO_LONG` before a single segment is produced, so the
 * language cannot be mined at all — the failure is loud, but it is total, and it lands on the LARGEST wikis,
 * which are the ones worth mining most.
 *
 * Paragraph mode makes streaming exact rather than approximate: `segment()` splits the whole text on `\n` and
 * treats each line independently, so reading the file a chunk at a time and emitting complete lines does
 * identical work. The deduplicating `Set` stays global, so output is byte-identical to the non-streaming path —
 * verified, and it has to be, because the artifact is committed and diffed.
 *
 * A `StringDecoder` is used rather than `chunk.toString()`: an 8 MB boundary falls mid-codepoint often enough
 * that decoding chunks independently corrupts multi-byte text, which for this fleet is most of it.
 */
export function segmentFile(path: string, mode: SegmentMode, terminators: string): string[] {
    const [min, max] = BOUNDS[mode];
    const fd = openSync(path, "r");
    const decoder = new StringDecoder("utf8");
    const buf = Buffer.alloc(1 << 23);
    const out = new Set<string>();
    let carry = "";
    const take = (line: string): void => {
        // Paragraph mode: the line IS the unit. Sentence mode: split within the line — a dump writes one
        // paragraph per line, so no sentence spans a boundary and the result matches whole-text splitting.
        const pieces = mode === "paragraph" ? [line] : segment(line, "sentence", terminators);
        for (const piece of pieces) {
            const t = piece.replace(/\s+/gu, " ").trim();
            if (t.length >= min && t.length <= max) out.add(t);
        }
    };
    try {
        for (;;) {
            const n = readSync(fd, buf, 0, buf.length, null);
            if (n === 0) break;
            carry += decoder.write(buf.subarray(0, n));
            const lines = carry.split("\n");
            carry = lines.pop() ?? "";
            for (const line of lines) take(line);
        }
        carry += decoder.end();
        if (carry !== "") take(carry);
    } finally { closeSync(fd); }
    return [...out];
}

/**
 * A bounded, strided sample of a corpus — enough text to infer its script, and never more.
 *
 * ⚠ THIS EXISTS BECAUSE `segments.join("\n").slice(0, 400_000)` THREW ON THE LARGEST DUMP. The join builds the
 * whole corpus as ONE STRING before the slice can narrow it, so hy's 1.4 GB dump died on
 * `RangeError: Invalid string length` — Node's maximum string length, the same ceiling that once made tt, arz,
 * ka and eu unminable at all and was fixed by streaming in `segmentFile`. Reintroducing it one function later
 * is why the bound has to be built INTO the probe rather than applied after the fact.
 *
 * Strided rather than head-truncated: the first 400 KB of a wiki dump is whatever the alphabet put first, and a
 * corpus whose opening articles are foreign would have its script inferred from them. A deterministic stride
 * across the whole array samples the corpus as it actually is, and keeps the artifact reproducible.
 */
export function scriptProbe(segments: readonly string[], budget = 400_000): string {
    const step = Math.max(1, Math.floor(segments.length / 2_000));
    const parts: string[] = [];
    let size = 0;
    for (let i = 0; i < segments.length && size < budget; i += step) {
        const seg = segments[i]!;
        parts.push(seg);
        size += seg.length + 1;
    }
    return parts.join("\n").slice(0, budget);
}

export interface CellSelection {
    picked: { cell: string; text: string }[];
    counts: Record<string, number>;
    asciiCounts: Record<string, number>;
}

/** Pure selection: segments → per-cell counts and up to `perCell` examples each. Deterministic. */
export function selectCells(segments: string[], opts: { perCell: number; terms?: string[] }): CellSelection {
    const terms = opts.terms ?? [];
    // ⚠ A SEGMENT WITH NONE OF THE CORPUS'S OWN SCRIPT IS NOT EVIDENCE ABOUT THIS LANGUAGE, and this selector
    // is the reason it has to be said here. Selection is ADVERSARIAL — it prefers symbol-dense segments — and
    // foreign-language prose in a non-Latin wiki is symbol-dense (prices, box-office figures, bare markup), so
    // English articles quoted in the wiki were over-represented in the very tier the gate reads. km's artifact
    // carried 47 such cells of 253, and their `US$` drops reported as Khmer reading gaps. Filtered here rather
    // than in `extracts()`/`segmentFile()` because only this function sees the WHOLE corpus, which is what
    // makes the script inferable without a language→script table that could fall stale.
    const script = dominantScript(scriptProbe(segments));
    segments = segments.filter((s) => isNativeSegment(s, script));
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
    /** The exact invocation that produced this artifact. See `renderJsonc`'s note on why it is recorded. */
    command?: string;
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
 * the artifact explains itself standalone.
 */
/**
 * Which frequency claim the artifact's `sample` tier can support, decided from its recorded source. A dump is
 * the whole wiki, so a uniform stride over it is the real distribution; an API fetch is intros plus
 * search-ranked articles, so it is not. Keyed on the source string because that is the only provenance the
 * artifact carries, and an unrecognised source gets the cautious answer rather than the flattering one.
 */
export function SAMPLE_CAVEAT(source: string): string {
    // ⚠ KEYWORD-SNIFFING A FREE-TEXT FIELD IS FRAGILE, AND IT INVERTED ITSELF ON THE FIRST AWKWARD SOURCE
    // STRING. `mag` records `"… (random 400 + targeted insource: fill; NO DUMP is published for this wiki)"`,
    // which `/\bdump\b/i` matched — so the artifact told its reader `✓ dump-sourced, sample IS the language's
    // real distribution` about an API fetch with no dump behind it. Exactly backwards, in the one field whose
    // job is to stop a reader over-trusting the data.
    //
    // Two defences. The pattern now requires the CANONICAL provenance form the dump converter emits —
    // `dump (pages-articles…` — rather than the bare word; and an explicit negation anywhere in the string
    // disqualifies it regardless. A free-text field cannot be made safe, but it can be made to fail closed.
    if (/\bno\s+dump\b|\bnot\s+a\s+dump\b/iu.test(source)) return API_CAVEAT;
    if (/\bdump\s*\(pages-articles/iu.test(source))
        return "// ✓ THIS artifact is dump-sourced, so `sample` IS the language's real distribution — a rate computed\n"
            + "//   from it is meaningful, which is what the ×33 and \"22.1% of the corpus\" counts in the rule comments\n"
            + "//   rely on.";
    if (/FLEURS/u.test(source))
        return "// ✓ THIS artifact is corpus-sourced (FLEURS), so `sample` reflects that corpus's own distribution.";
    return API_CAVEAT;
}

const API_CAVEAT = "// ⚠ THIS artifact is API-sourced (random article intros + `insource:` fill), so `sample` is NOT\n"
    + "//   frequency-representative either — the fill's articles were chosen by a search ranked on the very\n"
    + "//   patterns being counted. Do not compute a rate from it; re-mine from a dump if a rate is needed.";

export function renderJsonc(c: MinedCorpus): string {
    const cov = CELLS.filter((x) => (c.counts[x.key] ?? 0) > 0).length;
    const rows = CELLS.map((x) => {
        const n = c.counts[x.key] ?? 0, a = c.asciiCounts[x.key] ?? 0;
        const note = x.lexical ? " lexical cell — matched via the term list" : n > 0 && a === 0 ? " ASCII-BLIND: \\d would find NONE of these" : n > a ? ` \\d would miss ${n - a}` : "";
        return `        "${x.key}": ${n},${" ".repeat(Math.max(1, 18 - x.key.length - String(n).length))}//${note || ` in ${x.langs} treated languages`}`;
    }).join("\n");
    const esc = (s: string): string => JSON.stringify(s);
    return `// MINED NORMALIZATION CORPUS — ${c.language}. Generated by tools/normalization/mine.ts.
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
// ⚠⚠ AND WHETHER "sample" CAN CARRY THAT DEPENDS ON THE SOURCE, which this warning used to assert
// unconditionally. A uniform stride is only representative of what it strides OVER. Over a full dump it is
// the language's real distribution. Over an API fetch it is a stride across random ARTICLE INTROS plus
// articles chosen by a search ranked on the very patterns being measured — so a rate computed from it is a
// fact about the fetch, not about the language. The line below states which case this artifact is.
${SAMPLE_CAVEAT(c.source)}
//
// ⚠ AN EMPTY CELL IS NOT EVIDENCE. It is a query to run or a tool bug. Both have happened here: random
// sampling read intros and missed 1013 articles with a percentage, and a sentence splitter ate the
// abbreviation dots and emptied three cells that a grep showed were well populated.
//
// source: ${c.source}
//
// ⚠ REGENERATE WITH THE COMMAND BELOW, NOT FROM MEMORY. This artifact's shape depends on flags that leave no
// trace in the data — omit --sample and the whole sample tier silently disappears; omit --terms and the lexical
// cells report EMPTY. Both happened while re-mining this fleet: km lost its 200-entry sample tier to a
// reconstructed invocation, and my dropped from 35/35 cells to 33/35 because it is the one language with a terms
// list and the sweep did not pass it. Neither failure is visible in the output — the run reports success.
//
// command: ${c.command ?? "(not recorded — this artifact predates the field; regenerate to capture it)"}
// segmentation: ${c.segmentMode}${c.segmentMode === "paragraph" ? " (no dot is ever interpreted — correct when the target IS the period)" : " (abbreviation dots protected before splitting)"}
{
    "language": ${esc(c.language)},
    "source": ${esc(c.source)},
    "command": ${esc(c.command ?? "")},
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
const FLEURS_ROOT = process.env["FLEURS"] ?? "";
const UA = "vernacula-phonemizer-corpus-probe/0.1 (https://github.com/christopherthompson81/vernacula-phonemizer)";

const delay = (ms: number): Promise<void> => new Promise((res) => { setTimeout(res, ms); });

/**
 * ⚠ 429 IS THE FAILURE THAT SCALES WITH THE SWEEP, and it went unhandled until the sweep hit it. Fetching
 * ten wikis back to back tripped Wikimedia's bot rate limit, and the shape of the failure is the dangerous
 * one: every batch logged `429 Your bot is making too many requests`, the loop below caught each one and
 * carried on, the tool printed `wrote 0 passages`, and **it exited 0**. Three of the ten languages ended up
 * with an empty raw file — including `he`, whose wiki has 269 million words of article text. Under a 93-
 * language sweep that produces empty corpora at a success exit code, which is the one thing a gate must
 * never do.
 *
 * So a 429 is retried with backoff, honouring `Retry-After` when the server sends it, and the caller exits
 * non-zero when a fetch comes back empty. A rate limit is a "wait", never an answer about a wiki.
 */
async function api(wiki: string, params: Record<string, string>): Promise<any> {
    const u = new URL(`https://${wiki}.wikipedia.org/w/api.php`);
    for (const [k, v] of Object.entries({ format: "json", ...params })) u.searchParams.set(k, v);
    for (let attempt = 0; ; attempt++) {
        // A User-Agent is REQUIRED: without one the API returns non-JSON and the fetch silently yields
        // nothing, which reads as "this wiki has no articles" rather than as an error.
        const r = await fetch(u, { headers: { "User-Agent": UA } });
        if (r.ok) return r.json();
        // 429 and 5xx are TRANSIENT. A 404 or 400 is about the request and retrying it just repeats it.
        const transient = r.status === 429 || r.status >= 500;
        if (!transient || attempt >= 4) throw new Error(`${r.status} ${r.statusText}`);
        const after = Number(r.headers.get("retry-after"));
        const wait = Number.isFinite(after) && after > 0 ? 1000 * after : 1500 * 2 ** attempt;
        console.error(`  ${r.status} — waiting ${(wait / 1000).toFixed(1)}s (attempt ${attempt + 1}/5)`);
        await delay(wait);
    }
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

/**
 * Article plain-text extracts → ONE PARAGRAPH PER LINE, wiki heading/link syntax removed.
 *
 * ⚠ THIS FUNCTION SILENTLY DESTROYED THE ENTIRE FILL STEP, and the fill step is the feature that makes an
 * empty cell "a query to run, not a fact about the language". It collapsed `\s+` to a single space across
 * the WHOLE extract, which is right for an intro (one paragraph) and catastrophic for the full article the
 * fill pulls: the article became one line of a median **19,029 characters**. `segment()` in paragraph mode
 * splits on `\n` alone — deliberately, so no dot is ever interpreted — and then discards anything over its
 * 1,200-character ceiling. So:
 *
 *   he: 65 filled articles → 1 usable paragraph segment
 *   fi: 59 filled articles → 2
 *   ka: 111 filled articles → 12
 *
 * The sweep's symptom was that six languages reported thousands of `insource:` hits per cell, "pulled 8
 * articles" for each, and then moved 23→24 cells. Nothing connected the two numbers, and the natural reading
 * — "the pattern must live in infoboxes, which don't survive plain-text extraction" — was wrong and would
 * have been recorded as a limit of the method.
 *
 * `segment()`'s own comment states the contract this violated: *"The extractor writes one paragraph per
 * line, so the boundary is already decided and no dot is ever interpreted."* It didn't. Now it does, and
 * whitespace is collapsed WITHIN a paragraph only.
 *
 * (`intro` stays unused, and is kept because the caller distinguishes the two cases and a future change to
 * intro handling belongs here rather than at the call sites.)
 */
/**
 * ⚠ A RENDERED TEMPLATE'S ERROR MESSAGE IS ENGLISH TEXT GLUED INTO THE SENTENCE, and only this route can
 * produce it. `wikidump-to-text.py` carries a `RE_WIKI_ERROR` list for exactly this — added after three
 * MediaWiki errors reached cmn's artifact and were read aloud as English — but the fix went into the dump path
 * only, and the API path had no filter at all.
 *
 * THE TWO ROUTES ARE NOT EQUALLY EXPOSED, which is why this hid. A dump carries UNEXPANDED wikitext, so
 * `{{...}}` is stripped before any error can be rendered; the API's `explaintext` renders templates and
 * inherits whatever they emit. Measured across every committed artifact, this class appears in exactly one —
 * `cmn`, the pre-existing documented case — and in none of the dump-mined set.
 *
 * Found in Magahi by the template-field detector, not by inspection: `is` and `deprecated` came back as
 * field-like "words" present in 17% of segments at a rate of 1.02, which is the signature of a fixed string
 * rather than vocabulary. The string is a language-tag deprecation notice spliced mid-word:
 *
 *   अजमेर जिल्लौcode: raj is deprecated raj
 *   नामक्कल् (तमिल्: நாமக்கல்code: ta is deprecated ta
 *
 * 131 of 759 paragraphs. A paragraph carrying one is discarded whole rather than repaired: the surrounding
 * text is a template expansion too, and there is no reliable prose boundary to cut at.
 */
/**
 * ⚠ NOT SPEECH, AND THE CELL SELECTOR REACHES FOR IT. The Python converter carries the same guard, and it has
 * to exist on BOTH routes for the same reason the template-error filter did: a fix on one path is not a fix on
 * the other, and the API path is the one that serves the languages whose dumps exceed the size cap.
 *
 * A contact record is almost pure digits — dialling number, postcode, street number — and a URL path is almost
 * pure slashes, so `digit-run`, `ranges`, `signed-number` and `fractions` all prefer that material to ordinary
 * prose. Neither is anything a reader says aloud, and a URL sitting in a `fractions` slot tests nothing.
 *
 * Discarded WHOLE: there is no partial redaction that leaves trustworthy prose, because the text around a
 * contact block is more contact block.
 */
const PERSONAL = /[\w.+-]+@[\w-]+\.[a-z]{2,}|(?:facebook|instagram|twitter|tiktok|whatsapp|t\.me|linkedin)\.com\/[\w./-]+|\b(?:tel|t[eé]l|tlf)\b\s*[.:]\s*\(?\+?\d|\b(?:phone|telephone|mobile)\b\s*(?:no\.?|number|:)\s*\(?\+?\d|\(\+\d{1,3}[\s)-]\s?\d[\d\s-]{6,}|https?:\/\/\S{12,}/iu;

const WIKI_ERROR = /code:\s*\w[\w-]*\s+is\s+deprecated|Missing required parameter|Expression error|Template loop detected|Cite error|Invalid time|Unknown archive|script error|Lua error/iu;

export function extracts(json: any, intro: boolean): string[] {
    void intro;
    const out: string[] = [];
    for (const p of Object.values<any>(json?.query?.pages ?? {})) {
        const text = String(p.extract ?? "")
            .replace(/^=+.*?=+$/gmu, "\n") // == Heading == survives plain-text extraction; keep the break
            .replace(/\[\[|\]\]/gu, "");
        // A paragraph is a run of non-empty lines: MediaWiki's plaintext extract separates paragraphs with
        // newlines, and a single `\n` inside one is a soft wrap rather than a boundary worth keeping.
        for (const para of text.split(/\n/u)) {
            const t = para.replace(/\s+/gu, " ").trim();
            if (t.length > 40 && !WIKI_ERROR.test(t) && !PERSONAL.test(t)) out.push(t);
        }
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
    const batches = Math.ceil(wantRandom / 20);
    let failedBatches = 0;
    for (let i = 0; i < batches; i++) {
        try {
            const j = await api(wiki, { action: "query", generator: "random", grnnamespace: "0", grnlimit: "20", prop: "extracts", explaintext: "1", exintro: "1", exlimit: "20" });
            const lines = extracts(j, true);
            appendFileSync(out, lines.join("\n") + "\n", "utf8");
            n += lines.length;
        } catch (e) { failedBatches++; console.error(`  random batch ${i}: ${(e as Error).message}`); }
    }
    // THE COUNT OF WHAT DID NOT ARRIVE, printed beside the count of what did. Reporting only the passages
    // fetched made a rate-limited run look like a small wiki.
    if (wantRandom) console.log(`random: ${n} passages from ${batches - failedBatches}/${batches} batches`
        + (failedBatches > 0 ? `  ⚠ ${failedBatches} batch(es) LOST — this corpus is short by up to ${20 * failedBatches} articles` : ""));

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
            // `got` counts PARAGRAPHS, not articles — `extracts` emits one line per paragraph, and saying
            // "articles" here overstated the fetch by an order of magnitude once that was fixed.
            console.log(`  ${key.padEnd(14)} ${String(total).padStart(6)} hits on the wiki → ${titles.length} articles, ${got} paragraphs`
                + (failed > 0 ? `  (${failed} article fetch(es) failed)` : ""));
        } catch (e) { console.error(`  ${key}: ${(e as Error).message}`); }
    }
    console.log(`wrote ${n} passages → ${out}`);
    // ⚠ EXIT NON-ZERO ON AN EMPTY FETCH. This tool is the first step of a 93-language sweep, so it will be
    // driven from a loop, and a loop reads the exit code. A rate-limited run that reports success leaves an
    // empty file behind and the next stage mines it, reports "0 segments", and the sweep records a language
    // as having no minable text — which is a claim about the wiki, from an artifact of the request rate.
    // Exiting 2 makes a lost fetch stop the loop, which is the only safe default at that scale.
    if (n === 0) {
        console.error(`\n⚠ NOTHING FETCHED. This is a fact about this run, NOT about ${wiki}.wikipedia.org.`
            + `\n  Check for 429s above; wait and re-run rather than treating this wiki as empty.`);
        process.exit(2);
    }
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
 *   survives, never one that vanishes — which is why a currency drop can go unnoticed through
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
    // The script this corpus is WRITTEN in, inferred from the corpus rather than a language→script table (see
    // scripts.ts). Used only to tell a foreign-language span from a native one; `undefined` (too little evidence,
    // or a genuine two-script mix) disables the check, which fails toward reporting rather than hiding.
    const nativeScript = dominantScript(lines.join("\n").slice(0, 200_000));
    const nativeRe = nativeScript === undefined || nativeScript === "Latin"
        ? undefined
        : SCRIPTS.find(([name]) => name === nativeScript)?.[1];

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
            // know it. `coverage.ts` consults `ACCEPTED_SILENT`, so the SAME sentence was
            // accepted by the audit and failed by `review.ts`, which runs this scan — mr's `चंद्रयान -1` is
            // accepted as a designation in one tool and reported as a `DROP minus` in the other. The baseline
            // is per-LINE and the artifact's line is the same designation the corpus's is, so the check
            // belongs on both paths; disagreeing about it made one of the two gates unreadable.
            if (isAcceptedSilent(lang, d.klass, sentence, DROP_RE.get(d.klass) ?? /$^/u)) {
                bump(`ACCEPTED ${d.klass}`, sentence);
                continue;
            }
            // ⚠ A SIGN INSIDE A FOREIGN-LANGUAGE SPAN IS NOT THIS LANGUAGE'S DEFECT. Mined artifacts contain
            // BILINGUAL lines — legitimately, since most of such a line is the language — and a symbol sitting in
            // the English half of one tests English. km's gate failed on `SGD$8.5 million to build`, inside a
            // sentence with 0 Khmer letters either side of it, which asked the author to source a Khmer reading
            // for English prose. Reported as a NOTE so it stays visible rather than being silently dropped.
            // A refusal argued at CLASS level in the language's own file is not a per-line defect here either.
            // Labelled distinctly from the per-INSTANCE acceptance below: the two rest on different arguments —
            // ACCEPTED-CLASS means "no reading of this sign ships in this language, and the reason is in its own
            // file"; ACCEPTED means "this exact line's symbol is correctly silent". Printing both as `ACCEPTED`
            // made it impossible to tell from a gate run which table had spoken.
            if (acceptedSignClass(lang, d.klass, sentence)) { bump(`ACCEPTED-CLASS ${d.klass}`, sentence); continue; }
            if (allOccurrencesForeign(sentence, DROP_RE.get(d.klass) ?? /$^/u, nativeRe)) {
                bump(`FOREIGN ${d.klass}`, sentence);
                continue;
            }
            // Every occurrence inside LaTeX or template markup — a formula copied into the wiki, not prose.
            if (allOccurrencesInMarkup(sentence, DROP_RE.get(d.klass) ?? /$^/u)) {
                bump(`MARKUP ${d.klass}`, sentence);
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
    const isNote = (k: string): boolean =>
        k.startsWith("REDUNDANT") || k.startsWith("ACCEPTED") || k.startsWith("FOREIGN");
    // (ACCEPTED-CLASS is covered by the ACCEPTED prefix above.)
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
    /**
     * The invocation, so the artifact can be rebuilt without reconstructing flags from memory.
     *
     * ⚠ PATHS ARE REDUCED TO BASENAMES, for the same reason `source` is a few lines below: an absolute path leaks
     * a local directory tree — and in the first version of this field it recorded
     * `/tmp/claude-.../-home-<user>-Programming-...`, a username included, into an artifact destined for a public
     * repository. The corpus lives wherever the operator keeps it; the FLAGS are the part that cannot be
     * reconstructed, and they are what this preserves.
     *
     * Arguments containing spaces are quoted so the line can be pasted back with the paths filled in.
     */
    const command = ["npx tsx tools/normalization/mine.ts", ...process.argv.slice(2)
        // Only the ARGUMENTS are reduced — the tool's own repo-relative path is not a leak and is worth keeping.
        .map((a) => (a.includes("/") ? a.replace(/^.*\//u, "") : a))
        .map((a) => (/\s/u.test(a) ? `"${a}"` : a))].join(" ");
    const perCell = Number(arg("per-cell", "8"));
    const sampleN = Number(arg("sample", "0"));
    const segmentMode = (arg("segment", "sentence") === "paragraph" ? "paragraph" : "sentence") as SegmentMode;
    const terminators = arg("terminators", ".!?။።۔؟।॥…。！？៕")!;
    const termsPath = arg("terms");
    const terms = termsPath !== undefined ? readFileSync(termsPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : [];

    // MULTIPLE SOURCES, MERGED. `--in a,b` reads each and concatenates the segments, which is what a
    // language with a FLEURS corpus but incomplete coverage needs: FLEURS is read-aloud news prose and so
    // is symbol-POOR (hu_hu contains no `$` at all, and nine treated languages sit below 20/29
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
        sources.flatMap((src) => (src.startsWith("fleurs:")
            ? segment(readSource(src), "paragraph", terminators)
            // Streamed, so a dump over Node's ~512 MB string cap is minable at all — see `segmentFile`.
            : segmentFile(src, segmentMode, terminators))),
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

    /**
     * ⚠ `--lang` IS REQUIRED, and it used to default to `"und"`. Seven artifacts were mined, reviewed,
     * scanned and COMMITTED carrying `"language": "und"` before anyone read the field — the scan takes its
     * own `--lang`, the staleness check does not look at this one, and nothing else in the toolchain reads
     * it, so an artifact can be wrong here and pass every gate. A silent default on an identity field is
     * worse than no default: it produces a plausible-looking artifact that names no language.
     */
    const lang = arg("lang");
    if (lang === undefined) throw new Error("mine needs --lang <code> — the artifact records which language it describes, and there is no sensible default");
    /**
     * ⚠ AND `source` DEFAULTS TO THE BASENAME, never the path it was given. The same seven artifacts
     * recorded the full absolute path of a machine-local scratch directory — session-scoped temp tree and
     * all — committed to a public repo in the one field whose whole job is provenance. The existing
     * artifacts say `"FLEURS de_de"` and `"my.wikipedia.org dump (pages-articles, paragraphs)"`, which is
     * what this field is for.
     *
     * A basename is still not provenance — pass `--source` — but it cannot leak a local directory tree.
     */
    const source = arg("source") ?? inPath.replace(/^.*\//u, "");
    writeFileSync(outPath, renderJsonc({
        language: lang,
        source,
        command,
        segmentMode,
        totalSegments: segments.length,
        counts: result.counts,
        asciiCounts: result.asciiCounts,
        picked: result.picked,
        sample,
    }), "utf8");
    console.log(`wrote ${result.picked.length} hard + ${sample.length} sample → ${outPath}`);
}
