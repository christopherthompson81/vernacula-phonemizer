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
 * ── EXCEPT WHERE THERE ARE NO WORD BOUNDARIES ──────────────────────────────────────────────────────────
 *
 * The paragraph above is right for every alphabetic script and WRONG for a spaceless one, and the original
 * `tokens()` comment here claimed it "works for a spaceless orthography's words too" while doing the exact
 * opposite. Splitting Chinese prose on non-letters yields ONE token per sentence, so `toks.has(word)` is
 * false for every real Chinese word and the verdict is `substring-only` no matter what. Measured on cmn:
 *
 *   等于 小于 乘以 除以 平方 立方 摄氏度 …  →  0 token / 1 substring — every one, including 摄氏度,
 *                                            which this repo has SHIPPED as the Celsius word since #562
 *
 * Worse, the one `attested` verdict in that run — 大于 — hit only because a LaTeX dump had put spaces round
 * it. The boundary test was not measuring the language; it was measuring the markup.
 *
 * So for a word in an unspaced script the substring match IS the hit test, and the tool says so in the
 * verdict (`attested*`) rather than laundering it. What is lost is real: the boundary test supplies the
 * precision that caught `Libyen`, and there is no substitute for it here — a Han substring can always be a
 * fragment of a longer compound. That makes READING THE EXAMPLES not merely advisable but the only filter,
 * which is why examples are now kept for these hits; before this change they were discarded, so the sole
 * evidence a spaceless language can offer was collected, thrown away, and reported as a negative.
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
 *   npx tsx tools/normalization/attest.ts --lang ff --after kiloomeeteer,meeteer  # what FOLLOWS this noun?
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
    console.error("usage: --lang <code> [--words a,b,c | --from-review | --after noun,noun] [--wiki <wikicode>] [--limit N]");
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

/** Escape a probed word for use inside a regex — a term list may contain a dot or a hyphen. */
const reEsc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const fold = (s: string): string => s.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "");
/** TOKEN membership, the whole point of this file — for a script that HAS tokens. Splits on anything that is
 *  not a letter or mark, and folds diacritics the way the review gate does. */
function tokens(text: string): Set<string> {
    return new Set(fold(text).split(/[^\p{L}\p{M}]+/u).filter((t) => t !== ""));
}

/**
 * Scripts written without spaces between words, where the token test above cannot apply.
 *
 * Keyed off the PROBED WORD, not the wiki: a Chinese word is unspaced wherever it appears, and probing a
 * Latin loan on zh.wikipedia should still get the boundary test that Latin admits. Kana are here with Han
 * because Japanese is unspaced throughout; Hangul is NOT — modern Korean puts spaces between eojeol.
 */
const UNSPACED = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Thai}\p{sc=Lao}\p{sc=Khmer}\p{sc=Myanmar}\p{sc=Tibetan}\p{sc=Javanese}]/u;

interface Finding {
    word: string;
    tokenHits: number;
    articles: number;
    substringOnly: number;
    examples: string[];
    /** False when the script has no word boundaries, so `tokenHits` is a bare substring count. */
    bounded: boolean;
    verdict: "attested" | "attested*" | "substring-only" | "absent";
}

