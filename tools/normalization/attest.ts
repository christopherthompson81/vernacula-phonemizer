/**
 * WORD ATTESTATION PROBE — answer "is this word actually used in this language?" for the words
 * `review.ts --lang X` reports as *in NO source*.
 *
 * WHY THIS EXISTS. The sourcing gate's haystack is the FLEURS corpus + the mined artifact + the referee word
 * lists + the language's own data files + espeak `dictsource` + any sister standard. That is a strong haystack
 * for a well-resourced language and a thin one otherwise, and the batches kept ending on the same
 * unresolvable prompt — one currency word, attested nowhere, shipped as a stated assumption because dropping
 * the sign would delete the currency from the only sentences that have one:
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
 * ── AND THE ERROR THAT PRECISION CAN MAKE IN THE OTHER DIRECTION ───────────────────────────────────────
 *
 * A boundary test can also be too narrow, and then it manufactures the negative instead of the positive.
 * This tool split words on every non-letter, so a word whose ORTHOGRAPHY CONTAINS PUNCTUATION was cut in
 * half before the test ran and could never be a token: `sampè'` (mad) came back `0 token / 17 substring`
 * while the run's own examples read `ḍâri sobbhu sampe’ pokol 10:00`. Of 522 recorded findings in
 * `tools/corpus/attest/`, ALL 11 whose probed word held an apostrophe or hyphen were `substring-only`,
 * against an 82% `attested` rate for plain words — five languages, one bug. Since a `substring-only` reads
 * as unattested and this project leaves an unattested word unauthored, the instrument was producing refusals
 * for exactly those languages that write a glottal stop, an elision or a compound hyphen. See `matchers()`.
 *
 * ── EXCEPT WHERE THERE ARE NO WORD BOUNDARIES ──────────────────────────────────────────────────────────
 *
 * The paragraph above is right for every alphabetic script and WRONG for a spaceless one, and the original
 * tokenizer's comment here claimed it "works for a spaceless orthography's words too" while doing the exact
 * opposite. Splitting Chinese prose on non-letters yields ONE token per sentence, so `toks.has(word)` is
 * false for every real Chinese word and the verdict is `substring-only` no matter what. Measured on cmn:
 *
 *   等于 小于 乘以 除以 平方 立方 摄氏度 …  →  0 token / 1 substring — every one, including 摄氏度,
 *                                            which this repo has SHIPPED as the Celsius word since the start62
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
import { pathToFileURL } from "node:url";

/** ⚠ Only dispatch when this file IS the entry point — the same guard `mine.ts` and `wiki-health.ts` carry,
 *  and for the same reason: without it the CLI runs on import, and the `process.exit(2)` below would kill a
 *  test process before it could call `matchers()`. The boundary rule this file turns on is the one thing here
 *  that is pure and testable, and it stayed untested — and wrong — for as long as it was unreachable. */
const IS_CLI = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

const USAGE = "usage: --lang <code> [--words a,b,c | --from-review | --after noun,noun] [--wiki <wikicode>] [--limit N]";
const argv = process.argv.slice(2);
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);

const lang = arg("lang");
const wiki = arg("wiki", lang) ?? "";
const limit = Number(arg("limit", "40"));
/**
 * `--context` — THE REGISTER TIER, and the one the sign-reading work showed is not optional.
 *
 * Terms appended to the SEARCH query only. The hit test, the token boundaries and the verdict are untouched:
 * this narrows WHICH ARTICLES are sampled, it does not loosen what counts as a hit.
 *
 * ⚠ WHY A SEARCH-SIDE RESTRICTION AND NOT A BETTER WORD LIST. Plain `--words` asks whether a word exists, and
 * for a mathematical reading that question has a false-positive answer. Probing German
 * `ist gleich,kleiner als,größer als,geteilt durch` returned three `absent` and one `attested` — `größer als`
 * ×2, **both from "Gott ist größer als Elvis", a film title.** The word existed; the sense was cinema. Appending
 * the language's own words for arithmetic to the query puts the sample in maths prose, where a hit for a
 * relational word is a hit in the slot the sign occupies.
 *
 * ⚠ AND IT IS STILL NOT A SENSE TEST. Restricting the sample raises the prior; it cannot check the reading.
 * Read the examples — that instruction gets stronger here, not weaker, because a plausible register makes a
 * wrong quote easier to accept.
 *
 *   npx tsx tools/normalization/attest.ts --lang es --words "igual a,dividido entre" \
 *     --context "matemáticas aritmética división"
 */
