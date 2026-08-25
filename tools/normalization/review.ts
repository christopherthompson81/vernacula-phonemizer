/**
 * NORMALIZATION REVIEW — the mechanical half of reviewing a language's normalization layer.
 *
 * WHY THIS EXISTS. Reviewing the Czech layer turned up four defects, and ALL FOUR were checklist
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
import { parseJsonc } from "../../src/core/jsonc.ts";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { CELLS, staleness } from "./cells.ts";
import { ACCEPTED_SIGN_SILENCE, CITED_WORDS, DROPPABLE, SIGN_CASES, sistersOf } from "./defects.ts";
import { pathToFileURL } from "node:url";
import { espeakRoot } from "./espeak.ts";
import { fleursRoot } from "./corpusRoot.ts";

/**
 * ⚠ THE CLI MUST NOT RUN ON IMPORT — the fifth file in this directory to need this guard, after `mine.ts`,
 * `wiki-health.ts`, `candidates.ts` and `sources.ts`, and needed here for the same reason: everything from
 * `main()` down is the checklist, and everything above it is pure text-in / words-out, so
 * `test/normalization-review.test.ts` can put a FIXTURE layer through the sourcing extractor without a
 * language directory, a corpus or a subprocess.
 */
const IS_CLI = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

/** Lowercase and strip combining marks. The Arabic percent word is declared WITH harakat
 *  (`الْمِئَة`) while every corpus is undiacritised, so a mark-sensitive compare reported ten Arabic
 *  dialects as unsourced for a word each of their corpora contains. */
export function fold(t: string): string {
    return t.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "");
}
/** Han, Hiragana/Katakana, Thai, Khmer, Lao, Burmese: no spaces, so no token boundaries. */
export const SPACELESS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}]/u;

/** Everything a word can be attested against, already folded — see `attestationHaystack`. */
export interface Haystack { readonly tokens: ReadonlySet<string>; readonly text: string }
/** The source text a layer's declarations can live in. Passed explicitly rather than read from a
 *  language directory, so the extractor is a pure function and a fixture can stand in for a language. */
export interface LayerSources {
    /** every `.ts` in the language dir WITHOUT "normalize" in its name */
    readonly engine: string;
    /** every `normalize*.ts` in the dir, `normalize.ts` included */
    readonly tier: string;
    /** the `.jsonc` manifests in the dir */
    readonly jsonc: readonly string[];
}

/**
 * ── THE LOCAL TABLE ────────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ THIS CHECK ONCE REPORTED `no percent/currency/decimal word declared` FOR FOUR LAYERS THAT DECLARE ALL
 * OF THEM, and that is the failure mode this section exists to close. Every arm of `declaredWords` used to
 * be anchored on a DECLARATION SHAPE — `makeSymbolNormalizer({ percent: […] })`, a `MANIFEST.symbols`
 * block, or a `.replace(/…%…/, "literal")` written with a literal regex. A layer that owns its symbol table
 * LOCALLY, in code, matched none of them, so `needles` came back empty and the check took the branch that
 * says *there is nothing here to check* — when the truth was *the check cannot see what is here*.
 *
 * A local table is legitimate and sometimes forced: the shared tier runs AFTER `normalize.ts`, so a layer
 * that spends the decimal point itself (ug, ps, fa, ckb) has no number-adjacency left for a tier rule to
 * match on. Pushing those languages back onto `makeSymbolNormalizer` to satisfy a gate would be the gate
 * causing the edit, which is the worst thing a gate can do. So the check learns to read the local shape.
 *
 * ⚠ AND IT MUST NEVER ANSWER `ok` FOR A LAYER IT CANNOT READ. The Lao layer had INVENTED a currency word
 * that appears in no source, and this line is what caught it; a false green here costs exactly that catch.
 * So the extractor reports, per class, both the words it found AND the classes it saw a rule for and found
 * no word in — `unread` — and the caller degrades those to `[??]` with the reason. An honest unknown is
 * fine; a false green is not.
 *
 * ⚠ READ, NOT RUN. The obvious alternative is to ask the layer at RUNTIME what it emits — normalize `35%`
 * and read the word out of the result — which would be immune to every parsing detail below. It is not
 * available: eleven layers export a FACTORY (`makeUyghurNormalizer({ numeralWords })`, `makeHindiNormalizer`)
 * whose dependencies are supplied by the engine, so there is no generic way to construct one; and the only
 * runtime surface that IS generic, `phonemize`, returns IPA, while attestation is a question about
 * ORTHOGRAPHY. Parsing is therefore the available option, and the mitigation for its brittleness is not
 * cleverness but the `unread` channel: when the parse fails, the report says so.
 */

/** The percent sign in every encoding a layer keys on. `﹪` and `％` are rare but real. */
const PERCENT_SIGN = /[%٪﹪％]/u;
/** A word literal: two or more letters, apostrophes and the interpunct allowed inside. */
const WORD = /^[\p{L}\p{M}][\p{L}\p{M}'’ʻ·-]+$/u;
/** ⚠ NOT A WORD: the FLAGS argument of `new RegExp(pattern, "gu")`, which sits inside the very
 *  `.replace()` call the extractor reads and was the first needle ug reported — *gu — in NO source*. The
 *  same filter the `spelling → g2p` check has carried since it shipped. */
const REGEX_FLAGS = /^[dgimsuvy]+$/u;

/** Comments are not code, and here they are actively misleading: a rule's header EXPLAINS the sign and
 *  names the word, and `uyghur/normalize.ts` mentions `makeSymbolNormalizer` only to say why it does not
 *  call it. Reading either would attest a word the layer never emits. */
export function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:])\/\/[^\n]*/gu, "$1");
}

/**
 * `$1` is a BACKREFERENCE, `${…}` an interpolation and a trailing `$` an ANCHOR — none of them is money,
 * and counting them as one would mark half the tree as declaring a currency. `n % 10` is arithmetic for the
 * same reason: a `%` with whitespace on both sides is a modulo, never a regex (English's ordinal suffix
 * rule is the live instance, inside a `.replace` callback).
 *//**
 * Tokens the bare reading has that the CLAUSE-FINAL one lost — the comparison behind the `clause-final`
 * check. A trailing mark may only ADD a pause token; it can never remove one, so anything missing is a rule
 * that declined at a sentence boundary. Multiset difference, not set difference: a reading legitimately
 * repeats a word (`sto … sto`), and treating the second one as already-seen would hide a real loss.
 * Exported so the gate can be shown to FAIL — see `test/normalization-review.test.ts`.
 */
export function lostTokens(bare: string, clauseFinal: string): string[] {
    const rest = clauseFinal.split(/\s+/u).filter(Boolean), out: string[] = [];
    for (const tok of bare.split(/\s+/u).filter(Boolean)) {
        const i = rest.indexOf(tok);
        if (i === -1) out.push(tok); else rest.splice(i, 1);
    }
    return out;
}


