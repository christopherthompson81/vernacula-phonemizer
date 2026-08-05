/**
 * VOCABULARY-SOURCE REPORT (#586) — per language, which classes of normalizer vocabulary have a source, and
 * which are blocked. Run this BEFORE writing a layer, and again when planning a re-sweep.
 *
 * WHY THIS EXISTS. Reading back through all 25 merged #562 PRs, the "deliberately not done" lists are not 25
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
 * it by hand is not the time, it is that **it was got wrong**: Slovak (#603) deferred 119 initialisms with
 * "it is a separate seam", when the seam existed, 30 languages already wired it, and espeak carried Slovak's
 * full letter-name table. That is trap 16, and this file is trap 16 mechanised: the check becomes a lookup.
 *
 * The counterpart matters just as much. Luxembourgish (#604) and Zulu/Xhosa (#606/#607) deferred the same
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
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? undefined : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);

const ESPEAK = process.env["ESPEAK_NG"] ?? "/home/chris/Programming/espeak-ng";
const DICT = join(ESPEAK, "dictsource");
const CORPUS_ROOT = process.env["FLEURS"] ?? "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
const REFEREES = "tools/referee-eval/referees";

/** Every `case "xx":` in the registry — the fleet, in the order the registry lists it. */
function fleet(): string[] {
    const reg = readFileSync("src/registry.ts", "utf8");
    return [...new Set([...reg.matchAll(/case "([a-z][a-z0-9-]*)":/gu)].map((m) => m[1]!))];
}

function langDir(code: string): string | undefined {
    const reg = readFileSync("src/registry.ts", "utf8");
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

interface Ctx {
    code: string;
    dir: string | undefined;
    espeak: string;
    referee: string;
    langSrc: string;
    corpus: string;
}

function context(code: string): Ctx {
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
    const stripComments = (t: string): string =>
        t.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/(^|[^:])\/\/[^\n]*/gu, "$1 ");
    let langSrc = "";
    if (dir !== undefined && existsSync(join("src/languages", dir)))
        for (const f of readdirSync(join("src/languages", dir)))
            langSrc += f.endsWith(".ts") || f.endsWith(".jsonc")
                ? stripComments(read(join("src/languages", dir, f)))
                : read(join("src/languages", dir, f));
    return { code, dir, espeak: read(join(DICT, `${code}_list`)) + read(join(DICT, `${code}_extra`)), referee, langSrc, corpus };
}

type Verdict = "have" | "partial" | "none" | "check" | "n/a";
interface Row { klass: string; verdict: Verdict; detail: string }

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
 * whose Latin letter block is entirely COMMENTED OUT. Found by the #586 loop-back on cmn.
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
    const espeakAtAll = c.espeak !== "";
    return {
        klass: "letter-names", verdict: "none",
        detail: espeakAtAll ? "espeak has the language but no letter block" : "espeak does not ship this language at all",
    };
}

/** THE DECIMAL POINT — espeak's `_dpt` is the separator's name; `_.` is the punctuation mark's, and they are
 *  NOT interchangeable (ms: `_dpt perpuluhan` for a decimal, `_. titik` for a version dot — #601 needed both
 *  and the distinction was the citation). Also accept a manifest `decimalWord`. */