const context = arg("context");
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
    /**
     * ⚠ A 429 IS NOT AN ERROR, IT IS A WAIT — and treating it as an error is what destroyed a cache.
     *
     * This threw on the first non-OK response, so a rate limit arriving at word 3 of 20 killed the process
     * with a stack trace and the run wrote nothing. Combined with the carry-forward bug (see `BLOCK_RE`),
     * which forced every cache to be built by a single all-or-nothing run, that made a small wiki's rate
     * limiter able to make an entire language unprobeable: the `bar` run lost nine recorded findings exactly
     * this way, and the fix it needed was to wait a few seconds.
     *
     * So the transient statuses are retried with exponential backoff, honouring `Retry-After` when the wiki
     * sends one. Everything else still throws immediately — a 404 or a 414 is a fact about the request and
     * waiting cannot improve it. When the retries are exhausted it throws too, because the alternative is
     * returning an empty result, and this file's whole hazard is the manufactured confident negative.
     */
    const TRANSIENT = new Set([429, 502, 503, 504]);
    let wait = 2000;
    for (let attempt = 0; ; attempt++) {
        const r = await fetch(u, { headers: { "User-Agent": UA } });
        if (r.ok) return r.json();
        if (!TRANSIENT.has(r.status) || attempt >= 5) {
            throw new Error(`${r.status} ${r.statusText} — ${wiki}.wikipedia.org`
                + (TRANSIENT.has(r.status) ? " (still rate-limited after 6 attempts — back off and retry later;"
                    + " do NOT reduce --limit, which makes the counts incomparable with the tree's)" : ""));
        }
        const after = Number(r.headers.get("retry-after"));
        const delay = Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 60_000) : wait;
        console.error(`  ${r.status} from ${wiki}.wikipedia.org — waiting ${Math.round(delay / 1000)}s `
            + `(attempt ${attempt + 1}/6). Prior findings in the cache are untouched.`);
        await new Promise((res) => setTimeout(res, delay));
        wait = Math.min(wait * 2, 60_000);
    }
}

/** Does the wiki exist at all? A negative from a nonexistent wiki is not evidence of anything. */
async function wikiExists(): Promise<boolean> {
    try {
        const j = await api({ action: "query", meta: "siteinfo" });
        return typeof j?.query?.general?.sitename === "string";
    } catch { return false; }
}

/** Escape a probed word for use inside a regex — a term list may contain a dot or a hyphen. */
export const reEsc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * THE APOSTROPHE IS ONE CHARACTER WEARING SEVEN CODEPOINTS, and which one a wiki uses is a typographic
 * accident, not a fact about the language.
 *
 * `mad.wikipedia.org` writes the glottal with U+2019 (`sampe’`); the probe list, the corpus and this repo's
 * own source files write it with U+0027 (`sampè'`). Before this class existed the two never met: the probed
 * word could not match the wiki's spelling of the SAME WORD, and the tool answered with a negative.
 *
 * ⚠ U+02BC ʼ AND U+02BB ʻ ARE `\p{Lm}` — LETTERS. A ʼokina therefore sailed straight through every
 * letters-only boundary as though it were an `a`, welding the word to whatever stood next to it. Folding
 * them here puts Hawaiian-style orthography under the same boundary rule as everything else.
 */
const APOS_CHARS = /['‘’‛ʼʻ´]/gu;
/** The same set as a regex CLASS, for matching against text that has NOT been folded (the example quotes). */
const APOS_CLASS = "['‘’‛ʼʻ´]";
export const fold = (s: string): string =>
    s.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "").replace(APOS_CHARS, "'");