function withoutOperators(s: string): string {
    return s
        .replace(/\$\{[^{}]*\}/gu, " ")
        .replace(/\$[$&`'\d<]/gu, " ")
        .replace(/\$(?=\s*(?:[/`"'|)\]]|$))/gu, " ")
        .replace(/(?<=\s)%(?=\s)/gu, " ");
}

/**
 * The WORD literals in a fragment of code — TWO PASSES, because one regex cannot see both. A template
 * literal swallows the strings nested in its interpolations (`` `${n} ${named?.trim() ?? "سلنه"}` `` is
 * Pashto's percent rule, and the word is that inner string), so quoted strings are scanned over the whole
 * fragment first and templates separately, with their interpolations blanked.
 */
export function wordLiterals(source: string): string[] {
    // A UNICODE NORMALIZATION FORM IS AN API ARGUMENT, NOT TEXT — the same false positive the
    // `spelling → g2p` check hit on `"NFC"`. Yoruba's percent rule calls a `fold()` helper whose body is
    // `.normalize("NFD")`, and one hop on, `NFD` was reported as an unsourced Yoruba word.
    const code = source.replace(/\.normalize\(\s*"[^"]*"\s*\)/gu, " ");
    const out: string[] = [];
    const take = (lit: string): void => {
        for (const w of withoutOperators(lit).split(/\s+/u)) if (WORD.test(w) && !REGEX_FLAGS.test(w)) out.push(w);
    };
    for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/gu)) take(m[1] ?? m[2]!);
    for (const m of code.matchAll(/`((?:[^`\\]|\\.)*)`/gu)) take(m[1]!);
    return out;
}

/**
 * ⚠ THE APOSTROPHE IS NOT A QUOTE HERE. Malagasy's percent rule is `.replace(/%\s*n['’]/gu, " isan-jaton'")`
 * — the `'` inside the CHARACTER CLASS opened a "string" that ran past the comma, so the call could not be
 * split and its word went missing from the report. Regex sources hold apostrophes far more often than this
 * repo's layers hold single-quoted strings, so the paren walk recognises only `"` and a backtick; the word
 * scan (`wordLiterals`) reads all three and is unaffected.
 */
function isQuote(c: string): boolean { return c === '"' || c === "`"; }

/** Skip a string/template literal, returning the index of its closing quote. An unterminated quote is an
 *  apostrophe or a regex, not a string, so a non-template bails at the newline. */
function skipLiteral(code: string, at: number): number {
    const q = code[at]!;
    for (let i = at + 1; i < code.length; i++) {
        if (code[i] === "\\") { i++; continue; }
        if (code[i] === q) return i;
        if (q !== "`" && code[i] === "\n") return i;
    }
    return code.length - 1;
}

/**
 * Every `.replace()`/`.replaceAll()` call, paren-balanced and split into its PATTERN and its REPLACEMENT.
 *
 * ⚠ THE WHOLE CALL, NOT A LINE AND NOT A STATEMENT — the replacement may be a callback several statements
 * long (Bambara returns `` `${n} kɛmɛsarada${gap}` `` after two `;` of its own). Splitting the source on
 * `;` cut that in half and splitting on newlines cut every multi-line rule.
 *
 * ⚠ AND THE TWO ARGUMENTS ARE NOT INTERCHANGEABLE, which the first version of this got wrong and paid for
 * across the fleet. Reading the whole call as one blob, Welsh's range rule — whose pattern ENDS in the
 * guard `(?![%\p{Sc}])`, i.e. "not a percentage and not money" — looked like a currency declaration, and
 * its callback then contributed the unit table and, through the hop, the digraph list: eleven invented
 * needles for a rule that reads no symbol at all. So the SIGN is looked for in the pattern and the WORD in
 * the replacement.
 */
export interface ReplaceCall { readonly pattern: string; readonly replacement: string }
export function replaceCalls(code: string): ReplaceCall[] {
    const out: ReplaceCall[] = [];
    for (const m of code.matchAll(/\.replace(?:All)?\s*\(/gu)) {
        const open = m.index! + m[0].length - 1;
        let depth = 0, i = open, comma = -1;
        for (; i < code.length; i++) {
            const c = code[i]!;
            if (isQuote(c)) { i = skipLiteral(code, i); continue; }
            if (c === "(" || c === "[" || c === "{") depth++;
            else if (c === ")" || c === "]" || c === "}") { depth--; if (depth === 0) break; }
            else if (c === "," && depth === 1 && comma === -1) comma = i;
        }
        if (depth !== 0 || i >= code.length || comma === -1) continue;
        out.push({ pattern: code.slice(open + 1, comma), replacement: code.slice(comma + 1, i) });
    }
    return out;
}

/**
 * The part of a PATTERN that can carry a sign the rule actually reads. Two things are cut out first, and
 * both were measured as noise across the fleet:
 *
 *   · LOOKAROUNDS, balanced. `(?![%\p{Sc}])` means "stop before a percentage or a price" — the rule
 *     DECLINES the class. Welsh's range rule ends in exactly that, and reading it as a declaration pulled
 *     in the unit table and, one hop on, the digraph list: eleven invented needles. Balanced, because
 *     Swedish's year guard is `(?!\s*(?:%|[$€£°²³]|(?:km|cm|mm|kg|m)…))` and a `[^()]*` matcher stops at
 *     its first inner group and leaves the `%` behind.
 *   · A NESTED `.replace()`. Abkhaz builds its abbreviation pattern with
 *     `${abbr.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}` — a regex-ESCAPING class, whose `$` is a
 *     metacharacter being escaped and not money.
 */
function signBearingPart(pattern: string): string {
    let out = "";
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i]!;
        // ⚠ NOT SKIPPING OVER STRING LITERALS, and that is the point: a pattern built with `new RegExp` is a
        // TEMPLATE, so its lookarounds live INSIDE the literal. Skipping literals left Azerbaijani's
        // `(?=\s*$)` — an end-of-string anchor in an abbreviation rule — reading as a currency sign, and its
        // era table came back as unsourced currency words.
        const look = /^\(\?<?[!=]/u.test(pattern.slice(i, i + 4));
        const nested = pattern.startsWith(".replace", i);
        if (!look && !nested) { out += c; continue; }
        let depth = 0, j = look ? i : pattern.indexOf("(", i);
        if (j === -1) { out += c; continue; }
        for (; j < pattern.length; j++) {
            const d = pattern[j]!;
            if (isQuote(d)) { j = skipLiteral(pattern, j); continue; }
            if (d === "(") depth++;
            else if (d === ")") { depth--; if (depth === 0) break; }
        }
        out += " ";
        i = j;
    }
    return out;
}

/** The classes a local table can declare. `decimal` is deliberately absent: a layer that spends the
 *  separator as a SPACE — the correct reading when no word is sourceable, and ug's highest-traffic
 *  refusal — is indistinguishable from one that has no rule, so there is nothing honest to report. */
type SymbolClass = "percent" | "currency";

/** The currency signs a fragment keys on, restricted to those the corpus actually writes — a language
 *  that never writes `¥` never speaks its yen word, so its attestation cannot affect a reading. */
function currencySigns(fragment: string, hay: Haystack): string[] {
    return [...new Set(fragment.match(/\p{Sc}/gu) ?? [])].filter((ch) => hay.text.includes(fold(ch)));
}

/**
 * A SIGN-KEYED TABLE, which is what a local currency table looks like in both shapes it is written in:
 * `[["\\$", "دوللار"], ["₺", "لىرا"]]` iterated by a loop (ug), and `{ "$": ["dollar", "dollars"] }` looked
 * up by index (en, fr, it, ms). The `.replace()` in either case names neither the sign nor the word — both
 * arrive through a variable — so the table has to be read directly.
 *
 * ⚠ GATED PER ENTRY, not per table. A language that never writes `¥` never speaks its yen word, so its
 * attestation cannot affect a reading; harvesting whole tables reported yen/euro across fifteen languages,
 * true and useless. This is the same rule the tier's `used()` arm has always applied.
 */
function signKeyedWords(text: string, hay: Haystack): { cls: SymbolClass; words: string[] }[] {
    const out: { cls: SymbolClass; words: string[] }[] = [];
    const push = (key: string, value: string): void => {
        const words = wordLiterals(value);
        if (words.length === 0) return;
        const bare = key.replace(/\\/gu, "");
        if (PERCENT_SIGN.test(bare)) out.push({ cls: "percent", words });
        else if (currencySigns(bare, hay).length > 0) out.push({ cls: "currency", words });
    };
    // `["sign", "word"]` — the array-pair shape.
    for (const m of text.matchAll(/\[\s*"((?:[^"\\\n]|\\.)*)"\s*,\s*"((?:[^"\\\n]|\\.)*)"\s*\]/gu))
        push(m[1]!, `"${m[2]!}"`);
    // `"sign": "word"` and `"sign": ["singular", "plural"]` — the record shape.
    for (const m of text.matchAll(/"((?:[^"\\\n]|\\.)*)"\s*:\s*(\[[^\]]*\]|"(?:[^"\\\n]|\\.)*")/gu))
        push(m[1]!, m[2]!);
    return out;
}

/**
 * A definition's text: from its keyword to the end of its body, brackets balanced.
 *
 * ⚠ BOTH ENDS ARE EASY TO GET WRONG, AND BOTH WERE. `[^;]*;` stopped at the first `;` INSIDE a helper's
 * body, which is where Pashto's `money()` keeps its currency word. Stopping only at a depth-0 `;` runs off
 * the end of a `function` declaration — whose body needs no semicolon — and swallows whatever top-level
 * code follows: that is how Azerbaijani's percent rule, one hop through `harmoniseSuffix()`, came back
 * holding the era table (*eramızdan əvvəl*, *bizim eradan*). So a `}` that closes the definition ends it,
 * while a `)` that merely closes an arrow's parameter list does not.
 */
function definitionOf(code: string, name: string): string {
    const at = new RegExp(`(?:^|[^.\\w])(?:const|let|var|function)\\s+${name}\\b`, "u").exec(code);
    if (at === null) return "";
    let depth = 0, i = at.index + at[0].length;
    for (; i < code.length; i++) {
        const c = code[i]!;
        if (isQuote(c)) { i = skipLiteral(code, i); continue; }
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]") depth--;
        else if (c === "}") { depth--; if (depth <= 0) break; }
        else if (c === ";" && depth <= 0) break;
    }
    return code.slice(at.index, i);
}