function decimalWord(c: Ctx): Row {
    const dpt = /^_dpt\s+\S/mu.test(c.espeak);
    const dot = /^_\.\s+\S/mu.test(c.espeak);
    const manifest = /"decimal(?:Word|Connector)"\s*:/u.test(c.langSrc);
    const parts = [dpt && "espeak _dpt", dot && "espeak _.", manifest && "manifest decimalWord"].filter(Boolean);
    return parts.length > 0
        ? { klass: "decimal-point", verdict: "have", detail: parts.join(" + ") }
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

/** TEMPERATURE SCALE NAMES. `°C` is common and the scale name is unsourceable in more languages than not; om
 *  and xh and zu all stop at the degree word. Worth reporting because "drop the letter" is a decision, and
 *  the code should say so rather than the reader discovering it. */
function scaleNames(c: Ctx): Row {
    const hay = `${c.corpus}\n${c.referee}\n${c.espeak}\n${c.langSrc}`;
    const hasDeg = /\d\s?°/u.test(c.corpus);
    const cels = /(?<![\p{L}\p{M}])(celsi|selsi|셀시|celzi|t͡selsi)/iu.test(hay);
    const fahr = /(?<![\p{L}\p{M}])(fahren|faren|fahrenh)/iu.test(hay);
    if (!hasDeg) return { klass: "scale-names", verdict: "n/a", detail: "no ° in the corpus" };
    return cels || fahr
        ? { klass: "scale-names", verdict: cels && fahr ? "have" : "partial", detail: `${cels ? "Celsius " : ""}${fahr ? "Fahrenheit" : ""}`.trim() }
        : { klass: "scale-names", verdict: "none", detail: "° occurs, neither scale name anywhere — the letter gets dropped" };
}

/** PERCENT and CURRENCY, the two the review gate already checks — reported here so one command answers the
 *  whole planning question rather than two. */
function tierWords(c: Ctx): Row[] {
    const tier = /makeSymbolNormalizer\(\{[\s\S]*?\n\}\)/u.exec(c.langSrc)?.[0] ?? "";
    // A LAYER MAY EMIT THESE FROM normalize.ts AND DECLARE NO TIER, and reading only the declaration made
    // this report wrong for en, da, nb, ro and is on its first fleet run — five false NONEs, i.e. five
    // languages the sweep would have re-investigated for a word they already have. English predates the
    // shared tier entirely and keeps its own implementation; the Nordic layers claim percent locally for
    // ordering reasons. Same heuristic review.ts uses for the same reason (#601): a `.replace()` whose
    // PATTERN mentions the sign is emitting the word.
    // THE SIGN MUST BE FOUND IN THE PATTERN, NOT IN THE WHOLE `.replace(...)`, and getting that wrong made
    // this check report `have` for almost every language. `$` is the regex END-OF-STRING ANCHOR, the
    // backreference marker (`"$1 percent"`) and the JS template-literal sigil (`${h} ${min}`) — and `$` is in
    // `\p{Sc}`. So testing the whole call text found a "currency sign" in every layer that uses a template
    // literal anywhere, which is all of them. Measured: fa, hu, sr, th and yue all reported
    // `currency-word: declared or emitted` while every one of them DROPS `$5` — the five languages of #584,
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
 * SIGN VOCABULARY (#654) — minus, ±, =, <, >, ×, ÷ and the exponent.
 *
 * ⚠ THIS FILE DID NOT KNOW ABOUT THESE CLASSES, AND THAT IS A REAL GAP RATHER THAN AN OMISSION. #654 spent a
 * whole issue establishing the sign vocabulary for the fleet, and taught `defects.ts` (SIGN_CASES), `review.ts`
 * and `coverage.ts` about it — but not this file. So the tool the playbook mandates running BEFORE writing a
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
 * It deliberately does NOT try to name the word: #654's finding was that the readings are ordinary prose —
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
 * This file reported on currency, percent, degree (as scale-names) and — only after #654's gap was noticed —
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
    return { ctx: c, rows: [letterNames(c), decimalWord(c), eraPhrase(c), scaleNames(c), ...tierWords(c), fractionSeries(c), ...signWords(c)] };
}

const MARK: Record<Verdict, string> = { have: " ok ", partial: "part", none: "NONE", check: "chk?", "n/a": "  · " };

/**
 * ⚠ THE CLI MUST NOT RUN ON IMPORT — the fourth file in this directory to need this guard, after `mine.ts`,
 * `wiki-health.ts` and `candidates.ts`, and discovered the same way each time: a test tried to import a pure
 * function and the whole report executed instead, taking the suite with it.
 */
const IS_CLI = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

function main(): void {
    if (has("all")) {
        const codes = fleet();
        const klasses = ["letter-names", "decimal-point", "era-phrase", "scale-names", "percent-word", "currency-word", "fraction-series"];
        console.log(`\n── vocabulary sources across ${codes.length} registered languages ──\n`);
        console.log(`      ${klasses.map((k) => k.slice(0, 9).padEnd(10)).join("")}`);
        const blockedBy: Record<string, string[]> = Object.fromEntries(klasses.map((k) => [k, []]));
        for (const code of codes) {
            const { rows } = rowsFor(code);
            const by = new Map(rows.map((r) => [r.klass, r]));
            for (const k of klasses) if (by.get(k)?.verdict === "none") blockedBy[k]!.push(code);
            if (has("blocked") && !rows.some((r) => r.verdict === "none")) continue;
            console.log(`  ${code.padEnd(4)}${klasses.map((k) => MARK[by.get(k)?.verdict ?? "n/a"].padEnd(10)).join("")}`);
        }
        console.log(`\n── blocked counts (a NONE is work that needs a SOURCE, not code) ──`);
        for (const k of klasses)
            console.log(`  ${k.padEnd(16)} ${String(blockedBy[k]!.length).padStart(3)}  ${blockedBy[k]!.slice(0, 22).join(" ")}${blockedBy[k]!.length > 22 ? " …" : ""}`);
        console.log(`\n  AVAILABILITY IS NOT CORRECTNESS — an ` + "`ok`" + ` says a source exists, never that the word fits the`);
        console.log(`  slot. ff hakkunde, ms paun, zu amaphuzu and the Gabonese district Idola all passed here.\n`);
    } else {
        const code = arg("lang");
        if (code === undefined) { console.error("usage: --lang <code> | --all [--blocked]"); process.exit(2); }
        const { ctx, rows } = rowsFor(code);
        console.log(`\n── ${code} (${ctx.dir ?? "?"}) vocabulary sources ──\n`);
        for (const r of rows) console.log(`  [${MARK[r.verdict]}] ${r.klass.padEnd(16)} ${r.detail}`);
        console.log(`\n  espeak: ${ctx.espeak === "" ? "NOT SHIPPED for this language" : `${ctx.espeak.split("\n").length} lines`}`
            + ` · referee: ${ctx.referee === "" ? "none" : `${ctx.referee.split("\n").length} lines`}`
            + ` · corpus: ${ctx.corpus === "" ? "none" : `${ctx.corpus.split("\n").length} lines`}`
            + (existsSync(new URL(`../corpus/mined/${ctx.code}.jsonc`, import.meta.url).pathname) ? " (incl. mined artifact)" : ""));
        console.log(`\n  AVAILABILITY IS NOT CORRECTNESS. Read the source before using it (the Fula lesson).\n`);
    }
}

if (IS_CLI) main();