async function probe(word: string): Promise<Finding> {
    const w = fold(word);
    const bounded = !UNSPACED.test(word);
    /** A probe with internal whitespace is a COLLOCATION, tested as a phrase rather than as a token. */
    const phrase = /\s/u.test(word.trim());
    // In an unspaced script the hit test is a plain substring; everywhere else it is flanked by the
    // not-a-letter lookarounds that make `Yen` fail inside `Libyen`. Internal whitespace is relaxed to `\s+`
    // so a phrase still matches across a line break or a double space in the extract.
    const body = phrase ? w.trim().split(/\s+/u).map(reEsc).join("\\s+") : w;
    const hitRe = new RegExp(bounded ? `(?<![\\p{L}\\p{M}])${body}(?![\\p{L}\\p{M}])` : body, "gu");
    // CirrusSearch tokenises, so a plain term search is the right recall net; the token test below is what
    // supplies the precision. `insource:` regex was tried and is worse here — it is expensive on small wikis
    // and its own \b is ASCII-defined, which is the trap that disabled the initialism pass fleet-wide.
    const s = await api({
        action: "query", list: "search", srsearch: word,
        srlimit: String(Math.min(limit, 50)), srnamespace: "0", srprop: "snippet",
    });
    const hits: any[] = s?.query?.search ?? [];
    if (hits.length === 0) {
        return { word, tokenHits: 0, articles: 0, substringOnly: 0, examples: [], bounded, verdict: "absent" };
    }
    // Pull the pages' text so the judgement is made on prose, not on the API's highlighted snippet (which
    // wraps matches in markup and can elide the surrounding word).
    const titles = hits.slice(0, Math.min(limit, 20)).map((h) => String(h.title)).join("|");
    const e = await api({ action: "query", titles, prop: "extracts", explaintext: "1", exlimit: "20" });
    let tokenHits = 0, articles = 0, substringOnly = 0;
    const examples: string[] = [];
    for (const p of Object.values<any>(e?.query?.pages ?? {})) {
        const text = String(p.extract ?? "").replace(/\s+/gu, " ");
        if (text === "") continue;
        // The token set gates the count for a bounded SINGLE WORD only. For an unspaced script it would gate
        // on a sentence-sized token and reject everything, so the substring hit stands as the hit — and for a
        // MULTI-WORD PHRASE it can never match at all, because `tokens()` splits on the very space the phrase
        // contains. That made every phrase probe report `substring-only`, which reads as a NEGATIVE, while the
        // phrase was sitting in the quoted example directly above it: ff's `kiloomeeteer kaaree` was called
        // substring-only in the same run whose example was "468 kiloomeeteer kaaree (181 mi kaaree)". A phrase
        // is the collocation test this file exists to support (trap 37), so it is gated by `hitRe`, which
        // already flanks the WHOLE probe with the not-a-letter lookarounds.
        if (phrase ? hitRe.test(fold(text)) : bounded ? tokens(text).has(w) : fold(text).includes(w)) {
            articles++;
            // Count and quote the occurrences, so a human can judge the SENSE — the part no tool can do.
            // `amaphuzu` (zu) is a real token meaning sports POINTS, not the decimal point; `paun` (ms) is
            // the weight pound, not the currency. Attestation is necessary and never sufficient — and where
            // `bounded` is false these quotes are the ONLY evidence, since no boundary test filtered them.
            hitRe.lastIndex = 0;
            // COUNT on the folded text, but QUOTE from the original — and never mix the two indices.
            //
            // `fold()` does NFD + `\p{M}+` removal, which CHANGES STRING LENGTH in every script that writes
            // combining marks. Slicing the ORIGINAL text at an index found in the FOLDED text therefore lands
            // a window off by however many marks preceded the hit, and the quoted sentence does not contain
            // the word at all. Latin without diacritics folds to itself, which is why this survived: it was
            // caught reading Maithili, where `प्रतिशत`'s example showed a passage with no प्रतिशत in it.
            //
            // Examples are re-found in the ORIGINAL text with the ORIGINAL word. If the wiki writes it with
            // different marks the fold still COUNTS the hit and no example is quoted — a missing quote is a
            // prompt to look; a misaligned one is a wrong finding, and #610 made these quotes the whole of the
            // evidence for unspaced scripts.
            tokenHits += [...fold(text).matchAll(hitRe)].length;
            const qBody = phrase ? word.trim().split(/\s+/u).map(reEsc).join("\\s+") : reEsc(word);
            const quoteRe = new RegExp(bounded ? `(?<![\\p{L}\\p{M}])${qBody}(?![\\p{L}\\p{M}])` : qBody, "giu");
            for (const m of text.matchAll(quoteRe)) {
                if (examples.length >= 6) break;
                const at = m.index!;
                examples.push(`…${text.slice(Math.max(0, at - 60), at + word.length + 60).trim()}…`);
            }
        } else if (fold(text).includes(w)) {
            substringOnly++;
        }
    }
    const verdict: Finding["verdict"] = tokenHits > 0 ? (bounded ? "attested" : "attested*")
        : substringOnly > 0 ? "substring-only" : "absent";
    return { word, tokenHits, articles, substringOnly, examples, bounded, verdict };
}

/**
 * SLOT PROBE (`--after <noun>`) — the third sourcing tier, and the only one that can find a word you cannot
 * spell.
 *
 * `--words` asks "does THIS word occur?" and `concept.ts` asks "what does this language CALL the thing?".
 * Both fail the same way when the answer is a spelling you did not guess. Fula is the case: probing `kaare`
 * returned ×1 and it was the SHAPE ("Suudu juulirde nduu ko kaare" — the prayer hall is square), so the
 * language was recorded as having no squared word. It has one. It is `kaaree`, one letter longer, and no
 * amount of probing `kaare` would ever have surfaced it.
 *
 * So invert once more: name the noun the modifier must ATTACH to, and report every word that follows it.
 * The modifier cannot hide, because the slot is defined by something you already know.
 *
 *   npx tsx tools/normalization/attest.ts --lang ff --after kiloomeeteer,meeteer,miil
 *     → kaaree ×4 · gooto ×1 · kubik ×1        (and `gooto` is "one", which is why you read the examples)
 *
 * ⚠ THE ARTICLE CLASS MATTERS MORE THAN THE REGISTER. The intuition that a measure word lives in scholarly
 * maths prose is reasonable and was not what paid here: ff.wikipedia has no article for exponentiation,
 * mass–energy equivalence, area or volume. What it has is 20,809 articles about PLACES, and a place cannot
 * state its subject without an area figure — every one of the six independent `kaaree` attestations came
 * from a country or a reserve. Pick the page class that is FORCED to say the thing.
 * (ga.wikipedia does have the scholarly form, and it is the better quote when it exists: "cad é achar na
 * cearnóige atá 2 ciliméadar ar leithead? 4 ciliméadar cearnach atá an t-achar.")
 */