/** The parameters of a replacement callback — `(_m, sym, num) => …`. They are the CAPTURES, so an
 *  identifier that is one of them is not a table this check failed to follow; it is the matched text coming
 *  back out. Amharic drops a `$` whose word the corpus already wrote (trap 12) and re-emits only captures:
 *  that rule declares no word and is no blindness either. */
function callbackParams(replacement: string): Set<string> {
    const m = /^\s*(?:\(([^)]*)\)|([A-Za-z_]\w*))\s*(?::[^=]*)?=>/u.exec(replacement);
    const raw = m === null ? "" : (m[1] ?? m[2]!);
    return new Set(raw.split(",").map((p) => /([A-Za-z_]\w*)/u.exec(p)?.[1] ?? "").filter((p) => p !== ""));
}

/**
 * The identifiers a REPLACEMENT reaches out to — called (`percent(n)`), interpolated (`${word}`) or indexed
 * (`CURRENCY[sym]`) — resolved ONE hop to their definition in the same file, with the words they hold.
 *
 * ug's percent replacement is `(…) => percent(n, suf)` and the word lives in that helper's template; en, fr
 * and it keep a `{ "$": ["dollar", "dollars"] }` record and index it. Without the hop all four read as rules
 * with no word — which is the false report itself. One hop only: a second would be a dataflow analysis, and
 * `unread` is the honest answer beyond it.
 */
