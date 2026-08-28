/**
 * Normalizer provenance — #1150 stage 2.
 *
 * Stage 1 shipped a `normalize` REWRITE EVENT: one `{before, after}` pair for the whole normalization. That
 * is the receipt. This is the itemisation — WHICH INPUT CHARACTERS produced a given normalized span — and it
 * is what turns a trace token's span (into `normalized`) into a span into the caller's own string.
 *
 * `rewrite(s, re, rep)` is a faithful drop-in for `s.replace(re, rep)` that also maintains that mapping, so
 * adopting it in a normalizer is a textual substitution:
 *
 *     s = s.replace(RE, REP)   ->   s = rewrite(s, RE, REP)
 *
 * ⚠ THE HOT PATH IS THE WHOLE DESIGN. There are ~3,300 of these sites across 168 normalizers plus the shared
 * tier, and `phonemize()` runs them on every utterance. When no trace is recording, `rewrite` calls
 * `String.replace` and returns — one boolean test, native semantics, nothing allocated. The provenance path
 * exists only while `phonemizeTrace` is running, which is also what keeps the fidelity risk off the shipped
 * reading entirely: untraced, `rewrite` IS `replace`.
 *
 * ⚠ THE REGISTRY PRE-PASSES REPORT TOO, and getting there taught the seam's own rule. `stripMarkup`, the
 * confusable and fullwidth folds, Roman numerals and the vulgar-fraction fold run BEFORE any engine
 * normalizer; instrumenting their nineteen `.replace` sites lifted coverage and made
 * `phonemizeTrace("<b>hi</b> there", "en")` map both tokens where it previously mapped neither.
 *
 * ⚠ BUT THE SEAM MUST STAY NARROW, and a blanket conversion proved it. `foldLatinDiacritics` lives in the
 * same file and looks identical, but it is called PER WORD from `resolveWord` — routing it through `rewrite`
 * poisoned the mapping on every utterance, because here a length mismatch legitimately means "a step went
 * unseen". Only functions that transform the PIPELINE STRING belong on this seam. (The C# port takes the
 * opposite rule for the opposite reason: its seam is `JsRe.Replace`, which the whole codebase uses, so a
 * mismatch there means "a different string" and is ignored.)
 *
 * ⚠ THE OLD CEILING, kept because the reasoning still applies to anything not yet reporting: `getPhonemizer`'s wrapper runs
 * `stripMarkup`, the confusable and fullwidth folds, Roman numerals and the vulgar-fraction fold BEFORE any
 * engine normalizer, and none of them reports. A LENGTH-PRESERVING one is harmless (`foldNativeDigits` maps
 * ｜１｜→｜1｜ one for one, and the mapping survives); a LENGTH-CHANGING one desyncs and the mapping is then
 * withheld. Measured: `phonemizeTrace("Dr. Smith paid １２５０", "en")` maps every token, and
 * `phonemizeTrace("<b>hi</b> there", "en")` maps none. 92.8% of tokens across the golden corpus carry a span;
 * the remaining 7.2% is overwhelmingly this.
 *
 * ⚠ INPUT-SIDE ONLY. `rewrite` maps a span back to the CALLER'S TEXT, so it belongs in a normalizer and nowhere
 * else. Several engine files carry the same `s = s.replace(...)` shape over an IPA STRING — `english-gb.ts`
 * un-flaps a tapped coronal and maps offglides on the READING, not the input — and routing those through
 * `rewrite` would stamp input offsets across output characters and silently corrupt the mapping. The shape is
 * identical; the meaning is not. A post-assembly rewrite reports itself through `noteRewrite` instead.
 *
 * ⚠ AND SPAN GRANULARITY IS WHAT MAKES IT WORK. A replacement's provenance is the whole match's span, not a
 * character correspondence. Normalizers reorder INSIDE a match — Luganda reads `1 244.7 km²` as
 * *kiromita eza kyebiriga 1244 7*, the unit ahead of the figure it followed — and a span mapping absorbs
 * that. Measured over 27,286 golden rows across 140 normalizers: zero non-monotonic once every step reports.
 */
import { hostDepth } from "./foreign.ts";

