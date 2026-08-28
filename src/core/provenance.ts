/**
 * Normalizer provenance — #1150 stage 2.
 *
 * Stage 1 shipped a `normalize` REWRITE EVENT: one `{before, after}` pair for the whole normalization. That
 * is the receipt. This is the itemisation — WHICH INPUT CHARACTERS produced a given normalized span — and it
 * is what turns a trace token's span (into `normalized`) into a span into the caller's own string.
 *
 * `tr(s, re, rep)` is a faithful drop-in for `s.replace(re, rep)` that also maintains that mapping, so
 * adopting it in a normalizer is a textual substitution:
 *
 *     s = s.replace(RE, REP)   ->   s = tr(s, RE, REP)
 *
 * ⚠ THE HOT PATH IS THE WHOLE DESIGN. There are ~3,200 of these sites across 168 normalizers plus the shared
 * tier, and `phonemize()` runs them on every utterance. When no trace is recording, `tr` calls
 * `String.replace` and returns — one boolean test, native semantics, nothing allocated. The provenance path
 * exists only while `phonemizeTrace` is running, which is also what keeps the fidelity risk off the shipped
 * reading entirely: untraced, `tr` IS `replace`.
 *
 * ⚠ INPUT-SIDE ONLY. `tr` maps a span back to the CALLER'S TEXT, so it belongs in a normalizer and nowhere
 * else. Several engine files carry the same `s = s.replace(...)` shape over an IPA STRING — `english-gb.ts`
 * un-flaps a tapped coronal and maps offglides on the READING, not the input — and routing those through
 * `tr` would stamp input offsets across output characters and silently corrupt the mapping. The shape is
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
 * Begin tracking, with `input` as the origin. Called by the trace recorder, never by a normalizer.
 * ⚠ A SECOND CALL AT DEPTH RESETS NOTHING: an embedded foreign run normalizes its own text through the same
 * `tr`, and letting it re-seed would replace the host's mapping with the run's.
 */
export function beginProvenance(input: string): void {
    if (hostDepth() > 1) return;
    prov = [...input].map((_, i) => [i, i + 1] as [number, number]);
}

export function endProvenance(): void {
    if (hostDepth() > 1) return;
    prov = null;
}

/**
 * The mapping, or `undefined` when it cannot be trusted.
 *
 * ⚠ LENGTH IS THE COMPLETENESS CHECK. Any transformation that is not routed through `tr` still changes the
 * string but leaves the array behind, so the two fall out of step. Returning a mapping in that state would
 * hand a caller confident, wrong offsets — so it is withheld instead, which is the difference between "we do
 * not know" and a silent wrong answer.
 */
export function provenanceFor(normalized: string): [number, number][] | undefined {
    if (prov === null || prov.length !== normalized.length) return undefined;
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

/** `s.replace(re, rep)`, carrying provenance when a trace is recording and nothing at all when it is not. */
export function tr(s: string, re: RegExp, rep: Replacer): string {
    // ⚠ THE UNTRACED PATH IS THE NATIVE CALL. Not "equivalent to" it — it IS it, so no reading can differ
    // because of this module, and the 3,200 sites cost one boolean test each.
    const p = prov;
    if (p === null || hostDepth() > 1) return s.replace(re, rep as string);

    const global = re.flags.includes("g");
    const rx = new RegExp(re.source, global ? re.flags : re.flags + "g");
    const out: string[] = [];
    const next: [number, number][] = [];
    let cursor = 0;
    let seen = 0;
    for (const m of s.matchAll(rx)) {
        if (!global && seen > 0) break;
        seen++;
        const at = m.index ?? 0;
        for (let i = cursor; i < at; i++) {
            out.push(s[i]!);
            next.push(p[i] ?? [0, 0]);
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
        for (const ch of piece) {
            out.push(ch);
            next.push(sp);
        }
        cursor = at + m[0].length;
        if (m[0].length === 0 && cursor < s.length) {
            out.push(s[cursor]!);
            next.push(p[cursor] ?? [0, 0]);
            cursor++;
        }
    }
    for (let i = cursor; i < s.length; i++) {
        out.push(s[i]!);
        next.push(p[i] ?? [0, 0]);
    }
    prov = next;
    return out.join("");
}
