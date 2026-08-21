/**
 * CODE-SWITCH MARKUP for `read_text` — `{en:nineteen forty five}`.
 *
 * A reader who voices part of a sentence in ANOTHER LANGUAGE has, until now, had nowhere to be recorded.
 * The three vehicles that exist each fail on it:
 *
 *   · plain `read_text` — the host re-reads the spelling with its own grapheme rules. Measured: `mi` passes
 *     `nineteen` straight through as raw LETTERS into the IPA, and `ceb` gives *ninetˈeʔen fˈoɾtj fˈibe*.
 *     A misreading, not an accent (numeral_register.mts records the same for `eight` → *ˈɛːiɡ̤htʼ* in Zulu).
 *   · IPA in `read_text` — every engine re-parses it. `naɪntiːn fɔːɹti faɪv` came back as *nˈanti n fˈo tˈi
 *     fˈab* (ceb), *nˈanti n fo ti faʋ* (hr), *naɪnti ˈɛn fɔ ɹti fˈaɪv* (en). Not one of ten passed through,
 *     and the wreckage still LOOKS like IPA, so a dump shows nothing. `read_text.py` refuses it outright.
 *   · `numeral_register.mts` — the right mechanism (segments, each read by the engine that owns it) but a
 *     PER-LANGUAGE table. That is exactly why ceb/fil/mi/ig were declined at 62–85%: their register is a
 *     per-ROW fact, and a table that must answer for the whole language gets a third of the rows wrong.
 *
 * This markup is the per-row form of the same mechanism. It carries TEXT AND A LANGUAGE, never phones, so
 * every segment is still read by an engine — the row keeps testing the phonemizer instead of asserting an
 * answer. A hand-written IPA row can never fail again, which is worse than a wrong row: it is a wrong row
 * that looks permanently right.
 *
 * ⚠ SPANS ARE EXTRACTED BEFORE THE NUMERAL REGISTER RUNS, and only host text is offered to it. A span is
 * already in its target language; letting the register rewrite `{en:nineteen forty five}` would apply the
 * HOST's register to text the host does not own.
 *
 * ⚠ AN UNRECOGNIZED TAG IS AN ERROR, NOT LITERAL TEXT. `{xx:…}` throws rather than silently phonemizing the
 * braces through the host — the failure mode this whole file exists to prevent.
 */
import { numeralSegments } from "./numeral_register.mts";

export interface CodeSwitchSegment {
    readonly text: string;
    /** `undefined` = the host language reads this segment. */
    readonly lang?: string;
    /**
     * Join this segment's IPA to the previous one with NO space.
     *
     * ⚠ CODE-SWITCHING IS NOT ALWAYS AT A WORD BOUNDARY. Shona takes English stems under its own noun-class
     * prefixes — `maneutron`, `maproton` — and the reader says the prefix in Shona and the stem in English
     * (`maɲuːtrɔn`). Writing that as `ma{en:neutron}` and joining on a space gives `ma nˈuːtɹɑːn`, inventing
     * a word break the speaker did not make. The distance metric strips whitespace so it would not show
     * there, which is exactly why it needs handling here: a trainer reading the IPA would see two words.
     *
     * Adjacency is already in the source — the span either touches the previous character or it does not —
     * so nothing extra has to be written by hand.
     */
    readonly tight?: boolean;
}

/** `{code:text}` — a registry code, then text with no nested brace. Anything else is literal. */
const SPAN = /\{([a-z][a-z0-9-]{0,15}):([^{}]*)\}/gu;

/**
 * Split `text` into segments, `{code:…}` spans carrying their language and everything else passing through
 * the host's numeral register.
 *
 * `isKnownLang` decides whether a tag resolves; the caller supplies it so this module stays free of the
 * registry (the corpus tools import the engine, the tests do not need to).
 */
export function codeSwitchSegments(
    text: string,
    hostCode: string,
    isKnownLang: (code: string) => boolean,
): readonly CodeSwitchSegment[] {
    const out: CodeSwitchSegment[] = [];
    let tight = false; // set when the next segment abuts the previous one in the SOURCE
    const push = (sg: CodeSwitchSegment): void => {
        out.push(tight && out.length > 0 ? { ...sg, tight: true } : sg);
        tight = false;
    };
    const host = (s: string): void => {
        if (s === "") return;
        for (const sg of numeralSegments(s, hostCode)) if (sg.text !== "") push(sg);
        tight = !/\s$/u.test(s);
    };
    let last = 0;
    SPAN.lastIndex = 0;
    for (const m of text.matchAll(SPAN)) {
        const whole = m[0], code = m[1]!, inner = m[2]!;
        if (!isKnownLang(code)) {
            throw new Error(
                `code_switch: unknown language tag {${code}:…} in read_text. Use a registry code, ` +
                `e.g. {en:nineteen forty five}. Tag came from: ${whole.slice(0, 40)}`,
            );
        }
        const before = text.slice(last, m.index);
        host(before);
        if (before === "" && out.length > 0) tight = true; // span directly follows the previous span
        if (inner.trim() !== "") push({ text: inner, lang: code });
        tight = !/^\s/u.test(text.slice(m.index + whole.length));
        last = m.index + whole.length;
    }
    host(text.slice(last));
    return out.length ? out : [{ text }];
}

/** The markup stripped back to plain text — the reading as a human would write it out.
 *  Used when reporting a row we could NOT re-derive, so the operator sees the attempted reading
 *  rather than the tags. */
export function stripCodeSwitch(text: string): string {
    return text.replace(SPAN, "$2").replace(/\s+/gu, " ").trim();
}