/** `prov[i]` = the `[start, end)` of the ORIGINAL input that character `i` of the current string came from. */
let prov: [number, number][] | null = null;
/**
 * ⚠ THE STRING THE MAPPING DESCRIBES. Length alone cannot carry the guarantee: a step outside `rewrite` that is
 * NET length-preserving passes a length check while having shifted every interior offset. Found in the C#
 * port, where `Mandarin.SubstituteNumbers` rewrites a code-point list outside the seam — `115`→`一百一十五` is
 * +2 and each `10`→`十` is −1 — so a stale identity mapping survived and reported `十` as coming from a SPACE.
 * The same hole was here. Comparing content is O(n) and only on the traced path.
 */
let tracked: string | null = null;

/**
 * ⚠ ONCE DESYNCED, STAY DESYNCED. `rewrite` rebuilds the array at the CURRENT string's length, so if a step the
 * mapping did not see has already shifted the text, the next tracked step would re-synchronise the LENGTH
 * over shifted values — and `provenanceFor`'s length check, the module's whole safety net, would then pass
 * and report those values as fact. Measured before this guard: 1,478 of 112,640 tokens across 74 languages
 * named input characters that did not contain their own surface (`paid` → `" Smi"`). Dropping the mapping on
 * the first sign of a gap is what makes "absent" mean not-known instead of not-noticed.
 */
function poison(): void {
    prov = null;
    tracked = null;
}

/**
 * A diagnostic sink for the poison, off by default and free when unset.
 *
 * ⚠ THE POISON IS THE ONLY THING THAT NAMES A NON-PIPELINE CALL SITE. Static shape cannot tell
 * `s = rewrite(s, …)` on the pipeline string from the same line inside a per-word helper — that
 * distinction is dynamic, and getting it wrong silently costs an utterance its whole mapping. Adopting the
 * seam in a new language (or a new port) is therefore: convert broadly, run the corpus with a sink
 * installed, and revert exactly the sites it names. Kept in the shipped module rather than a probe because
 * the next port will need it as much as this one did.
 */
let poisonSink: ((expected: string, got: string) => void) | null = null;
export function onPoison(fn: ((expected: string, got: string) => void) | null): void {
    poisonSink = fn;
}

/**
 * Begin tracking, with `input` as the origin. Called by the trace recorder, never by a normalizer.
 * ⚠ A SECOND CALL AT DEPTH RESETS NOTHING: an embedded foreign run normalizes its own text through the same
 * `rewrite`, and letting it re-seed would replace the host's mapping with the run's.
 */
export function beginProvenance(input: string): void {
    if (hostDepth() > 1) return;
    // ⚠ CODE UNITS, NOT CODE POINTS. `[...input]` iterates code points, while `s[i]`, `span()` and
    // `TraceToken.span` are all UTF-16 offsets — one astral character (an emoji, an SMP letter) made the seed
    // array SHORT, and the desync then read as a valid mapping. Indexing has to match what it indexes.
    prov = Array.from({ length: input.length }, (_, i) => [i, i + 1] as [number, number]);
    tracked = input;
}

export function endProvenance(): void {
    if (hostDepth() > 1) return;
    prov = null;
    tracked = null;
}

/**
 * The mapping, or `undefined` when it cannot be trusted.
 *
 * ⚠ LENGTH IS THE COMPLETENESS CHECK. Any transformation that is not routed through `rewrite` still changes the
 * string but leaves the array behind, so the two fall out of step. Returning a mapping in that state would
 * hand a caller confident, wrong offsets — so it is withheld instead, which is the difference between "we do
 * not know" and a silent wrong answer.
 */
export function provenanceFor(normalized: string): [number, number][] | undefined {
    if (prov === null || tracked !== normalized) return undefined;
    return prov;
}

/** The `[start,end)` in the input that produced `[from,to)` of the normalized string. */
export function inputSpan(p: [number, number][], from: number, to: number): [number, number] | undefined {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = from; i < to; i++) {
        const q = p[i];
        if (q === undefined) continue;
        lo = Math.min(lo, q[0]);
        hi = Math.max(hi, q[1]);
    }
    return lo === Infinity ? undefined : [lo, hi];
}

