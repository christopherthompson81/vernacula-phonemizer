/**
 * The trace recorder behind `phonemizeTrace` (#1150, stage 1) — DERIVED, never threaded.
 *
 * `phonemize(text, lang) → string` throws away everything about how the string was produced, and the recurring
 * defect class in this repo is an INPUT-SIDE transformation whose effect is invisible in the output: the
 * nativiser folded ⟨ŋ⟩→n before the g2p ran (#1131), a deliberate ⟨ŋ⟩ rule was dead because the fold ran first
 * (#1139), a letter the g2p could read was rewritten on the way in (#1140). None of them moved a golden row,
 * and 172 of 180 engines expose a word-level entry that is NOT the shipped path. This makes the "way in"
 * legible.
 *
 * ⚠ WHY AMBIENT STATE RATHER THAN A PARAMETER. Threading a trace object through `text()` would touch 159
 * language modules × 2 engines, and #1150's whole argument is that stage 1 must be cheap enough to be derived
 * at the ONE seam every engine already funnels through (`assembleClauses`). The recorder is safe here for a
 * reason specific to this code, not a general one: `Phonemizer.text()` is SYNCHRONOUS, so between
 * `beginToken()` and `endToken()` nothing else can run. It is not safe to make `text()` async without
 * revisiting this.
 *
 * ⚠ AND IT MUST SURVIVE RECURSION — which is the part the first cut got wrong three ways. `emitUnclaimed`
 * hands an embedded run to ANOTHER language's engine. The boundary that matters is therefore THE DELEGATING
 * CALL, not "which engine is running": gating on engine depth let a nested engine close the outer engine's
 * token (a Greek run in Russian lost its reading entirely), let the two engines that drive `clauseSink`
 * without `assembleClauses` double-record into the outer token (`中国` in Russian emitted twice), and let a
 * nested engine CLAIM THE RECORDING when the host was one of the untraced hand-rolled engines
 * (`phonemizeTrace("hello Владимир world", "en")` reported `traced: true` with `normalized: "Владимир"`).
 * So `foreignDepth` brackets the delegating calls in `emitUnclaimed`, and every recorder is inert inside one.
 */

import { hostDepth } from "./foreign.ts";
import { beginProvenance, endProvenance, inputSpan, provenanceFor } from "./provenance.ts";

/** One token as the tokenizer matched it, with what happened to it on the way to IPA. */
export interface TraceToken {
    /** `[start, end)` into the trace's `normalized` text — NOT into the caller's original input. */
    span: [number, number];
    /**
     * `[start, end)` into the CALLER's input, when normalizer provenance is complete for this engine (#1150
     * stage 2).
     * ⚠ ABSENT MEANS "NOT KNOWN", NEVER "IDENTICAL". A normalizer step that does not route through
     * `provenance.rewrite` still changes the string, so the mapping falls out of step and is withheld rather than
     * reported wrong — the difference between an unknown and a confident wrong offset.
     */
    inputSpan?: [number, number];
    /** The token exactly as the tokenizer matched it. */
    surface: string;
    /** What `makeNativiser` rewrote it to before the g2p saw it. Absent when nothing was rewritten. */
    nativised?: string;
    /**
     * What this token EMITTED, in order. Empty for a token that emits nothing (punctuation).
     * ⚠ NOT NECESSARILY A SUBSTRING OF THE FINAL READING. Some engines run a whole-string pass AFTER the
     * clause assembler — Spanish spirantizes across word boundaries, so `gato` emits *ɡˈato* and the sentence
     * reads *ɣˈato*. This is the token's contribution, not its surviving output.
     */
    emitted: string[];
    /**
     * `[start, end)` into the trace's `ipa` — where this token's contribution ENDED UP (#1150 stage 3).
     *
     * ⚠ THIS IS THE HALF THAT CLOSES THE LOOP. `inputSpan` says which characters the reader typed; this says
     * which characters of the reading they became. Together they are a two-way index between orthography and
     * IPA, which is what a player needs to highlight a word while its audio plays — the motivating case for
     * this whole issue.
     *
     * ⚠ ABSENT MEANS "NOT KNOWN", as everywhere else here. Eight engines rewrite the assembled string after
     * the clause assembler; six do it one character for one and keep their spans (Spanish spirantizes across
     * word boundaries, ɡ→ɣ), while `as` collapses a doubled aspirate and `fr-CA` applies an accent that
     * change LENGTHS — and an offset into the pre-rewrite string would be a confident wrong answer about the
     * post-rewrite one. See `noteRewrite`'s `positional` flag for which claim each pass makes.
     */
    ipaSpan?: [number, number];
}