/**
 * THE WORD BOUNDARY — the whole point of this file, and the thing it had wrong for every language whose
 * orthography puts punctuation INSIDE a word.
 *
 * This tool used to gate on token-set membership (`tokens(text).has(w)`) while COUNTING with the lookaround
 * regex below. For a probe made only of letters the two are equivalent — a token is a maximal run of
 * letters, so `w` is in the token set iff `w` occurs flanked by non-letters — but for a word containing an
 * apostrophe or a hyphen they disagree completely, because splitting on non-letters cuts such a word in half
 * and the whole word can never be a token. Measured over `tools/corpus/attest/*.jsonc`: of 522 recorded
 * findings, the 11 whose probed word contained an apostrophe or hyphen were `substring-only` — **all
 * eleven, 0 token hits** — against an 82% `attested` rate for plain words. Five languages, one cause:
 *
 *   ln  kilomɛtrɛ-kare · mad sampè' · mg tora-telo, isan-jato · nan Liap-sī, kong-kin, … · om baay’isuu, …
 *
 * A `substring-only` verdict READS AS A NEGATIVE and this project's rule is to leave a word unauthored when
 * it is unattested, so the failure was one-directional: it manufactured refusals, and only for languages
 * that write a glottal stop, an elision or a compound hyphen.
 *
 * WHY NOT SIMPLY WIDEN THE SPLIT CLASS, the way `corpus-words.ts` does (`[^\p{L}\p{M}‌'’-]+`). Because that
 * makes the tokenizer swallow punctuation wherever it sits, including where it is NOT part of the word — a
 * closing quote (`said 'ak'` → token `ak'`), an English possessive, a sentence-final apostrophe. That is the
 * OVER-report direction, and it is the worse one: this file's header records four occasions where a
 * substring was mistaken for an attestation, and a false positive is what lets a word be authored on
 * evidence that is not there. The lookarounds below add nothing to the token test for plain words; they only
 * stop cutting words that contain punctuation.
 *
 * ONE TIGHTENING, in the precision direction. Bare `(?<![\p{L}\p{M}])` treats any non-letter as a boundary,
 * so probing `sampe` against `sampe'an` would match — the `Libyen` error arriving through punctuation rather
 * than through a letter. So a flanking apostrophe THAT IS ITSELF GLUED TO A LETTER is not a boundary either.
 *
 * ⚠ THE HYPHEN IS DELIBERATELY NOT IN THAT REJECTION CLASS. An apostrophe binds tightly — glottal stop,
 * elision, ʼokina — so a letter on its far side belongs to the same word. A hyphen is a compound or syllable
 * joiner whose halves are routinely words in their own right (POJ `chit-ê`, and the hyphenated-compound
 * habit of Malagasy and Lingala). Rejecting it would newly make `chit` fail inside `chit-ê`: a change in the
 * FALSE-REFUSAL direction, which is the failure being fixed here. Hyphens keep exactly their old behaviour
 * as a boundary; what changes is that a hyphenated PROBE is no longer torn apart before the test runs.
 */
const LM = "\\p{L}\\p{M}";
function boundedSource(body: string): string {
    return `(?<![${LM}])(?<![${LM}]${APOS_CLASS})${body}(?![${LM}])(?!${APOS_CLASS}[${LM}])`;
}

/**
 * WHICH PROBES THE REMOTE TOKENIZER CANNOT BE TRUSTED TO HAVE SAMPLED — the search-side twin of the boundary
 * rule above, exported so it can be pinned without a live wiki.
 *
 * A word containing a hyphen or an apostrophe is split by CirrusSearch exactly as this file's own tokenizer
 * used to split it, so the plain word query returns articles matching the PARTS. See `probe()` for the cdo
 * measurement. Unspaced scripts are excluded: they carry no such punctuation and their query is not split
 * this way, and a phrase's internal space is already a term separator the search handles correctly.
 */
