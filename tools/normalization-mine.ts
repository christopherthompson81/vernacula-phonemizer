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
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

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

const CELLS: Cell[] = [
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
    { key: "ordinals", langs: 11, re: /\p{Nd}+(?:st|nd|rd|th|er|re|ème|º|ª|:e)(?![\p{L}\p{Nd}])/u, search: "[{D}]+(st|nd|rd|th|º|ª)" },
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
    { key: "negative", langs: 1, re: /(?<![\p{L}\p{Nd}])[-−–]\p{Nd}/u, search: "[ (][-−][{D}]" },
    // LETTER NAMES: a LONE Latin capital, which the initialism pass cannot claim (it needs two) and which
    // reached the g2p as an unpronounceable consonant. Distinct from `initialism`, and the reason
    // `letterName` exists per language in core/initialisms.ts.
    { key: "letter-name", langs: 3, re: /(?<![\p{L}\p{M}.])[A-Z](?![\p{L}\p{M}])/u, search: "[A-Z] [{D}]" },
    // CALENDAR: month names and non-Gregorian era words. LEXICAL, so it has no shape to match and no
    // regex can find it — Thai พ.ศ. (Buddhist), Ethiopian, Hijri and every set of month names are words,
    // not patterns. Supply them with --terms; the fill search then queries the terms directly, which is
    // both cheaper and more accurate than a regex. Same principle as acronymLetters in core/initialisms.ts:
    // a lexical fact belongs in data, not in logic.
    { key: "calendar", langs: 6, re: /$^/u, lexical: true },
];

const asciiVariant = (re: RegExp): RegExp => new RegExp(re.source.replace(/\\p\{Nd\}/gu, "\\d"), re.flags);

const argv = process.argv.slice(2);
const mode = argv[0];
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);
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
    const lines = readFileSync(inPath, "utf8").trim().split("\n");
    for (const ln of lines) {
        const sentence = ln.split("\t")[1] ?? "";
        let ipa: string;
        try { ipa = phonemize(sentence, lang) as string; } catch (e) { bump("THROW", sentence); continue; }
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

if (mode !== "mine") {
    console.error("usage: fetch --wiki my --out raw.txt [--random N] [--fill cell,cell] [--digits ၀-၉] [--terms f]\n       mine --in raw.txt --out hard.tsv [--per-cell 8] [--sample N] [--terminators \"။\"] [--terms f] [--audit-ascii]");
    process.exit(2);
}

const inPath = arg("in"), outPath = arg("out");
if (inPath === undefined || outPath === undefined) throw new Error("mine needs --in and --out");
const perCell = Number(arg("per-cell", "8"));
const sampleN = Number(arg("sample", "0"));
const terminators = arg("terminators", ".!?။።۔؟।॥…。！？៕")!;
const termsPath = arg("terms");
const terms = termsPath !== undefined ? readFileSync(termsPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : [];
const esc = (s: string): string => s.replace(/[\\\]^-]/gu, "\\$&");

const raw = readFileSync(inPath, "utf8");
const splitter = new RegExp(`[^${esc(terminators)}]+[${esc(terminators)}]*`, "gu");
const sentences = [...new Set(
    [...raw.matchAll(splitter)]
        .map((m) => m[0].replace(/\s+/gu, " ").trim())
        // A fragment shorter than this carries no context for a rule to be judged in; a very long one is
        // usually a table or list that survived the plain-text extraction.
        .filter((s) => s.length >= 20 && s.length <= 400),
)];

const termRe = terms.length > 0
    ? new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|"), "u")
    : undefined;
const test = (c: Cell, s: string): boolean => (c.lexical ? (termRe?.test(s) ?? false) : c.re.test(s));

const picked: { cell: string; sentence: string }[] = [];
const counts = new Map<string, number>();
const asciiCounts = new Map<string, number>();

for (const cell of CELLS) {
    const ascii = cell.lexical ? undefined : asciiVariant(cell.re);
    let taken = 0;
    for (const s of sentences) {
        if (!test(cell, s)) continue;
        counts.set(cell.key, (counts.get(cell.key) ?? 0) + 1);
        if (ascii?.test(s)) asciiCounts.set(cell.key, (asciiCounts.get(cell.key) ?? 0) + 1);
        // Prefer unpicked sentences so the set covers CELLS rather than repeating one dense sentence.
        if (taken < perCell && !picked.some((p) => p.sentence === s)) {
            picked.push({ cell: cell.key, sentence: s });
            taken++;
        }
    }
}

console.log(`sentences: ${sentences.length} unique\n`);
console.log("cell             langs   matched   picked   ascii-only");
for (const c of CELLS) {
    const n = counts.get(c.key) ?? 0, a = asciiCounts.get(c.key) ?? 0;
    const pk = picked.filter((p) => p.cell === c.key).length;
    const flag = c.lexical ? "  (lexical)" : n > 0 && a === 0 ? "  ← ASCII BLIND" : n > a ? `  (${n - a} missed)` : "";
    console.log(`${c.key.padEnd(16)} ${String(c.langs).padStart(3)}   ${String(n).padStart(7)}   ${String(pk).padStart(6)}   ${String(a).padStart(9)}${flag}`);
}
const empty = CELLS.filter((c) => (counts.get(c.key) ?? 0) === 0).map((c) => c.key);
console.log(`\ncovered ${CELLS.length - empty.length}/${CELLS.length} cells`);
if (empty.length > 0) {
    // An empty cell is a QUERY TO RUN, not a fact about the language — the first Burmese run read six
    // empty cells as "Burmese does not write those" and a targeted search found 944 articles with a
    // percentage. Print the command rather than the conclusion.
    console.log(`EMPTY: ${empty.join(" ")}`);
    console.log(`  → fetch --fill ${empty.join(",")} --digits <this language's digit range>`);
}

const lines = picked.map((p) => `${p.cell}\t${p.sentence}`);
if (sampleN > 0) {
    // Deterministic stride, not a shuffle — reproducible, and no Math.random.
    const stride = Math.max(1, Math.floor(sentences.length / sampleN));
    for (let i = 0; i < sentences.length && lines.length < picked.length + sampleN; i += stride) lines.push(`sample\t${sentences[i]}`);
}
writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`wrote ${lines.length} lines → ${outPath}`);