/**
 * A whole-string rewrite applied to an already-assembled reading, or to the input before tokenizing.
 *
 * ⚠ WHY THE TOKEN RECORD IS NOT ENOUGH. `TraceToken.emitted` is what a token CONTRIBUTED; several engines
 * then rewrite the assembled string, so the contribution is not a substring of the output. Spanish
 * spirantizes ACROSS word boundaries — `gato` emits *ɡˈato* and the sentence reads *ɣˈato* — and Assamese
 * collapses `dʱdʱ` → `dʱː`. Without an event for it, a consumer diffing tokens against the output sees a
 * discrepancy with no cause attached, which is the same "invisible transformation" problem one layer up.
 */
export interface TraceRewrite {
    /** What ran — `"spirantize-across-words"`, `"normalize"`, … */
    stage: string;
    before: string;
    after: string;
}

interface Recording {
    /** What the caller passed in, before the registry pre-passes and the engine's own normalizer. */
    input: string;
    normalized: string;
    tokens: TraceToken[];
    rewrites: TraceRewrite[];
    current: TraceToken | null;
    /** Did the TOP-LEVEL engine reach the traced seam? See `PhonemeTrace.traced`. */
    traced: boolean;
    /** Nesting of `beginToken`, so a re-entrant call nests rather than opening a second token. */
    tokenDepth: number;
    /**
     * Where each token's emissions landed in the ASSEMBLED reading (#1150 stage 3). `null` marks a token with
     * an emission that could not be placed — withheld whole rather than reported from a partial union.
     * ⚠ KEYED ON THE TOKEN OBJECT because `TraceToken` is the public shape; internal offsets that may yet be
     * disbelieved do not belong on it.
     */
    spans: Map<TraceToken, [number, number] | null>;
    /** The reading as the clause assembler built it, before any post-assembly rewrite. */
    assembled: string | null;
}

let recording: Recording | null = null;

/**
 * Recording, and at the TOP-LEVEL render. Every recorder below is gated on this.
 *
 * ⚠ THE NESTING SIGNAL IS THE REGISTRY'S OWN HOST STACK, not a counter kept here. `getPhonemizer`'s wrapper
 * pushes a host for EVERY language, including the four that hand-roll their tokenizer loop and never reach
 * `assembleClauses` — so counting delegations at the seam missed exactly those, and a nested engine under an
 * untraced host claimed the recording (`phonemizeTrace("hello Владимир world", "en")` reported `traced: true`
 * with `normalized: "Владимир"`). Asking how deep the render is cannot miss a caller that does not report.
 */
const active = (): boolean => recording !== null && hostDepth() <= 1;

export function startTrace(input: string): void {
    recording = { input, normalized: "", tokens: [], rewrites: [], current: null, traced: false, tokenDepth: 0, spans: new Map(), assembled: null };
    beginProvenance(input);
}

