/**
 * VOCABULARY-SOURCE REPORT — per language, which classes of normalizer vocabulary have a source, and
 * which are blocked. Run this BEFORE writing a layer, and again when planning a re-sweep.
 *
 * WHY THIS EXISTS. Reading back through all 25 merged normalization PRs, the "deliberately not done" lists are not 25
 * different problems. They are the SAME HANDFUL OF VOCABULARY CLASSES recurring, and in almost every case the
 * deferral turns on one question — *is there a source for this class in this language?*
 *
 *   initialisms / letter names   mentioned in 20 of the 25 PRs
 *   era markers                  18
 *   fraction denominators        16
 *   rate + frequency units       14
 *   sports-time / colon          14
 *
 * Every one of those was hand-investigated, per language, by whoever wrote the layer — and the cost of doing
 * it by hand is not the time, it is that **it was got wrong**: Slovak deferred 119 initialisms with
 * "it is a separate seam", when the seam existed, 30 languages already wired it, and espeak carried Slovak's
 * full letter-name table. ⚠ That is the before-declaring-a-class-out-of scope) mechanised: the check becomes a lookup.
 *
 * The counterpart matters just as much. Luxembourgish and Zulu/Xhosa deferred the same
 * class CORRECTLY — lb_list has 2 of 26 letter names and espeak ships no Zulu or Xhosa at all — and the
 * report says so, so nobody re-investigates a settled refusal.
 *
 * ⚠ AVAILABILITY IS NOT CORRECTNESS. This says a source EXISTS, never that the word fits the slot. The Fula
 * `hakkunde`, Malay `paun` (the weight, not the currency), Zulu `amaphuzu` (sports points, not the decimal
 * point) and the Gabonese district `Idola` all passed availability and failed sense. Read the source.
 *
 * Usage:
 *   npx tsx tools/normalization/sources.ts --lang zu
 *   npx tsx tools/normalization/sources.ts --all            # every registered language, as a matrix
 *   npx tsx tools/normalization/sources.ts --all --blocked   # only the classes with no source
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { parseJsonc } from "../../src/core/jsonc.ts";
import { join } from "node:path";
// ⚠ FROM `defects.ts`, NOT FROM `review.ts`. The sister set is `review.ts`'s, but `review.ts` is a CLI that
// RUNS ON IMPORT — the hazard this directory has hit four times — so the table already lives in `defects.ts`,
// which is a pure module (`candidates.ts` and `review.ts` both import it from there). One copy, no drift.
import { sistersOf } from "./defects.ts";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? undefined : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);

const ESPEAK = process.env["ESPEAK_NG"] ?? ""; // set ESPEAK_NG to an espeak-ng checkout to enable the dictsource tier
const DICT = join(ESPEAK, "dictsource");

/**
 * ⚠ IS THE ESPEAK TIER EVEN CONNECTED? Three states, and this tool used to collapse two of them into the
 * most confident one: with `ESPEAK_NG` unset, `DICT` is the relative path `dictsource`, every read returns
 * "", and EVERY language then reported `letter-names: espeak does not ship this language at all` — a
 * sentence about espeak's coverage, asserted from a shell variable.
 *
 * That is playbook trap 57's exact shape, and it was caught scoping a four-language batch: Lithuanian,
 * Latvian, Estonian, Basque and Maltese all reported `[NONE]` for every class, and espeak ships letter
 * tables for all five (30–65 letters each). The tell is uniformity — a gate that returns the same answer for
 * every input is not a strict gate, it is a disconnected one — and the cost is the expensive direction:
 * `letter-names` blocked is the single commonest deferral in this sweep (20 of 25 PRs), so a false NONE
 * there closes the question and gets recorded as a refusal.
 *
 * The distinction is NOT "not probed" versus "probed and absent", which is still a sentence about the data.
 * It names the VARIABLE, because that is the thing the reader has to change.
 */
const ESPEAK_OFF = ESPEAK === "" || !existsSync(DICT);
/** The haystack these messages may honestly claim to have searched. `review.ts`'s sourcing line already makes
 *  this distinction — *nobody has probed this* and *the probe ran and the word is absent there too* must not
 *  read the same — and a class that names espeak while the tier is disconnected is making the same mistake. */
const HAYSTACK = ESPEAK_OFF ? "corpus/referee (espeak NOT consulted)" : "corpus/referee/espeak";
const ESPEAK_OFF_NOTE = ESPEAK === ""
    ? "⚠ $ESPEAK_NG IS UNSET — the espeak tier was not consulted at all"
    : `⚠ $ESPEAK_NG IS SET BUT HAS NO dictsource/ (${ESPEAK}) — the espeak tier was not consulted at all`;
const CORPUS_ROOT = process.env["FLEURS"] ?? "";
const REFEREES = "tools/referee-eval/referees";

/** The registry source, read once. `langDir` is called per code and `evidenceKin` calls it once per code in
 *  the fleet, which re-read a 100 KB file ~36,000 times in an `--all` run. */
let REGISTRY: string | undefined;
const registrySrc = (): string => (REGISTRY ??= readFileSync("src/registry.ts", "utf8"));

/** Every `case "xx":` in the registry — the fleet, in the order the registry lists it. */
function fleet(): string[] {
    return [...new Set([...registrySrc().matchAll(/case "([a-z][a-z0-9-]*)":/gu)].map((m) => m[1]!))];
}

/**
 * THE CODES WHOSE EVIDENCE SPEAKS FOR THIS ONE'S DECLARATION — a sister standard, or any code served off the
 * SAME LAYER DIRECTORY.
 *
 * ⚠ WHY THIS EXISTS. `apd`, `zsm`, `pbt` and `bgc` have no corpus, no referee and no espeak of their own, and
 * they do not have a layer of their own either: the registry serves them off `arabic/`, `malay/`, `pashto/`
 * and `hindi/`. So the unit words this file judges for them are not *their* declaration in any meaningful
 * sense — they are the SHARED LAYER'S declaration, being read a second time under a second code. Reporting
 * `[??] nothing could attest them` said something true about their own evidence and nothing at all about the
 * question, while the language the declaration belongs to has a corpus that answers it.
 *
 * ⚠ IT IS DERIVED, NOT HAND-KEPT, and that is the whole point of computing it from `langDir`. A second
 * hand-kept table of "these codes are related" is a table that drifts from `SISTER_STANDARDS` — the hazard
 * that file's own header states — and it would have to be extended by hand every time the registry serves a
 * new code off an existing engine. The registry already knows; asking it cannot go stale.
 *
 * `SISTER_STANDARDS` is imported rather than restated for exactly the same reason, and it is NOT redundant
 * with the directory rule: `nb`/`nn`/`no` and `hr`/`sr`/`bs` are separate directories.
 *
 * ⚠ BORROWED EVIDENCE MAY ONLY ATTEST, NEVER REFUTE. See the call site.
 */
export function evidenceKin(code: string): string[] {
    const dir = langDir(code);
    const sameLayer = dir === undefined ? [] : fleet().filter((c) => c !== code && langDir(c) === dir);
    return [...new Set([...sistersOf(code), ...sameLayer])];
}

function langDir(code: string): string | undefined {
    const reg = registrySrc();
    const imports = new Map<string, string>();
    for (const m of reg.matchAll(/import \{\s*(create\w+)[^}]*\} from "\.\/languages\/([^/]+)\//gu))
        imports.set(m[1]!, m[2]!);
    const at = reg.indexOf(`case "${code}":`);
    if (at === -1) return undefined;
    for (const m of reg.slice(at, at + 600).matchAll(/(create\w+)\s*\(/gu)) {
        const d = imports.get(m[1]!);
        if (d !== undefined) return d;
    }
    return undefined;
}

const read = (f: string): string => { try { return readFileSync(f, "utf8"); } catch { return ""; } };

/**
 * COMMENTS OUT, CODE IN — and it had to become a SCANNER, for the third time in this file and for the same
 * reason each time.
 *
 * ⚠ THE TWO-REGEX VERSION DELETED LIVE CODE, and Italian is how it was found: writing the unit-word class,
 * `it` reported "the layer declares NO unit word" over a layer that declares nineteen of them, three lines
 * below the point where its source stops. Italian's currency note ends by naming two magnitude words in
 * emphasis, separated by a slash — an asterisk, a slash, an asterisk — which is a comment CLOSE and a comment
 * OPEN overlapping in three characters. Stripping block comments first, with no notion of a line comment,
 * therefore opened a comment inside a `//` line and ran it to the next close in the file, swallowing
 * `magnitudes`, `units`, `exponentWords` and everything else the tier declares.
 *
 * That is not a units-class bug. `percent-word`, `currency-word` and `scale-names` were all reading a
 * truncated Italian layer, and any language whose prose puts an emphasis marker against a slash is exposed —
 * which is one line of ordinary technical writing away in a repo whose comments quote forms in asterisks.
 * ⚠ And this very comment reproduced it once: written with the offending sequence quoted literally, it closed
 * itself early and broke the parse. The sequence is spelled out in words above for that reason.
 *
 * A line comment therefore has to be recognised BEFORE a block comment can open inside it, and strings and
 * regex literals have to be stepped over rather than pattern-matched. The regex-vs-division heuristic is the
 * same one `literals()` uses. The `[^:]` guard the old expression carried for `https://` is gone with it: a
 * URL lives inside a string, and the scanner does not read inside strings.
 */
export function strippedOfComments(t: string): string {
    let out = "";
    let prev = ""; // previous significant character, for the regex-vs-division decision
    for (let i = 0; i < t.length; i++) {
        const ch = t[i]!;
        if (ch === "/" && t[i + 1] === "/") {
            const nl = t.indexOf("\n", i);
            i = nl === -1 ? t.length : nl - 1;
            out += " ";
            continue;
        }
        if (ch === "/" && t[i + 1] === "*") {
            const end = t.indexOf("*/", i + 2);
            i = end === -1 ? t.length : end + 1;
            out += " ";
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            const end = skipString(t, i);
            out += t.slice(i, end + 1);
            i = end;
            prev = ch;
            continue;
        }
        if (ch === "/" && (prev === "" || "(,=:[!&|?{};+-*%~^<>".includes(prev))) { // a REGEX literal
            let j = i + 1;
            let cls = false;
            for (; j < t.length; j++) {
                const d = t[j]!;
                if (d === "\\") { j++; continue; }
                if (d === "[") cls = true;
                else if (d === "]") cls = false;
                else if (d === "/" && !cls) break;
                else if (d === "\n") { j = i; break; } // not a regex after all
            }
            out += t.slice(i, j + 1);
            i = j;
            prev = "/";
            continue;
        }
        out += ch;
        if (!/\s/u.test(ch)) prev = ch;
    }
    return out;
}

export interface Ctx {
    code: string;
    dir: string | undefined;
    espeak: string;
    referee: string;
    langSrc: string;
    corpus: string;
}

export function context(code: string): Ctx {
    const dir = langDir(code);
    let corpus = "";
    if (existsSync(CORPUS_ROOT))
        for (const cd of readdirSync(CORPUS_ROOT).filter((c) => c.startsWith(`${code}_`)))
            for (const f of readdirSync(join(CORPUS_ROOT, cd)).filter((f) => f.endsWith(".tsv")))
                corpus += read(join(CORPUS_ROOT, cd, f));
    /**
     * ⚠ AND THE MINED ARTIFACT, BECAUSE OTHERWISE THIS TOOL MANUFACTURES SETTLED REFUSALS. Every "no % in
     * corpus" verdict below is read off `ctx.corpus`, and for a language with no FLEURS corpus that string was
     * EMPTY — so the report said `[ · ] percent-word — no % in corpus` about a language whose mined artifact
     * carries 1,291 percent signs, 4,014 ranges and 15,952 iteration marks.
     *
     * That is the worst possible failure for THIS file specifically. Its whole purpose, stated in its own
     * header, is that "the check becomes a lookup" so nobody re-investigates a settled class — and it cites a
     * language that deferred 119 initialisms because someone concluded the seam did not exist. A false `·` here
     * does not merely mislead one pass; it tells every later pass that the class does not apply.
     *
     * The artifact is appended rather than substituted, so a language with BOTH sources is judged on both.
     */
    const art = new URL(`../corpus/mined/${code}.jsonc`, import.meta.url).pathname;
    if (existsSync(art)) {
        const doc = parseJsonc(read(art)) as { hard?: { text: string }[]; sample?: string[] };
        corpus += [...(doc.hard ?? []).map((h) => h.text), ...(doc.sample ?? [])].join("\n");
    }
    let referee = "";
    if (existsSync(REFEREES))
        for (const f of readdirSync(REFEREES).filter((f) => f.startsWith(`${code}.`))) referee += read(join(REFEREES, f));
    // COMMENTS ARE STRIPPED, and the tool's own first run is why. Oromo reported `scale-names: Celsius
    // Fahrenheit` — from its own source, where the only occurrences are the COMMENT recording that neither is
    // sourceable, part of it written during that PR's review. A file documenting an absence was being read as
    // evidence of presence, which is as close to a self-refuting measurement as this tool could produce.
    const stripComments = strippedOfComments;
    let langSrc = "";
    if (dir !== undefined && existsSync(join("src/languages", dir)))
        for (const f of readdirSync(join("src/languages", dir)))
            langSrc += f.endsWith(".ts") || f.endsWith(".jsonc")
                ? stripComments(read(join("src/languages", dir, f)))
                : read(join("src/languages", dir, f));
    return { code, dir, espeak: read(join(DICT, `${code}_list`)) + read(join(DICT, `${code}_extra`)), referee, langSrc, corpus };
}

/**
 * `unknown` is NOT `check`, and the distinction is the point of the scale-names repair. `check` says "a source
 * probably exists, go confirm it with review.ts". `unknown` says **this tool could not read the evidence** —
 * an unread script, or a layer arm whose output is computed — so it is refusing to answer rather than
 * guessing. It prints `[??]`, and it is deliberately not counted as blocked work in `--all`: nothing is
 * blocked, the instrument simply cannot see.
 */
export type Verdict = "have" | "partial" | "none" | "check" | "unknown" | "n/a";
export interface Row { klass: string; verdict: Verdict; detail: string }

/**
 * LETTER NAMES — the class that blocks `core/initialisms.ts`, and the one worth the most care, because the
 * seam is a NO-OP without it: `spellOut()` returns undefined the moment any letter lacks a name, so wiring it
 * with a partial table silently changes nothing rather than half-working.
 *
 * espeak writes them two ways and both must be counted: a bare single-letter headword (`b  be:`, Slovak and
 * Czech) and an underscore-prefixed one (`_a  a:`, where the bare letter would collide with a real word).
 * Neither shape is universal — sv_list uses only the first, lb_list has 2 of 26 and fills the rest of that
 * block with ACCENT names, which is exactly the trap that makes a header say "letter names" over data that
 * is not.
 *
 * See `NOT_SPELLING_LETTERS` below for the third shape of the same trap — data that is a real alphabet and
 * still not an answer to this question.
 */

/**
 * SCRIPTS WHOSE SINGLE-CHARACTER HEADWORDS ARE NOT THE LETTERS ANYONE SPELLS WITH.
 *
 * The question this class answers is narrow: when a reader meets an initialism, what does each character get
 * called? `\p{L}` matches 亿 as readily as `b`, and cmn_list is 3,899 lines of Han headwords — so the count
 * came back **3,836 letters** and this tool reported `letter-names espeak 3836 — WIREABLE` for a language
 * whose Latin letter block is entirely COMMENTED OUT. Found by a loop-back on cmn.
 *
 * Excluded by script rather than by count, because a large count can be legitimate: Ethiopic really does have
 * ~350 fidel and Amharic's seam is keyed on them, so a "no alphabet has more than N letters" threshold would
 * have thrown away a real table. Devanagari and Arabic letters are `\p{Lo}` like Han, so the general-category
 * route is no good either.
 *
 * BOPOMOFO IS HERE FOR A DIFFERENT REASON THAN THE REST, and it is the one worth stating: it IS an alphabet,
 * with 37 letters, and excluding Han alone left cmn reporting exactly 37 — a plausible-looking number that
 * was the entire bopomofo block. But bopomofo is a PHONETIC ANNOTATION system; nobody spells 拿 B A out in
 * ㄅㄆㄇ. Chinese initialisms are spelled with LATIN letter names, which is precisely the block espeak has
 * disabled. A source can be real, and an alphabet, and still not answer the question being asked.
 */
const NOT_SPELLING_LETTERS = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}\p{sc=Yi}\p{sc=Bopomofo}]/u;