async function slotProbe(nouns: string[]): Promise<void> {
    const after = new Map<string, number>();
    const examples: string[] = [];
    const seen = new Set<string>();
    for (const noun of nouns) {
        const s = await api({
            action: "query", list: "search", srsearch: noun,
            srlimit: String(Math.min(limit, 50)), srnamespace: "0",
        });
        const titles = (s?.query?.search ?? []).map((h: any) => String(h.title)).filter((t: string) => !seen.has(t));
        for (const t of titles) seen.add(t);
        for (let i = 0; i < titles.length; i += 20) {
            const e = await api({
                action: "query", titles: titles.slice(i, i + 20).join("|"),
                prop: "extracts", explaintext: "1", exlimit: "20",
            });
            for (const p of Object.values<any>(e?.query?.pages ?? {})) {
                const text = String(p.extract ?? "").replace(/\s+/gu, " ");
                // The noun, then a NUMBER-free following token. `\p{L}\p{M}` only, so a figure or a
                // parenthesis ends the slot rather than being reported as the modifier.
                const re = new RegExp(`(?<![\\p{L}\\p{M}])${reEsc(noun)}\\s+([\\p{L}\\p{M}]{2,})`, "giu");
                for (const m of text.matchAll(re)) {
                    const k = m[1]!.toLowerCase();
                    after.set(k, (after.get(k) ?? 0) + 1);
                    if (examples.length < 10)
                        examples.push(`${p.title}: …${text.slice(Math.max(0, m.index! - 50), m.index! + m[0].length + 26).trim()}…`);
                }
            }
        }
    }
    console.log(`\n── ${wiki}.wikipedia.org — what FOLLOWS ${nouns.join(" / ")} ──\n`);
    if (after.size === 0) {
        console.log("  nothing — no article in the search net puts a word directly after that noun.\n");
        return;
    }
    for (const [w, n] of [...after].sort((a, b) => b[1] - a[1]).slice(0, 20))
        console.log(`  ${w.padEnd(22)} ×${n}`);
    console.log(`\n  READ THE EXAMPLES. This tier finds the SLOT, never the sense — the commonest follower of a`);
    console.log(`  unit noun is often a numeral or an ordinary adjective, and only the quotes tell you which.\n`);
    for (const e of examples) console.log(`    ${e}`);
    console.log();
}

const exists = await wikiExists();
if (!exists) {
    console.error(`${wiki}.wikipedia.org does not respond as a wiki — a negative from here is NOT evidence.`);
    console.error(`Pass --wiki <code> if this language's wiki is filed under a different code.`);
    process.exit(3);
}

// `--after` is its own mode: it discovers candidates rather than judging them, so it prints and exits
// without writing the artifact — nothing here is a finding yet.
const afterArg = arg("after");
if (afterArg !== undefined) {
    await slotProbe(afterArg.split(",").map((n) => n.trim()).filter((n) => n !== ""));
    process.exit(0);
}

// A MISSING ARGUMENT IS A USAGE ERROR, not a stack trace: `words()` throws, and at top level that surfaced
// as an unhandled rejection with a Node banner, which reads like the tool is broken rather than misinvoked.
let wordList: string[];
try {
    wordList = words();
} catch (e) {
    console.error(`${(e as Error).message}`);
    console.error("usage: --lang <code> [--words a,b,c | --from-review | --after noun,noun] [--wiki <wikicode>] [--limit N]");
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
if (findings.some((f) => !f.bounded)) {
    console.log(`  * = UNSPACED SCRIPT: no word boundary exists, so the count is a SUBSTRING count and this`);
    console.log(`  tool supplied no precision at all. The hit may be a fragment of a longer compound. The`);
    console.log(`  examples below are the whole of the evidence — an unread \`attested*\` is worth nothing.\n`);
}
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
// \`bounded\` false means the word is in an UNSPACED script (Han, kana, Thai, Khmer, …) where no word boundary
// exists to test, so \`tokenHits\` is a substring count and the verdict is written \`attested*\`. The precision
// that makes \`Libyen\` fail for \`Yen\` is simply unavailable — a Han hit can always be part of a longer
// compound — so for those the examples are not a courtesy, they are the entire finding.
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
            "bounded": ${f.bounded},
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
