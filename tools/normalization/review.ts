/**
 * NORMALIZATION REVIEW (#562) — the mechanical half of reviewing a language's normalization layer.
 *
 * WHY THIS EXISTS. Reviewing the Czech layer (#588) turned up four defects, and ALL FOUR were checklist
 * items rather than insights: no tests, three silently dropped sign classes, a numeral that did not agree
 * with its noun, and an uncommitted artifact. Every one is machine-checkable, and checking them by hand
 * cost about nine minutes of repeated `vitest` runs and one-probe-per-process startup — against five
 * minutes of actual judgement.
 *
 * So: run this BEFORE opening a PR, and again when reviewing one. What it cannot do is decide whether a
 * reading is *right for the language* — that stays human, and it is the part worth spending time on.
 *
 * ⚠ IT IS NECESSARY, NEVER SUFFICIENT. The Czech artifact scanned "no defects" while an ampersand in its
 * own hard-set was being dropped: removing `&` changed the tokenization (`BB` is one initialism, `B B` is
 * two letters), so the differential test concluded the symbol contributed. A symbol can change the output
 * without ever being spoken. That is why the sign probes below PRINT their readings instead of only
 * asserting a difference — read them.
 *
 * That paragraph was written as a limitation and stood as one for thirty-seven languages, while THIS FILE'S
 * OWN `A&B` PROBE had the merge defect it describes — so the gate printed the ampersand's reading with no
 * DROPPED marker and the human was asked to notice. It is mechanical now: the probe is spaced (`A & B`), so
 * deleting the sign can no longer join two operands. The general rule survives — a printed reading still
 * needs a human — but this particular class no longer depends on one. See `signCases`.
 *
 * Usage:  npx tsx tools/normalization/review.ts --lang cs [--dir czech]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { CELLS, staleness } from "./cells.ts";

const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? undefined : argv[i + 1];
};
// NARROWED INTO ITS OWN BINDING, and this is not ceremony. `arg()` returns `string | undefined`, and the
// guard below narrows it — but every use is inside a HOISTED `function` declaration, and TypeScript cannot
// know when a hoisted function will be called, so inside those bodies the variable has its DECLARED type
// again. That is why `tools/` being outside tsconfig's `include` mattered: seven of these were live in this
// file, and the same blind spot previously hid a use-before-initialisation that made the tool throw for
// every language, plus a wrong `ReadonlySet<string>` return annotation.
const langArg = arg("lang");
if (langArg === undefined) {
    console.error("usage: --lang <code> [--dir <languages-subdir>]");
    process.exit(2);
}
const lang: string = langArg;

/** Resolve the language directory from the registry: `case "cs":` … `createCzech()` … and the import that
 *  names the file. Passed explicitly with --dir when a language's wiring does not follow that shape. */