function letterNames(c: Ctx): Row {
    const inRepo = /letterName:/u.test(c.langSrc);
    // A `$directive` VALUE IS NOT A LETTER NAME, and this is the trap the class header warns about, caught by
    // the tool's own first run: lb_list's letter block is 2 real names (`_a`, `_e`) plus FOURTEEN accent
    // entries (`à  $accent`), and counting those reported 18 of 26 — "partial" for a language that has two.
    // espeak's `$` values are flags (`$accent`, `$abbrev`, `$only`), never pronunciations.
    const keep = (s: Iterable<string>): string[] => [...s].filter((ch) => !NOT_SPELLING_LETTERS.test(ch));
    const bare = new Set(keep([...c.espeak.matchAll(/^(\p{L})\s+(?!\$)\S/gmu)].map((m) => m[1]!.toLowerCase())));
    const under = new Set(keep([...c.espeak.matchAll(/^_(\p{L})\s+(?!\$)\S/gmu)].map((m) => m[1]!.toLowerCase())));
    const n = new Set([...bare, ...under]).size;
    // A COMMENTED-OUT BLOCK IS NOT AN ABSENCE, and reporting it as one loses the most actionable state there
    // is. cmn_list carries all 26 Latin letter names disabled behind `//`, with the reason written above them
    // ("This will make letter within English sentense translated not correctly"), and Chinese speakers DO
    // spell UTC and NBA with Latin letter names — so the data exists, the objection is scoped to espeak's own
    // sentence-level routing, and porting it here is a different question from sourcing it.
    //
    // ONLY LATIN HEADWORDS, AND ONLY IN A NON-LATIN LANGUAGE. The first version of this counted any commented
    // single-character entry and promptly invented a new false positive of exactly the kind above it: Burmese
    // reported 44, which are commented-out WORD entries for single-character particles (`//က $nounf`, and
    // `//က kə3` — က is a postposition as well as a letter). An abugida's single characters are words too.
    // A run of LATIN letters inside a Chinese, Burmese or Thai dictionary cannot be word entries, which makes
    // the script the discriminator — and it is the case that matters anyway, since a non-Latin language spells
    // an initialism (UTC, NBA) with Latin letter names.
    const latinOnly = c.espeak.match(/^(?:_?[\p{sc=Latn}])\s+(?!\$)\S/gmu)?.length ?? 0;
    const disabled = latinOnly >= 20 ? new Set<string>() // already live, not disabled
        : new Set([...c.espeak.matchAll(/^\/\/\s*_?([\p{sc=Latn}])\s+(?!\$)\S/gmu)].map((m) => m[1]!.toLowerCase()));
    if (inRepo) return { klass: "letter-names", verdict: "have", detail: `wired in ${c.dir}/ (espeak has ${n})` };
    if (n >= 20) return { klass: "letter-names", verdict: "have", detail: `espeak ${n} letters — WIREABLE, not yet wired` };
    if (n > 0) return { klass: "letter-names", verdict: "partial", detail: `espeak only ${n} letters — a partial table makes the seam a NO-OP` };
    if (disabled.size >= 20) {
        return {
            klass: "letter-names", verdict: "partial",
            detail: `espeak has ${disabled.size} letter names but COMMENTED OUT — read its reason before porting`,
        };
    }
    // ⚠ THE THIRD STATE COMES FIRST, because it is the one that used to masquerade as the second. With
    // $ESPEAK_NG unset every language reaches here with `c.espeak === ""` and the old text asserted "espeak
    // does not ship this language at all" — a claim about espeak's coverage derived from a shell variable.
    if (ESPEAK_OFF) return { klass: "letter-names", verdict: "unknown", detail: ESPEAK_OFF_NOTE };
    const espeakAtAll = c.espeak !== "";
    return {
        klass: "letter-names", verdict: "none",
        detail: espeakAtAll ? "espeak has the language but no letter block" : "espeak does not ship this language at all",
    };
}

/** THE DECIMAL POINT — espeak's `_dpt` is the separator's name; `_.` is the punctuation mark's, and they are
 *  NOT interchangeable (ms: `_dpt perpuluhan` for a decimal, `_. titik` for a version dot — needed both
 *  and the distinction was the citation). Also accept a manifest `decimalWord`. */
function decimalWord(c: Ctx): Row {
    const dpt = /^_dpt\s+\S/mu.test(c.espeak);
    const dot = /^_\.\s+\S/mu.test(c.espeak);
    const manifest = /"decimal(?:Word|Connector)"\s*:/u.test(c.langSrc);
    const parts = [dpt && "espeak _dpt", dot && "espeak _.", manifest && "manifest decimalWord"].filter(Boolean);
    if (parts.length > 0) return { klass: "decimal-point", verdict: "have", detail: parts.join(" + ") };
    // Two of the three sources for this class live in espeak, so a disconnected tier must not read as absence.
    return ESPEAK_OFF
        ? { klass: "decimal-point", verdict: "unknown", detail: `no manifest word, and ${ESPEAK_OFF_NOTE}` }
        : { klass: "decimal-point", verdict: "none", detail: "no _dpt, no _., no manifest word — read the fraction digit-by-digit" };
}

/** THE ERA PHRASE. Deferred in 18 of 25 PRs, and the reason is almost always that the phrase must be
 *  ASSEMBLED. So this reports the PIECES, and deliberately does not claim a verdict of `have` on them: zu
 *  composed `ngaphambi kukaKristu` from attested pieces where xh refused the identical composition, because
 *  `Kristu` is attested in neither corpus as a bare noun — only inside the word for Christianity. Pieces
 *  present is a lead, not a source. */
function eraPhrase(c: Ctx): Row {
    const hay = `${c.corpus}\n${c.referee}\n${c.espeak}`;
    const marks = [/(?<![\p{L}\p{M}])pred\s+n/iu, /př\.\s?n\.\s?l/iu, /v\.\s?Chr/iu, /f\.\s?Kr/iu, /b\.?c\.?e/iu, /\bBCE\b/u];
    const written = marks.some((re) => re.test(c.corpus));
    const christ = /(?<![\p{L}\p{M}])(Krist|Chris|Kristus|Christus|Kristu)/u.test(hay);
    if (!written) return { klass: "era-phrase", verdict: "n/a", detail: "no era marker in the corpus" };
    return christ
        ? { klass: "era-phrase", verdict: "partial", detail: "marker occurs; a Christ-stem exists somewhere — CHECK it is a bare noun, not a bound stem" }
        : { klass: "era-phrase", verdict: "none", detail: "marker occurs and no era vocabulary anywhere" };
}