export function stopTrace(ipa?: string): {
    normalized: string;
    tokens: TraceToken[];
    rewrites: TraceRewrite[];
    traced: boolean;
} {
    const r = recording ?? { input: "", normalized: "", tokens: [], rewrites: [], traced: false, spans: new Map<TraceToken, [number, number] | null>(), assembled: null };
    // ⚠ RESOLVED AT STOP, not per token: a token is opened while the normalized string is still being
    // tokenized, and the provenance array is only complete once normalization has finished.
    const p = provenanceFor(r.normalized);
    if (p !== undefined)
        for (const t of r.tokens) {
            const is = inputSpan(p, t.span[0], t.span[1]);
            if (is !== undefined) t.inputSpan = is;
        }
    // ⚠ THE OUTPUT SPANS ARE ONLY OFFERED IF THE STRING THEY INDEX SURVIVED. The emission offsets are into
    // the ASSEMBLED reading; eight engines rewrite it afterwards, and an offset into the pre-rewrite string is
    // a confident wrong answer about the post-rewrite one. Comparing the strings is the same "length is not
    // identity" lesson the input side learned, applied where it is cheapest to check.
    if (ipa !== undefined && r.assembled === ipa)
        for (const t of r.tokens) {
            const sp = r.spans.get(t);
            if (sp != null) t.ipaSpan = sp;
        }
    endProvenance();
    recording = null;
    return { normalized: r.normalized, tokens: r.tokens, rewrites: r.rewrites, traced: r.traced };
}

/**
 * Record a whole-string rewrite. A no-op when nothing changed, so a stage that did not fire costs nothing and
 * leaves no noise — the events present are exactly the ones that moved the string.
 */
export function noteRewrite(stage: string, before: string, after: string, positional = false): void {
    if (!active() || recording === null || before === after) return;
    recording.rewrites.push({ stage, before, after });
    // ⚠ `positional` IS A CLAIM THE PASS MAKES, AND THE LENGTH IS WHAT VERIFIES IT (#1150 stage 3). It means
    // "every offset still means the same thing" — a one-for-one substitution such as Spanish's spirantization
    // (ɡ→ɣ, b→β, d→ð), where the token spans recorded against the assembled reading are still exact.
    //
    // ⚠ WITHOUT IT THE DEFAULT IS WITHHOLDING, WHICH IS THE RIGHT DEFAULT. `assembled` stops matching the
    // final reading, so `stopTrace` offers no `ipaSpan` at all rather than offsets into a string that no
    // longer exists. A pass that changes lengths — Assamese collapsing a doubled aspirate, Nepali expanding
    // a sentinel — cannot make this claim, and does not.
    //
    // ⚠ THE CLAIM IS NOT FULLY CHECKABLE, and saying so is better than implying it is: equal lengths do not
    // rule out a REORDERING. What rules it out is that these passes are character substitutions, which is a
    // property of the eight functions rather than of this check. `test/trace.test.ts` verifies the
    // consequence instead — that every reported span still contains what its token emitted.
    if (positional && before.length === after.length && recording.assembled === before) recording.assembled = after;
}

/** Enter a seam engine. The FIRST one at the top level owns the recording. */
export function enterEngine(normalized: string): void {
    if (!active() || recording === null || recording.traced) return;
    recording.normalized = normalized;
    recording.traced = true;
    // ⚠ NORMALIZATION IS REPORTED FOR EVERY ENGINE AT ONCE, HERE. Each of the 180 modules calls its own
    // `normalize*()` inline, so instrumenting them one by one would be 180 edits and would still miss the
    // registry's own pre-passes (markup stripping, digit folds, Roman numerals). The caller's string and the
    // string the tokenizer sees are both known at this point, and their difference IS the normalization —
    // including the reordering that makes a span un-mappable back to the input (Luganda's measure noun moves
    // ahead of its number). That is stage 2's problem; naming the rewrite is stage 1's contribution to it.
    noteRewrite("normalize", recording.input, normalized);
}
export function exitEngine(): void {
    /* nothing to unwind: `foreignDepth` is what scopes a nested engine, not a counter here */
}

/**
 * Open a token.
 *
 * ⚠ RE-ENTRANT, because `emitUnclaimed` is called from TWO places with different meanings. From
 * `assembleClauses`'s gap loop it introduces a token of its own (an embedded `Windows` in Russian text). But
 * `hmong.ts` calls it from INSIDE its handler, for a run its own tokenizer already claimed — there the
 * readings belong to the token already open, and its spans are relative to a different string entirely. The
 * outermost `beginToken` wins; an inner one only nests.
 */
