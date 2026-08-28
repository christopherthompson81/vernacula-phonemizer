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
 * ⚠ AND IT MUST SURVIVE RECURSION, because `emitUnclaimed` hands an embedded foreign run to ANOTHER language's
 * engine, which runs its own `assembleClauses`. Only the outermost call records; `depth` is what keeps an
 * inner engine from stealing the outer engine's tokens or clearing its state.
 */

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
    /** Did any engine actually reach the traced seam? See `PhonemeTrace.traced`. */
    traced: boolean;
}

let recording: Recording | null = null;
let depth = 0;

/** Is a trace being recorded at the outermost engine? */
export const tracing = (): boolean => recording !== null && depth === 1;

/** Start a recording. Returns the collected tokens; `stop()` must run even if the engine throws. */
export function startTrace(): void {
    recording = { normalized: "", tokens: [], current: null, traced: false };
    depth = 0;
    tokenDepth = 0;
}

export function stopTrace(): { normalized: string; tokens: TraceToken[]; traced: boolean } {
    const r = recording ?? { normalized: "", tokens: [], traced: false };
    recording = null;
    depth = 0;
    tokenDepth = 0;
    return { normalized: r.normalized, tokens: r.tokens, traced: r.traced };
}

/** Enter an engine. Only the first one recorded is the one whose tokens are kept. */
export function enterEngine(normalized: string): void {
    if (recording === null) return;
    depth++;
    if (depth === 1) {
        recording.normalized = normalized;
        recording.traced = true;
    }
}

export function exitEngine(): void {
    if (recording === null) return;
    depth--;
}

let tokenDepth = 0;

/**
 * Open a token. A no-op inside a nested (foreign-run) engine, whose tokens belong to that engine, not this.
 *
 * ⚠ AND RE-ENTRANT, because `emitUnclaimed` is called from TWO places with different meanings. From
 * `assembleClauses`'s gap loop it introduces a token of its own (an embedded `Windows` in Russian text). But
 * `hmong.ts` calls it from INSIDE its handler, for a run its own tokenizer already claimed — there the
 * readings belong to the token already open, and its spans are relative to a different string entirely. The
 * outermost `beginToken` wins; an inner one only nests.
 */
export function beginToken(span: [number, number], surface: string): void {
    if (!tracing() || recording === null) return;
    tokenDepth++;
    if (tokenDepth > 1) return; // already inside a token — its emits are that token's
    recording.current = { span, surface, emitted: [] };
    recording.tokens.push(recording.current);
}

export function endToken(): void {
    if (recording === null) return;
    if (tokenDepth > 0) tokenDepth--;
    if (tokenDepth === 0) recording.current = null;
}

/** Record what the nativiser did to the token currently open. */
export function noteNativised(from: string, to: string): void {
    if (!tracing() || recording?.current == null || from === to) return;
    recording.current.nativised = to;
}

/** Record one emitted reading against the token currently open. */
export function noteEmit(ipa: string): void {
    if (!tracing() || recording?.current == null || ipa === "") return;
    recording.current.emitted.push(ipa);
}