/**
 * TEMPERATURE SCALE NAMES. `°C` is common and the scale name is unsourceable in more languages than not; om
 * and xh and zu all stop at the degree word. Worth reporting because "drop the letter" is a decision, and
 * the code should say so rather than the reader discovering it.
 *
 * ⚠ THIS CHECK WAS WRONG IN BOTH DIRECTIONS AT ONCE, which is how it was found — one language reading `ok`
 * with nothing sourced and another reading `NONE` with both names written out in its corpus. The two are the
 * same mistake seen from either end: **the check was a substring search over a haystack that included the
 * layer's own source text, using an enumeration of LATIN transliterations.**
 *
 *   FALSE GREEN. cdo reported `[ ok ] scale-names Celsius Fahrenheit`. Its layer is one line —
 *   `readDegrees(s, { celsius: (n) => `${n} dô`, fahrenheit: (n) => `${n} dô`, bare: (n) => `${n} dô` })` —
 *   in which all three arms emit the BARE degree word and the scale letter is deliberately dropped, because
 *   `攝氏` has no Eastern Min reading anywhere. The words "celsius" and "fahrenheit" in that line are the
 *   OPTION KEYS of a shared helper. A helper's parameter names are not the language's vocabulary, and this is
 *   the same shape as the Oromo bug already recorded above — a file documenting an ABSENCE read as evidence of
 *   presence — except comments were stripped and identifiers were not. Nothing was sourced.
 *
 *   FALSE NEGATIVE. syl reported `[NONE] … the letter gets dropped`, and its corpus writes `০°–১০০° ꠍꠦꠟꠍꠤꠀꠍ`
 *   and `ꠚꠣꠞꠦꠘꠢꠣꠁꠐ ꠁꠃꠘꠤꠐꠅ -৪৫৯.৬৭° ꠚꠣ.` — both names IN FULL, each beside the abbreviation it expands. The
 *   probe is a list of Latin spellings (`celsi|selsi|celzi`), so it cannot read a Syloti Nagri corpus, or a
 *   Bengali, Arabic or Shahmukhi one: arz has `مئويه` and `فهرنهايت` degree-adjacent, pnb has `سیلسیس`, hi has
 *   `सेंटीग्रेड`, and every one of them was reported as a settled absence.
 *
 * WHY THE FALSE GREEN IS THE WORSE HALF. A `NONE` that is wrong costs a re-investigation and teaches the
 * reader to skim the line. An `ok` that is wrong is this instrument failing at the one thing it exists for:
 * it caught a Lao layer that had INVENTED a currency word by reporting it "in NO source", and an `ok` sourced
 * from the layer's own identifiers would have waved that through. So the rule below is asymmetric on purpose —
 * an unreadable layer shape yields `[??]`, never `ok`.
 *
 * THE BOUNDARY.
 *  1. TEXT EVIDENCE is corpus + referee + espeak, and NEVER the layer source. Source text is not a source.
 *  2. CODE EVIDENCE is read as ARMS, not as substrings: the `°C` arm's output is compared with the `°F` and
 *     bare-`°` arms'. Arms that differ declare a scale name (and the emitted text is reported verbatim, so
 *     yue reads `攝氏…度` rather than the English word "Celsius"). Arms that are IDENTICAL are a positive
 *     statement that the letter is dropped — which is how cdo now earns its `NONE` on evidence rather than by
 *     the probe failing to find anything.
 *  3. AN ARM WHOSE OUTPUT CANNOT BE READ STATICALLY IS `[??]`, NOT `none` AND NOT `ok`. rw computes it through
 *     a ternary over a `const CELSIUS`, ab through `MANIFEST.symbols.celsius`, syl through a lookup table
 *     keyed on the abbreviation. All three DO have a scale word; a `none` for any of them would be a fresh
 *     false negative of exactly the kind being fixed.
 *  4. `none` REQUIRES A PROBE THAT COULD HAVE READ THE CORPUS. The transliteration list is Latin-script, so a
 *     miss over a non-Latin corpus is not an absence — it is an unread haystack, and it reports `[??]` with
 *     the degree-adjacent tokens listed so the reader has the candidate in hand rather than a verdict.
 *
 * ⚠ WHAT IS DELIBERATELY NOT ATTEMPTED. Deciding, script-generally, whether a degree-adjacent token IS a scale
 * name. The syl corpus writes `০° ꠍꠦꠟꠍꠤꠀꠍ` (Celsius) and `১৮° ꠘꠤꠍꠦ ꠘꠣꠝꠦ` ("18 degrees BELOW") in the same
 * artifact, and km writes `° និង` ("and") four times; no rule over adjacency separates them without knowing
 * the language. So adjacency produces CANDIDATES inside a `[??]`, never a verdict. An honest unknown is the
 * whole point: this class's job is to stop someone asserting an absence they never checked.
 */
const SCALE_PROBES = {
    celsius: /(?<![\p{L}\p{M}])(celsi|selsi|셀시|celzi|t͡selsi|selisi|centigrad|sentigrad)/iu,
    fahrenheit: /(?<![\p{L}\p{M}])(fahren|faren|farengey|farenhaj)/iu,
} as const;

/**
 * Every string LITERAL in the layer source, with OBJECT KEYS excluded.
 *
 * ⚠ THIS HAD TO BE A SCANNER, and the first attempt — one `matchAll` pairing quotes — reproduced the very bug
 * it was written to fix. A normalization layer is full of REGEX literals containing lone quotes (`/['’]/u`)
 * and of NESTED template literals, so naive pairing runs one "string" across hundreds of lines and swallows
 * the source in between: on cdo it returned a single 400-character "literal" that contained
 * `celsius: (n) => …` verbatim, and the check reported `ok` again. Pairing quotes without tracking regex
 * literals and `${}` nesting is not parsing, it is guessing, and it guessed the same way twice.
 *
 * The regex-literal heuristic is the standard one — a `/` opens a regex when the previous significant
 * character cannot end an expression — which is exact for every shape these layers actually write.
 *
 * KEYS ARE EXCLUDED because a quoted key names a SLOT, not a word: ab's manifest writes
 * `"celsius": "Цельси иградус"`, where the English is the field name and the Abkhaz is the vocabulary.
 */
function literals(src: string): string[] {
    const out: string[] = [];
    let i = 0;
    let prev = ""; // previous significant character, for the regex-vs-division decision
    while (i < src.length) {
        const ch = src[i]!;
        if (ch === '"' || ch === "'" || ch === "`") {
            const quote = ch;
            let j = i + 1;
            let buf = "";
            for (; j < src.length; j++) {
                const d = src[j]!;
                if (d === "\\") { j++; continue; }
                if (d === quote) break;
                // A `${…}` HOLE IS CODE, AND ITS OWN LITERALS COUNT. Skipping it outright lost sr and hr,
                // whose scale words live inside the hole's ternary —
                // `${/[Ff]/u.test(unit) ? "Farenhajta" : "Celzijusa"}` — so the two languages that spell both
                // names out most explicitly read as having neither. So: recurse into the hole.
                if (quote === "`" && d === "$" && src[j + 1] === "{") {
                    let depth = 1;
                    const from = j + 2;
                    j += 2;
                    for (; j < src.length && depth > 0; j++) {
                        if (src[j] === "{") depth++;
                        else if (src[j] === "}") depth--;
                    }
                    out.push(...literals(src.slice(from, j - 1)));
                    j--;
                    continue;
                }
                if (quote !== "`" && d === "\n") break; // unterminated — a regex we misread; give up on it
                buf += d;
            }
            // A LITERAL FOLLOWED BY `:` IS A KEY ONLY WHERE A KEY CAN STAND — after `{` or `,`. Testing the
            // colon alone threw away the TRUE branch of every ternary (`cond ? "Farenhajta" : "Celzijusa"`),
            // which is precisely how hr and sr write their scale words: the two layers that spell both names
            // out in full read as having only one.
            const isKey = /^\s*:/u.test(src.slice(j + 1)) && (prev === "{" || prev === "," || prev === "");
            if (!isKey) out.push(buf);
            i = j + 1;
            prev = quote;
            continue;
        }
        if (ch === "/" && (prev === "" || "(,=:[!&|?{};+-*%~^<>".includes(prev))) { // a REGEX literal, not division
            let j = i + 1;
            let cls = false;
            for (; j < src.length; j++) {
                const d = src[j]!;
                if (d === "\\") { j++; continue; }
                if (d === "[") cls = true;
                else if (d === "]") cls = false;
                else if (d === "/" && !cls) break;
                else if (d === "\n") { j = i; break; } // not a regex after all
            }
            i = j + 1;
            prev = "/";
            continue;
        }
        if (!/\s/u.test(ch)) prev = ch;
        i++;
    }
    return out;
}

type Slot = "c" | "f" | "bare";
/** The three degree arms a layer can write, as the TEXT each emits. A slot in `unreadable` HAS an arm whose
 *  output is computed — tracked per slot, because a layer whose bare-° arm is a callback (ht, uk) can still
 *  have perfectly readable `°C` and `°F` arms, and one poisoned slot must not blind the other two. */
interface Arms { c?: string | undefined; f?: string | undefined; bare?: string | undefined; unreadable: Set<Slot>; any: boolean }

/**
 * Which degree arm is this `.replace` pattern? Decided by what follows the `°`, never by "is there a C
 * anywhere in the pattern" — that reading calls `/(\d+)\s?[°º]\s?([NSEW])/` (om's LONGITUDE arm, `35°W`) a
 * scale arm and then finds its output unreadable, so om reported `[??]` when its real state is the settled
 * refusal this file's own header cites: om stops at *digirii* and drops the letter, on purpose.
 *
 * `undefined` means "not a degree-scale arm at all" — a compass bearing, an angle — and it is skipped rather
 * than counted as unreadable.
 */
function armSlots(pattern: string): Slot[] | "ambiguous" | undefined {
    const at = pattern.indexOf("°");
    if (at === -1) return undefined;
    let inClass = false; // is the ° itself inside a [...]?
    for (let i = 0; i < at; i++) {
        if (pattern[i] === "\\") { i++; continue; }
        if (pattern[i] === "[") inClass = true;
        else if (pattern[i] === "]") inClass = false;
    }
    let rest = pattern.slice(at + 1);
    if (inClass) rest = rest.replace(/^[^\]]*\]/u, "");
    // OPTIONAL WHITESPACE BETWEEN THE SIGN AND THE LETTER, in every shape the fleet writes it — `\s?`, a
    // literal space, and the CHARACTER CLASS of space + no-break space (`[  ]?`) that the African and Bantu
    // layers use. Handling only `\s?` read xh's `°[  ]?[CF]` as a class whose letters are two spaces, i.e.
    // as the BARE arm, and a layer with an explicit scale arm reported as having none.
    for (;;) {
        const next = rest.replace(/^(?:\\s[?*+]?|[\s ]|\[[\s   ]*\][?*+]?)/u, "");
        if (next === rest) break;
        rest = next;
    }
    // ⚠ A NEGATIVE LOOKAHEAD IS NOT THE FOLLOWING LETTER. Nearly every degree rule in the fleet ends
    // `°(?![\p{L}\p{M}])` — a guard saying nothing may follow — and reading the class INSIDE it as the scale
    // letter yields the letters `p L p M`, which are not C or F, so the rule is discarded as "not a scale arm
    // at all". ht lost its bare-degree arm that way and then reported `none` — "the layer declares no scale
    // arm" — about a layer whose very next line emits `degre Sèlsiyis`. A negative guard means the ° is BARE.
    if (/^\(\?<?!/u.test(rest)) return ["bare"];
    const group = /^\(/u.test(rest) ? rest.slice(rest.indexOf("(") + 1).replace(/^\?<?[:=]?/u, "") : rest;
    // A DIGIT AFTER THE ° IS A COORDINATE, NOT A TEMPERATURE — `118°08'`, `22° 11′ 47″`. cdo claims that whole
    // shape in one rule with a callback, and reading it as the bare degree arm made the layer "unreadable",
    // which is how the language whose three temperature arms are provably identical went back to `[??]`.
    if (/^(?:\\d|\\p\{Nd\}|\[?[0-9])/u.test(group)) return undefined;
    const cls = /^\[([^\]]*)\]/u.exec(group);
    const letters = cls !== null ? cls[1]!.replace(/[^\p{L}]/gu, "") : /^[\p{L}]/u.test(group) ? group[0]! : "";
    if (letters === "") return ["bare"];
    // ⚠ THE SCALE LETTER IS OFTEN WRITTEN TWICE, IN TWO SCRIPTS. ru, uk and sr all match `[CСc]` / `[FФf]`,
    // because a Cyrillic corpus writes `20°С` with Cyrillic С as readily as Latin C and the layer must catch
    // both. Reading С as "some other letter, so not a scale arm" made three layers that spell Цельсия and
    // Фаренгейта out in full unreadable — a false `[??]` for the languages with the clearest evidence.
    const LOOKALIKE: Readonly<Record<string, string>> = { "С": "C", "Ф": "F", "Ϲ": "C", "Ⅽ": "C" };
    const up = [...new Set([...letters.toUpperCase()].map((ch) => LOOKALIKE[ch] ?? ch))];
    if (up.every((ch) => ch === "C" || ch === "F")) return up.map((ch) => (ch === "C" ? "c" : "f"));
    // A LATIN NON-C/F LETTER IS A COMPASS BEARING and the rule is not about temperature at all (`35°W`). A
    // NON-LATIN one is the language's own scale ABBREVIATION — syl matches `°\s*(ꠍꠦ|ꠚꠣ)` — and calling that
    // "not a scale arm" would let the layer fall through to an absence verdict. It is a scale arm this tool
    // cannot classify, which is `[??]`, so it is reported as ambiguous rather than skipped.
    return up.every((ch) => /\p{sc=Latn}/u.test(ch)) ? undefined : "ambiguous";
}

/** The text a replacement argument emits, or `undefined` when it is computed. A bare literal and an arrow
 *  returning one literal (`(_m, n) => \`${n} градусів Цельсія\``) are the same declaration written two ways;
 *  reading only the first left uk, xh and rn `[??]` for no reason but syntax. */
function replacementText(arg: string): string | undefined {
    const body = /^\([^)]*\)\s*=>\s*([\s\S]*)$/u.exec(arg.trim())?.[1] ?? arg.trim();
    const lit = /^(["'`])((?:\\.|(?!\1)[^\\])*)\1$/u.exec(body.trim());
    return lit === null ? undefined : lit[2]!.replace(/\$\{[^}]*\}|\$\d|\$&/gu, "");
}

function degreeArms(src: string): Arms {
    const arms: Arms = { unreadable: new Set(), any: false };
    // SHAPE A — the shared Sinitic helper, whose OPTION KEYS are what produced the false green. The key names
    // the slot; only the arrow BODY is the language's text, and `${n}` is the number, not a word.
    // ⚠ THE OPTIONS OBJECT MUST BE BRACE-MATCHED, not lazily regexed to the first `}`. Every arm body is a
    // template literal containing `${n}`, so `\{([\s\S]*?)\}` stops inside the FIRST HOLE and hands back
    // `celsius: (n) => \`${n` — from which no arm is readable and cdo went straight back to `[??]`. The whole
    // point of the arm comparison is that cdo's three arms are IDENTICAL; that is unmeasurable if the object
    // is truncated at the first brace it contains.
    const call = ((): string | undefined => {
        const at = /readDegrees\s*\([^,]*,\s*\{/u.exec(src);
        if (at === null) return undefined;
        let depth = 1;
        let i = at.index + at[0].length;
        for (; i < src.length && depth > 0; i++) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
        }
        return src.slice(at.index + at[0].length, i - 1);
    })();
    if (call !== undefined) {
        arms.any = true;
        for (const [slot, key] of [["c", "celsius"], ["f", "fahrenheit"], ["bare", "bare"]] as const) {
            const at = new RegExp(`(?<![\\p{L}])${key}\\s*:`, "u").exec(call);
            if (at === null) continue;
            const body = call.slice(at.index + at[0].length);
            const lit = /^\s*\([^)]*\)\s*=>\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/u.exec(body);
            if (lit === null) arms.unreadable.add(slot);
            else arms[slot] = lit[2]!.replace(/\$\{[^}]*\}/gu, "");
        }
    }
    // SHAPE B — a local `.replace(/…°…C…/, "…")`. The replacement counts only when it is a plain string
    // literal: a callback or a `new RegExp` built from a table is exactly the shape that must read `[??]`.
    // The `new RegExp(…)` alternative is ONE level paren-balanced: the pattern is a template string that
    // almost always contains a capture group (`(ꠍꠦ|ꠚꠣ)`), and `[^)]*` stops at that group's own paren, after
    // which the whole call fails to match and the arm vanishes instead of counting as unreadable.
    for (const m of src.matchAll(/\.replace\(\s*(?:\/((?:\\.|\[[^\]]*\]|[^/\n])+)\/[a-z]*|new RegExp\((?:[^()]|\([^()]*\))*\))\s*,\s*([\s\S]{0,120}?)\)/gu)) {
        let pat = m[1];
        if (pat === undefined) {
            if (!/°/u.test(m[0])) continue;
            // A `new RegExp(…)` whose pattern is ONE STRING can still be classified — unescape it and ask the
            // same question. ⚠ Without this, hak's COORDINATE rules (`new RegExp(`(\\d+)\\s*°\\s*(\\d+)…`)`)
            // counted as unreadable temperature arms and blanked a layer that emits 攝氏 and 華氏 outright.
            // A pattern ASSEMBLED from named parts (si: `SIGN + NUM + "\\s*[°º]"`) genuinely cannot be read,
            // and that is the case that stays unreadable rather than becoming an absence.
            const lit = /new RegExp\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*[,)]/u.exec(m[0]);
            if (lit === null) {
                arms.any = true;
                for (const s of ["c", "f", "bare"] as const) arms.unreadable.add(s);
                continue;
            }
            pat = lit[2]!.replace(/\\\\/gu, "\\").replace(/\$\{[^}]*\}/gu, "~");
        }
        const slots = armSlots(pat);
        if (slots === undefined) continue;
        arms.any = true;
        if (slots === "ambiguous") { for (const s of ["c", "f", "bare"] as const) arms.unreadable.add(s); continue; }
        const text = replacementText(m[2]!);
        if (text === undefined) for (const slot of slots) arms.unreadable.add(slot);
        else for (const slot of slots) arms[slot] ??= text;
    }
    if (!arms.any && /°\s*\\?s?\*?\s*\[?[CF]/u.test(src)) {
        arms.any = true;
        for (const s of ["c", "f", "bare"] as const) arms.unreadable.add(s);
    }
    return arms;
}

