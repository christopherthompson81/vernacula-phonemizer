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

/** One token as the tokenizer matched it, with what happened to it on the way to IPA. */
export interface TraceToken {
    /** `[start, end)` into the trace's `normalized` text — NOT into the caller's original input. */
    span: [number, number];
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
}

interface Recording {
    normalized: string;
    tokens: TraceToken[];
    current: TraceToken | null;
    /** Did the TOP-LEVEL engine reach the traced seam? See `PhonemeTrace.traced`. */
    traced: boolean;
    /** Nesting of `beginToken`, so a re-entrant call nests rather than opening a second token. */
    tokenDepth: number;
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

export function startTrace(): void {
    recording = { normalized: "", tokens: [], current: null, traced: false, tokenDepth: 0 };
}

export function stopTrace(): { normalized: string; tokens: TraceToken[]; traced: boolean } {
    const r = recording ?? { normalized: "", tokens: [], traced: false };
    recording = null;
    return { normalized: r.normalized, tokens: r.tokens, traced: r.traced };
}

/** Enter a seam engine. The FIRST one at the top level owns the recording. */
export function enterEngine(normalized: string): void {
    if (!active() || recording === null || recording.traced) return;
    recording.normalized = normalized;
    recording.traced = true;
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
    if (!active() || recording === null) return;
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

/** Record one emitted reading against the token currently open. */
export function noteEmit(ipa: string): void {
    if (!active() || recording?.current == null || ipa === "") return;
    recording.current.emitted.push(ipa);
}