export function beginToken(span: [number, number], surface: string): void {
    // ⚠ AND ONLY ONCE AN ENGINE HAS DECLARED ITSELF. `emitUnclaimed` opens tokens, and an engine that drives
    // `clauseSink` without calling `enterEngine` would otherwise emit tokens against an empty `normalized`,
    // with spans indexing a string the caller never sees — `traced: false` alongside a populated token list.
    if (!active() || recording === null || !recording.traced) return;
    recording.tokenDepth++;
    if (recording.tokenDepth > 1) return;
    recording.current = { span, surface, emitted: [] };
    recording.tokens.push(recording.current);
}

export function endToken(): void {
    // ⚠ GATED THE SAME WAY `beginToken` IS. Ungated, a nested engine's `endToken` calls decremented the OUTER
    // engine's depth against increments that never happened, closing its token early and dropping the
    // readings that followed.
    if (!active() || recording === null) return;
    if (recording.tokenDepth > 0) recording.tokenDepth--;
    if (recording.tokenDepth === 0) recording.current = null;
}

/** Record what the nativiser did to the token currently open. */
export function noteNativised(from: string, to: string): void {
    if (!active() || recording?.current == null || from === to) return;
    recording.current.nativised = to;
}

/**
 * Record a COMPLETE token in one call — the hook for a pipeline that cannot bracket its emits.
 *
 * ⚠ `english.ts` and `french.ts` are two-phase: they collect tokens, run a POS tagger / liaison lookahead over
 * the whole stream, and only then render. There is no point in that shape where a token is "open" while its
 * reading is produced, so the streaming `beginToken`/`endToken` pair does not fit. They call this instead,
 * after rendering, when span, surface and readings are all known.
 */
export function noteToken(
    span: [number, number],
    surface: string,
    emitted: string[],
    nativised?: string,
    ipaSpan?: [number, number],
): void {
    if (!active() || recording === null || !recording.traced) return;
    const t: TraceToken = { span, surface, emitted: emitted.filter((x) => x !== "") };
    if (nativised !== undefined && nativised !== surface) t.nativised = nativised;
    // ⚠ THE TWO-PHASE ENGINES MUST PASS THIS THEMSELVES. They never open a token while its reading is being
    // made, so `noteEmit`'s offset never reaches them; what they DO know is which slot of their own parts
    // list each reading went into, which is the same fact one step earlier.
    if (ipaSpan !== undefined) recording.spans.set(t, ipaSpan);
    recording.tokens.push(t);
}

/** Record one emitted reading against the token currently open. */
export function noteEmit(ipa: string, at?: number): void {
    if (!active() || recording?.current == null || ipa === "") return;
    recording.current.emitted.push(ipa);
    // ⚠ KEYED ON THE TOKEN OBJECT, not stored on it: `TraceToken` is the public shape and a parallel array of
    // internal offsets does not belong in it. A token with SOME offsets and some missing is withheld whole.
    const t = recording.current;
    const cur = recording.spans.get(t);
    if (at === undefined) { recording.spans.set(t, null); return; } // an emission with no place in the reading
    if (cur === null) return;                                       // already withheld: one gap withholds all
    recording.spans.set(t, cur === undefined
        ? [at, at + ipa.length]
        : [Math.min(cur[0], at), Math.max(cur[1], at + ipa.length)]);
}

/**
 * The reading as the clause assembler built it, before any post-assembly rewrite.
 *
 * ⚠ RECORDED SO IT CAN BE DISBELIEVED. The emission offsets index THIS string; `stopTrace` reports them as
 * `ipaSpan` only when it is still what the caller receives.
 */
export function noteAssembled(s: string): void {
    if (!active() || recording === null) return;
    recording.assembled = s;
}