/** Tokens the corpus writes immediately after a `°` — candidates only, never a verdict (see the header). */
function degreeAdjacent(corpus: string): string[] {
    const seen = new Map<string, number>();
    for (const m of corpus.matchAll(/°\s*([\p{L}\p{M}]{1,24})/gu)) {
        const w = m[1]!;
        if (/^[\p{sc=Latn}]{1,2}$/u.test(w)) continue; // C, F, N, E, W — the abbreviation or a compass bearing
        seen.set(w, (seen.get(w) ?? 0) + 1);
    }
    return [...seen].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w, n]) => `${w}×${n}`);
}

/** Is the corpus written in a script the Latin transliteration probe could have read? */
function probeCanRead(corpus: string): boolean {
    const letters = corpus.match(/\p{L}/gu)?.length ?? 0;
    if (letters === 0) return false;
    return (corpus.match(/[\p{sc=Latn}]/gu)?.length ?? 0) / letters > 0.5;
}

export function scaleNames(c: Ctx): Row {
    // ⚠ THE CLASS NAME IS WRITTEN AS A LITERAL FIELD, not hoisted into a shared `const`, because
    // `normalization-sources.test.ts` reconciles this file's classes against `DROPPABLE` by GREPPING for
    // `klass: "…"`. Hoisting it hid `scale-names` from that reconciliation and the pre-flight row for `degree`
    // read as missing — the exact "silent class" failure that test was written to make impossible.
    const row = (verdict: Verdict, detail: string): Row => ({ klass: "scale-names", verdict, detail });
    // ⚠ `\p{Nd}`, NOT `\d` — `\d` is ASCII-only even under `/u`, so a corpus that writes its temperatures in
    // its own digits (`১৮°ꠍꠦ.`, `০°–১০০° ꠍꠦꠟꠍꠤꠀꠍ`) reported "no ° in the corpus" and skipped the class
    // entirely. Same false-absence shape as the rest of this repair, one layer further out: the tool was not
    // deciding wrongly, it was declining to look.
    if (!/\p{Nd}\s?°/u.test(c.corpus)) return row("n/a", "no ° in the corpus");
    // 1. TEXT EVIDENCE — corpus, referee, espeak. The layer's own source is NOT a text source.
    const text = `${c.corpus}\n${c.referee}\n${c.espeak}`;
    const lits = literals(c.langSrc).join("\n");
    const found = (slot: "celsius" | "fahrenheit"): string | undefined =>
        SCALE_PROBES[slot].test(text) ? `attested in ${HAYSTACK}`
            : SCALE_PROBES[slot].test(lits) ? "emitted by the layer" : undefined;
    // 2. CODE EVIDENCE, read as ARMS. Identical arms are the layer SAYING the letter is dropped.
    // ⚠ THE TWO KINDS OF EVIDENCE ARE MERGED, NOT SHORT-CIRCUITED. Returning on the first text hit cost nan
    // its Celsius: its `°C` arm emits 攝氏…度 and its corpus contains the string "Fahrenheit" exactly once — in
    // the FILM TITLE `Fahrenheit 9/11` — so the weaker of the two findings answered for both slots.
    const arms = degreeArms(c.langSrc);
    const norm = (a: string): string => a.replace(/\s+/gu, " ").trim();
    /**
     * THE SCALE WORD IS THE RESIDUE — what the `°C` arm emits that the BARE-degree arm does not.
     *
     * ⚠ "DIFFERS FROM THE OTHER ARM" IS NOT THE TEST, and it produced a fresh false green on the first fleet
     * run: uz reads `°C` as `N daraja` (just "degree") and `°F` as `N daraja farengeyt`. The two arms differ,
     * so a difference test declared a Uzbek Celsius word that does not exist — the identical mistake to the
     * one being repaired, arrived at from the other side. Only Fahrenheit is declared there, and the residue
     * says so: `°C` minus bare is empty, `°F` minus bare is `farengeyt`.
     *
     * The residue is computed by trimming the longest common PREFIX and SUFFIX rather than by splitting on
     * spaces, because half the fleet does not space its words: hak's `攝氏N度` against a bare `N度` yields
     * `攝氏`, and ru's `N градусов Цельсия` against `N градусов` yields `Цельсия`, under one rule.
     */
    const residue = (mine: string | undefined, base: string | undefined): string | undefined => {
        if (mine === undefined || base === undefined) return undefined;
        const a = norm(mine);
        const b = norm(base);
        let s = 0;
        while (s < a.length && s < b.length && a[s] === b[s]) s++;
        let e = 0;
        while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
        const left = a.slice(s, a.length - e).trim();
        return /\p{L}/u.test(left) ? left : undefined;
    };
    // The baseline is the bare-° arm — the reading with the letter dropped. Absent one, the other scale arm
    // is the only baseline available, which is still sound for the identical-arms case (cdo, om).
    const base = (other: string | undefined): string | undefined => arms.bare ?? other;
    const armSays = (slot: Slot, mine: string | undefined, other: string | undefined): string | undefined => {
        if (arms.unreadable.has(slot)) return undefined;
        const r = residue(mine, base(other));
        return r === undefined ? undefined : `the °${slot.toUpperCase()} arm adds ${JSON.stringify(r)}`;
    };
    const cels = found("celsius") ?? armSays("c", arms.c, arms.f);
    const fahr = found("fahrenheit") ?? armSays("f", arms.f, arms.c);
    if (cels !== undefined || fahr !== undefined) {
        const say = [cels && `Celsius — ${cels}`, fahr && `Fahrenheit — ${fahr}`].filter(Boolean).join(" · ");
        return row(cels !== undefined && fahr !== undefined ? "have" : "partial", say);
    }
    // IDENTICAL ARMS ARE THE LAYER SAYING THE LETTER IS DROPPED — a `none` earned on evidence rather than
    // handed out because a probe found nothing. cdo's three arms all emit ` dô`; om's both emit `digirii `.
    const pair: [Slot, string | undefined][] = [["c", arms.c], ["f", arms.f], ["bare", arms.bare]];
    const readablePair = pair.filter(([s, a]) => a !== undefined && !arms.unreadable.has(s));
    if (readablePair.length >= 2 && new Set(readablePair.map(([, a]) => norm(a!))).size === 1) {
        return row("none", `the layer's ${readablePair.map(([s]) => (s === "bare" ? "°" : `°${s.toUpperCase()}`)).join("/")} arms all emit `
            + `the same text (${JSON.stringify(norm(readablePair[0]![1]!))}) — the letter IS dropped, deliberately`);
    }
    const adj = degreeAdjacent(c.corpus);
    const candidates = adj.length > 0 ? ` — degree-adjacent corpus tokens: ${adj.join(" ")}` : " — nothing follows ° in the corpus but the bare letter";
    if (arms.any && arms.unreadable.size > 0) {
        return row("unknown", `the layer HAS a °${[...arms.unreadable].map((s) => (s === "bare" ? "" : s.toUpperCase())).join("/°")} arm but its `
            + `output is computed, not written (table lookup, ternary or manifest field) — read ${c.dir ?? "?"}/${candidates}`);
    }
    // 3. `none` ONLY WHERE THE PROBE COULD HAVE READ THE CORPUS.
    if (!probeCanRead(c.corpus)) {
        return row("unknown", `the scale probe reads LATIN spellings and this corpus is not Latin — a miss is an unread haystack, `
            + `not an absence${candidates}`);
    }
    return row("none", `° occurs, neither scale name in ${HAYSTACK}, and the layer declares no scale arm${candidates}`);
}

