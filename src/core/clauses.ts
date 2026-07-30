/**
 * Assemble a phonemizer's text() output from its tokenizer. Collapses the identical `out`/`pending` + `emit`
 * closure + final-flush skeleton that every language's text() repeats: phonemized tokens are space-joined, and a
 * clause-punctuation mark becomes a PENDING pause attached BEFORE the next emitted token (never trailing an empty
 * output, never doubled). Only the per-token dispatch — which regex group is a word / number / punctuation, and
 * how each is phonemized — varies, so the caller supplies a `handle(match, sink)` over `input.matchAll(token)`.
 *
 *   text(input) {
 *     return assembleClauses(input, TOKEN, (m, sink) => {
 *       if (m[1]) sink.emit(phonemizeWord(m[1]));
 *       else if (m[2]) for (const w of numberWords(m[2])) sink.emit(phonemizeWord(w));
 *       else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
 *     });
 *   }
 */
import { getDefaultForeign } from "./foreign.ts";

export interface ClauseSink {
    /** Append a phonemized token, space-joined; flushes any pending pause before it. Empty strings are ignored. */
    emit(ipa: string): void;
    /** Set a pending clause pause (rendered before the next emitted token). No-op while the output is still empty. */
    pause(mark: string): void;
}

/**
 * The clause-assembly state machine, independent of how tokens are iterated. `sink` drives it; `finish()`
 * flushes any trailing pause and returns the assembled string. Use this directly when the tokenization isn't a
 * single regex matchAll (mandarin scans code-point Han/Latin runs); use assembleClauses otherwise.
 */
export function clauseSink(): { sink: ClauseSink; finish: () => string } {
    let out = "";
    let pending: string | null = null;
    const sink: ClauseSink = {
        emit(ipa) {
            if (ipa === "") return;
            if (out === "") out = ipa;
            else if (pending !== null) {
                out += ` ${pending} ${ipa}`;
                pending = null;
            } else out += ` ${ipa}`;
        },
        pause(mark) {
            if (out !== "") pending = mark;
        },
    };
    return {
        sink,
        finish() {
            if (pending !== null && out !== "") out += ` ${pending}`;
            return out;
        },
    };
}

/** A run of Latin-script text (with its combining marks, apostrophes and internal hyphens). */
const LATIN_RUN = /\p{Script=Latin}[\p{Script=Latin}\p{M}'’-]*/gu;

/**
 * Emit the FOREIGN runs inside text the engine's own tokenizer did not claim.
 *
 * Only Latin-script runs are surfaced. Everything else in a gap — stray punctuation, whitespace, a
 * third script — stays dropped exactly as before, keeping this change tightly scoped to the defect it
 * fixes (see core/foreign.ts for why 47 engines lost embedded Latin entirely).
 */
export function emitUnclaimed(gap: string, sink: ClauseSink): void {
    if (!/\p{Script=Latin}/u.test(gap)) return; // fast path: nothing foreign here
    const foreign = getDefaultForeign();
    if (foreign === undefined) return; // no fallback registered → previous behaviour (dropped)
    for (const run of gap.matchAll(LATIN_RUN)) sink.emit(foreign(run[0]));
}

export function assembleClauses(
    input: string,
    token: RegExp,
    handle: (match: RegExpMatchArray, sink: ClauseSink) => void,
): string {
    const { sink, finish } = clauseSink();
    let cursor = 0;
    for (const m of input.matchAll(token)) {
        const at = m.index ?? cursor;
        // Text between the previous match and this one is text the tokenizer declined; an engine whose
        // TOKEN already has a Latin group claims it here and leaves no gap, so this is a no-op for the
        // engines that were already correct.
        if (at > cursor) emitUnclaimed(input.slice(cursor, at), sink);
        handle(m, sink);
        cursor = at + m[0].length;
    }
    if (cursor < input.length) emitUnclaimed(input.slice(cursor), sink);
    return finish();
}