/**
 * `$`-substitution for a STRING replacement, following `String.replace` EXACTLY.
 *
 * ⚠ AN OUT-OF-RANGE `$n` IS LITERAL, NOT EMPTY. `"abc".replace(/\d+/g, "$1")` keeps the text `$1`, because
 * the pattern has no group 1. A randomised differential against the native `replace` caught this on 337 of
 * 4,000 cases — silently wrong anywhere a replacement contains a literal dollar-digit.
 * ⚠ AND `$nn` FALLS BACK to `$n` plus the trailing digit when the two-digit group does not exist.
 */
function expand(rep: string, m: RegExpMatchArray, at: number, whole: string): string {
    const groups = m.length - 1;
    let out = "";
    for (let i = 0; i < rep.length; i++) {
        if (rep[i] !== "$" || i === rep.length - 1) {
            out += rep[i]!;
            continue;
        }
        const c = rep[i + 1]!;
        if (c === "$") { out += "$"; i++; continue; }
        if (c === "&") { out += m[0]; i++; continue; }
        if (c === "`") { out += whole.slice(0, at); i++; continue; }
        if (c === "'") { out += whole.slice(at + m[0].length); i++; continue; }
        if (c === "<") {
            const close = rep.indexOf(">", i + 2);
            if (close < 0 || m.groups === undefined) { out += "$"; continue; }
            out += m.groups[rep.slice(i + 2, close)] ?? "";
            i = close;
            continue;
        }
        if (c >= "0" && c <= "9") {
            const two = rep[i + 2];
            const twoDigit = two !== undefined && two >= "0" && two <= "9" ? Number(c + two) : NaN;
            if (!Number.isNaN(twoDigit) && twoDigit >= 1 && twoDigit <= groups) { out += m[twoDigit] ?? ""; i += 2; continue; }
            const one = Number(c);
            if (one >= 1 && one <= groups) { out += m[one] ?? ""; i++; continue; }
            out += "$";
            continue;
        }
        out += "$";
    }
    return out;
}

/** The union of the provenance of `[at, at+len)`. A ZERO-WIDTH match is an insertion: the point, not a range. */
function span(p: [number, number][], at: number, len: number): [number, number] {
    if (len === 0) {
        const here = p[at];
        if (here !== undefined) return [here[0], here[0]];
        const prev = p[at - 1];
        return prev === undefined ? [0, 0] : [prev[1], prev[1]];
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = at; i < at + len; i++) {
        const q = p[i];
        if (q === undefined) continue;
        lo = Math.min(lo, q[0]);
        hi = Math.max(hi, q[1]);
    }
    if (lo === Infinity) {
        const prev = p[at - 1];
        return prev === undefined ? [0, 0] : [prev[1], prev[1]];
    }
    return [lo, hi];
}

/**
 * The replacer `String.replace` accepts. ⚠ `any[]` MATCHES THE STANDARD LIBRARY'S OWN SIGNATURE
 * (`lib.es5.d.ts`: `replacer: (substring: string, ...args: any[]) => string`), and it has to: callbacks in
 * the tree declare their captures with real types (`(whole, base: string, sup: string, at: number,
 * all: string)`), which `never[]` or `unknown[]` reject under strictFunctionTypes. This is a drop-in for
 * `replace`, so it takes exactly what `replace` takes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Replacer = string | ((substring: string, ...args: any[]) => string);

/**
 * ⚠ A STRING PATTERN IS A LITERAL, FIRST MATCH ONLY — `String.replace`'s own rule, and the reason this
 * overload exists rather than the 31 sites that use one being left off the seam. Escaping it into a
 * non-global RegExp reproduces that rule exactly, so the shape stays one function with one implementation.
 * ⚠ `$` IN THE REPLACEMENT STILL SUBSTITUTES. `"a".replace("a", "$&")` yields `"a"`, not `"$&"`, so the
 * replacement must go through `expand` as it does for a regex — which routing it through `rewrite` does.
 * ⚠ AND NO `u` FLAG: everything is escaped, so the reading is identical either way, while `u` would THROW
 * on a lone surrogate in the pattern.
 */
const ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/gu;