/**
 * UNIT WORDS — the class this file did not have, and whose absence is the NAMED ROOT CAUSE of a missing unit
 * word surviving a review cycle.
 *
 * ⚠ `units` WAS EXCLUDED BY DESIGN, and the design was wrong. `review.ts`'s sourcing prompt excludes units for
 * a good and measured reason — a unit borrowing (*kilomita*, *milimetre*) is absent from every source in ~30
 * languages and is perfectly correct there, so failing on an unattested unit word would be noise. But that is
 * an argument about ATTESTATION, and this file's question is the other one: *is there a word at all?* Igbo
 * called the shared tier with NO `units` key for the whole life of its layer — `10 km` read *iɾi km* and
 * `48 kg` read *iɾi anɔ na asatɔ kɡ*, the letters not merely left alone but pronounced as a cluster — and the
 * mandated pre-flight said nothing, because the class did not exist. Eleven languages with a normalization
 * layer were in that state. A silent class is how folklore replaces a lookup; that is this file's own header.
 *
 * ⚠ `units` IS TWO KEYS WITH ONE NAME, and a substring probe cannot tell them apart. `core/numbers.ts`
 * declares `units: string[]` for the DIGIT SPELLINGS 0–9, and every manifest carries
 * `"numbers": { "units": ["аноль", "акы", …] }`. A search for `units` over the layer source therefore finds a
 * unit table in every language in the fleet — the Oromo shape (a file documenting an absence read as evidence
 * of presence) arrived at through a homonym. So the reader below is SCOPED: the brace-matched argument object
 * of a `makeSymbolNormalizer({…})` call, and nothing else.
 *
 * THE BOUNDARY, following the `scale-names` rebuild.
 *  1. TEXT EVIDENCE is corpus + referee + espeak (+ the `attest.ts` cache's ATTESTED example prose, the same
 *     tier `review.ts` admits and under the same restriction — an `absent` finding records the word it probed,
 *     so reading the cache wholesale would attest every word it was ever asked about). The layer source is
 *     NEVER text evidence: a declaration cannot be its own attestation.
 *  2. CODE EVIDENCE is the DECLARATION, read scoped, with ONE level of indirection resolved — a named
 *     `const UNIT = { km: "kilomita" }` (ig, rw, rn) and a manifest pair array
 *     `"units": [["км", "километра"]]` (ab). Without that resolution four languages that demonstrably HAVE
 *     unit words all read `[??]`, starting with the one that motivated the class.
 *  3. A DECLARATION WHOSE WORDS CANNOT BE READ IS `[??]`, never `none` and never `ok`.
 *  4. `none` MEANS "THE LAYER IS WRITTEN AND DECLARES NO UNIT WORD" — a statement about code this tool can
 *     read, the counterpart of the identical-arms rule in `scale-names`. A language with NO layer yet reports
 *     `check`, not `none`: nothing is blocked there, nobody has looked.
 *
 * ⚠ WHAT IS DELIBERATELY NOT CHECKED: the BARE-TOKEN path (`makeBareUnitNormalizer`, the seam that reads a
 * unit standing in a table header rather than after a number), which ~50 languages lacked while having the
 * word. That is a WIRING question, not a vocabulary one — the word is already sourced — and this file reports
 * on sources. It is the leak gates' business, and answering it here would let a `[ ok ]` mean two things.
 */
const UNIT_ABBREVIATIONS = [
    // SI/metric and digital, in the two scripts that write them. ⚠ `s` and `h` are OUT, for the reason the
    // symbol tier itself gives for keeping one-letter denominators out of its standalone alternation: `1990s`
    // is a decade, not four seconds (en s×4, tl s×6, crh s×25). `in` is out because it is the preposition in
    // every Latin-script language that has one (nci in×15, la in×13). And the IMPERIAL set (ft mi lb oz) is
    // out because the Igbo audit established what it is: a parenthetical gloss of a metric figure the sentence
    // already gave (*"kilomita 115 (71 mi)"*), which a layer is right to leave unread.
    "km/h", "km/s", "km", "kg", "cm", "mm", "ml", "mg", "kb", "mb", "gb", "tb", "kw", "mw", "gw",
    "khz", "mhz", "ghz", "hz", "ha", "m", "g", "l", "t",
    "км/ч", "км", "кг", "см", "мм", "мл", "мг", "га", "м", "г", "л", "т",
] as const;
/** The multi-letter keys only — safe to look for inside a REGEX PATTERN, where a one-letter key matches the
 *  inside of `\p{M}` and every other construct that happens to contain that letter. */
const UNIT_MULTI = UNIT_ABBREVIATIONS.filter((u) => u.length > 1);

/**
 * "IS THIS TWO LETTERS OR MORE" — the test that separates a WORD from an abbreviation, a numeral or a stray
 * symbol, and it may NOT be written `\p{L}{2}`.
 *
 * ⚠ `\p{L}{2}` MEANS TWO *ADJACENT* LETTERS, WHICH AN ABUGIDA NEVER HAS. Assamese `কিলোমিটাৰ` is
 * ক ি ল ো ম ি ট া ৰ — nine code points, five of them combining matras (`\p{M}`), and no two letters touch.
 * So the test was false for every Bengali-Assamese word, and the unit table Assamese declares was dropped
 * word by word until nothing was left: the tool printed `NONE — the layer declares NO unit word` at a
 * manifest naming all seven of them. Devanagari, Gujarati, Kannada, Khmer and Thai are the same shape;
 * Burmese passed only by accident, on the bare letter pair inside `ဂရမ်`.
 *
 * A letter with its trailing marks is one letter, so that is what the test counts.
 */
const TWO_LETTERS = /(?:\p{L}\p{M}*){2}/u;

/** Unit abbreviations the corpus writes after a number, most frequent first — the evidence that the class
 *  applies at all. ⚠ `\p{Nd}`, never `\d`: a corpus that writes its numbers in its own digits is still a
 *  corpus (the same false absence the scale probe had). */
function unitsAfterNumber(corpus: string): string[] {
    const esc = (u: string): string => u.replace(/\//gu, "\\/");
    const num = "(?<![\\p{L}\\p{M}])\\p{Nd}[\\p{Nd}.,\u00a0\u066b ]*";
    const tail = "(?![\\p{L}\\p{M}\\p{Nd}])";
    // ⚠ A ONE-LETTER KEY MUST BE SPACED FROM ITS NUMBER, and a Syloti false positive is why. `syl` reported
    // `NONE — the layer declares no unit word` against a layer whose header records the opposite as a MEASURED
    // refusal (`units` and `rate` are both ×0 in its artifact). Its two "unit" hits were `(Γ00l)` and `l99l` —
    // a Latin ⟨l⟩ standing in for the DIGIT ONE in a transliterated Syloti date. Glued to digits, a one-letter
    // key is a numeral lookalike, a decade plural or a version suffix far more often than it is a unit;
    // spaced, it is `5 m`, `20 g`, `1,2 t`, which is how a corpus that means the unit writes it.
    const res = [
        new RegExp(`${num}\\s?(${UNIT_MULTI.map(esc).join("|")})${tail}`, "giu"),
        new RegExp(`${num}[ \u00a0\u202f](${UNIT_ABBREVIATIONS.filter((u) => u.length === 1).join("|")})${tail}`, "giu"),
    ];
    const seen = new Map<string, number>();
    for (const re of res)
        for (const m of corpus.matchAll(re)) {
            const k = m[1]!.toLowerCase();
            seen.set(k, (seen.get(k) ?? 0) + 1);
        }
    return [...seen].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k}×${n}`);
}

const CLOSER: Readonly<Record<string, string>> = { "{": "}", "[": "]", "(": ")" };

/** From just past a quote, the index OF its closing quote. Escapes are honoured; a template's `${}` needs no
 *  special case, since its braces are balanced and are skipped as part of the string either way. */
function skipString(src: string, at: number): number {
    const q = src[at]!;
    for (let i = at + 1; i < src.length; i++) {
        if (src[i] === "\\") i++;
        else if (src[i] === q) return i;
    }
    return src.length;
}

/** Walk from `from`, skipping strings and BALANCED brackets, to the first character in `stop` that is at this
 *  level — or to `end` when there is none. This is what makes the reader scoped rather than substring-based.
 *  ⚠ A REGEX LITERAL IS NOT STEPPED OVER, deliberately: this only ever walks a tier CONFIG object, which is
 *  data, and every one in the fleet is arrays and strings. A layer that put `/[/u` in one would need the same
 *  regex-vs-division heuristic `literals()` carries, and would announce itself as a wrong verdict, not a
 *  silent one — the value would fail to parse as an object and read `[??]`. */
function scanTop(src: string, from: number, stop: string, end = src.length): number {
    for (let i = from; i < end; i++) {
        const ch = src[i]!;
        if (ch === '"' || ch === "'" || ch === "`") { i = skipString(src, i); continue; }
        if (CLOSER[ch] !== undefined) { i = scanTop(src, i + 1, CLOSER[ch]!, end); continue; }
        if (stop.includes(ch)) return i;
    }
    return end;
}

/** The argument object of every `makeSymbolNormalizer({…})` call in the layer, brace-matched. Every call site
 *  in the fleet is written this way, so this is exact rather than a heuristic. */
function tierObjects(src: string): string[] {
    const out: string[] = [];
    for (const m of src.matchAll(/makeSymbolNormalizer\s*\(\s*\{/gu)) {
        const from = m.index! + m[0].length;
        out.push(src.slice(from, scanTop(src, from, "}")));
    }
    return out;
}

/** A TOP-LEVEL property's value text. Top-level is the point: `rateDenominators: { … }` and a nested
 *  `numbers: { units: … }` must not answer for the tier's own `units`. */
function property(obj: string, key: string): string | undefined {
    for (const m of obj.matchAll(new RegExp(`(?<![\\w$.])["']?${key}["']?\\s*:`, "gu"))) {
        if (depthAt(obj, m.index!) !== 0) continue; // a nested `numbers: { units: … }` is a DIFFERENT key
        const from = m.index! + m[0].length;
        return obj.slice(from, scanTop(obj, from, ",")).trim();
    }
    return undefined;
}

/** Bracket depth at `at`, strings skipped. */
function depthAt(src: string, at: number): number {
    let depth = 0;
    for (let i = 0; i < at; i++) {
        const ch = src[i]!;
        if (ch === '"' || ch === "'" || ch === "`") { i = skipString(src, i); continue; }
        if (CLOSER[ch] !== undefined) depth++;
        else if (ch === "}" || ch === "]" || ch === ")") depth--;
    }
    return depth;
}

export interface UnitDecl { words: string[]; where: string; unreadable: boolean }

/**
 * THE CITATION FORM OF EACH ENTRY — the FIRST count form, and not the rest.
 *
 * ⚠ MEASURED, AND THE FIRST VERSION WAS NOISE. Reading every literal in the table demanded attestation of
 * every inflected form a layer declares: ru declares three case forms per unit and fr, es and pt each declare
 * a plural, so 58 of 108 languages came back "some declared unit word is unattested" — a line that says
 * something about almost everyone says nothing about anyone, which is the failure the `scale-names` header
 * calls teaching the reader to skim.
 *
 * The first form is the right one on the tier's OWN terms: it emits exactly this form for a bare unit,
 * "because a bare symbol is a citation, not a count". Whether *kilometrov* is the right genitive plural of an
 * attested *kilometr* is a morphology question; whether the language has a word for the kilometre at all is
 * this one.
 */
function entryHeads(objBody: string): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < objBody.length) {
        const colon = scanTop(objBody, i, ":");
        if (colon >= objBody.length) break;
        const end = scanTop(objBody, colon + 1, ",");
        const first = literals(objBody.slice(colon + 1, end)).find((w) => /\p{L}/u.test(w));
        if (first !== undefined) out.push(first);
        i = end + 1;
    }
    return out;
}

/** An ARRAY of pairs — `[["km", "километра"], …]` and `[[/km/giu, "ကီလိုမီတာ"], …]`, the two shapes a layer
 *  that owns its rule writes. The word is the SECOND literal where there are two (the first is the
 *  abbreviation) and the first where there is one (the abbreviation was a regex, which is not a literal). */
function pairTails(body: string): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < body.length) {
        const open = body.indexOf("[", i);
        if (open === -1) break;
        const end = scanTop(body, open + 1, "]");
        const lits = literals(body.slice(open + 1, end)).filter((w) => TWO_LETTERS.test(w));
        if (lits.length > 0) out.push(lits.length > 1 ? lits[1]! : lits[0]!);
        i = end + 1;
    }
    return out;
}

/**
 * The unit words the layer declares, or `unreadable` when a unit path plainly exists and its words do not.
 * `undefined` is the third state and the loud one: no unit path at all.
 */
/**
 * Is this candidate a WORD, or the thing the word was supposed to replace?
 *
 * ⚠ TWO SHAPES GOT THROUGH AND BOTH WOULD HAVE READ AS `ok`. A `.replace` arm that rewrites `km²` to `km²`
 * (hmn, before it sourced its noun) yields the ABBREVIATION as its own "word" — a green line for a language
 * whose unit was still reaching the sink raw. And a G2P entry yields IPA, not vocabulary: `mˡ`, `k͡χʰ`, `ᵐb`.
 * A modifier letter is the tell for the second and an exact abbreviation match for the first.
 */
function wordLike(w: string): boolean {
    if (!TWO_LETTERS.test(w)) return false;
    if (/\p{Lm}/u.test(w)) return false;
    const bare = w.trim().toLowerCase().replace(/[²³23]$/u, "");
    return !(UNIT_ABBREVIATIONS as readonly string[]).includes(bare);
}

export function unitDeclaration(langSrc: string): UnitDecl | undefined {
    const d = readUnitDeclaration(langSrc);
    if (d === undefined) return undefined;
    const words = d.words.filter(wordLike);
    // A declaration whose every "word" was an abbreviation or an IPA string is not a declaration this tool
    // could read — `[??]`, never an absence and never an `ok`.
    return { ...d, words, unreadable: d.unreadable || (d.words.length > 0 && words.length === 0) };
}