function hopWords(code: string, replacement: string, hay: Haystack): { words: string[]; unresolved: boolean } {
    const BUILTIN = /^(?:RegExp|String|Number|Boolean|Array|Object|Math|JSON|Set|Map|if|for|while|switch|return|function|new|typeof|undefined|null|true|false)$/u;
    const params = callbackParams(replacement);
    const names = new Set([
        ...[...replacement.matchAll(/(?:^|[^.\w$])([A-Za-z_]\w*)\s*[([]/gu)].map((m) => m[1]!),
        ...[...replacement.matchAll(/\$\{\s*([A-Za-z_]\w*)\b/gu)].map((m) => m[1]!),
    ]);
    const out: string[] = [];
    let unresolved = false;
    for (const name of names) {
        if (BUILTIN.test(name) || params.has(name)) continue;
        const def = definitionOf(code, name);
        if (def === "") { unresolved = true; continue; }
        // ⚠ AN ALIAS OF THE MANIFEST IS NOT A BLINDNESS. Yoruba emits its percent circumfix as
        // `${SYM.percentBefore}` where `const SYM = MANIFEST.symbols` — no word in the code at all, because
        // the words are DATA, which is the house direction and which `manifestSymbols()` above already
        // reads. Counting it here reported "could not read the word for percent" for a layer whose percent
        // word the same checklist line was printing.
        if (/\bMANIFEST\b/u.test(def)) continue;
        // A sign-keyed def is read PER ENTRY; anything else contributes every word literal it holds.
        // ⚠ FOUND-AND-EMPTY IS NOT BLIND. A helper can legitimately hold no word — Yoruba's percent rule
        // calls a tone-folding `fold()` whose whole body is a mark strip — and a currency table whose signs
        // the corpus never writes is gated down to nothing on purpose. Blindness is a name with NO
        // definition in this file: an imported table or helper, where the word is real and out of reach.
        const keyed = signKeyedWords(def, hay);
        out.push(...(keyed.length > 0 ? keyed.flatMap((k) => k.words) : wordLiterals(def)));
    }
    return { words: out, unresolved };
}

/** What a layer declares IN ITS OWN CODE: the words, and the classes it plainly has a rule for and whose
 *  word could not be read. The second half is the whole point — see the section header. */
export function localDeclarations(source: string, hay: Haystack): { words: string[]; unread: SymbolClass[] } {
    // ⚠ THE SHARED TIER'S OWN BLOCK IS CUT OUT FIRST — this arm reads what the tier arm CANNOT, and reading
    // the same declaration twice is not free. `makeSymbolNormalizer({ currency: { … } })` is matched above by
    // `currency:\s*\{([^}]*)\}`, which stops at the first `}` and so misses every entry after a nested one;
    // scanning it here as well turned that latent under-reading into a dozen languages changing verdict in a
    // commit about local tables. It is a real defect — measured at 14 codes (af as az bn ceb it ms ne pt ro
    // sd su xh zsm) whose later currency entries are declared and never checked — and it belongs to the tier
    // arm, in its own change, with its own before/after.
    const code = stripComments(source).replace(/makeSymbolNormalizer\(\{[\s\S]*?\n\}\)/u, " ");
    const words = new Set<string>();
    const seen = new Set<SymbolClass>(), got = new Set<SymbolClass>();
    for (const { pattern, replacement } of replaceCalls(code)) {
        const classes: SymbolClass[] = [];
        const bare = withoutOperators(signBearingPart(pattern));
        if (PERCENT_SIGN.test(bare)) classes.push("percent");
        if (currencySigns(bare, hay).length > 0) classes.push("currency");
        if (classes.length === 0) continue;
        const body = replacement;
        const hop = hopWords(code, body, hay);
        const found = [...wordLiterals(body), ...hop.words];
        // ⚠ A RULE THAT EMITS NO WORD IS NOT A BLINDNESS. Three shapes reach here with nothing found, and
        // none of them is a table this check failed to follow:
        //   · a SIGN-TO-SIGN FOLD — `s.replace(/٪/gu, "%")`, which every Arabic dialect runs before any rule;
        //   · a MOVE or a DROP — `([$€£¥])\s?(\d+\.\d+)` → `"$2 $1"`, and Amharic dropping a `$` whose word
        //     the corpus already wrote (trap 12), whose callback re-emits only its own captures;
        //   · a PASSTHROUGH — wu and hak carry `([%‰])?` through a range rule untouched.
        // Each leaves the replacement with no unresolved identifier: nothing was looked up and lost. The
        // blindness is the OTHER case — `CURRENCY[sym]` or `money(n, …)` where the name resolves nowhere.
        // Whether such a sign is ever SPOKEN is the `sign classes` probe's question, not this line's.
        if (found.length === 0 && !hop.unresolved) continue;
        for (const c of classes) seen.add(c);
        for (const w of found) words.add(w);
        if (found.length > 0) for (const c of classes) got.add(c);
    }
    for (const { cls, words: ws } of signKeyedWords(code, hay)) {
        seen.add(cls); got.add(cls);
        for (const w of ws) words.add(w);
    }
    return { words: [...words], unread: [...seen].filter((c) => !got.has(c)) };
}

async function main(): Promise<void> {

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

    const CORPUS_ROOT = fleursRoot().root; // resolved, not read from the env — see corpusRoot.ts
    /**
     * PLURICENTRIC SETS — codes that are STANDARDS OF ONE LANGUAGE, whose sources attest for each other. Not
     * "related languages": the test is whether a speaker of one would recognise the other's word as their own.
     *
     * Croatian is why this exists. Its tier reads `¥` as `jen`, which the hr corpus never spells — but
     * the SERBIAN corpus renders the very same FLEURS sentence as "od 2500 i 130.000 japanskih jena", and `jen`
     * is in the Serbian referee. The evidence existed and a one-language haystack could not see it, so the
     * check asked a human to source a word the repo already had.
     *
     * Kept deliberately short. Arabic's dialect codes are NOT here: they share a script and much of MSA, but a
     * word being right in one is not evidence for another, which is the whole property this map asserts.
     */
    // Imported, not restated — see SISTER_STANDARDS in defects.ts for why the second copy was removed.
    const sisters = sistersOf;

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
    // file references " — with a blank where the name should be. Found by a loop-back on hi, and the blank
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
    /** The normalize* files, which `engineFiles` excludes by name — the tier may be declared in one of them. */
    const tierSrc = readdirSync(join("src/languages", dir))
        .filter((f) => f.endsWith(".ts") && f.includes("normalize") && !f.includes(".test."))
        .map((f) => readFileSync(join("src/languages", dir, f), "utf8")).join("\n");
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
    // `ms.jsonc`. Reporting that as "missing" then skips the scan entirely, which is how one run lost a gate to a
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
     * mentioned, and it is exactly the kind this gate exists to close — so it is a FAIL, not a note.
     */
    if (existsSync(artifact)) {
        const st = staleness(readFileSync(artifact, "utf8"));
        const current = st.missing.length === 0 && st.unknown.length === 0;
        /**
         * A BACKFILLED CELL PASSES BUT IS NAMED, EVERY RUN. It was evaluated against the artifact's own
         * retained text rather than mined from the corpus, so it answers "does this language write this"
         * and NOT "how often" — and the whole reason the block exists is that the honest answer stays
         * visible instead of being absorbed into `counts`. Saying `mined against all N cells` when one of
         * them was backfilled would be the exact laundering this check exists to prevent.
         */
        const backfilled = st.backfilled.length > 0
            ? `${st.backfilled.length} backfilled from retained text, NOT corpus-counted: ${st.backfilled.join(" ")}` : "";
        const detail = current
            ? [`${CELLS.length - st.backfilled.length}/${CELLS.length} cells mined`, backfilled].filter(Boolean).join(" | ")
            : [
                st.minedAgainst !== undefined && st.minedAgainst !== CELLS.length
                    ? `mined against ${st.minedAgainst} cells, inventory is now ${CELLS.length}` : "",
                st.missing.length > 0 ? `NEVER EVALUATED: ${st.missing.join(" ")}` : "",
                st.unknown.length > 0 ? `dead key(s): ${st.unknown.join(" ")}` : "",
                backfilled,
            ].filter(Boolean).join(" | ");
        note("artifact current", current, current ? detail : `${detail} — re-mine with mine.ts, or backfill the new cell(s) with \`mine.ts backfill\``);
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
    const signCases = SIGN_CASES;
    /**
     * EVERY `DROPPABLE` CLASS MUST BE PROBED HERE, and this asserts it rather than trusting the comment above.
     *
     * `signCases` cannot be DERIVED from `DROPPABLE` — a defect regex is not a probe string, and one class needs
     * several probes (`math-sign` covers `+ ± = < > × ÷`). So it is a hand-kept list, which is exactly the shape
     * that drifted before: the list was missing `÷ > ±`, the exponent and the currency sign, and nothing said so.
     * Mapping each class to the probes that cover it turns the next omission into a loud failure instead of a
     * silent hole — add a class to `DROPPABLE` and this fails until you probe it or state why you did not.
     */
    const CLASS_PROBES: Readonly<Record<string, readonly string[]>> = {
        percent: ["percent"],
        currency: ["currency"],
        degree: ["degrees"],
        minus: ["minus"],
        "math-sign": ["plus", "plus-minus", "equals", "less-than", "greater-than", "times", "divide"],
        exponent: ["exponent"],
        ampersand: ["ampersand"],
        // Script-specific: a language that does not use the mark would report it dropped, so the finding would be
        // noise for all but a handful. `mine.ts scan` catches it where the corpus actually contains one.
        iteration: [],
    };
    {
        const probeNames = new Set(signCases.map(([n]) => n));
        const unmapped = DROPPABLE.map(([k]) => k).filter((k) => CLASS_PROBES[k] === undefined);
        const unprobed = Object.entries(CLASS_PROBES)
            .filter(([, ps]) => ps.length > 0 && !ps.some((p) => probeNames.has(p)))
            .map(([k]) => k);
        const orphan = [...probeNames].filter((n) => !Object.values(CLASS_PROBES).some((ps) => ps.includes(n)));
        const ok = unmapped.length === 0 && unprobed.length === 0 && orphan.length === 0;
        note("sign probes cover DROPPABLE", ok, ok
            ? `all ${DROPPABLE.length} classes mapped to probes`
            : [
                unmapped.length > 0 ? `class(es) with NO mapping: ${unmapped.join(" ")}` : "",
                unprobed.length > 0 ? `mapped but never probed: ${unprobed.join(" ")}` : "",
                orphan.length > 0 ? `probe(s) mapped to no class: ${orphan.join(" ")}` : "",
            ].filter(Boolean).join(" | "));
    }

    const dropped: string[] = [];
    const accepted: string[] = [];
    // ⚠ AN INTENTIONAL SILENCE IS NOT A FAILURE, AND MARKING IT SO MADE THE LINE USELESS. Three languages had a
    // permanently red `sign classes` line for reasons argued at length in their own files, which meant the line
    // could no longer tell anyone whether something had REGRESSED — the only job it has. Those exemptions live in
    // ACCEPTED_SIGN_SILENCE with their reasoning; everything else still fails, because "no rule yet" is a TODO.
    const exempt = ACCEPTED_SIGN_SILENCE[lang] ?? {};
    console.log(`\n── sign classes (read these; a DROPPED line is a hard fail) ──`);
    for (const [name, probe, strip] of signCases) {
        const full = say(probe), bare = say(probe.replace(strip, ""));
        const isDropped = full === bare;
        const why = exempt[name];
        if (isDropped && why !== undefined) accepted.push(name);
        else if (isDropped) dropped.push(name);
        const tag = isDropped ? (why === undefined ? "DROPPED" : "  INTENT") : "       ";
        console.log(`  ${name.padEnd(13)} ${probe.padEnd(8)} ${tag}  ${full.slice(0, 46)}`);
    }
    note("sign classes", dropped.length === 0, dropped.length === 0 ? "none dropped" : `DROPPED: ${dropped.join(" ")}`);
    // PRINTED, NEVER WITHHELD — the same rule the accepted-cells baseline follows: an exemption nobody can see is
    // indistinguishable from a bug nobody has found.
    for (const name of accepted) console.log(`  ⓘ ${name} is INTENTIONALLY silent — ${exempt[name]!}`);

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
     * German reads `5 km²` as *fʏnf km* — the unit abbreviation reaching the phoneme sink verbatim — ⚠ a word your layer emits must come from the language, and this one is
     * defect arriving through the exponent. French differs from `5 km` by ONE VOWEL (kilomˈɛtʁ vs kilɔmˈɛtʁ),
     * an incidental g2p artefact of the changed token, so even a careful reader has to compare two nearly
     * identical strings to see that the `²` was dropped. That is 28 of 66 languages.
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

    // ── 4a-bis. THE CLAUSE-FINAL PROBE ────────────────────────────────────────────────────────────────
    /**
     * DOES THE READING SURVIVE A FULL STOP? Every probe above sits alone; real text ends sentences on
     * figures, and a right-hand guard written `(?![\d.,…])` then declines the whole match at exactly that
     * position. The rule looks correct in isolation and silently gives up at a clause boundary.
     *
     * ⚠ THIS EXISTS BECAUSE THE SAME DEFECT SHIPPED IN FOUR LANGUAGES IN A ROW, three of them in ONE batch
     * and by authors who had read the warning: `lg` (`800 m.` kept a bare `m`), `lt` (`už $800.` read the
     * dollar as silent), `mn` (`350 000.` read as "three hundred fifty, zero"), `et` (`lk 137–151.` lost its
     * `kuni`, measured at 9 corpus segments gained / 0 regressed). One of them sits one line below the arm
     * its author had just fixed for this; another sits in a file whose own comment explains the fix for the
     * COMMA and leaves the DOT. That is the playbook's test for moving a rule off the page and into a tool.
     *
     * THE TEST. A trailing mark may only ADD a pause token; it can never remove one. So phonemize the probe
     * bare and clause-final, and report any token the bare reading has that the clause-final one lost.
     *
     * ⚠ WHAT IS IN THE GATE AND WHAT IS ONLY PRINTED, measured over all 189 registered languages before
     * being wired, because a gate that cries wolf gets switched off:
     *   · SIGNS, UNITS and SPACE-GROUPING — 6 hits in 3 languages (ne `$5.` loses its currency word; su and
     *     mos `50 000.` lose the thousand word). All three read as real defects, so these FAIL.
     *   · RANGES — 174 hits across 49 languages, and that is NOT 49 defects. In Slovene, Slovak, Latvian and
     *     others a trailing `1995.` is itself the ORDINAL marker, so a range rule excluding a following dot
     *     may be deliberate and correct. Printed for a human, never failed on. Reading those 49 is a sweep
     *     task in its own right and the count is recorded here so nobody has to re-derive it.
     *   · `5 m.` and `50,000.` are DELIBERATELY NOT PROBED. `m.` is Monsieur in French and *metai* (year) in
     *     Lithuanian, and the comma is the DECIMAL separator in half the fleet — in both shapes the trailing
     *     mark genuinely changes what the string means, so a lost token is the right answer, not a defect.
     */
    const CLAUSE_FINAL: readonly (readonly [string, string, boolean])[] = [
        ...signCases.map(([n, p]) => [n, p, true] as const),
        ["unit-km", "5 km", true], ["unit-cm", "5 cm", true], ["unit-kg", "5 kg", true],
        ["grouped-space", "50 000", true],
        ["range", "1990-1995", false], ["range-dash", "137\u2013151", false],
    ];
    const clauseLost: string[] = [];
    const clauseLines: string[] = [];
    for (const [name, probe, gated] of CLAUSE_FINAL) {
        const bare = say(probe);
        if (bare === "" || bare.startsWith("THROW")) continue;
        for (const mark of [".", ","]) {
            const missing = lostTokens(bare, say(`${probe}${mark}`));
            if (missing.length === 0) continue;
            clauseLines.push(`  ${name.padEnd(13)} ${(probe + mark).padEnd(11)} ${gated ? "LOST   " : "  note "} ${missing.join(" ").slice(0, 40)}`);
            if (gated) clauseLost.push(`${name}${mark}`);
        }
    }
    if (clauseLines.length > 0) {
        console.log(`\n── clause-final figures (a guard that declines at a sentence end) ──`);
        for (const l of clauseLines) console.log(l);
    }
    note("clause-final", clauseLost.length === 0,
        clauseLost.length === 0 ? "a trailing . or , loses no reading" : `LOST: ${clauseLost.join(" ")}`);

    console.log(`\n── numeral agreement (does the numeral suit its noun? judgement required) ──`);
    for (const probe of ["1:15", "2:00", "21:00", "1 km", "2 km", "5 km", "21 %"])
        console.log(`  ${probe.padEnd(8)} ${say(probe).slice(0, 52)}`);

    console.log(`\n── ordinary text and a sentence end must survive ──`);
    for (const probe of ["1990-1995", "12,5", "1.234", "5 000"])
        console.log(`  ${probe.padEnd(10)} ${say(probe).slice(0, 52)}`);

    // ── 4b. no SPELLING reaches the phoneme sink ──────────────────────────────────────────────────────
    // Uzbek pushed the decimal word into the sink as ORTHOGRAPHY: `12,5` read `ˈon ikkˈi vergul bˈeʃ`
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
                // gate's first since it shipped at 0/60. Reported by the Swedish run, which worked around
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
    // Fula shipped `tere` as BOTH the decimal point and the percent word. It phonemised cleanly, so the
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
    // unread — a wrong word is worse than a dropped sign.
    // ⚠ `=== undefined` LEAVES A HOLE: `export ESPEAK_NG=` sets it to the EMPTY STRING, which is not undefined,
    // and `join("", "dictsource")` is the RELATIVE path `dictsource` — resolved against whatever the cwd
    // happens to be. Falsy, not undefined, is the test; and the path must exist before it counts as searched.
    // ⚠ RESOLVED, NOT READ FROM THE ENVIRONMENT — see tools/normalization/espeak.ts. The tier answers the
    // two classes that block rounds most often, and it was disconnected in every fresh shell.
    const ESPEAK_FOUND = espeakRoot();
    const ESPEAK_ROOT = ESPEAK_FOUND.root;
    const ESPEAK_DICT = ESPEAK_FOUND.dict;
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
        // ⚠ `.tsv` ONLY — NOT THE LANGUAGE'S OWN `.jsonc`, WHICH IS THE DECLARATION THIS CHECK EXISTS TO TEST.
        // The manifests were added here too, and that made the gate self-fulfilling through the second door: the
        // needles are EXTRACTED from `igbo.jsonc`'s `"decimalWord"`, so searching a haystack containing that same
        // file finds the word every time. Igbo's dictionary-sourced `ntụkpọ` — 0 corpus hits, genuinely absent —
        // reported "attested", and so did `zzqqxwood` substituted in its place. A declaration cannot be its own
        // evidence. Lexicon `.tsv`s stay: those are human-verified word lists, independent of what a layer declares.
        for (const f of readdirSync(join("src/languages", dir)).filter((f) => f.endsWith(".tsv")))
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
    /** The words that carry EVERY instance of their symbol: the percent word, the currency names, the decimal
     *  word — from the tier's own data, from the manifest, and from the layer's LOCAL table. Along with the
     *  classes that plainly have a rule and whose word could not be read; see `localDeclarations`. */
    function highTrafficWords(hay: Haystack): { words: string[]; unread: string[] } {
        // SEARCHED IN normalize.ts TOO, because `engineSrc` deliberately EXCLUDES any file with "normalize" in
        // its name — and a language may configure the tier in exactly that file. Three shipped languages do
        // (pa, yue, mi), and for all three this check reported "no percent/currency/decimal word declared" while
        // both were declared: the sourcing gate was silently inert for them. That is the false negative the
        // `declares` note below warns about, arriving through a different door than the one it measured — it
        // checked for data behind a HELPER and found none, where the live blindness was data in another FILE.
        const tier = `${engineSrc}\n${tierSrc}`.match(/makeSymbolNormalizer\(\{[\s\S]*?\n\}\)/u)?.[0] ?? "";
        // A currency name is only worth checking if its SIGN is in the corpus: a language that never writes ¥
        // never speaks its yen word, so its attestation cannot affect a reading. Checking all of them reported
        // yen/euro/jen across fifteen languages — true, and useless.
        /** Every `currency: { … }` body in `src`, brace-matched so a nested object or a `}` inside a comment
         *  cannot truncate it. */
        const currencyBlocks = (src: string): string[] => {
            const out: string[] = [];
            for (const m of src.matchAll(/currency:\s*\{/gu)) {
                let depth = 0;
                for (let i = m.index + m[0].length - 1; i < src.length; i++) {
                    if (src[i] === "{") depth++;
                    else if (src[i] === "}" && --depth === 0) { out.push(src.slice(m.index + m[0].length, i)); break; }
                }
            }
            return out;
        };
        // ⚠ THE KEY MAY BE UNQUOTED, AND FOR 42 LANGUAGES IT IS. `currency: { $: [...], "\u00a5": [...] }` is
        // valid TypeScript and the house style in about a quarter of the fleet, but the first version of
        // this split and filtered on a QUOTED key only — so a shorthand entry matched neither the split
        // lookahead nor the sign extractor, and was dropped whole. Serbian declares `{ $: ["dolar",
        // "dolara", "dolara"], "\u00a5": [...] }`; the gate checked `jen`/`jena` and never once looked at
        // `dolar`. That is the same "check went blind" failure the Hausa comment below records, one key
        // shape further along, and it is worse than the bug it sits beside because it reports GREEN.
        const KEY = '(?:"([^"]+)"|([^\\s"{},:]+))\\s*:';
        const used = (block: string): string => block.split(new RegExp(`,(?=\\s*${KEY})`, "u"))
            .filter((entry) => {
                const m = new RegExp(`^\\s*${KEY}`, "u").exec(entry);
                const sign = m?.[1] ?? m?.[2];
                return sign !== undefined && hay.text.includes(sign);
            })
            .join(" ");
        // The language's .jsonc files, read ONCE — both the manifest-symbols arm and the decimalWord arm
        // below consume this list, so the file-selection rule cannot drift between them.
        // ⚠ THE MANIFESTS ARE IN `data/`, NOT `src/`, AND THIS PATH WAS STALE. Data moved out of the engine
        // tree so neither port owns it, and this arm kept reading `src/languages/<dir>` — where no .jsonc
        // has existed since. `jsoncSrcs` was therefore EMPTY for every manifest-backed language, so the
        // manifest arm this comment block describes never ran and the gate reported "could not read it"
        // for a language whose declarations were all present and typed. The symbol-tier sweep made that
        // the common case rather than the rare one: ~38 languages moved their tier into the .jsonc.
        // ⚠ BOTH ROOTS ARE READ, not just the new one — a few languages still keep a .jsonc beside the
        // engine, and silently dropping those would trade one blind spot for another.
        const jsoncSrcs = [join("data/languages", dir), join("src/languages", dir)]
            .filter((d) => existsSync(d))
            .flatMap((d) => readdirSync(d).filter((n) => n.endsWith(".jsonc"))
                .map((f) => readFileSync(join(d, f), "utf8")));
        // A TIER MAY BE MANIFEST-DRIVEN — `percent: [MANIFEST.symbols.percent]`, currencies built with
        // Object.fromEntries over MANIFEST.symbols.currencies — which is the house direction (data lives in
        // the .jsonc, not in code). The literal extractors see no strings there, and without this arm the
        // check reported "could not read it" for a language whose declarations were all present and typed
        // (the Abkhaz run).
        // ⚠ PARSED, NOT SCRAPED: the first version regex-matched the `symbols` block and stopped at the
        // first line-initial `}` — one nested object formatted across lines and the block silently
        // truncated, dropping needles (the "check went blind" mode this arm exists to close). parseJsonc is
        // the repo's own conformant parser, written for exactly this failure; four sibling tools already
        // use it.
        // ⚠ GATED ON THE WHOLE LAYER SOURCE, not the matched tier block: yoruba aliases
        // (`const SYM = MANIFEST.symbols`) and the tier block then never contains the literal string.
        // Every STRING under `symbols` is a candidate word (percent, degree, hour, squared…); a
        // [sign, word] pair contributes its word only when the FOLDED sign is in the corpus — the same
        // sign-in-corpus rule as the inline `used()` arm, folded because `hay.text` is folded (an
        // unfolded "US$" can never match a lowercased haystack).
        const manifestSymbols = (): string[] => {
            // ⚠ AND THE ACTIVATION GUARD WAS STALE TOO, for the same reason the path was. It tested for
            // `MANIFEST.symbols`, and the symbol-tier sweep renamed that key to `symbolTier` fleet-wide
            // (and some engines reach it as `DEF.symbolTier` or `def.symbolTier`, not through a MANIFEST
            // alias at all). So the arm switched itself off for exactly the languages the sweep had just
            // made manifest-backed. Match the FIELD, not one spelling of the object holding it.
            if (!/\.(symbols|symbolTier)\b/u.test(`${engineSrc}\n${tierSrc}\n${readFileSync(normPath, "utf8")}`)) return [];
            const out: string[] = [];
            const walk = (v: unknown): void => {
                if (typeof v === "string") { out.push(v); return; }
                if (Array.isArray(v)) {
                    if (v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string") {
                        if (hay.text.includes(fold(v[0]))) out.push(v[1]);
                        return;
                    }
                    for (const x of v) walk(x);
                }
                // nested Records (e.g. a scales→numbers-key map) hold REFERENCES, not words — skipped.
            };
            // ⚠ BOTH KEYS. `symbols` is the older name and still means two different tables depending on
            // the language — a symbol-WORD bag in yo, a bare-sign map in the Indic group — while
            // `symbolTier` is what the sweep standardised the SHARED tier on. Reading only the first left
            // el and sw blind after their tiers moved, so both are walked and the union is the candidate
            // set; a word that is not in the corpus contributes nothing either way.
            for (const src of jsoncSrcs) {
                const doc = parseJsonc(src) as { symbols?: Record<string, unknown>; symbolTier?: Record<string, unknown> };
                for (const v of Object.values(doc.symbols ?? {})) walk(v);
                for (const v of Object.values(doc.symbolTier ?? {})) walk(v);
            }
            return out;
        };
        const decl = [
            ...[...tier.matchAll(/percent:\s*(\[[^\]]*\])/gu)].map((m) => m[1]!),
            // ⚠ BRACE-MATCHED, NOT `[^}]*`. That class stops at the FIRST `}`, so a nested object or a
            // comment containing one truncates the block and silently drops every entry after it — the
            // same shape the `parseJsonc` comment below records for the manifest arm. No shipped language
            // trips it today (measured), which is exactly why it would ship unnoticed when one does.
            ...currencyBlocks(tier).map((b) => used(b)),
            ...manifestSymbols().map((w) => `["${w.replace(/"/gu, "")}"]`),
            ...jsoncSrcs.flatMap((src) =>
                [...src.matchAll(/"decimal(?:Word|Connector)"\s*:\s*"([^"]+)"/gu)].map((m) => `["${m[1]!}"]`)),
        ].join(" ");
        // Extract the WORD ARRAYS first, then the literals inside them. Scanning `"…"` over the raw block
        // pairs quotes in the wrong phase: in `"$": ["dollar"]` the closing quote of the KEY pairs with the
        // opening quote of the value, the match consumes both, and `dollar` is never seen — which is how Hausa
        // reported "all 1 high-traffic words attested" while three of its four currency names went unchecked.
        // A LAYER MAY EMIT ITS PERCENT WORD AS TEXT and declare no tier at all — Malay reads `%` in
        // normalize.ts with `peratus` because the tier it inherits says the Indonesian `persen`. Reading only
        // the declaration made the check inert for exactly the language whose percent word was in question.
        // The first version of this arm read one shape — `.replace(/…%…/, "literal")` — and four layers that
        // declare a percent word, three currency names and an explicit decimal refusal (bm, my, ps/pbt, ug)
        // wrote it another way and were reported as declaring NOTHING. `localDeclarations` reads the local
        // table; see its header for what it does when it cannot.
        const local = localDeclarations(`${tierSrc}\n${engineSrc}`, hay);
        const words = new Set<string>(local.words);
        for (const arr of decl.matchAll(/\[([^\]]*)\]/gu))
            for (const lit of arr[1]!.matchAll(/"([^"]+)"/gu))
                for (const w of lit[1]!.split(/\s+/u)) if (/^[\p{L}\p{M}][\p{L}\p{M}'’ʻ·-]+$/u.test(w)) words.add(w);
        return { words: [...words], unread: local.unread };
    }
    const hay = attestationHaystack();
    const { words: needles, unread } = highTrafficWords(hay);
    /** A class the layer plainly has a rule for and whose word this check could not read. NEVER folded into
     *  an `ok`: the Lao layer's invented currency word is what this line exists to catch, so a green verdict
     *  that silently excluded an unread class would cost exactly that catch. */
    const blind = unread.length === 0 ? ""
        : ` — ⚠ and this check could not read the word for: ${unread.join(", ")} (emitted through a helper or `
        + `a table it cannot follow; source those by hand)`;
    // A DECLARATION THIS CHECK CANNOT PARSE MUST COMPLAIN, NOT SHRUG. The extractors above read LITERAL
    // arrays (`percent: ["odstotek", …]`); a language that declares the same data through a helper
    // (`percent: F("pct")`) yields no needles, and the arm below then reports "nothing declared" — which reads
    // as *there is nothing to check* when the truth is *the check went blind*. A false negative is worse than
    // a false positive: the NFC bug at least announced itself. Reported by the Slovenian run, which
    // worked around it locally with literal arrays plus a drift test.
    // Measured before adding this: ZERO shipped languages declare tier data through a helper — all ~49 use
    // literal arrays — so this is latent, not a live blindness, and closing it costs nothing today.
    const declares = /makeSymbolNormalizer\(\{[\s\S]*?\b(?:percent|currency):/u.test(`${engineSrc}\n${tierSrc}`);
    if (needles.length === 0 && declares)
        note("sourcing", false,
            "a tier IS declared but this check could not read it — declare percent/currency as LITERAL arrays, "
            + "or the sourcing gate silently passes");
    // ⚠ "NOTHING DECLARED" AND "NOTHING I COULD READ" ARE DIFFERENT ANSWERS, and printing the first for the
    // second is what made this line lie about ug. Both are `[??]`; only the reason differs, and the reason is
    // the whole value of the line — one says *there is nothing to source*, the other says *go source it by
    // hand, because I went blind here*.
    else if (needles.length === 0 && unread.length > 0)
        note("sourcing", null,
            `the layer HAS a ${unread.join("/")} rule and this check could not read the word it emits `
            + "— source it by hand, or declare it as a literal");
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
        // ⚠ AND THE SAME DISTINCTION APPLIES TO ESPEAK, which this line used to name unconditionally. With
        // `$ESPEAK_NG` unset, `ESPEAK_DICT` is "" and the dictsource tier contributes nothing to the haystack —
        // so "in NO source (… espeak …)" claimed a search that never ran, which is the stronger negative
        // asserted from a shell variable. It is the identical mistake the wikipedia half of this string was
        // written to avoid, one source over, and it is the mistake `sources.ts` was making fleet-wide.
        // Two ways to be off and they need different fixes, so name the one that applies rather than asserting
        // the commoner one — a reader who HAD exported the variable must not be told to export it.
        const espeakSearched = ESPEAK_DICT !== "" && existsSync(ESPEAK_DICT);
        const espeakWhy = ESPEAK_FOUND.note;
        const verdictOf = (w: string): string => {
            const p = probed(w);
            return `${w} — in NO source (corpus, artifact, referee, lexicon`
                + `${espeakSearched ? ", espeak" : `; espeak NOT consulted — ${espeakWhy}`}`
                + `${p === undefined ? "; wikipedia NOT probed — try tools/normalization/attest.ts" : `, and ${p}`})`;
        };
        // A CITATION IS SOURCING TOO — see CITED_WORDS. A corpus cannot attest how a SYMBOL is spoken (writers type
        // `2.5`, they never write how they say it), so a decimal word can be in universal use and score zero. The
        // citation must name a work outside this repository; the manifest deliberately does not count, because the
        // needles are extracted from it.
        const cited = CITED_WORDS[lang] ?? {};
        const unattested = needles.filter((w) => cited[w] === undefined
            && (SPACELESS.test(w) ? !hay.text.includes(fold(w)) : !near(w)));
        const citedUsed = needles.filter((w) => cited[w] !== undefined);
        const how = citedUsed.length === 0 ? "" : `; ${citedUsed.length} CITED — `
            + citedUsed.map((w) => `${w}: ${cited[w]!}`).join(" · ");
        note("sourcing", unattested.length === 0 && unread.length === 0 ? true : null,
            unattested.length === 0
                ? `all ${needles.length} high-traffic words attested${how}${blind}`
                : `${unattested.map(verdictOf).join(", ")} — Say where each came from, or leave the symbol unread${how}${blind}`);
    }

    // ── 5. the artifact scan ──────────────────────────────────────────────────────────────────────────
    if (tracked || existsSync(artifact)) {
        try {
            const out = execSync(`npx tsx tools/normalization/mine.ts scan --in ${artifact} --lang ${lang}`, { encoding: "utf8" });
            /**
             * ⚠ CLEAN MEANS NO DEFECT LINE, NOT THE LITERAL STRING "no defects". The scan prints that only when it
             * reports NOTHING AT ALL, so an artifact whose every finding is a NOTE — FOREIGN, REDUNDANT, ACCEPTED,
             * MARKUP, none of them a defect — failed this gate. Khmer hit it: every dropped math-sign was fixed or
             * excused, the scan emitted four note lines and no DROP, and the gate still said FAIL and then printed
             * the notes as the reason, because the message builder finds no DROP line and falls back to the last
             * three lines of output. That is the same shape as the `slice(-3)` bug the comment below describes —
             * a verdict derived from the shape of the output rather than from its content.
             */
            const defects = out.trim().split("\n").filter((l) => /^(DROP|LEAK|THROW)/u.test(l));
            const clean = out.includes("no defects") || defects.length === 0;
            // A `REDUNDANT` line is a PERMISSIBLE drop, not a defect: the symbol's own word is already in the
            // reading because the sentence spells it out beside the sign ("93% ശതമാനം", "$2300 millones de
            // dólares"), and saying it ONCE in the language-idiomatic position is the correct reading. Surfaced
            // here rather than buried in the scan output, because it is also where a swallowed sign would hide.
            const redundant = out.split("\n").filter((l) => l.startsWith("REDUNDANT")).map((l) => l.split("e.g.")[0]!.trim());
            note("artifact scan", clean,
                // ⚠ EVERY DEFECT LINE, NOT THE LAST THREE. `slice(-3)` silently hid defects as the number of reported
                // classes grew — the scan sorts defects before notes, so REDUNDANT/ACCEPTED/FOREIGN notes pushed real
                // DROP lines out of the window. km was reporting 13 dropped math-signs that this gate did not print,
                // and the omission fooled the author of this change into recording the class as fixed.
                (clean ? (defects.length === 0 && !out.includes("no defects") ? "no defects — every finding is a note" : "no defects")
                    : defects.join(" | "))
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
}

if (IS_CLI) await main();