/** `s.replace(re, rep)`, carrying provenance when a trace is recording and nothing at all when it is not. */
export function rewrite(s: string, re: RegExp | string, rep: Replacer): string {
    // ⚠ THE UNTRACED PATH IS THE NATIVE CALL. Not "equivalent to" it — it IS it, so no reading can differ
    // because of this module, and the 3,300 sites cost one boolean test each.
    // ⚠ AND THE STRING-PATTERN FORM MUST TAKE IT FIRST. Escaping the literal and compiling a RegExp is how
    // the traced path reproduces `replace`'s first-match rule, but doing it before this test put an escape
    // pass and a regex construction on the SHIPPED path of every site that passes a literal.
    const p = prov;
    if (p === null || hostDepth() > 1) return s.replace(re as RegExp, rep as string);
    if (typeof re === "string") return rewrite(s, new RegExp(re.replace(ESCAPE_PATTERN, "\\$&")), rep);
    // ⚠ THE MAPPING MUST ALREADY DESCRIBE THE STRING IT IS HANDED. If a step this module did not see has
    // shifted the text, `p` is stale — and continuing would rebuild it at the NEW length, re-synchronising
    // the length check over shifted values and reporting them as fact. Checking only the indices actually
    // read is not enough: the repro (`"abc"` → an untracked `b`→`BB`, then a tracked `c`→`C`) touches none
    // of the missing ones and still comes out confidently wrong.
    if (tracked !== s) { poisonSink?.(tracked ?? "", s); poison(); return s.replace(re, rep as string); }

    const global = re.flags.includes("g");
    const rx = new RegExp(re.source, global ? re.flags : re.flags + "g");
    // ⚠ `String.replace` RESETS `lastIndex` on a global regex; this path builds its own and would leave the
    // caller's object untouched. khmer's de-grouping loop shares one `/g` regex between `rewrite` and `.test()`,
    // so a stale offset there could end the loop early — latent, but the guarantee is that no reading differs.
    re.lastIndex = 0;
    const out: string[] = [];
    const next: [number, number][] = [];
    let cursor = 0;
    let seen = 0;
    for (const m of s.matchAll(rx)) {
        if (!global && seen > 0) break;
        seen++;
        const at = m.index ?? 0;
        for (let i = cursor; i < at; i++) {
            const q = p[i];
            if (q === undefined) { poison(); return s.replace(re, rep as string); }
            out.push(s[i]!);
            next.push(q);
        }
        // ⚠ DO NOT RE-RUN THE REGEX ON THE ISOLATED MATCH. A pattern with a lookahead cannot match `m[0]`
        // alone, so the replacement silently does not apply — `Jr.` stayed `Jr.` on 2 of 200 English rows.
        // The replacer takes the arguments `String.replace` passes, INCLUDING offset and whole string, which
        // several callbacks read.
        const piece =
            typeof rep === "function"
                ? (rep as (substring: string, ...args: unknown[]) => string)(
                      m[0],
                      ...(m as unknown as unknown[]).slice(1, m.length),
                      at,
                      s,
                      ...(m.groups === undefined ? [] : [m.groups]),
                  )
                : expand(rep, m, at, s);
        const sp = span(p, at, m[0].length);
        // ⚠ CODE UNITS AGAIN: `for (const ch of piece)` yields code POINTS, so an astral character in a
        // replacement pushed one entry where the string grew by two.
        for (let i = 0; i < piece.length; i++) {
            out.push(piece[i]!);
            next.push(sp);
        }
        cursor = at + m[0].length;
        if (m[0].length === 0 && cursor < s.length) {
            const q = p[cursor];
            if (q === undefined) { poison(); return s.replace(re, rep as string); }
            out.push(s[cursor]!);
            next.push(q);
            cursor++;
        }
    }
    for (let i = cursor; i < s.length; i++) {
        const q = p[i];
        if (q === undefined) { poison(); return s.replace(re, rep as string); }
        out.push(s[i]!);
        next.push(q);
    }
    // ⚠ AND THE ARRAY MUST MATCH THE STRING IT DESCRIBES, or the length check is measuring nothing.
    const joined = out.join("");
    // ⚠ REPORTED TOO. This branch means the accounting in THIS function failed, which is a worse fault
    // than a missed pipeline step and was the only way to lose the mapping without saying so.
    if (next.length !== joined.length) { poisonSink?.(s, joined); poison(); return joined; }
    prov = next;
    tracked = joined;
    return joined;
}