function readUnitDeclaration(langSrc: string): UnitDecl | undefined {
    for (const tier of tierObjects(langSrc)) {
        const value = property(tier, "units");
        if (value === undefined) continue;
        if (value.startsWith("{")) {
            // The words are the VALUES — `{ "គម": ["គីឡូម៉ែត្រ"] }` declares the Khmer word, not the Khmer
            // abbreviation — which is what reading entries rather than literals gets right for free.
            const words = entryHeads(value.slice(1, scanTop(value, 1, "}")));
            return { words, where: "the symbol tier", unreadable: words.length === 0 };
        }
        // ONE LEVEL OF INDIRECTION, and no more. `Object.fromEntries(Object.entries(UNIT).map(…))` over a local
        // table (ig, rw, rn) and `MANIFEST.symbols.units.map(([sym, word]) => …)` over a manifest pair array
        // (ab) are the two shapes the fleet writes; both are the layer's own text, one identifier away.
        const named = [...value.matchAll(/(?<![\w$.])([A-Z][A-Z0-9_]*)(?![\w$])/gu)].map((m) => m[1]!);
        for (const id of named) {
            if (id === "MANIFEST") continue;
            // ⚠ THE TYPE ANNOTATION AND THE ARRAY FORM BOTH HAD TO BE ALLOWED FOR, and neither is exotic:
            // rw and rn write `const UNIT: Readonly<Record<string, string>> = {`, and pl's tier table is
            // `const UNITS: [string, string][] = [`. Matching only `const X = {` left three layers that
            // plainly declare unit words reading `[??]`.
            const at = new RegExp(`(?:const|let|var)\\s+${id}\\b[^=\\n]*=\\s*([{[])`, "u").exec(langSrc);
            if (at === null) continue;
            const from = at.index + at[0].length;
            const body = langSrc.slice(from, scanTop(langSrc, from, at[1] === "{" ? "}" : "]"));
            const words = at[1] === "{" ? entryHeads(body) : pairTails(body);
            if (words.length > 0) return { words, where: `the local \`${id}\` table`, unreadable: false };
        }
        if (/\.units\b/u.test(value)) {
            const words = manifestUnitWords(langSrc);
            if (words.length > 0) return { words, where: "the manifest's symbol units", unreadable: false };
        }
        return { words: [], where: "the symbol tier", unreadable: true };
    }
    // NO TIER `units` KEY — which is not yet an absence, because a layer may resolve its units LOCALLY, and
    // fourteen do. Japanese states the reason: it owns the rule so its own decimal rewrite and the exponent
    // stay adjacent to the number the tier matches on. Same reasoning that made percent/currency read the
    // emission as well as the declaration, and the same measured consequence — reading only the declaration
    // reported five false NONEs there, and ten here.
    const table = localUnitTable(langSrc);
    if (table.length > 0) return { words: table, where: "a unit table the layer owns", unreadable: false };
    return localUnitRule(langSrc);
}

/** The manifest's SYMBOL units — `[["км", "километра"], …]` or `{ "км": ["километра"] }`. ⚠ NOT the NUMBER
 *  units, which are a flat array of digit spellings under the same key name; a flat array is rejected here,
 *  and that rejection is the whole reason this reads structure rather than a name. */
