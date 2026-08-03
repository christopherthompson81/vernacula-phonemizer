/**
 * WORD ATTESTATION PROBE (#562/#586) — answer "is this word actually used in this language?" for the words
 * `review.ts --lang X` reports as *in NO source*.
 *
 * WHY THIS EXISTS. The sourcing gate's haystack is the FLEURS corpus + the mined artifact + the referee word
 * lists + the language's own data files + espeak `dictsource` + any sister standard. That is a strong haystack
 * for a well-resourced language and a thin one otherwise, and the #562 batches kept ending on the same
 * unresolvable prompt — one currency word, attested nowhere, shipped as a stated assumption because dropping
 * the sign would delete the currency from the only sentences that have one (#584):
 *
 *   lb  Yen      · zu  amadola  · xh  iiyeni  · af/hr  jen
 *
 * For zu and xh that verdict was close to unimprovable by the existing route: **espeak ships no Zulu and no
 * Xhosa at all**, and their referees are programmatic epitran G2P output, so the corpus and the artifact were
 * very nearly the whole haystack. Wikipedia is the one avenue not tried.
 *
 * WHY IT IS NOT PART OF `mine.ts fetch --fill`. That searches for CELL SHAPES — a clock, a range, an ordinal
 * — to prove the artifact exercises each rule. This asks a different question about a specific WORD, so it
 * takes a different query and produces a different artifact. `nb.jsonc` is the one hybrid in the tree
 * (`FLEURS nb_no + no.wikipedia (targeted fill)`) and it was filled for coverage, not for sourcing.
 *
 * ── THE THING THIS TOOL EXISTS TO GET RIGHT ────────────────────────────────────────────────────────────
 *
 * A SUBSTRING MATCH IS NOT AN ATTESTATION, and that error has now been made — and caught — four times in one
 * batch of reviews. Each time, a plain grep made an absent word look sourced:
 *
 *   ff  `tere`   matched inside a longer word
 *   hr  `jen`    matched `jendek` / `jenjati` in the Serbian referee
 *   lb  `Yen`    matched `Libyen`, `Webproxyen`, and 19 espeak `-yen` plurals (`babyen`, `moyen`)
 *   xh  `iiyeni` matched inside `yeNintendo`
 *
 * So this tool reports TOKEN hits and SUBSTRING-ONLY hits as separate counts, and only the first can attest.
 * The substring column is printed anyway, because seeing `0 token / 7 substring` is what teaches you that the
 * word is absent and your grep was lying.
 *
 * WIKIPEDIA IS A WEAKER SOURCE THAN A CORPUS OR A REFEREE, and the cache records it as its own tier rather
 * than laundering it into "attested". It is user-generated, it is not audio-aligned, and for a small wiki a
 * single article can be one contributor's idiolect — so the cache stores the HIT COUNT and the number of
 * DISTINCT ARTICLES, because one word in one article is a lead and not a finding.
 *
 * Usage:
 *   npx tsx tools/normalization/attest.ts --lang zu --words amadola,idola,iiyeni
 *   npx tsx tools/normalization/attest.ts --lang zu --words amadola --wiki zu   # if the wiki code differs
 *   npx tsx tools/normalization/attest.ts --lang lb --from-review               # take the words the gate names
 *
 * Writes `tools/corpus/attest/<lang>.jsonc` so the answer is recorded, reviewable and reproducible, and so
 * `review.ts` can read it instead of asking the same question again next time.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const argv = process.argv.slice(2);
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);

const lang = arg("lang");
if (lang === undefined) {
    console.error("usage: --lang <code> [--words a,b,c | --from-review] [--wiki <wikicode>] [--limit N]");
    process.exit(2);
}
const wiki = arg("wiki", lang)!;
const limit = Number(arg("limit", "40"));
const OUT_DIR = "tools/corpus/attest";
const UA = "vernacula-phonemizer-attestation-probe/0.1 (https://github.com/christopherthompson81/vernacula-phonemizer)";

/** The words to probe. `--from-review` lifts them out of the sourcing line so the two tools cannot drift. */
function words(): string[] {
    const list = arg("words");
    if (list !== undefined) return list.split(",").map((w) => w.trim()).filter((w) => w !== "");
    if (!has("from-review")) throw new Error("need --words or --from-review");
    const out = execSync(`npx tsx tools/normalization/review.ts --lang ${lang}`, { encoding: "utf8" });
    // The gate prints e.g. `[ ?? ] sourcing   Yen — in NO source (corpus, artifact, …)`
    const line = out.split("\n").find((l) => /\]\s*sourcing/u.test(l) && /in NO source/u.test(l));
    if (line === undefined) throw new Error("review.ts reports no unsourced word for this language");
    return [...line.matchAll(/([\p{L}\p{M}'’-]{2,})\s+—\s+in NO source/gu)].map((m) => m[1]!);
}

async function api(params: Record<string, string>): Promise<any> {
    const u = new URL(`https://${wiki}.wikipedia.org/w/api.php`);
    for (const [k, v] of Object.entries({ format: "json", ...params })) u.searchParams.set(k, v);
    // A User-Agent is REQUIRED, per mine.ts: without one the API returns non-JSON and the fetch silently
    // yields nothing, which reads as "this word does not occur" rather than as an error — the worst possible
    // failure mode for an attestation tool, since it manufactures a confident negative.
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${wiki}.wikipedia.org`);
    return r.json();
}

/** Does the wiki exist at all? A negative from a nonexistent wiki is not evidence of anything. */
async function wikiExists(): Promise<boolean> {
    try {
        const j = await api({ action: "query", meta: "siteinfo" });
        return typeof j?.query?.general?.sitename === "string";
    } catch { return false; }
}

const fold = (s: string): string => s.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "");
/** TOKEN membership, the whole point of this file. Splits on anything that is not a letter or mark, so it
 *  works for a spaceless orthography's words too, and folds diacritics the way the review gate does. */
function tokens(text: string): Set<string> {
    return new Set(fold(text).split(/[^\p{L}\p{M}]+/u).filter((t) => t !== ""));
}

interface Finding {
    word: string;
    tokenHits: number;
    articles: number;
    substringOnly: number;
    examples: string[];
    verdict: "attested" | "substring-only" | "absent";
}

async function probe(word: string): Promise<Finding> {
    const w = fold(word);
    // CirrusSearch tokenises, so a plain term search is the right recall net; the token test below is what
    // supplies the precision. `insource:` regex was tried and is worse here — it is expensive on small wikis
    // and its own \b is ASCII-defined, which is the trap that disabled the initialism pass fleet-wide.
    const s = await api({
        action: "query", list: "search", srsearch: word,
        srlimit: String(Math.min(limit, 50)), srnamespace: "0", srprop: "snippet",
    });
    const hits: any[] = s?.query?.search ?? [];
    if (hits.length === 0) return { word, tokenHits: 0, articles: 0, substringOnly: 0, examples: [], verdict: "absent" };
    // Pull the pages' text so the judgement is made on prose, not on the API's highlighted snippet (which
    // wraps matches in markup and can elide the surrounding word).
    const titles = hits.slice(0, Math.min(limit, 20)).map((h) => String(h.title)).join("|");
    const e = await api({ action: "query", titles, prop: "extracts", explaintext: "1", exlimit: "20" });
    let tokenHits = 0, articles = 0, substringOnly = 0;
    const examples: string[] = [];
    for (const p of Object.values<any>(e?.query?.pages ?? {})) {
        const text = String(p.extract ?? "").replace(/\s+/gu, " ");
        if (text === "") continue;
        const toks = tokens(text);
        if (toks.has(w)) {
            articles++;
            // Count and quote the occurrences, so a human can judge the SENSE — the part no tool can do.
            // `amaphuzu` (zu) is a real token meaning sports POINTS, not the decimal point; `paun` (ms) is
            // the weight pound, not the currency. Attestation is necessary and never sufficient.
            for (const m of fold(text).matchAll(new RegExp(`(?<![\\p{L}\\p{M}])${w}(?![\\p{L}\\p{M}])`, "gu"))) {
                tokenHits++;
                if (examples.length < 6) {
                    const at = m.index!;
                    examples.push(`…${text.slice(Math.max(0, at - 60), at + w.length + 60).trim()}…`);
                }
            }
        } else if (fold(text).includes(w)) {
            substringOnly++;
        }
    }
    const verdict = tokenHits > 0 ? "attested" : substringOnly > 0 ? "substring-only" : "absent";
    return { word, tokenHits, articles, substringOnly, examples, verdict };
}

const exists = await wikiExists();
if (!exists) {
    console.error(`${wiki}.wikipedia.org does not respond as a wiki — a negative from here is NOT evidence.`);
    console.error(`Pass --wiki <code> if this language's wiki is filed under a different code.`);
    process.exit(3);
}

// A MISSING ARGUMENT IS A USAGE ERROR, not a stack trace: `words()` throws, and at top level that surfaced
// as an unhandled rejection with a Node banner, which reads like the tool is broken rather than misinvoked.
let wordList: string[];
try {
    wordList = words();
} catch (e) {
    console.error(`${(e as Error).message}`);
    console.error("usage: --lang <code> [--words a,b,c | --from-review] [--wiki <wikicode>] [--limit N]");
    process.exit(2);
}
const findings: Finding[] = [];
for (const w of wordList) findings.push(await probe(w));

const pad = (s: string, n: number): string => s.padEnd(n);
console.log(`\n── ${wiki}.wikipedia.org — TOKEN attestation ──\n`);
console.log(`  ${pad("word", 16)} ${pad("token", 6)} ${pad("arts", 5)} ${pad("substr-only", 12)} verdict`);
for (const f of findings)
    console.log(`  ${pad(f.word, 16)} ${pad(String(f.tokenHits), 6)} ${pad(String(f.articles), 5)} `
        + `${pad(String(f.substringOnly), 12)} ${f.verdict}`);
console.log(`\n  READ THE EXAMPLES. A token hit proves the word EXISTS, never that it fits the slot — the`);
console.log(`  Fula lesson. zu's amaphuzu is a real token meaning sports POINTS, not the decimal point.\n`);
for (const f of findings) {
    if (f.examples.length === 0) continue;
    console.log(`  ${f.word}:`);
    for (const x of f.examples) console.log(`    ${x}`);
    console.log();
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, `${lang}.jsonc`);
const prior = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
const kept = [...prior.matchAll(/"word":\s*"([^"]+)"/gu)].map((m) => m[1]!);
const esc = (s: string): string => JSON.stringify(s);
writeFileSync(outPath, `// WIKIPEDIA WORD ATTESTATION — ${lang} (#586). Written by tools/normalization/attest.ts.
//
// A SEPARATE AND WEAKER TIER than the FLEURS corpus, the referees, and espeak's dictsource. Wikipedia is
// user-generated and not audio-aligned, and on a small wiki one article can be a single contributor's
// idiolect — so \`articles\` is recorded beside \`tokenHits\`: one hit in one article is a LEAD, not a finding.
//
// \`substringOnly\` is the column that matters when tokenHits is 0. It is the count of articles where the
// letters appear INSIDE another word, which is exactly how an absent word comes to look sourced —
// lb's \`Yen\` in \`Libyen\`, xh's \`iiyeni\` in \`yeNintendo\`. A substring-only verdict is a NEGATIVE result.
//
// ⚠ ATTESTATION IS NEVER SUFFICIENT. It proves a word exists, not that it fits the slot. Check the part of
// speech and the sense against the examples before using any of this to justify a reading.
{
    "language": ${esc(lang)},
    "wiki": ${esc(`${wiki}.wikipedia.org`)},
    "tier": "wikipedia",
    "findings": [
${findings.map((f) => `        {
            "word": ${esc(f.word)},
            "verdict": ${esc(f.verdict)},
            "tokenHits": ${f.tokenHits},
            "articles": ${f.articles},
            "substringOnly": ${f.substringOnly},
            "examples": [${f.examples.map((x) => `\n                ${esc(x)}`).join(",")}${f.examples.length ? "\n            " : ""}]
        }`).join(",\n")}
    ],
}
`, "utf8");
console.log(`  → ${outPath}${kept.length ? `  (replaced ${kept.length} prior finding(s))` : ""}`);
console.log(`  Only an \`attested\` verdict WITH a sense you have checked belongs in a sourcing argument.\n`);