export const needsInsource = (word: string): boolean =>
    !UNSPACED.test(word) && !isPhrase(word) && /['‘’‛ʼʻ´-]/u.test(word);

/** A probe with internal whitespace is a COLLOCATION, tested as a phrase rather than as a single word. */
const isPhrase = (word: string): boolean => /\s/u.test(word.trim());

/**
 * The two regexes a probe needs, built once and derived from the SAME boundary rule so the gate, the count
 * and the quote can never again disagree about what a word is.
 *
 * `hit` runs against FOLDED text (where every apostrophe variant is already U+0027); `quote` runs against the
 * ORIGINAL text with the ORIGINAL word, because slicing original text at a folded index lands the window off
 * by however many combining marks preceded it. The apostrophes in the quote pattern are widened to the class
 * so an `'`-spelled probe still finds its examples in an `’`-spelled wiki.
 */
export function matchers(word: string): { hit: RegExp; quote: RegExp; bounded: boolean; phrase: boolean } {
    const bounded = !UNSPACED.test(word);
    const phrase = isPhrase(word);
    // Internal whitespace is relaxed to `\s+` so a phrase still matches across a line break or a double space.
    const classed = (t: string): string => reEsc(t).replace(APOS_CHARS, APOS_CLASS);
    const part = (t: string, esc: (x: string) => string): string =>
        phrase ? t.trim().split(/\s+/u).map(esc).join("\\s+") : esc(t);
    const hitBody = part(fold(word), reEsc);
    const quoteBody = part(word, classed);
    return {
        hit: new RegExp(bounded ? boundedSource(hitBody) : hitBody, "gu"),
        quote: new RegExp(bounded ? boundedSource(quoteBody) : quoteBody, "giu"),
        bounded, phrase,
    };
}

/** Does `text` attest `word`? The gate, exported so both failure directions can be pinned by test. */
export function isHit(word: string, text: string): boolean {
    const { hit, bounded } = matchers(word);
    // In an unspaced script no boundary exists, so the substring match IS the hit test — see UNSPACED below.
    if (!bounded) return fold(text).includes(fold(word));
    hit.lastIndex = 0;
    return hit.test(fold(text));
}

/** How many times, on the same rule. */
export function countHits(word: string, text: string): number {
    const { hit } = matchers(word);
    hit.lastIndex = 0;
    return [...fold(text).matchAll(hit)].length;
}

/**
 * Scripts written without spaces between words, where the token test above cannot apply.
 *
 * Keyed off the PROBED WORD, not the wiki: a Chinese word is unspaced wherever it appears, and probing a
 * Latin loan on zh.wikipedia should still get the boundary test that Latin admits. Kana are here with Han
 * because Japanese is unspaced throughout; Hangul is NOT — modern Korean puts spaces between eojeol.
 */
const UNSPACED = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Thai}\p{sc=Lao}\p{sc=Khmer}\p{sc=Myanmar}\p{sc=Tibetan}\p{sc=Javanese}]/u;

/**
 * ⚠ THE PROBE'S OWN FALSE POSITIVE, AND IT WAS RECORDED AS A FINDING BEFORE IT WAS UNDERSTOOD. `ht.jsonc`
 * carried `mw` — "attested, 76 token hits across 14 articles, 0 substring-only", the strongest verdict this
 * tool can issue. Every one of the 76 was inside `.mw-parser-output`, the wrapper class of the CSS that
 * `<templatestyles>` expands into the article. `mw` is not a Haitian word; it is half a CSS class name.
 *
 * ⚠ NO COLUMN OF THIS TOOL COULD HAVE CAUGHT IT. `substringOnly` is the designed defence against a word that
 * only looks sourced, and it is BLIND here: `.mw-parser-output` puts a `.` before `mw` and a `-` after, and
 * both are word boundaries, so the letters really are a token. `bounded` was true, `articles` was 14 —
 * the CSS ships on every article with a reference list, which is exactly the plural-source evidence the
 * header calls the difference between a lead and a finding. Precision cannot rescue a haystack that contains
 * a stylesheet; the stylesheet has to leave the haystack.
 *
 * ⚠ AND THE SAME BLOCK WAS REPORTED TWICE MORE, THROUGH THE OTHER ROUTE. `nya mw` ×2 and `ln mw` came out of
 * `mine.ts`'s artifacts, and all three are one MediaWiki CSS block, not three language findings. It is
 * filtered in three places now — here, `mine.ts`'s `extracts()`, and `wikidump-to-text.py` — for the reason
 * `mine.ts` states about the template-error guard: the routes cannot import from each other and a fix on one
 * is not a fix on the others.
 *
 * ⚠ THE SPLIT HAS TO HAPPEN BEFORE THE WHITESPACE COLLAPSE, which is why this is a function and not a
 * `.replace` at the call sites. Both callers used to write `extract.replace(/\s+/gu, " ")` as their first
 * act, and that destroys the paragraph boundary the guard needs — after it, the CSS and the article's prose
 * are one string with no seam to cut at, and the only remaining options are keeping the CSS or discarding a
 * real article whole. Splitting first makes it the same LINE-LEVEL DISCARD every other stage of this
 * pipeline performs: the stylesheet is its own paragraph in a plaintext extract, which is precisely why it
 * became one line of a mined artifact.
 */