function manifestUnitWords(langSrc: string): string[] {
    const out: string[] = [];
    for (const m of langSrc.matchAll(/"units"\s*:\s*[[{]/gu)) {
        const open = langSrc[m.index! + m[0].length - 1]!;
        const from = m.index! + m[0].length;
        const body = langSrc.slice(from, scanTop(langSrc, from, CLOSER[open]!));
        if (open === "[") {
            for (const p of body.matchAll(/\[\s*(["'])(?:\\.|(?!\1)[^\\])*\1\s*,\s*(["'])((?:\\.|(?!\2)[^\\])*)\2/gu))
                out.push(p[3]!);
        } else {
            out.push(...entryHeads(body));
        }
    }
    return out;
}

/**
 * A UNIT TABLE THE LAYER OWNS RATHER THAN DECLARING TO THE TIER — an abbreviation PAIRED with a word, in any
 * of the four shapes the fleet writes it:
 *
 *     km: "کیلۆمەتر"                  ckb, ja — an object keyed on the abbreviation
 *     km: ["kilometer", "kilometers"]  en — the same with count forms
 *     ["km", "километра"]              bg, ug — an array of pairs
 *     [/km/giu, "ကီလိုမီတာ"]            my — pairs whose key is a regex
 *
 * ⚠ THIS IS NOT OPTIONAL DECORATION, AND THE FIRST FLEET RUN PROVES IT. Reading only the tier declaration and
 * `.replace` arms reported `NONE — the layer declares no unit word` for TEN languages, and reading them found
 * that en, bg, ckb, my, he, ko, ug, ps and za all own a local table: bg's `["km", "километра"]`, my's
 * `[/km/giu, "ကီလိုမီတာ"]`, za's `goengleix` (the commonest noun in its corpus, ×162). That is a false NONE
 * rate of 9 in 10 — the same accusation-by-silence the percent/currency check made on ITS first run, in a
 * class where the accusation is "you left every measurement unread".
 *
 * ⚠ MULTI-LETTER KEYS ONLY. A one-letter key matches the inside of `\p{M}`, of `\s*` and of half the
 * constructs a layer writes; this is source text, not prose.
 */
function localUnitTable(langSrc: string): string[] {
    // ⚠ THE KEY SET IS NARROWER HERE THAN IN THE CORPUS PROBE, AND MEASURING IS WHY. Unscoped, this scan reads
    // a G2P GRAPHEME TABLE as a unit table: `mb: "ᵐb"` in Guaraní, `kw`/`ng` in every Bantu digraph map,
    // `kh: "k͡χʰ"` in Tswana — the computing keys (kb mb gb tb kw mw gw hz) are all ordinary digraphs, and a
    // phoneme map pairs them with a string exactly the way a unit table pairs a word. It reported `[ ok ]
    // unit-word … all attested: ᵐb` for four languages that have no normalization layer at all.
    //
    // So: the METRIC core only, in both scripts that write it, and TWO DISTINCT KEYS required — one pairing is
    // a coincidence, `km` beside `cm` is a table. Every local table in the fleet clears that bar.
    // ⚠ `ml` IS NOT IN THIS SET, and Hmong is why: RPA writes ⟨ml⟩ as a digraph, its G2P maps `ml: "mˡ"`, and
    // with `ml` admitted that pairing was the second key that turned a phoneme map into a "unit table" —
    // reporting the IPA cluster *mˡ* as a declared Hmong unit word. Same family of error as the Guaraní `mb`
    // above, one key further in, and the reason the set here is only what no orthography writes as a digraph.
    const KEYS = ["km/h", "km", "kg", "cm", "mm", "км/ч", "км", "кг", "см", "мм"];
    const re = new RegExp(
        `(?<![\\p{L}\\p{M}])["'\`/]?(${KEYS.map((k) => k.replace(/\//gu, "\\/")).join("|")})(?:[²³]|\\^?[23])?["'\`]?(?:\\/[a-z]*)?\\s*[,:]\\s*\\[?\\s*(["'\`])((?:\\\\.|(?!\\2)[^\\\\])*)\\2`,
        "giu",
    );
    const out: string[] = [];
    const keys = new Set<string>();
    for (const m of langSrc.matchAll(re)) {
        if (!TWO_LETTERS.test(m[3]!)) continue;
        keys.add(m[1]!.toLowerCase());
        out.push(m[3]!);
    }
    return keys.size >= 2 ? out : [];
}

/**
 * A unit rule written LOCALLY rather than declared: a `.replace()` whose PATTERN carries a number and a unit
 * abbreviation, with the word read as the RESIDUE of its replacement — the same arms reading `scale-names`
 * uses, and the same refusal at the end of it (a computed replacement is unreadable, never an absence).
 *
 * ⚠ MULTI-LETTER KEYS ONLY, for the reason `localUnitTable` gives.
 */
function localUnitRule(langSrc: string): UnitDecl | undefined {
    const alt = UNIT_MULTI.map((u) => u.replace(/\//gu, "\\/?")).join("|");
    const key = new RegExp(`(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])`, "iu");
    const words: string[] = [];
    let unreadable = false;
    for (const m of langSrc.matchAll(/\.replace\(\s*(?:\/((?:\\.|\[[^\]]*\]|[^/\n])+)\/[a-z]*|new RegExp\((?:[^()]|\([^()]*\))*\))\s*,\s*([\s\S]{0,120}?)\)/gu)) {
        const pat = m[1] ?? /new RegExp\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/u.exec(m[0])?.[2];
        if (pat === undefined) continue;
        // ⚠ NO SEPARATE "AND A DIGIT" TEST. It was there to keep an unrelated `.replace` out, and it threw
        // away the Hebrew unit arm instead: he builds its pattern as a template
        // (`(?<![\p{L}\p{M}0-9.])(${NUM})\s?km³…`), where the number is an interpolated const and the only
        // literal digits are `0-9` inside a lookbehind CLASS. The metric key as a whole token is specific
        // enough on its own — and a rule that rewrites `km` at all is a unit reading whether or not this tool
        // can see the number beside it.
        if (!key.test(pat)) continue;
        const text = replacementText(m[2]!)?.trim();
        if (text === undefined || !/\p{L}/u.test(text)) unreadable = true;
        else words.push(text);
    }
    if (words.length > 0) return { words, where: "a local `.replace` rule", unreadable: false };
    if (unreadable) return { words: [], where: "a local `.replace` rule", unreadable: true };
    // THE BARE-UNIT CALL'S OWN ARGUMENT, when it is written out. `makeBareUnitNormalizer([["km", "kilometr"]])`
    // is a declaration in every sense — and mos, which sourced `kilometr` at ×31 across 20 articles and wrote
    // the audit into its header, read `[??]` until this was here. One key, so the two-key guard that keeps
    // G2P digraph tables out cannot apply; inside this call there is nothing else the argument could be.
    const bare = /makeBareUnitNormalizer\s*\(\s*\[/u.exec(langSrc);
    if (bare !== null) {
        const from = bare.index + bare[0].length;
        const words = pairTails(langSrc.slice(from, scanTop(langSrc, from, "]")));
        return words.length > 0
            ? { words, where: "the bare-unit call", unreadable: false }
            : { words: [], where: "a bare-unit call", unreadable: true };
    }
    // A UNIT PATH WITH NO TABLE THIS TOOL CAN SEE must not read as an absence. The words are elsewhere; that
    // is `[??]`, which is the honest answer.
    return /makeBareUnitNormalizer\s*\(/u.test(langSrc)
        ? { words: [], where: "a bare-unit call", unreadable: true }
        : undefined;
}

/** SCRIPTS WITH NO WORD SEPARATOR, where a token test has nothing to tokenise and substring is the only test
 *  available — the same accommodation `review.ts`'s attestation haystack makes, for the same reason. */
const UNSPACED = /[\p{sc=Han}\p{sc=Hira}\p{sc=Kana}\p{sc=Khmr}\p{sc=Thai}\p{sc=Laoo}\p{sc=Mymr}\p{sc=Tibt}]/u;

/** Is this word attested in the TEXT evidence? Token-wise, because `hay.includes("tere")` is satisfied by any
 *  longer word containing those four letters — the substring test that passed the Fula word this whole
 *  discipline exists to catch. A multi-word reading (`kilómetro por hora`) counts when every token of it does. */
function attestedIn(word: string, hay: string, tokens: ReadonlySet<string>): boolean {
    if (UNSPACED.test(word)) return hay.includes(word);
    const parts = word.toLowerCase().split(/[^\p{L}\p{M}'’ʻ·-]+/u).filter((t) => t !== "");
    return parts.length > 0 && parts.every((t) => tokens.has(t));
}

/** The `attest.ts` cache, ATTESTED findings only and only their example PROSE. ⚠ Never the file: the cache
 *  records the word it probed even when the verdict is `absent`, so reading it wholesale would attest every
 *  word it was ever asked about — a self-fulfilling haystack, worse than no haystack. */
function attestProse(code: string): string {
    const f = new URL(`../corpus/attest/${code}.jsonc`, import.meta.url).pathname;
    if (!existsSync(f)) return "";
    let hay = "";
    for (const block of read(f).split(/\}\s*,?\s*(?=\{)/u))
        if (/"verdict":\s*"attested"/u.test(block))
            for (const ex of block.matchAll(/"…([^"\\]*)…"/gu)) hay += ` ${ex[1]!} `;
    return hay;
}

export function unitWords(c: Ctx): Row {
    // ⚠ THE CLASS NAME IS A LITERAL FIELD — see the identical note in `scaleNames`. `normalization-sources.ts`
    // greps this file for `klass: "…"`, and hoisting the name would hide the row from that reconciliation.
    const row = (verdict: Verdict, detail: string): Row => ({ klass: "unit-word", verdict, detail });
    const inCorpus = unitsAfterNumber(c.corpus);
    const decl = unitDeclaration(c.langSrc);
    // ⚠ "HAS A LAYER" IS THREE QUESTIONS, and asking only the first got ug and ps wrong: both have a
    // `normalize.ts` and neither calls the shared tier (they export `make<Lang>Normalizer` and own every
    // rule), so a tier-call test reported "no normalization layer yet" about 250 KB of written layer.
    const hasLayer = /makeSymbolNormalizer\s*\(/u.test(c.langSrc)
        || /export function make\w*Normalizer/u.test(c.langSrc)
        || (c.dir !== undefined && existsSync(join("src/languages", c.dir, "normalize.ts")));
    if (decl === undefined) {
        // ⚠ THE TWO ABSENCES ARE NOT THE SAME ABSENCE, and collapsing them would bury the eleven languages
        // this class exists for under the forty nobody has started. A WRITTEN layer that declares no unit word
        // is a fact about code this tool can read — every abbreviation reaches the phoneme sink — and it is
        // the Igbo state exactly. An UNWRITTEN one is a class nobody has looked at yet: `check`, not blocked.
        if (inCorpus.length === 0) return row("n/a", "no unit abbreviation after a number in the evidence, and none declared");
        return hasLayer
            ? row("none", `the layer declares NO unit word — every abbreviation reaches the phoneme sink verbatim `
                + `(after a number in the corpus: ${inCorpus.join(" ")})`)
            : row("check", `no normalization layer yet; the corpus writes ${inCorpus.join(" ")} after a number — `
                + `source the unit words when writing it`);
    }
    if (decl.unreadable) {
        return row("unknown", `${decl.where} declares units but the words are computed, not written — read ${c.dir ?? "?"}/`
            + (inCorpus.length > 0 ? ` (after a number in the corpus: ${inCorpus.join(" ")})` : ""));
    }
    // TEXT EVIDENCE. ⚠ NOT `c.langSrc`: a declaration cannot be its own attestation, which is the door the
    // Igbo `ntụkpọ` finding closed in `review.ts` — the word was extracted FROM the manifest and then
    // "attested" by searching a haystack containing that manifest.
    const hay = `${c.corpus}\n${c.referee}\n${c.espeak}\n${attestProse(c.code)}`.toLowerCase();
    const tokens = new Set(hay.split(/[^\p{L}\p{M}'’ʻ·-]+/u).filter((t) => t !== ""));
    const words = [...new Set(decl.words)];
    // ⚠ NO HAYSTACK IS NOT AN ABSENCE — rule 4 of the `scale-names` rebuild, one class further out. A language
    // with no FLEURS corpus, no mined artifact, no referee and no espeak dictionary has nothing that COULD
    // attest a word, and reporting its declaration as unattested would be an assertion about evidence nobody
    // has.
    if (!/\p{L}/u.test(hay)) {
        /**
         * …UNLESS THE DECLARATION IS SOMEONE ELSE'S, WHICH FOR FOUR CODES IT IS. `apd`, `zsm`, `pbt` and `bgc`
         * carry no corpus, referee or espeak — and no layer either. The registry serves them off `arabic/`,
         * `malay/`, `pashto/` and `hindi/`, so the words being judged here are the SHARED LAYER'S words, read
         * a second time under a second code, and the language they belong to has evidence that answers.
         *
         * ⚠ WHAT THE VERDICT IS ABOUT IS THE SHARED LAYER'S DECLARATION, NOT THIS CODE'S USAGE, and the
         * detail says so in words. Haryanvi is served by the Hindi engine as a LABELLED APPROXIMATION, not as
         * Hindi, so "absent from the Hindi corpus" would be an unsupported claim about Haryanvi — but it is a
         * supported claim about the Hindi tier's declared word, which is the thing this class judges and the
         * thing `bgc` actually reads. Same relation `review.ts` has always assumed for a sister standard.
         *
         * The check reproduces the owning language's own row exactly, which is the evidence that the relation
         * is the right one: apd 0/7 = ar 0/7, pbt 4/5 = ps 4/5, bgc 6/8 = hi 6/8 (zsm gets 1/4 where ms gets
         * 0/4, because `id` is a sister of both and attests *kilometer*).
         */
        const kin = evidenceKin(c.code);
        const kinHay = kin.map((k) => {
            const kc = context(k);
            return `${kc.corpus}\n${kc.referee}\n${kc.espeak}\n${attestProse(k)}`;
        }).join("\n").toLowerCase();
        if (/\p{L}/u.test(kinHay)) {
            const kinTokens = new Set(kinHay.split(/[^\p{L}\p{M}'’ʻ·-]+/u).filter((t) => t !== ""));
            const gone = words.filter((w) => !attestedIn(w, kinHay, kinTokens));
            const via = `the evidence of the layer it shares (${kin.join(" ")}), this code having no corpus, referee or espeak of its own`;
            if (gone.length === 0)
                return row("have", `${words.length} unit word(s) in ${decl.where}, all attested in ${via}: ${words.slice(0, 6).join(" ")}`);
            return row("partial", `${words.length - gone.length}/${words.length} unit word(s) in ${decl.where} attested in ${via}`
                + `; UNATTESTED: ${gone.slice(0, 8).join(" ")} — a shortfall here is about the SHARED LAYER's declaration,`
                + ` not about this code's own usage, and a unit borrowing is legitimately absent from every source in ~30`
                + ` languages: a prompt to READ them, not a defect`);
        }
        return row("unknown", `${words.length} unit word(s) declared in ${decl.where} (${words.slice(0, 6).join(" ")}) and this `
            + `language has NO corpus, referee or espeak dictionary — nothing could attest them, which is an unread haystack`);
    }
    const missing = words.filter((w) => !attestedIn(w, hay, tokens));
    const n = words.length - missing.length;
    if (missing.length === 0) return row("have", `${n} unit word(s) in ${decl.where}, all attested: ${words.slice(0, 6).join(" ")}`);
    /**
     * ⚠ AN UNATTESTED UNIT WORD IS A PROMPT, NEVER A DEFECT VERDICT, AND THAT BOUNDARY IS MEASURED TWICE.
     *
     * `review.ts` excludes units from its sourcing gate for a reason it states: a unit borrowing (*kilomita*,
     * *millimetre*) is absent from every source in ~30 of the 66 languages it checked and is perfectly correct
     * there. This class's own first fleet run reproduces that at full scale — with the evidence tiers actually
     * present, 79 of 108 layers have at least one declared unit word that nothing attests, INCLUDING de, whose
     * `Kilometer` appears in its referee only inside the compound *Kilometerzähler*. A line that is amber for
     * three quarters of the fleet teaches the reader to skim it, which is how the ten `NONE`s below it would
     * be lost — the precise failure the `scale-names` header describes.
     *
     * So: `partial` for any shortfall, with the ratio and the names in the detail, and the reader told what
     * the shortfall does and does not mean. What it may NOT do is read `ok`: the layer's own text is not a
     * source (rule 1), and an `ok` assembled from a declaration is what would have waved the invented Lao
     * currency word through.
     */
    return row("partial", `${n}/${words.length} declared unit word(s) attested in ${HAYSTACK}/attest`
        + `${c.corpus === "" ? " (no corpus for this language)" : ""}; UNATTESTED: ${missing.slice(0, 8).join(" ")}`
        + ` — a unit borrowing is legitimately absent from every source in ~30 languages, so this is a prompt to READ them, not a defect`);
}

/** PERCENT and CURRENCY, the two the review gate already checks — reported here so one command answers the
 *  whole planning question rather than two. */
function tierWords(c: Ctx): Row[] {
    const tier = /makeSymbolNormalizer\(\{[\s\S]*?\n\}\)/u.exec(c.langSrc)?.[0] ?? "";
    // A LAYER MAY EMIT THESE FROM normalize.ts AND DECLARE NO TIER, and reading only the declaration made
    // this report wrong for en, da, nb, ro and is on its first fleet run — five false NONEs, i.e. five
    // languages the sweep would have re-investigated for a word they already have. English predates the
    // shared tier entirely and keeps its own implementation; the Nordic layers claim percent locally for
    // ordering reasons. Same heuristic review.ts uses for the same reason: a `.replace()` whose
    // PATTERN mentions the sign is emitting the word.
    // THE SIGN MUST BE FOUND IN THE PATTERN, NOT IN THE WHOLE `.replace(...)`, and getting that wrong made
    // this check report `have` for almost every language. `$` is the regex END-OF-STRING ANCHOR, the
    // backreference marker (`"$1 percent"`) and the JS template-literal sigil (`${h} ${min}`) — and `$` is in
    // `\p{Sc}`. So testing the whole call text found a "currency sign" in every layer that uses a template
    // literal anywhere, which is all of them. Measured: fa, hu, sr, th and yue all reported
    // `currency-word: declared or emitted` while every one of them DROPS `$5` — the five languages in that class,
    // reported clean by the tool meant to find them.
    //
    // So: match the regex LITERAL only, and for `$` require it to be ESCAPED (`\$`, how a pattern matches a
    // literal dollar) or inside a CHARACTER CLASS (`[$€]`). The other signs are not regex metacharacters and
    // need no such care.
    const emits = (sign: RegExp): boolean =>
        [...c.langSrc.matchAll(/\.replace\(\s*(\/(?:\\.|\[[^\]]*\]|[^/\n])+\/[a-z]*)\s*,([^;]*)\)/gu)]
            // The word may sit anywhere in the replacement, not against the quote: English writes
            // `.replace(/(\d)\s?%/gu, "$1 percent")`, so a `["'`]\p{L}{2,}` anchor missed it.
            // The replacement window is CAPPED: `([^;]*)` runs to the next semicolon, which in a chained
            // `.replace(...).join("")` swallows the following calls — `join` then counted as the emitted
            // word. 120 characters is past any real replacement string and short of the next call.
            .some((m) => sign.test(m[1]!) && /["'`][^"'`]*\p{L}{3,}/u.test(m[2]!.slice(0, 120)));
    /**
     * A currency sign as a regex may write it. For `$` this accepts ONLY the escaped form `\$`, which is how a
     * pattern matches a literal dollar (English writes `/\$/`).
     *
     * The character-class form `[$€]` is deliberately NOT accepted, because the shape is indistinguishable from
     * a REGEX-ESCAPING class — Cantonese has `.replace(/[.*+?^${}()|[\]\\-]/gu, "\\$&")`, which contains `$`
     * only because it escapes it, and accepting classes let that report as a currency emission. Missing a real
     * `[$…]` costs a `check` verdict, which this class's header already declares the conservative outcome:
     * `review.ts` tests the READING and is the authority.
     */
    const CUR_IN_PATTERN = /[¢-¥֏؋৲৳૱௹฿៛₠-₿]|\\\$/u;
    const pct = /percent:\s*\[/u.test(tier) || emits(/%/u);
    const cur = /currency:\s*\{/u.test(tier) || emits(CUR_IN_PATTERN);
    const signInCorpus = /[%٪％]/u.test(c.corpus);
    const curInCorpus = /\p{Sc}/u.test(c.corpus);
    // THESE TWO REPORT `check`, NEVER `none`, AND THAT IS A MEASURED DECISION. The other classes read
    // STRUCTURED data — espeak's letter block, `_dpt`, a manifest field — so a negative is reliable. These
    // read CODE, and the shapes a layer can emit a word in are unbounded. The tool's own fleet runs walked it
    // down: 14 percent + 10 currency "NONE" on the first pass, 6 + 2 after catching the emit-from-normalize
    // shape — and `as`, `th` and `fa` STILL report negative while carrying শতাংশ, เปอร์เซ็นต์ and درصد in
    // their sources. Three known false negatives out of six is not a verdict; it is a prompt. `review.ts
    // --lang X` is the authority for this class, because it tests the READING rather than reading the source.
    return [
        { klass: "percent-word", verdict: pct ? "have" : signInCorpus ? "check" : "n/a", detail: pct ? "declared or emitted" : signInCorpus ? "% in corpus, no declaration found — CHECK with review.ts" : "no % in corpus" },
        { klass: "currency-word", verdict: cur ? "have" : curInCorpus ? "check" : "n/a", detail: cur ? "declared or emitted" : curInCorpus ? "sign in corpus, no declaration found — CHECK with review.ts" : "no sign in corpus" },
    ];
}

/**
 * SIGN VOCABULARY — minus, ±, =, <, >, ×, ÷ and the exponent.
 *
 * ⚠ THIS FILE DID NOT KNOW ABOUT THESE CLASSES, AND THAT IS A REAL GAP RATHER THAN AN OMISSION. 654 spent a
 * whole issue establishing the sign vocabulary for the fleet, and taught `defects.ts` (SIGN_CASES), `review.ts`
 * and `coverage.ts` about it — but not this file. So the tool that must run BEFORE writing a
 * layer was blind to eight of the classes `review.ts` then FAILS the layer on.
 *
 * The consequence is not hypothetical. Writing the Khmer layer, this report listed percent, currency, degrees,
 * decimal and fractions and said nothing about signs, so the author asserted "× ÷ and = have no corpus-attested
 * Khmer reading" into a code comment WITHOUT CHECKING. Every one of them was attested, several heavily: ដក
 * (minus) ×3,808, គុណ (times) ×3,338, ចែក (divide) ×3,285, ស្មើ (equals) ×2,077 — with `៣គុណ៥` and `២៨ ដក៥`
 * written out in arithmetic position. A silent class is how folklore replaces a lookup, which is the exact
 * failure this file's header was written to end.
 *
 * WHAT IS CHECKED. Whether the SIGN occurs in the evidence at all, and whether the layer already emits a reading.
 * It deliberately does NOT try to name the word: the finding was that the readings are ordinary prose —
 * `kleiner als`, `ਤੋਂ ਵੱਧ`, `zaidi ya` — attested in quantity and specific to each language, so the candidate has
 * to come from `corpus-words.ts` with its SENSE checked. Availability here means "go and look", never "use this".
 *
 * ⚠ AND THE EXPONENT IS THE ONE THAT USUALLY FAILS. Khmer has ការេ "square" ×147 and it is 0/0 digit-adjacent —
 * it is a unit word (`ម៉ែត្រការេ`, square metre), not a reading for `²`. Availability is not correctness.
 */
/**
 * ⚠ EVERY CLASS THE GATES TEST MUST HAVE A ROW HERE, and three did not. `DROPPABLE` in `defects.ts` is the
 * authoritative list of symbol classes whose disappearance `review.ts` and `coverage.ts` will fail a layer on:
 *
 *     ampersand · currency · degree · exponent · iteration · math-sign · minus · percent
 *
 * This file reported on currency, percent, degree (as scale-names) and — only after the gap was noticed —
 * minus and exponent. It said nothing about AMPERSAND or the ITERATION mark, so an author running the mandated
 * pre-flight check was told those classes did not exist. Khmer needed both: `&` 1,331 occurrences and ៗ 24,413,
 * the latter being the single largest defect in the language.
 *
 * `SOURCES_EXEMPT` records the classes that deliberately have no vocabulary row, WITH the reason, so the
 * relationship is complete rather than merely long. `sources.test.ts` asserts the two sets reconcile, which is
 * what stops the next class added to `DROPPABLE` from silently lacking a pre-flight row — the same failure mode
 * as `coverage.ts`'s hand-maintained language list, which sat at 37 while the tree grew to 67 and left 30
 * languages unaudited behind a confident "0 defects".
 */
export const SOURCES_EXEMPT: Readonly<Record<string, string>> = {
    // A repetition mark needs a RULE, not a word: the reading is "say the previous word again", so there is no
    // vocabulary to source. Thai's ๆ and Khmer's ៗ are both handled by reduplication in their own layers.
    iteration: "needs a rule (repeat the antecedent), not a vocabulary item",
    // A catch-all bucket for arithmetic signs, each of which has its own row below. Nothing to source under the
    // bucket name itself.
    "math-sign": "a bucket over equals/times/divide/plus, each of which has its own row",
};

const SIGN_PROBES: readonly { klass: string; sign: RegExp; hint: string }[] = [
    { klass: "minus-word", sign: /(?<![\p{L}\p{Nd}])[-−–]\p{Nd}/u, hint: "subtract/negative" },
    { klass: "plus-minus-word", sign: /±/u, hint: "the two words, or one compound" },
    { klass: "equals-word", sign: /\p{Nd}\s*=\s*\p{Nd}|\s=\s/u, hint: "equal/is" },
    { klass: "less-than-word", sign: /\p{Nd}\s*<\s*\p{Nd}/u, hint: "smaller/fewer than" },
    { klass: "greater-than-word", sign: /\p{Nd}\s*>\s*\p{Nd}/u, hint: "bigger/more than" },
    { klass: "times-word", sign: /\p{Nd}\s*[×✕]\s*\p{Nd}/u, hint: "multiply" },
    { klass: "divide-word", sign: /\p{Nd}\s*[÷]\s*\p{Nd}/u, hint: "divide/share" },
    { klass: "ampersand-word", sign: /&(?![a-zA-Z]{2,8};|#\d{1,6};)/u, hint: "and" },
    { klass: "plus-word", sign: /\p{Nd}\s*\+\s*\p{Nd}/u, hint: "plus/add" },
    { klass: "exponent-word", sign: /\p{Nd}\s*\p{L}*[²³⁰¹⁴-⁹]|\p{L}[²³]/u, hint: "square/power — usually NOT sourceable; check digit-adjacency" },
];

function signWords(c: Ctx): Row[] {
    return SIGN_PROBES.map(({ klass, sign, hint }) => {
        if (!sign.test(c.corpus)) return { klass, verdict: "n/a" as const, detail: "the sign does not occur in the evidence" };
        // A reading already emitted by the layer counts as handled; the source text is the only place to look,
        // since a normalizer may emit a word inline rather than declaring it (see the percent/currency note).
        const emitted = new RegExp(`${klass.replace(/-word$/u, "")}`, "iu").test(c.langSrc);
        return emitted
            ? { klass, verdict: "have" as const, detail: "the layer names this class" }
            : { klass, verdict: "check" as const, detail: `sign occurs, no reading found — source the ${hint} word with corpus-words.ts, then SENSE-check it digit-adjacent` };
    });
}

/** FRACTION DENOMINATORS — deferred in 16 of 25. The signal is whether the language's own ordinal/denominator
 *  series exists to compose from, which in this repo means a manifest ordinal table or espeak entries. */
function fractionSeries(c: Ctx): Row {
    const hasFrac = /\d\s*[\/⁄]\s*\d|[½¼¾⅓⅔]/u.test(c.corpus);
    const espeakFrac = /^_(?:1\/|frac)/mu.test(c.espeak) || /(?:tel|ina|ième|tel\b)/u.test(c.espeak);
    const ordTable = /ordinal/iu.test(c.langSrc);
    if (!hasFrac) return { klass: "fraction-series", verdict: "n/a", detail: "no fraction in the corpus" };
    return ordTable || espeakFrac
        ? { klass: "fraction-series", verdict: "partial", detail: "an ordinal/denominator series exists to compose from — verify each form" }
        : { klass: "fraction-series", verdict: "none", detail: "fraction occurs, no series to compose from" };
}

function rowsFor(code: string): { ctx: Ctx; rows: Row[] } {
    const c = context(code);
    return { ctx: c, rows: [letterNames(c), decimalWord(c), eraPhrase(c), scaleNames(c), ...tierWords(c), unitWords(c), fractionSeries(c), ...signWords(c)] };
}

const MARK: Record<Verdict, string> = { have: " ok ", partial: "part", none: "NONE", check: "chk?", unknown: " ?? ", "n/a": "  · " };

/**
 * ⚠ THE CLI MUST NOT RUN ON IMPORT — the fourth file in this directory to need this guard, after `mine.ts`,
 * `wiki-health.ts` and `candidates.ts`, and discovered the same way each time: a test tried to import a pure
 * function and the whole report executed instead, taking the suite with it.
 */
const IS_CLI = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

function main(): void {
    if (has("all")) {
        const codes = fleet();
        const klasses = ["letter-names", "decimal-point", "era-phrase", "scale-names", "percent-word", "currency-word", "unit-word", "fraction-series"];
        console.log(`\n── vocabulary sources across ${codes.length} registered languages ──\n`);
        // ⚠ THE FLEET VIEW IS WHERE A DISCONNECTED TIER DOES THE MOST DAMAGE, because its headline output is a
        // COUNT — "letter names are absent for 94 of the registered languages" is a number people plan work
        // from. With $ESPEAK_NG unset that number is a fact about the shell, so say so before the matrix.
        if (ESPEAK_OFF) console.log(`  ${ESPEAK_OFF_NOTE}, so every letter-names and decimal-point cell below\n`
            + `  reads ?? rather than NONE. Any COUNT taken from this run is a fact about the shell, not the fleet:\n`
            + `      export ESPEAK_NG=/path/to/espeak-ng   # the checkout containing dictsource/\n`);
        console.log(`      ${klasses.map((k) => k.slice(0, 9).padEnd(10)).join("")}`);
        const blockedBy: Record<string, string[]> = Object.fromEntries(klasses.map((k) => [k, []]));
        const unreadable: Record<string, string[]> = Object.fromEntries(klasses.map((k) => [k, []]));
        for (const code of codes) {
            const { rows } = rowsFor(code);
            const by = new Map(rows.map((r) => [r.klass, r]));
            for (const k of klasses) if (by.get(k)?.verdict === "none") blockedBy[k]!.push(code);
            for (const k of klasses) if (by.get(k)?.verdict === "unknown") unreadable[k]!.push(code);
            if (has("blocked") && !rows.some((r) => r.verdict === "none")) continue;
            console.log(`  ${code.padEnd(4)}${klasses.map((k) => MARK[by.get(k)?.verdict ?? "n/a"].padEnd(10)).join("")}`);
        }
        console.log(`\n── blocked counts (a NONE is work that needs a SOURCE, not code) ──`);
        for (const k of klasses)
            console.log(`  ${k.padEnd(16)} ${String(blockedBy[k]!.length).padStart(3)}  ${blockedBy[k]!.slice(0, 22).join(" ")}${blockedBy[k]!.length > 22 ? " …" : ""}`);
        // A `[??]` IS NOT BLOCKED WORK, and listing it under the blocked heading would restore the very
        // confusion this repair removed: nothing is missing, the tool cannot read the evidence.
        const anyUnknown = klasses.filter((k) => unreadable[k]!.length > 0);
        if (anyUnknown.length > 0) {
            console.log(`\n── [??] counts (NOT blocked — the tool could not READ the evidence; go and look) ──`);
            for (const k of anyUnknown)
                console.log(`  ${k.padEnd(16)} ${String(unreadable[k]!.length).padStart(3)}  ${unreadable[k]!.slice(0, 22).join(" ")}${unreadable[k]!.length > 22 ? " …" : ""}`);
        }
        console.log(`\n  AVAILABILITY IS NOT CORRECTNESS — an ` + "`ok`" + ` says a source exists, never that the word fits the`);
        console.log(`  slot. ff hakkunde, ms paun, zu amaphuzu and the Gabonese district Idola all passed here.\n`);
    } else {
        const code = arg("lang");
        if (code === undefined) { console.error("usage: --lang <code> | --all [--blocked]"); process.exit(2); }
        const { ctx, rows } = rowsFor(code);
        console.log(`\n── ${code} (${ctx.dir ?? "?"}) vocabulary sources ──\n`);
        for (const r of rows) console.log(`  [${MARK[r.verdict]}] ${r.klass.padEnd(16)} ${r.detail}`);
        if (ESPEAK_OFF) console.log(`\n  ${ESPEAK_OFF_NOTE}.\n  Every verdict above that rests on it is UNKNOWN, not negative — export it and re-run:`
            + `\n      export ESPEAK_NG=/path/to/espeak-ng   # the checkout containing dictsource/`);
        console.log(`\n  espeak: ${ESPEAK_OFF ? "NOT CONSULTED ($ESPEAK_NG unset)" : ctx.espeak === "" ? "NOT SHIPPED for this language" : `${ctx.espeak.split("\n").length} lines`}`
            + ` · referee: ${ctx.referee === "" ? "none" : `${ctx.referee.split("\n").length} lines`}`
            + ` · corpus: ${ctx.corpus === "" ? "none" : `${ctx.corpus.split("\n").length} lines`}`
            + (existsSync(new URL(`../corpus/mined/${ctx.code}.jsonc`, import.meta.url).pathname) ? " (incl. mined artifact)" : ""));
        console.log(`\n  AVAILABILITY IS NOT CORRECTNESS. Read the source before using it (the Fula lesson).\n`);
    }
}

if (IS_CLI) main();
