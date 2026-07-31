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
 *   npx tsx tools/normalization-mine.ts fetch --wiki my --out raw.txt [--random 500] [--digits ၀-၉]
 *        [--fill percent,clock,degrees] [--per-cell-articles 20]
 *   npx tsx tools/normalization-mine.ts mine  --in raw.txt --out my.hard.tsv [--per-cell 8] [--sample 200]
 *        [--terminators "။"] [--terms months.txt] [--audit-ascii]
 */
import { readFileSync, writeFileSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * THE PATTERN INVENTORY. `langs` is the count of treated languages that authored a rule in that category —
 * the mining priority, since a cell 22 languages needed is one the next language probably needs too.
 *
 * `search` is the CirrusSearch `insource:` regex used to FILL the cell when random sampling misses it.
 * CirrusSearch regex is a restricted dialect: no `\p{...}`, no lookaround, no `\b`. `{D}` is substituted
 * with the language's digit range (`--digits`), which is how the fill stays script-correct — the exact
 * thing `\d` gets wrong. A cell with no `search` cannot be filled by pattern (see `calendar`).
 */
interface Cell {
    key: string;
    langs: number;
    re: RegExp;
    search?: string;
    /** Matched against the language's own term list (`--terms`) rather than by shape. */
    lexical?: boolean;
}

export const CELLS: Cell[] = [
    { key: "degrees", langs: 22, re: /\p{Nd}\s*(?:°|℃|℉)/u, search: "[{D}]+ ?°" },
    { key: "digit-run", langs: 19, re: /\p{Nd}{4,}/u, search: "[{D}]{4,}" },
    { key: "fractions", langs: 18, re: /\p{Nd}\s*[\/⁄]\s*\p{Nd}|[½¼¾⅓⅔⅛]/u, search: "[{D}]+/[{D}]+" },
    { key: "clock", langs: 18, re: /\p{Nd}{1,2}\s*[:.]\s*\p{Nd}{2}(?!\p{Nd})/u, search: "[{D}]{1,2}:[{D}]{2}" },
    { key: "signs", langs: 17, re: /[%‰+±×÷=<>]|\p{Sc}/u, search: "[{D}] ?[+±×÷]" },
    { key: "dotted", langs: 16, re: /\p{L}\.\s*\p{L}\./u, search: "[A-Za-z]\\.[A-Za-z]\\." },
    // Split from `year` deliberately: in the treated languages ERA is a DOTTED marker (kn ಕ್ರಿ.ಪೂ,
    // te క్రీ.శ, tr M.Ö., ta கி.மு.) that must be claimed BEFORE the abbreviation rule, which is a
    // different rule and a different ordering constraint from reading a bare 4-digit year.
    { key: "era-marker", langs: 14, re: /(?:\p{L}\.\s?\p{L}\.)\s*\p{Nd}|\p{Nd}+\s*(?:\p{L}\.\s?\p{L}\.)/u, search: "[A-Za-z]\\.[A-Za-z]\\. ?[{D}]" },
    { key: "year", langs: 14, re: /(?<!\p{Nd})\p{Nd}{4}(?!\p{Nd})/u, search: "[{D}]{4}" },
    { key: "decimals", langs: 12, re: /\p{Nd}[.,]\p{Nd}/u, search: "[{D}][.,][{D}]" },
    // ORDINALS, SPLIT IN TWO because one regex cannot do both and pretending otherwise hid a blind spot
    // in each direction.
    //
    // The first version listed LATIN suffixes only (st|nd|rd|th|er|ème|º|ª), so it matched `21st` and
    // found NOTHING in ၂၁ ကြိမ်မြောက် / २१वीं / 21е / 21. — it looked correct because it worked for
    // English. That is the `\d`-is-ASCII trap one level up, in a cell written AFTER that trap was
    // documented, and 32 treated languages have an ordinal rule.
    //
    // Widening it to "digit followed by letters in any script" then over-corrected: Burmese writes
    // numbers directly against words (၂၀၂၄ခုနှစ်), so the count went 462 -> 35,504 and the cell stopped
    // meaning anything. A cell that matches 8% of all text cannot answer "does this language have
    // ordinals". So: the Latin shape stays a SHAPE, and the native shape is LEXICAL — the suffix is a
    // word (वीं, е, မြောက်, ที่) exactly as month names are, and belongs in the term list.
    { key: "ordinal-latin", langs: 11, re: /\p{Nd}+(?:st|nd|rd|th|er|re|ème|º|ª|:e)(?![\p{L}\p{Nd}])|\p{Nd}+\.(?=\s+\p{Lu})/u, search: "[{D}]+(st|nd|rd|th|º|ª)" },
    { key: "ordinal-native", langs: 21, re: /$^/u, lexical: true },
    { key: "units", langs: 9, re: /\p{Nd}\s*(?:km|kg|cm|mm|ml|mg|GB|MB|kHz|MHz|GHz|kW|m²|km²|m³)(?![\p{L}])/iu, search: "[{D}] ?(km|kg|cm|mm|MB|GB)" },
    { key: "ranges", langs: 7, re: /\p{Nd}\s*[–—]\s*\p{Nd}|\p{Nd}-\p{Nd}/u, search: "[{D}] ?[–—-] ?[{D}]" },
    { key: "currency", langs: 6, re: /\p{Sc}\s*\p{Nd}|\p{Nd}\s*\p{Sc}/u, search: "[$€£¥₹₩฿] ?[{D}]" },
    { key: "abbrev", langs: 6, re: /(?<![\p{L}\p{M}])\p{L}{1,4}\.(?=\s+\p{L})/u, search: "[A-Za-z]{2,4}\\. [A-Za-z]" },
    { key: "latin-in-native", langs: 6, re: /[A-Za-z]{2,}/u, search: "[A-Za-z]{4,}" },
    { key: "percent", langs: 5, re: /\p{Nd}\s*[%‰]/u, search: "[{D}]+ ?%" },
    { key: "rate", langs: 4, re: /\p{Nd}\s*\p{L}+\s*\/\s*\p{L}+/u, search: "[{D}] ?[A-Za-z]+/[A-Za-z]+" },
    { key: "zero-width", langs: 4, re: /[​-‍⁠﻿]/u },
    // Roman numerals: the token must be ENTIRELY roman letters, else every capitalised English word with
    // the right letters (MIX, DIM, CIVIL) is a hit. Still a candidate selector rather than a rule — a
    // false positive costs one reviewed sentence.
    { key: "roman", langs: 3, re: /(?<![\p{L}\p{M}])M{0,4}(?:C[MD]|D?C{0,3})(?:X[CL]|L?X{0,3})(?:I[XV]|V?I{0,3})(?![\p{L}\p{M}])(?<=[MDCLXVI]{2,})/u, search: "[IVXLCDM]{2,} " },
    { key: "initialism", langs: 3, re: /(?<![\p{L}\p{M}])\p{Lu}{2,}(?![\p{L}\p{M}])/u, search: "[A-Z]{3,}" },
    { key: "grouped", langs: 3, re: /\p{Nd}{1,3}(?:[,.  ]\p{Nd}{3})+(?!\p{Nd})/u, search: "[{D}]{1,3},[{D}]{3}" },
    // NEGATIVES. One treated language (fr) authored this, and it is worth its own cell because it is the
    // AMBIGUOUS half of `ranges` — the same character, and the two rules compete for it. Requires a
    // boundary before the sign so a hyphenated compound is not read as a minus.
    // SIGNED NUMBERS. Was `negative` and matched only the minus; the PLUS half is the same phenomenon and
    // is measurably more common — `+` before a number occurs in nb 5, de 5, en 5, ru 3, fr 3, as positive
    // temperatures (`+30°C`) and timezone offsets (`UTC +1`), while a bare minus is rarer. A cell that
    // covered one sign and not the other reported the category as handled when half of it was invisible.
    { key: "signed-number", langs: 2, re: /(?<![\p{L}\p{Nd}])[-−–+]\p{Nd}/u, search: "[ (][-−+][{D}]" },
    // ORDINAL RANGES — `10.–11. århundre`, a range whose ENDS are ordinals rather than cardinals. Neither
    // the `ranges` cell nor an ordinal cell claims it: the dash sits between two ordinal dots, so a range
    // rule sees `10.` and `11.` as malformed numbers and an ordinal rule sees a dash where it wants a
    // word. Attested in every ordinal-dot orthography checked — nb 2, da 2, de 1, cs 1 — small counts but
    // four independent languages, which is what makes it a category rather than a Norwegian quirk.
    { key: "ordinal-range", langs: 1, re: /\p{Nd}{1,2}\.\s*[-–—]\s*\p{Nd}{1,2}\./u, search: "[{D}]{1,2}\\. ?[-–] ?[{D}]{1,2}\\." },
    // LETTER NAMES: a LONE Latin capital, which the initialism pass cannot claim (it needs two) and which
    // reached the g2p as an unpronounceable consonant. Distinct from `initialism`, and the reason
    // `letterName` exists per language in core/initialisms.ts.
    { key: "letter-name", langs: 3, re: /(?<![\p{L}\p{M}.])[A-Z](?![\p{L}\p{M}])/u, search: "[A-Z] [{D}]" },
    // EXPONENTS and SCIENTIFIC NOTATION. 24 languages declare `exponentWords` in their DATA — a harder
    // signal than a comment grep, and it would rank second in this table — yet the miner had no cell, so
    // no mined corpus could ever exercise them. Covers the superscript forms (km², m³) and the ×10ⁿ shape
    // whose negative exponent the Burmese run surfaced as an unexplained DROP:minus residue
    // (`9.1093837 × 10 -31 kg`).
    { key: "exponent", langs: 24, re: /\p{Nd}\s*\p{L}*[²³⁰¹⁴-⁹]|\p{L}[²³]|[\p{Nd}]\s*[×x]\s*10\s*[-−–]?\s*\p{Nd}/u, search: "[{D}] ?(km|m|cm)?[²³]" },
    // ARITHMETIC and RELATIONAL signs standing between operands. Deliberately NOT merged into `signs`:
    // that cell is a catch-all which any currency or percent already satisfies, so an equation never
    // surfaced separately. The Burmese run left `DROP math-sign ×10` unexplained for exactly this reason.
    { key: "arithmetic", langs: 2, re: /\p{Nd}\s*[+×÷=<>≤≥≈]\s*\p{Nd}|\s[=≈]\s/u, search: "[{D}] ?[+×÷=] ?[{D}]" },
    // AMPERSAND — a word in every language and never a letter, but the shared initialism pass sees `P&R`
    // as two one-letter runs. Dutch authored the only rule so far (`&` → *en*).
    { key: "ampersand", langs: 1, re: /&|＆/u, search: "&" },
    // ITERATION / REPETITION marks: Thai ๆ, Japanese 々 and the kana repeats, Khmer ៗ. Only one treated
    // language has the rule, but there it was the LARGEST single defect in the language (ๆ, 351
    // occurrences in 16.7% of th_th utterances, silently dropped). A low language-count cell that is
    // decisive where it applies, and invisible to every other cell because the mark is script-specific.
    { key: "iteration", langs: 1, re: /[ๆ々〃ヽヾゝゞៗ]/u, search: "ๆ" },
    // CALENDAR: month names and non-Gregorian era words. LEXICAL, so it has no shape to match and no
    // regex can find it — Thai พ.ศ. (Buddhist), Ethiopian, Hijri and every set of month names are words,
    // not patterns. Supply them with --terms; the fill search then queries the terms directly, which is
    // both cheaper and more accurate than a regex. Same principle as acronymLetters in core/initialisms.ts:
    // a lexical fact belongs in data, not in logic.
    { key: "calendar", langs: 6, re: /$^/u, lexical: true },
];

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
    return `// MINED NORMALIZATION CORPUS — ${c.language} (#585). Generated by tools/normalization-mine.ts.
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
    const termsPath = arg("terms");
    const terms = termsPath !== undefined ? readFileSync(termsPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : [];
    for (const key of fill) {
        const cell = CELLS.find((c) => c.key === key);
        if (cell === undefined) { console.error(`  unknown cell: ${key}`); continue; }
        // A lexical cell is searched by its WORDS; a shape cell by an insource: regex with the language's
        // own digit range substituted for {D}.
        const srsearch = cell.lexical
            ? terms.slice(0, 12).map((t) => `"${t}"`).join(" OR ")
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
            let got = 0;
            for (const title of titles) {
                const j = await api(wiki, { action: "query", titles: title, prop: "extracts", explaintext: "1", exlimit: "1" });
                const lines = extracts(j, false);
                if (lines.length > 0) { appendFileSync(out, lines.join("\n") + "\n", "utf8"); got += lines.length; }
            }
            n += got;
            console.log(`  ${key.padEnd(14)} ${String(total).padStart(6)} hits on the wiki → pulled ${got} articles`);
        } catch (e) { console.error(`  ${key}: ${(e as Error).message}`); }
    }
    console.log(`wrote ${n} passages → ${out}`);
    process.exit(0);
}

/**
 * SCAN a mined hard-set for defects. Two families, and the second is the point:
 *
 *   LEAK — a digit, native mark or symbol survived into the IPA. These are the classes
 *   `normalization-corpus-diff.ts` already carries.
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
    const { phonemize } = await import(new URL("../src/index.ts", import.meta.url).href);
    const LEAK: [string, RegExp][] = [
        ["DIGIT", /\p{Nd}/u],
        ["SLOT-GAP", /\s{2,}|^\s|\s$/u],
        ["RAWMARK", /[…。、，％℃°ºª〜～・！？²³\p{Sc}।॥۔؟،؛]/u],
        ["ZERO-WIDTH", /[​-‍⁠﻿]/u],
    ];
    /** Each symbol class, and the regex that deletes it, for the differential drop test. */
    const DROPPABLE: [string, RegExp][] = [
        ["percent", /[%‰]/gu],
        ["currency", /\p{Sc}/gu],
        ["degree", /[°℃℉]/gu],
        ["minus", /(?<![\p{L}\p{Nd}])[-−–](?=\p{Nd})/gu],
        ["math-sign", /[+±×÷=<>]/gu],
    ];
    const hits = new Map<string, number>();
    const example = new Map<string, string>();
    // Reads the JSONC artifact the mine step writes; comments are stripped before parsing.
    const { parseJsonc } = await import(new URL("../src/core/jsonc.ts", import.meta.url).href);
    const doc = parseJsonc(readFileSync(inPath, "utf8")) as MinedCorpus & { hard: { cell: string; text: string }[] };
    const lines = [...doc.hard.map((h) => h.text), ...(doc.sample ?? [])];
    for (const sentence of lines) {
        let ipa: string;
        try { ipa = phonemize(sentence, lang) as string; } catch { bump("THROW", sentence); continue; }
        for (const [name, re] of LEAK) if (re.test(ipa)) bump(`LEAK ${name}`, sentence);
        for (const [name, re] of DROPPABLE) {
            if (!re.test(sentence)) continue;
            const without = sentence.replace(re, "");
            try { if ((phonemize(without, lang) as string) === ipa) bump(`DROP ${name}`, sentence); } catch { /* the stripped form is not comparable */ }
        }
    }
    function bump(k: string, s: string): void {
        hits.set(k, (hits.get(k) ?? 0) + 1);
        if (!example.has(k)) example.set(k, s.slice(0, 80));
    }
    console.log(`scanned ${lines.length} lines of ${inPath} as ${lang}\n`);
    if (hits.size === 0) console.log("no defects");
    for (const [k, v] of [...hits.entries()].sort((a, b) => b[1] - a[1]))
        console.log(`${k.padEnd(18)} ×${String(v).padEnd(5)} e.g. ${example.get(k)}`);
    process.exit(0);
}

if (mode === "__module__") {
    // imported as a library — export only, run nothing
} else if (mode !== "mine") {
    console.error("usage: fetch --wiki my --out raw.txt [--random N] [--fill cell,cell] [--digits ၀-၉] [--terms f]\n       mine --in raw.txt --out hard.tsv [--per-cell 8] [--sample N] [--terminators \"။\"] [--terms f] [--audit-ascii]");
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

    // A corpus-backed language reads its FLEURS transcripts directly, so EVERY treated language ends up
    // with the same artifact shape regardless of where its text came from. That matters for round two of
    // the sweep (#586): the coverage audit then runs off artifacts rather than being FLEURS-only, and a
    // language treated from a mined corpus is checkable by exactly the same command as one treated from
    // FLEURS. Column 3 is the ORIGINAL cased text; column 4 is lowercased and stripped of the very
    // punctuation this layer exists to read.
    const raw = inPath.startsWith("fleurs:")
        ? (() => {
            const dir = join(FLEURS_ROOT, inPath.slice("fleurs:".length));
            const seen = new Set<string>();
            for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsv")))
                for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
                    const col = line.split("\t")[2];
                    if (col !== undefined && col !== "") seen.add(col);
                }
            return [...seen].join("\n");
        })()
        : readFileSync(inPath, "utf8");
    // FLEURS is one utterance per line and already sentence-sized, so it is segmented as paragraphs —
    // splitting it again would re-open the abbreviation-dot problem for no gain.
    const segments = segment(raw, inPath.startsWith("fleurs:") ? "paragraph" : segmentMode, terminators);
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