function resolveDir(code: string): string | undefined {
    const reg = readFileSync("src/registry.ts", "utf8");
    const imports = new Map<string, string>();
    for (const m of reg.matchAll(/import \{\s*(create\w+)[^}]*\} from "\.\/languages\/([^/]+)\//gu))
        imports.set(m[1]!, m[2]!);
    const at = reg.indexOf(`case "${code}":`);
    if (at === -1) return undefined;
    const block = reg.slice(at, at + 600);
    for (const m of block.matchAll(/(create\w+)\s*\(/gu)) {
        const dir = imports.get(m[1]!);
        if (dir !== undefined) return dir;
    }
    return undefined;
}

const dirArg = arg("dir") ?? resolveDir(lang);
if (dirArg === undefined) {
    console.error(`could not resolve the languages/ subdir for "${lang}" — pass --dir`);
    process.exit(2);
}
const dir: string = dirArg;

const CORPUS_ROOT = process.env["FLEURS"] ?? "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
/**
 * PLURICENTRIC SETS — codes that are STANDARDS OF ONE LANGUAGE, whose sources attest for each other. Not
 * "related languages": the test is whether a speaker of one would recognise the other's word as their own.
 *
 * Croatian (#599) is why this exists. Its tier reads `¥` as `jen`, which the hr corpus never spells — but
 * the SERBIAN corpus renders the very same FLEURS sentence as "od 2500 i 130.000 japanskih jena", and `jen`
 * is in the Serbian referee. The evidence existed and a one-language haystack could not see it, so the
 * check asked a human to source a word the repo already had.
 *
 * Kept deliberately short. Arabic's dialect codes are NOT here: they share a script and much of MSA, but a
 * word being right in one is not evidence for another, which is the whole property this map asserts.
 */
const SISTER_STANDARDS: readonly (readonly string[])[] = [
    ["hr", "sr", "bs"],   // Serbo-Croatian: three standards, one language
    ["id", "zsm", "ms"],  // Malay: Indonesian and Malaysian
    ["nb", "nn", "no"],   // Norwegian: Bokmål and Nynorsk
];
// A FUNCTION DECLARATION, not a const arrow: the artifact lookup in §3 runs above this point in the file,
// and a const would be a use-before-initialisation there (it was — the whole tool threw).
function sisters(code: string): readonly string[] {
    return SISTER_STANDARDS.find((set) => set.includes(code))?.filter((c) => c !== code) ?? [];
}

const results: [string, boolean | null, string][] = [];
const note = (name: string, ok: boolean | null, detail: string): void => { results.push([name, ok, detail]); };

// ── 1. the normalizer exists and is wired ──────────────────────────────────────────────────────────
const normPath = join("src/languages", dir, "normalize.ts");
const hasNorm = existsSync(normPath);
note("normalizer", hasNorm, hasNorm ? normPath : `${normPath} missing`);
if (!hasNorm) { report(); process.exit(1); }

// ALL exported normalizers, not the first: czech/normalize.ts exports both `normalizeCzech` and
// `normalizeCzechInitialisms`, and matching only the first reported "no tests" for a file that has them.
//
// AND NOT ONLY THE `normalize*` NAME. Eleven languages export a FACTORY instead, because their engine serves
// several languages off one normalizer with different number data: `makeHindiNormalizer` (hi, ur, mr, as, gu,
// ne, or, fa, bn, pa) and `makeAmharicNormalizer` (am). Matching `normalize\w+` alone found nothing in any
// of them, so `exportNames` was EMPTY and two checks reported a false FAIL — "no call to  found" and "no test
// file references " — with a blank where the name should be. Found by the #586 loop-back on hi, and the blank
// is what gave it away: a report that cannot name what it is looking for is not reporting a real absence.
const exportNames = [...readFileSync(normPath, "utf8")
    .matchAll(/export function ((?:normalize|make|create)\w+)/gu)]
    .map((m) => m[1]!)
    .filter((n) => /^normalize/u.test(n) || /Normalizer/u.test(n));
const exportName = exportNames[0];
// The engine is not necessarily the first non-normalize .ts file alphabetically: uzbek/ sorts numbers.ts
// before uzbek.ts, turkish/ sorts g2p.ts before turkish.ts. Scan EVERY candidate engine file, so a
// normalizer wired into any of them is found.
const engineFiles = readdirSync(join("src/languages", dir)).filter((f) => f.endsWith(".ts") && !f.includes("normalize") && !f.includes(".test."));
const engineSrc = engineFiles.map((f) => readFileSync(join("src/languages", dir, f), "utf8")).join("\n");
// `exportName` is `exportNames[0]` and CAN be undefined — a normalize.ts that exports no `normalize*`
// function at all. Unguarded, `.includes(undefined)` searches for the literal string "undefined" and the
// engine pick silently lands on whatever file happens to contain it (usually none, so `?? engineFiles[0]`),
// which would then be reported as the wiring site. Surfaced only once tools/ came under tsconfig.
const engine = exportName === undefined
    ? engineFiles[0]
    : engineFiles.find((f) => readFileSync(join("src/languages", dir, f), "utf8").includes(exportName)) ?? engineFiles[0];
const called = exportNames.filter((n) => engineSrc.includes(n));
note("wired into text()", called.length > 0,
    called.length > 0 ? `${engine} calls ${called.join(", ")}`
        : exportNames.length === 0 ? `${normPath} exports no normalize*/…Normalizer function — cannot tell`
            : `no call to ${exportNames.join("/")} found`);

// ── 2. tests reference the normalizer (Czech shipped none; the suite was identical before and after) ──
const testFiles = [
    ...readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => join("test", f)),
    ...readdirSync(join("src/languages", dir)).filter((f) => f.endsWith(".test.ts")).map((f) => join("src/languages", dir, f)),
];
// TWO WAYS A TEST CAN EXERCISE THIS LAYER, and requiring only the first was a false negative for all eleven
// FACTORY languages. `test/hindi.test.ts` asserts `phonemize("५०%", "hi")` → *pachaas pratishat* — a proper
// normalization test, end-to-end through the wired pipeline, which never names `makeHindiNormalizer`. Testing
// through `phonemize` is if anything the better shape, since it also proves the wiring.
//   1. it references an exported normalizer BY NAME (the unit-test shape)
//   2. it phonemizes IN THIS LANGUAGE with an input carrying a digit or a symbol — i.e. something only this
//      layer can read. Gated on the symbol, not merely on the language code, or every g2p test would count
//      and the check could never fail.
const NORMALIZABLE = /["'`][^"'`\n]*[\d%\p{Sc}°&+=<>‰،؛।॥][^"'`\n]*["'`]/u;
const testing = testFiles.filter((f) => {
    const src = readFileSync(f, "utf8");
    if (exportNames.some((n) => src.includes(n))) return true;
    return new RegExp(`["'\`]${lang}["'\`]`, "u").test(src) && NORMALIZABLE.test(src);
});
note("tests", testing.length > 0,
    testing.length > 0 ? testing.join(", ")
        : exportNames.length === 0 ? `${normPath} exports no normalize*/…Normalizer function — cannot tell`
            : `no test file references ${exportNames.join("/")}`);

// ── 3. the artifact is committed (Czech's was left untracked) ─────────────────────────────────────
// The artifact is usually `<lang>.jsonc`, but a language served through an ALIAS files it under the code
// its corpus is named for: Standard Malay runs as `zsm` while its corpus is `ms_my` and its artifact is
// `ms.jsonc`. Reporting that as "missing" then skips the scan entirely, which is how #601 lost a gate to a
// naming detail.
//
// A sister candidate is only usable if that code is NOT ITSELF A REGISTERED LANGUAGE: a registered sibling
// has its own artifact for its own corpus, and scanning Indonesian's `id.jsonc` as `zsm` reports
// Indonesian's drops against Malay — which is worse than the missing-file failure it replaced.
const registered = (code: string): boolean => readFileSync("src/registry.ts", "utf8").includes(`case "${code}":`);
const artifact = [`${lang}.jsonc`, ...sisters(lang).filter((c) => !registered(c)).map((c) => `${c}.jsonc`)]
    .map((f) => join("tools/corpus/mined", f))
    .find((f) => existsSync(f)) ?? join("tools/corpus/mined", `${lang}.jsonc`);
let tracked = false;
try { execSync(`git ls-files --error-unmatch ${artifact}`, { stdio: "ignore" }); tracked = true; } catch { /* untracked */ }
note("artifact tracked", tracked, tracked ? artifact : `${artifact} ${existsSync(artifact) ? "exists but is UNTRACKED" : "missing"}`);

/**
 * IS THE ARTIFACT MEASURED AGAINST TODAY'S INVENTORY?
 *
 * A tracked artifact can still be answering last month's question. The cell inventory GROWS as the sweep
 * proceeds — five cells came out of the uz/af/as review passes alone, and `negative` was RENAMED to
 * `signed-number` — and nothing compared an artifact's recorded `cellsTotal` to the current list. So a
 * language could report a comfortable `covered 24/29` while the inventory stood at 35 and five of its cells
 * had never been evaluated for that language at all.
 *
 * Measured across the tree when this check was added: **64 of 67 artifacts stale**, with `sports-time`,
 * `version-dot`, `quote-letter`, `scaled-currency` and `ordinal-caps` never evaluated for any of those 64, and
 * 35 still carrying a count under the dead key `negative`. That is a fleet-sized blind spot that no gate
 * mentioned, and it is exactly the kind #586 exists to close — so it is a FAIL, not a note.
 */
if (existsSync(artifact)) {
    const st = staleness(readFileSync(artifact, "utf8"));
    const current = st.missing.length === 0 && st.unknown.length === 0;
    const detail = current
        ? `mined against all ${CELLS.length} cells`
        : [
            st.minedAgainst !== undefined && st.minedAgainst !== CELLS.length
                ? `mined against ${st.minedAgainst} cells, inventory is now ${CELLS.length}` : "",
            st.missing.length > 0 ? `NEVER EVALUATED: ${st.missing.join(" ")}` : "",
            st.unknown.length > 0 ? `dead key(s): ${st.unknown.join(" ")}` : "",
        ].filter(Boolean).join(" | ");
    note("artifact current", current, current ? detail : `${detail} — re-mine with mine.ts`);
}

// ── 4. the probes. PRINTED, not merely asserted — see the header. ─────────────────────────────────
const { phonemize } = await import(new URL("../../src/index.ts", import.meta.url).href);
const say = (t: string): string => { try { return (phonemize(t, lang) as string).trim(); } catch (e) { return `THROW ${(e as Error).message.slice(0, 40)}`; } };

/**
 * A symbol that contributes NOTHING is a hard fail; one that merely changes the output is printed for a
 * human to judge, because changing tokenization is not the same as being spoken.
 *
 * EVERY PROBE MUST BE NON-MERGING, and `A&B` was not. Deleting its `&` yields `AB` — ONE token, read
 * differently from `A B` — so the differential test saw a change and reported the class clean. Measured on
 * cmn, whose artifact writes `一众 B&B 公司`: this gate printed `ampersand A&B  ˈə bˈiː` with no DROPPED
 * marker while `corpus-diff.ts` reported `DROP:ampersand` on the real sentence. The spaced form `A & B`
 * deletes to `A  B`, which reads as `A B`, so a dropped `&` is now visible. This is the same trap
 * `defects.ts` documents for the minus: never build a probe whose deletion joins two operands.
 *
 * THE CLASS LIST IS `DROPPABLE`'s, because a probe list that drifts from the defect table is exactly what
 * `defects.ts` was extracted to stop — and this list had drifted, missing `÷`, `>`, `±`, the exponent and
 * the currency sign outright. Two classes are DELIBERATELY not probed here, stated rather than silently
 * omitted:
 *   · `iteration` (ๆ 々 ゝ ៗ) — script-specific. A language that does not use the mark would report it
 *     dropped, so the finding would be noise for all but a handful; `mine.ts scan` catches it where the
 *     corpus actually contains one.
 *   · nothing else. Every other DROPPABLE class is below.
 */
const signCases: [string, string, RegExp][] = [
    ["minus", "-5", /[-−]/gu],
    ["plus", "+5", /\+/gu],
    ["plus-minus", "±5", /±/gu],
    ["ampersand", "A & B", /&/gu],
    ["equals", "x = y", /=/gu],
    ["less-than", "5 < 6", /</gu],
    ["greater-than", "6 > 5", />/gu],
    ["times", "6 × 6", /×/gu],
    ["divide", "6 ÷ 3", /÷/gu],
    ["exponent", "5 km²", /²/gu],
    ["currency", "$5", /\$/gu],
    ["percent", "25 %", /%/gu],
    ["degrees", "20 °C", /°/gu],
];
const dropped: string[] = [];
console.log(`\n── sign classes (read these; a DROPPED line is a hard fail) ──`);
for (const [name, probe, strip] of signCases) {
    const full = say(probe), bare = say(probe.replace(strip, ""));
    const isDropped = full === bare;
    if (isDropped) dropped.push(name);
    console.log(`  ${name.padEnd(13)} ${probe.padEnd(8)} ${isDropped ? "DROPPED" : "       "}  ${full.slice(0, 46)}`);
}
note("sign classes", dropped.length === 0, dropped.length === 0 ? "none dropped" : `DROPPED: ${dropped.join(" ")}`);

/**
 * ⚠ THE `exponent` LINE IS THE WEAKEST OF THE THIRTEEN — READ IT, DO NOT TRUST ITS MARKER.
 *
 * Every other probe deletes a symbol and leaves the rest of the string tokenizing identically. The exponent
 * cannot: deleting the `²` from `5 km²` also changes the UNIT TOKEN, because `km²` and `km` are different
 * strings to the word path. So the readings differ for reasons unrelated to the exponent, and the class
 * reports clean even when the exponent is gone.
 *
 * MEASURED OVER THE 66 LANGUAGES WITH A MINED ARTIFACT, while `signCases` reported nothing for any of them:
 *
 *   21 leak a RAW `km` into the IPA   am ar as bg bn ckb cy de fa ff ga gu kk mi ne pa sw th tr ur yue
 *    7 lose the unit word entirely    da fr hu id ja nb sv
 *
 * German reads `5 km²` as *fʏnf km* — the unit abbreviation reaching the phoneme sink verbatim, trap 6's
 * defect arriving through the exponent. French differs from `5 km` by ONE VOWEL (kilomˈɛtʁ vs kilɔmˈɛtʁ),
 * an incidental g2p artefact of the changed token, so even a careful reader has to compare two nearly
 * identical strings to see that the `²` was dropped. That is 28 of 66 languages, for #586 to sweep.
 *
 * TWO MECHANICAL CHECKS WERE TRIED AND BOTH REJECTED, which is why this is a comment and not a `note()`:
 *
 *   · A spaced probe (`5 km ²`) — the non-merging fix that worked for the ampersand. WRONG here: English
 *     handles the exponent in its own layer and requires it attached, so the probe invents a failure for one
 *     of the languages that is correct.
 *   · Asserting the bare unit's words survive into the `km²` reading, taken differentially against `5`.
 *     Rejected at 6 false positives in 19: the `compound` position languages (da hu ja ko nb sv) FUSE the
 *     measure word into the unit, and the fused token's g2p legitimately differs from the standalone one —
 *     Swedish reads a lone `km` with ɕ (*ɕɪlɔmˈeːtɛr*) and the compound with k (*kvadrˈɑ̀ːtkiːlɔmˌeːtɛr*).
 *     Suprasegmental stripping fixes four of the six and not those two.
 *
 * A gate that fails six correct languages to catch thirteen broken ones is not worth shipping; a documented
 * count that the sweep can act on is.
 */

console.log(`\n── numeral agreement (does the numeral suit its noun? judgement required) ──`);
for (const probe of ["1:15", "2:00", "21:00", "1 km", "2 km", "5 km", "21 %"])
    console.log(`  ${probe.padEnd(8)} ${say(probe).slice(0, 52)}`);

console.log(`\n── ordinary text and a sentence end must survive ──`);
for (const probe of ["1990-1995", "12,5", "1.234", "5 000"])
    console.log(`  ${probe.padEnd(10)} ${say(probe).slice(0, 52)}`);

// ── 4b. no SPELLING reaches the phoneme sink ──────────────────────────────────────────────────────
// Uzbek (#590) pushed the decimal word into the sink as ORTHOGRAPHY: `12,5` read `ˈon ikkˈi vergul bˈeʃ`
// — ASCII v/g and no stress, where the g2p says `ʋerɡˈul`. Every other language routes the same literal
// correctly (`sink.emit(phonemizeWord("Komma"))`), which is what makes the defect checkable: a word literal
// inside `text()` that is NOT an argument of the g2p is the bug, and the wrapped form is the fix.
//
// NO GATE COULD SEE IT. The leak classes look for a surviving digit, mark or symbol; a Latin-letter spelling
// in a Latin-script language looks exactly like a word. In a non-Latin script it would have been obvious —
// which is why this landed in Uzbek and not in Macedonian.
//
// MEASURED before shipping: 0 flags across the 60 languages with a normalizer, and it fires on the pre-fix
// Uzbek. The filters below are what took it from 70 raw hits to 0 — comments MENTION the decimal word,
// property tests and dialect comparisons quote strings, and regex flags look like words.
function textBodies(src: string): string[] {
    const bodies: string[] = [];
    for (const m of src.matchAll(/\btext\s*\([^)]*\)\s*(?::\s*string\s*)?\{/gu)) {
        let depth = 0, i = m.index! + m[0].length - 1;
        for (; i < src.length; i++) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}" && --depth === 0) break;
        }
        bodies.push(src.slice(m.index!, i));
    }
    return bodies;
}
const spellings: string[] = [];
for (const f of engineFiles) {
    const src = readFileSync(join("src/languages", dir, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//gu, "")          // a comment mentioning the word is not a call emitting it
        .replace(/(^|[^:])\/\/[^\n]*/gu, "$1");
    for (const body of textBodies(src))
        for (const m of body.matchAll(/"([^"\\\n]{2,40})"|'([^'\\\n]{2,40})'/gu)) {
            const lit = m[1] ?? m[2]!;
            const after = body.slice(m.index! + m[0].length, m.index! + m[0].length + 6);
            const before = body.slice(Math.max(0, m.index! - 40), m.index!);
            if (!/^[\p{L}\p{M}][\p{L}\p{M} '’ʻ-]*$/u.test(lit) || !/\p{L}{2}/u.test(lit)) continue; // a WORD, not a regex/IPA fragment
            if (/^[dgimsuvy]+$/u.test(lit)) continue;                       // regex flags
            if (/phonemiz\w*\(\s*$/u.test(before)) continue;                // the CORRECT shape — routed through the g2p
            // A UNICODE NORMALIZATION FORM IS AN API ARGUMENT, NOT TEXT. `input.normalize("NFC")` inside a
            // `text()` body flagged `"NFC"` as a spelling leak reading [nft͡ʃʼ] — a FALSE POSITIVE, and the
            // gate's first since it shipped at 0/60. Reported by the Swedish run (#605), which worked around
            // it by hoisting the fold out of `text()`; that is a real edit made to satisfy a broken check,
            // which is the worst thing a gate can cause. Reproduced by injecting the fold into Oromo's
            // `text()` before fixing. `.normalize(` only, so a genuine word literal elsewhere still reports.
            if (/\.normalize\(\s*$/u.test(before)) continue;
            if (/[=!<>]=+\s*$/u.test(before) || /^\s*[=!]==?/u.test(after)) continue; // a comparison
            if (/^\s*in\s/u.test(after)) continue;                          // `"key" in obj`
            const ipa = say(lit);
            if (ipa === "" || ipa === lit || ipa.startsWith("THROW")) continue; // g2p is identity here → undecidable
            spellings.push(`"${lit}" (g2p: ${ipa})`);
        }
}
note("spelling → g2p", spellings.length === 0,
    spellings.length === 0 ? "no unphonemized word literal in text()" : `${spellings.join(", ")} — wrap in the g2p`);

// ── 4c. SOURCING: where did each high-traffic word come from? ────────────────────────────────────
// Fula (#596) shipped `tere` as BOTH the decimal point and the percent word. It phonemised cleanly, so the
// scan, the corpus diff and the referee were all green — and the word appears in neither the language's
// corpus nor the epitran referee's 1,777-word list. One word cannot be both "point" and "percent"; both
// readings were wrong, in the highest-traffic rule the layer has.
//
// THIS IS A PROMPT, NOT A GATE, and the distinction is measured. Checked over the 66 treated languages, an
// "unattested" verdict is right often enough to be worth reading and wrong often enough that failing on it
// would be noise: unit borrowings (kilogram, millimetre) are absent from every source in ~30 languages and
// are perfectly correct, which is why `units` is excluded here. What remains — the percent word, the
// currency names, the decimal word — is core vocabulary, where absence is real evidence.
//
// So: read the list. For each word, if you cannot say WHERE it came from, source it or leave the symbol
// unread — a wrong word is worse than a dropped sign (playbook, "Two standing rules on data").
const ESPEAK_DICT = process.env["ESPEAK_NG"] === undefined ? "" : join(process.env["ESPEAK_NG"], "dictsource");
function attestationHaystack(): { tokens: ReadonlySet<string>; text: string } {
    let hay = "";
    const add = (f: string): void => { try { hay += readFileSync(f, "utf8"); } catch { /* absent source */ } };
    // The language's own sources, then any SISTER STANDARD's — same language, so its corpus and referee
    // attest here too (see SISTER_STANDARDS).
    for (const code of [lang, ...sisters(lang)]) {
        if (existsSync(CORPUS_ROOT))
            for (const cd of readdirSync(CORPUS_ROOT).filter((c) => c.startsWith(`${code}_`)))
                for (const f of readdirSync(join(CORPUS_ROOT, cd)).filter((f) => f.endsWith(".tsv"))) add(join(CORPUS_ROOT, cd, f));
        const art = join("tools/corpus/mined", `${code}.jsonc`);
        if (existsSync(art)) add(art);
        for (const f of readdirSync("tools/referee-eval/referees").filter((f) => f.startsWith(`${code}.`)))
            add(join("tools/referee-eval/referees", f));
    }
    for (const f of readdirSync(join("src/languages", dir)).filter((f) => f.endsWith(".jsonc") || f.endsWith(".tsv")))
        add(join("src/languages", dir, f));
    // THE WIKIPEDIA ATTESTATION CACHE (`attest.ts`) — a weaker tier, added last, and added SELECTIVELY.
    //
    // It must NOT be `add()`ed as a file, and this is the one hazard in the whole design: the cache records
    // the word it probed even when the verdict is `absent`, so reading it wholesale would let
    // `"word": "amadola"` satisfy the search for *amadola* — the gate would attest every word it was ever
    // asked about, including the ones proven missing. A self-fulfilling haystack is worse than no haystack.
    //
    // So: only findings with verdict `attested`, and only their EXAMPLE PROSE, which is real running text
    // containing the word as a token. An `absent` or `substring-only` finding contributes nothing at all.
    for (const code of [lang, ...sisters(lang)]) {
        const cache = join("tools/corpus/attest", `${code}.jsonc`);
        if (!existsSync(cache)) continue;
        const src = readFileSync(cache, "utf8");
        for (const block of src.split(/\}\s*,?\s*(?=\{)/u))
            if (/"verdict":\s*"attested"/u.test(block))
                for (const ex of block.matchAll(/"…([^"\\]*)…"/gu)) hay += ` ${ex[1]!} `;
    }
    if (ESPEAK_DICT !== "" && existsSync(ESPEAK_DICT))
        for (const f of [`${lang}_list`, `${lang}_extra`]) add(join(ESPEAK_DICT, f));
    // TOKENS, not a substring test: `hay.includes("tere")` was satisfied by any longer word containing
    // those four letters, which passed the very word this check exists to catch. Kept alongside the raw
    // text, because a script written WITHOUT SPACES (Han, Thai, Khmer, Lao, Burmese) has no tokens to
    // match — there, substring is the only test available.
    return {
        tokens: new Set(fold(hay).split(/[^\p{L}\p{M}'’ʻ·-]+/u).filter((t) => t !== "")),
        text: fold(hay),
    };
}
/** Lowercase and strip combining marks. The Arabic percent word is declared WITH harakat
 *  (`الْمِئَة`) while every corpus is undiacritised, so a mark-sensitive compare reported ten Arabic
 *  dialects as unsourced for a word each of their corpora contains. */
function fold(t: string): string {
    return t.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "");
}
/** Han, Hiragana/Katakana, Thai, Khmer, Lao, Burmese: no spaces, so no token boundaries. */
const SPACELESS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}]/u;
/** The words that carry EVERY instance of their symbol: the percent word, the currency names, the decimal
 *  word. Extracted from the tier's own data and the manifest, so the check reads declarations, not prose. */
function highTrafficWords(hay: { tokens: ReadonlySet<string>; text: string }): string[] {
    const tier = engineSrc.match(/makeSymbolNormalizer\(\{[\s\S]*?\n\}\)/u)?.[0] ?? "";
    // A currency name is only worth checking if its SIGN is in the corpus: a language that never writes ¥
    // never speaks its yen word, so its attestation cannot affect a reading. Checking all of them reported
    // yen/euro/jen across fifteen languages — true, and useless.
    const used = (block: string): string => block.split(/,(?=\s*"[^"]*"\s*:)/u)
        .filter((entry) => { const sign = /"([^"]+)"\s*:/u.exec(entry)?.[1]; return sign !== undefined && hay.text.includes(sign); })
        .join(" ");
    const decl = [
        ...[...tier.matchAll(/percent:\s*(\[[^\]]*\])/gu)].map((m) => m[1]!),
        ...[...tier.matchAll(/currency:\s*\{([^}]*)\}/gu)].map((m) => used(m[1]!)),
        ...readdirSync(join("src/languages", dir)).filter((f) => f.endsWith(".jsonc"))
            .flatMap((f) => [...readFileSync(join("src/languages", dir, f), "utf8")
                .matchAll(/"decimal(?:Word|Connector)"\s*:\s*"([^"]+)"/gu)].map((m) => `["${m[1]!}"]`)),
    ].join(" ");
    // Extract the WORD ARRAYS first, then the literals inside them. Scanning `"…"` over the raw block
    // pairs quotes in the wrong phase: in `"$": ["dollar"]` the closing quote of the KEY pairs with the
    // opening quote of the value, the match consumes both, and `dollar` is never seen — which is how Hausa
    // reported "all 1 high-traffic words attested" while three of its four currency names went unchecked.
    // A LAYER MAY EMIT ITS PERCENT WORD AS TEXT and declare no tier at all — Malay (#601) reads `%` in
    // normalize.ts with `peratus` because the tier it inherits says the Indonesian `persen`. Reading only
    // the declaration made the check inert for exactly the language whose percent word was in question.
    // So: any `.replace()` whose PATTERN mentions `%` contributes the word literals in its REPLACEMENT.
    const normSrc = readFileSync(normPath, "utf8");
    const emitted = [...normSrc.matchAll(/\.replace\(\s*\/[^\n]*%[^\n]*\/[a-z]*\s*,([^;]*)\)/gu)]
        .map((m) => m[1]!).join(" ");
    const words = new Set<string>();
    for (const lit of emitted.matchAll(/"([^"\\\n]{2,40})"|`([^`\\\n]{2,40})`/gu))
        for (const w of (lit[1] ?? lit[2]!).split(/\s+/u))
            if (/^[\p{L}\p{M}][\p{L}\p{M}'’ʻ·-]+$/u.test(w)) words.add(w);
    for (const arr of decl.matchAll(/\[([^\]]*)\]/gu))
        for (const lit of arr[1]!.matchAll(/"([^"]+)"/gu))
            for (const w of lit[1]!.split(/\s+/u)) if (/^[\p{L}\p{M}][\p{L}\p{M}'’ʻ·-]+$/u.test(w)) words.add(w);
    return [...words];
}
const hay = attestationHaystack();
const needles = highTrafficWords(hay);
// A DECLARATION THIS CHECK CANNOT PARSE MUST COMPLAIN, NOT SHRUG. The extractors above read LITERAL
// arrays (`percent: ["odstotek", …]`); a language that declares the same data through a helper
// (`percent: F("pct")`) yields no needles, and the arm below then reports "nothing declared" — which reads
// as *there is nothing to check* when the truth is *the check went blind*. A false negative is worse than
// a false positive: the NFC bug at least announced itself. Reported by the Slovenian run (#608), which
// worked around it locally with literal arrays plus a drift test.
// Measured before adding this: ZERO shipped languages declare tier data through a helper — all ~49 use
// literal arrays — so this is latent, not a live blindness, and closing it costs nothing today.
const declares = /makeSymbolNormalizer\(\{[\s\S]*?\b(?:percent|currency):/u.test(engineSrc);
if (needles.length === 0 && declares)
    note("sourcing", false,
        "a tier IS declared but this check could not read it — declare percent/currency as LITERAL arrays, "
        + "or the sourcing gate silently passes");
else if (needles.length === 0) note("sourcing", null, "no percent/currency/decimal word declared");
else {
    // INFLECTION-TOLERANT: a lemma is attested by any of its forms. Croatian `jen` appears in the Serbian
    // corpus only as the genitive plural *jena*, and Polish `procenty` only as *procent* — the same word
    // each time, and demanding the exact surface form reported both as unsourced. A needle therefore counts
    // as attested when a token differs from it by at most three trailing letters in either direction, with
    // a four-character floor so a short needle cannot be satisfied by an unrelated longer word. Checked
    // against the case this whole line exists for: no Fula token begins with `tere`, so that still reports.
    // The tolerance is GRADED BY LENGTH, because a short needle is cheap to match by accident: three
    // letters allow one more, four allow two, five or more allow three. Croatian `jen` clears on the
    // Serbian corpus's *jena* (+1) but not on the unrelated *jendek* (+3); Polish `procenty` clears on
    // *procent* (-1); Fula `tere` still reports, since nothing in its sources begins with those letters.
    const near = (w: string): boolean => {
        const f = fold(w);
        if (hay.tokens.has(f)) return true;
        if (f.length < 3) return false;
        const slack = f.length >= 5 ? 3 : f.length - 2;
        for (const t of hay.tokens) {
            // FORWARD — the corpus has an inflected form of the needle (jen → jena).
            if (t.length >= 3 && t.startsWith(f) && t.length - f.length <= slack) return true;
            // REVERSE — the corpus has a shorter form of the same lemma (procenty → procent). Bounded far
            // harder, because a fragment matches anything: the token must be a real word (4+) and the
            // needle long enough to be inflected (5+). Without that floor Catalan's three-letter `ien`
            // cleared on a two-letter token, which is not evidence of anything.
            if (t.length >= 4 && f.length >= 5 && f.startsWith(t) && f.length - t.length <= 3) return true;
        }
        return false;
    };
    // WHAT WAS ACTUALLY SEARCHED, per word. "in NO source" was one string for two very different states:
    // nobody has run the Wikipedia probe, versus the probe ran and the word is absent there too. The second
    // is a much stronger negative and the reader should not have to re-run `attest.ts` to discover it.
    const probed = (w: string): string | undefined => {
        for (const code of [lang, ...sisters(lang)]) {
            const cache = join("tools/corpus/attest", `${code}.jsonc`);
            if (!existsSync(cache)) continue;
            for (const block of readFileSync(cache, "utf8").split(/\}\s*,?\s*(?=\{)/u)) {
                if (!new RegExp(`"word":\\s*"${w.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`, "u").test(block)) continue;
                return /"verdict":\s*"substring-only"/u.test(block) ? "substring-only on wikipedia"
                    : /"verdict":\s*"absent"/u.test(block) ? "absent from wikipedia too" : undefined;
            }
        }
        return undefined;
    };
    const verdictOf = (w: string): string => {
        const p = probed(w);
        return `${w} — in NO source (corpus, artifact, referee, manifest, espeak`
            + `${p === undefined ? "; wikipedia NOT probed — try tools/normalization/attest.ts" : `, and ${p}`})`;
    };
    const unattested = needles.filter((w) => (SPACELESS.test(w) ? !hay.text.includes(fold(w)) : !near(w)));
    note("sourcing", unattested.length === 0 ? true : null,
        unattested.length === 0
            ? `all ${needles.length} high-traffic words attested`
            : `${unattested.map(verdictOf).join(", ")} — Say where each came from, or leave the symbol unread`);
}

// ── 5. the artifact scan ──────────────────────────────────────────────────────────────────────────
if (tracked || existsSync(artifact)) {
    try {
        const out = execSync(`npx tsx tools/normalization/mine.ts scan --in ${artifact} --lang ${lang}`, { encoding: "utf8" });
        const clean = out.includes("no defects");
        // A `REDUNDANT` line is a PERMISSIBLE drop, not a defect: the symbol's own word is already in the
        // reading because the sentence spells it out beside the sign ("93% ശതമാനം", "$2300 millones de
        // dólares"), and saying it ONCE in the language-idiomatic position is the correct reading. Surfaced
        // here rather than buried in the scan output, because it is also where a swallowed sign would hide.
        const redundant = out.split("\n").filter((l) => l.startsWith("REDUNDANT")).map((l) => l.split("e.g.")[0]!.trim());
        note("artifact scan", clean,
            (clean ? "no defects" : out.trim().split("\n").slice(-3).join(" | "))
            + (redundant.length > 0 ? ` — permissible: ${redundant.join(", ")} (the word is already in the sentence; read them anyway)` : ""));
    } catch { note("artifact scan", null, "scan failed to run"); }
} else note("artifact scan", null, "no artifact");

function report(): void {
    console.log(`\n── checklist ──`);
    let failed = 0;
    for (const [name, ok, detail] of results) {
        const mark = ok === null ? " ?? " : ok ? " ok " : "FAIL";
        if (ok === false) failed++;
        console.log(`  [${mark}] ${name.padEnd(18)} ${detail}`);
    }
    console.log(`\n${failed === 0 ? "checklist clean" : `${failed} FAILING`} — the readings above still need a human.`);
    console.log("Not covered here: referee before/after, and reading every change in the sample tier.\n");
}
report();
process.exit(results.some(([, ok]) => ok === false) ? 1 : 0);