const TEMPLATE_STYLES = /mw-parser-output|@media\s+(?:screen|print|all|only)\b|\{[^{}]{0,200}\b(?:margin|padding|font-size|font-weight|font-family|line-height|list-style|column-width|column-count|columns|break-inside|page-break-inside|white-space|text-align|vertical-align|background|border|display|float|clear|overflow|content|color|width|height|position|z-index|visibility)\s*:/iu;

export function articleText(extract: unknown): string {
    return String(extract ?? "")
        .split("\n")
        .filter((para) => !TEMPLATE_STYLES.test(para))
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim();
}

interface Finding {
    word: string;
    tokenHits: number;
    articles: number;
    substringOnly: number;
    examples: string[];
    /** False when the script has no word boundaries, so `tokenHits` is a bare substring count. */
    bounded: boolean;
    verdict: "attested" | "attested*" | "substring-only" | "absent";
    /** Set when the article sample was widened with an `insource:` query — see `probe()`. */
    via?: "insource";
}

/**
 * THE ONE PLACE A FINDING BLOCK IS SHAPED — writer and parser derived from the same constant, because they
 * drifted and the drift disabled the carry-forward entirely.
 *
 * `BLOCK_RE` expected a closing brace at **8** spaces; `renderFinding()` (then inline in the writer) emitted
 * one at **12**. Every cache this tool had ever written therefore parsed as ZERO prior blocks, so the
 * carry-forward guard below fired on every re-run — `REFUSING TO WRITE: N existing finding(s) could not be
 * parsed` — and the cache could only ever be built by ONE run covering every word. That is not a cosmetic
 * bug: the `bar` run deleted its cache to force the single clean run the tool demanded, the wiki then
 * rate-limited it, and nine recorded findings existed afterwards only in an investigation document.
 *
 * The brace width is a range, not a number, because both widths are now in the tree: 71 cached files close
 * their blocks at 12, and a block re-emitted through carry-forward keeps whatever it had. Anything inside a
 * block sits at 12 or 16 spaces and none of it is a brace, so the lazy match still stops at the block's own
 * closer. `test/normalization-attest.test.ts` pins the round trip against `renderFinding()` output rather
 * than against a hand-typed fixture, so the two cannot drift apart again silently.
 */
export const BLOCK_RE = /\{\s*"word":[\s\S]*?\n {8,12}\}/gu;

/** Render one finding exactly as the cache stores it — the input side of the round trip `BLOCK_RE` parses. */
export function renderFinding(f: Finding): string {
    const esc = (s: string): string => JSON.stringify(s);
    return `        {
                "word": ${esc(f.word)},
                "verdict": ${esc(f.verdict)},
                "bounded": ${f.bounded},${f.via === undefined ? "" : `
                // The article sample was widened with an \`insource:\` query, because CirrusSearch tokenises
                // this word on its own punctuation and its plain word query samples the PARTS — see \`probe()\`.
                "via": ${esc(f.via)},`}
                "tokenHits": ${f.tokenHits},
                "articles": ${f.articles},
                "substringOnly": ${f.substringOnly},
                "examples": [${f.examples.map((x) => `\n                ${esc(x)}`).join(",")}${f.examples.length ? "\n            " : ""}]
            }`;
}

/**
 * Batch titles by their ENCODED LENGTH, not by count.
 *
 * The API takes `titles` in the query string, so every title is percent-encoded — and a non-Latin script
 * costs about three bytes per character. A fixed batch of 20 titles is fine for Latin and overflows the URI
 * limit for Devanagari: mr.wikipedia returned **414 URI Too Long** and the probe died with a stack trace,
 * which for an attestation tool reads as "this language has nothing" — the manufactured-negative failure this
 * file's `api()` already warns about, arriving through a different door.
 */
function titleBatches(titles: string[], budget = 1500): string[][] {
    const out: string[][] = [];
    let cur: string[] = [], len = 0;
    for (const t of titles) {
        const cost = encodeURIComponent(t).length + 3; // + the `|` separator, encoded
        if (cur.length > 0 && (len + cost > budget || cur.length >= 20)) { out.push(cur); cur = []; len = 0; }
        cur.push(t); len += cost;
    }
    if (cur.length > 0) out.push(cur);
    return out;
}

async function probe(word: string): Promise<Finding> {
    const w = fold(word);
    // In an unspaced script the hit test is a plain substring; everywhere else it is flanked by the
    // boundary that makes `Yen` fail inside `Libyen` and `sampe` fail inside `sampe'an`, while letting
    // `sampè'` and `Liap-sī` be words. `quoteRe` carries the SAME boundary — see `matchers()`.
    const { hit: hitRe, quote: quoteRe, bounded } = matchers(word);
    // CirrusSearch tokenises, so a plain term search is the right recall net; the token test below is what
    // supplies the precision. `insource:` regex was tried and is worse here — it is expensive on small wikis
    // and its own \b is ASCII-defined, which is the trap that disabled the initialism pass fleet-wide.
    // ⚠ THE SEARCH QUERY MAY CARRY `--context` TERMS; THE HIT TEST NEVER DOES. Widening the query narrows the
    // article sample to a register (see `--context` above); `hitRe` below still tests the probed word alone.
    const search = async (q: string): Promise<any[]> => {
        const s = await api({
            action: "query", list: "search", srsearch: context === undefined ? q : `${q} ${context}`,
            srlimit: String(Math.min(limit, 50)), srnamespace: "0", srprop: "snippet",
        });
        return s?.query?.search ?? [];
    };
    let hits: any[] = await search(word);
    let via: Finding["via"];
    /**
     * ⚠ TRAP 19 AGAIN, ONE LAYER OUT: THE REMOTE TOKENIZER SPLITS THE SAME WORDS THE LOCAL ONE DID.
     *
     * Commit `9539e03` fixed this tool's OWN boundary so a hyphenated or apostrophed word could be a token.
     * That fixed the VERDICT and left the SAMPLE wrong, because CirrusSearch tokenises too, and it splits on
     * the hyphen. Probing cdo's `lī-mī` (BUC for "kilometre") the wiki serves the query as the two terms `lī`
     * and `mī` and returns a full 40 articles — `Mī-guók` (America), `Gŭng-lī`, `Hŭk-lò̤-lī-dăk` — not one of
     * which contains the compound. The probe then reads twenty articles chosen for the wrong word, finds
     * nothing, and reports `absent` with **0 substring hits too**, which is the reading that says "this word
     * does not exist". `lī-mī`, `gŭng-gĭng` and `lĭk-huŏng` were all recorded `absent` on cdo. All three are
     * in the wiki.
     *
     * ⚠ SO THE TRIGGER IS THE PUNCTUATION, NOT AN EMPTY RESULT. The obvious guard — retry when the search
     * comes back with nothing — never fires, because the split query is not empty; it is *full of the wrong
     * articles*. A punctuation-bearing probe simply cannot trust a tokenised word query to have sampled the
     * word it was given, so the `insource:` query is fired for every such probe and its titles are read FIRST.
     * (`insource:"…"` matches the literal string in the raw wikitext, so the hyphen survives the query: 2
     * articles for `lī-mī` against the word query's 40 irrelevant ones.)
     *
     * This widens RECALL only. Every article either query returns still faces the same `hitRe` below, so
     * nothing about what counts as an attestation is relaxed — and the word-query titles are kept after the
     * `insource:` ones rather than replaced, because on a big wiki the tokenised query is the better net for a
     * word whose hyphen is optional in practice. The retry is recorded in the cache as `"via": "insource"`,
     * since a reader must be able to reproduce the sample that produced the verdict.
     *
     * The file header's objection to `insource:` stands for the general case (expensive on small wikis, and
     * its regex form has an ASCII-defined `\b`). Neither applies here: it is the quoted literal form, fired
     * once, only for probes the plain query provably mis-samples, and no `\b` of the wiki's is trusted.
     */
    if (needsInsource(word)) {
        const exact = await search(`insource:"${word.replace(/"/gu, "")}"`);
        if (exact.length > 0) {
            via = "insource";
            const seen = new Set(exact.map((h: any) => String(h.title)));
            hits = [...exact, ...hits.filter((h: any) => !seen.has(String(h.title)))];
        }
    }
    if (hits.length === 0) {
        return { word, tokenHits: 0, articles: 0, substringOnly: 0, examples: [], bounded, verdict: "absent" };
    }
    // Pull the pages' text so the judgement is made on prose, not on the API's highlighted snippet (which
    // wraps matches in markup and can elide the surrounding word).
    // Same encoded-length budget as the slot probe: a count-based batch overflows the URI in a non-Latin
    // script, and only the FIRST batch is needed here since `limit` already caps the sample.
    const titles = titleBatches(hits.map((h) => String(h.title)))[0] ?? [];
    // ⚠ ONE TITLE PER REQUEST, AND THIS IS NOT AN INEFFICIENCY — IT IS THE FIX FOR A MANUFACTURED NEGATIVE.
    //
    // This call used to pass all 20 titles with `exlimit: "20"`. The API accepts that and answers with a
    // WARNING rather than an error — `"exlimit" was too large for a whole article extracts request, lowered
    // to 1` — and returns the first page only. So the probe searched twenty articles, read ONE, and reported
    // the other nineteen as containing nothing. Every `absent` and every low `articles` count produced before
    // this fix understates by up to 20×, including a pilot's three German `absent` verdicts.
    //
    // The alternative the API offers is `exintro=1`, which does allow 20 pages — but only their LEAD
    // paragraph, and a relational word or a unit modifier is body prose, not summary prose. Reading whole
    // articles one at a time is the request this tool actually needs; `limit` already caps the sample size.
    const pages: any[] = [];
    for (const t of titles) {
        const e = await api({ action: "query", titles: t, prop: "extracts", explaintext: "1", exlimit: "1" });
        pages.push(...Object.values<any>(e?.query?.pages ?? {}));
    }
    let tokenHits = 0, articles = 0, substringOnly = 0;
    const examples: string[] = [];
    for (const p of pages) {
        const text = articleText(p.extract);
        if (text === "") continue;
        // ⚠ ONE GATE, AND IT IS THE ONE THAT COUNTS. This line used to read
        // `bounded ? tokens(text).has(w) : …` — it GATED on token-set membership while the count two lines
        // below has always used `hitRe`. The two agree for a word made only of letters and disagree utterly
        // for one containing an apostrophe or a hyphen, because splitting on non-letters cuts such a word in
        // half: `sampè'` (mad), `Liap-sī` (nan), `isan-jato` (mg), `baay’isuu` (om) could not match a token
        // no matter how often the wiki wrote them. All 11 such findings in `tools/corpus/attest/` came back
        // `substring-only` — a NEGATIVE — and the same failure had already been caught for MULTI-WORD
        // PHRASES, which `tokens()` splits on the very space they contain: ff's `kiloomeeteer kaaree` was
        // called substring-only in the run whose own example read "468 kiloomeeteer kaaree (181 mi kaaree)".
        // The phrase was special-cased then; the general cause is fixed now. `tokens()` is gone.
        //
        // For an unspaced script no boundary exists, so the substring match stands as the hit.
        if (bounded ? hitRe.test(fold(text)) : fold(text).includes(w)) {
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
            // prompt to look; a misaligned one is a wrong finding, and these quotes are the whole of the
            // evidence for unspaced scripts.
            //
            // The apostrophe is the one exception the quote pattern makes, and it is not a mark: `matchers()`
            // widens each apostrophe in the probe to the whole variant CLASS, so a `'`-spelled probe still
            // quotes its examples from an `’`-spelled wiki. That is not laundering — the word is the same
            // word; only the typography differs, and the count already folded them together.
            tokenHits += [...fold(text).matchAll(hitRe)].length;
            quoteRe.lastIndex = 0;
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
    return { word, tokenHits, articles, substringOnly, examples, bounded, verdict, via };
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
        for (const batch of titleBatches(titles)) {
            const e = await api({
                action: "query", titles: batch.join("|"),
                prop: "extracts", explaintext: "1", exlimit: "20",
            });
            for (const p of Object.values<any>(e?.query?.pages ?? {})) {
                const text = articleText(p.extract);
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

if (IS_CLI) {
    if (lang === undefined) {
        console.error(USAGE);
        process.exit(2);
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
            + `${pad(String(f.substringOnly), 12)} ${f.verdict}${f.via === undefined ? "" : "  ← via insource: (the word query was split on its own punctuation)"}`);
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
    /**
     * ⚠ PRIOR FINDINGS ARE CARRIED FORWARD, BECAUSE THIS TOOL USED TO DESTROY THEM. The cache is per LANGUAGE and
     * the file was rewritten from this run's findings alone, so probing one word deleted every word probed before
     * it — `--lang hi --words दशमलव` replaced seven existing findings (ऋण, गुणा, भाजित, घन, माइनस, बराबर, ऋणात्मक)
     * and the only trace was a cheerful "(replaced 7 prior finding(s))" in the log. The loss is worse than it
     * sounds: each finding costs a live Wikipedia fetch, `review.ts`'s haystack reads the cache for its example
     * prose, and its "wikipedia NOT probed" hint sends the next reader to this exact command. Following the gate's
     * own advice silently unsourced seven other words.
     *
     * A word probed in THIS run always wins — that is a fresh measurement of the same question. Everything else is
     * kept verbatim, block for block, so no re-parse can alter a finding this run did not make.
     */
    const priorBlocks = [...prior.matchAll(BLOCK_RE)].map((m) => m[0]);
    const probed = new Set(findings.map((f) => f.word));
    const carried = priorBlocks.filter((b) => {
        const w = /"word":\s*"([^"]+)"/u.exec(b)?.[1];
        return w !== undefined && !probed.has(w);
    });
    const replaced = priorBlocks.length - carried.length;
    // ⚠ AND THE CARRY-FORWARD IS CHECKED, because the block pattern above depends on the indentation THIS FILE
    // writes, and a hand-edited cache could defeat it — reintroducing the silent deletion by another route. The
    // word list is matched with a pattern that cannot miss, so any word neither probed nor carried means the
    // block parse failed. Loud, and non-zero exit, because the failure mode is data loss.
    const priorWords = new Set([...prior.matchAll(/"word":\s*"([^"]+)"/gu)].map((m) => m[1]!));
    const carriedWords = new Set(carried.map((b) => /"word":\s*"([^"]+)"/u.exec(b)?.[1]));
    const lost = [...priorWords].filter((w) => !probed.has(w) && !carriedWords.has(w));
    if (lost.length > 0) {
        console.error(`\n  REFUSING TO WRITE: ${lost.length} existing finding(s) could not be parsed for carry-forward `
            + `— ${lost.join(", ")}. Writing now would delete them. The block pattern expects the indentation this `
            + `tool emits; if ${outPath} was hand-edited, restore it from git and re-run.`);
        process.exit(1);
    }
    const esc = (s: string): string => JSON.stringify(s);
    writeFileSync(outPath, `// WIKIPEDIA WORD ATTESTATION — ${lang}. Written by tools/normalization/attest.ts.
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
        "tier": ${esc(context === undefined ? "wikipedia" : "wikipedia (register-restricted)")},${context === undefined ? "" : `
        // The article sample was narrowed to this register; the hit test was NOT relaxed. Reproduce with
        // \`--context\` set to exactly this string.
        "context": ${esc(context)},`}
        "findings": [
${[...findings.map(renderFinding), ...carried.map((b) => `        ${b.replace(/^\s+/u, "")}`)].join(",\n")}
        ],
    }
    `, "utf8");
    console.log(`  → ${outPath}${replaced ? `  (re-probed ${replaced} existing finding(s))` : ""}`
        + `${carried.length ? `, ${carried.length} earlier finding(s) kept` : ""}`);
    console.log(`  Only an \`attested\` verdict WITH a sense you have checked belongs in a sourcing argument.\n`);
}
