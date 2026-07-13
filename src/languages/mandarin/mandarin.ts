/**
 * Mandarin Chinese (cmn) phonemizer — canonical IPA. Phase 1: the pinyin input path (tokenized pinyin with
 * tone digits → IPA with Chao tones + third-tone sandhi). Phase 2 adds the Hanzi front-end (pypinyin char +
 * phrase dicts → polyphone-aware pinyin), Phase 3 numbers + normalization. The data (syllable→IPA table,
 * tone system, sandhi) lives beside this file; this module wires it into the Phonemizer interface.
 */
import type { Phonemizer } from "../../registry.ts";
import { makePinyinToIpa, type MandarinTables } from "./pinyinToIpa.ts";
import { segment, type PinyinTables } from "./segment.ts";
import { applyYiBuSandhi } from "./yiBuSandhi.ts";
import { integerToChinese, digitsToChinese } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

const HAN = /\p{Script=Han}/u;
const LATIN = /[A-Za-z]/;
// Clause punctuation + the measure-word set are DATA (cmn.jsonc). A standalone 2 before a measure word reads
// colloquial 两 (两个, 两天), not 二.
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const MEASURE_WORDS = MANIFEST.measureWords;
// A whitespace-separated pinyin string with at least one tone digit takes the direct pinyin path. Requiring
// a tone digit keeps bare Latin words (hello, iPhone) and number-bearing tokens out of it → routed properly.
const PINYIN_INPUT = /^[a-zü:]+[1-5]?(?:\s+[a-zü:]+[1-5]?)*$/i;

/** Embedded Latin → foreign (en) phonemizer, injected by the registry (lazy, like Hindi). */
export type ForeignPhonemizer = (latin: string) => string;

class MandarinPhonemizer implements Phonemizer {
    private readonly pinyinToIpa: (pinyin: string) => string;

    constructor(
        tables: MandarinTables,
        private readonly pinyin: PinyinTables,
        private readonly foreign?: ForeignPhonemizer,
    ) {
        this.pinyinToIpa = makePinyinToIpa(tables);
    }

    /** A Han run (with a per-char sandhi-exempt mask): segment → 一/不 sandhi → pinyin → IPA (3-3 within run). */
    private hanRun(chars: string[], exempt: boolean[]): string {
        const tokens = segment(chars, this.pinyin, exempt);
        applyYiBuSandhi(tokens);
        return this.pinyinToIpa(tokens.map((t) => t.py).join(" "));
    }

    /** Append a number's Chinese-numeral reading, marking each code point sandhi-exempt or not. Digit-string
     *  readings (year, decimal fraction, oversized) are exempt (their 一 is a spoken digit, citation tone); a
     *  quantity reading is NOT exempt, so its 一 sandhis normally (一千 → yì qiān), matching typed 一千. */
    private appendNumber(
        cp: string[],
        exempt: boolean[],
        num: string,
        after: string | undefined,
    ): void {
        const push = (text: string, ex: boolean): void => {
            for (const c of text) {
                cp.push(c);
                exempt.push(ex);
            }
        };
        if (/^\d{4}$/.test(num) && after === "年") {
            push(digitsToChinese(num), true);
            return;
        } // year
        if (
            num === "2" &&
            after !== undefined &&
            MEASURE_WORDS.includes(after)
        ) {
            push(MANIFEST.numbers.two, false);
            return;
        } // 2个 → 两个
        const dot = num.indexOf(".");
        const intStr = dot < 0 ? num : num.slice(0, dot);
        const intN = Number(intStr || "0");
        if (Number.isSafeInteger(intN))
            push(integerToChinese(intN), false); // quantity → sandhi-eligible
        else push(digitsToChinese(intStr), true); // oversized → digit-by-digit, exempt
        if (dot >= 0 && dot < num.length - 1) {
            push(MANIFEST.numbers.decimalPoint, true);
            push(digitsToChinese(num.slice(dot + 1)), true);
        }
    }

    /** Substitute Arabic numbers with Chinese numeral characters, tracking which code points are sandhi-exempt. */
    private substituteNumbers(input: string): {
        cp: string[];
        exempt: boolean[];
    } {
        const cp: string[] = [],
            exempt: boolean[] = [];
        let last = 0;
        const re = /\d+(?:\.\d+)?/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(input)) !== null) {
            if (m.index > last)
                for (const c of input.slice(last, m.index)) {
                    cp.push(c);
                    exempt.push(false);
                }
            this.appendNumber(cp, exempt, m[0], input[m.index + m[0].length]);
            last = m.index + m[0].length;
        }
        if (last < input.length)
            for (const c of input.slice(last)) {
                cp.push(c);
                exempt.push(false);
            }
        return { cp, exempt };
    }

    text(input: string): string {
        // Tone-marked pinyin input (letters + a tone digit, no Han) keeps the direct path (e.g. "ni3 hao3").
        if (!HAN.test(input) && /[1-5]/.test(input) && PINYIN_INPUT.test(input))
            return this.pinyinToIpa(input);

        const { cp, exempt } = this.substituteNumbers(input);
        let out = "";
        let pending: string | null = null;
        const emit = (ipa: string): void => {
            if (ipa === "") return;
            if (out === "") out = ipa;
            else if (pending !== null) {
                out += ` ${pending} ${ipa}`;
                pending = null;
            } else out += ` ${ipa}`;
        };
        let i = 0;
        while (i < cp.length) {
            const ch = cp[i]!;
            if (HAN.test(ch)) {
                // Han run (may include synthesized numerals)
                let j = i;
                while (j < cp.length && HAN.test(cp[j]!)) j++;
                emit(this.hanRun(cp.slice(i, j), exempt.slice(i, j)));
                i = j;
            } else if (LATIN.test(ch)) {
                // Latin run → foreign (en)
                let j = i;
                while (j < cp.length && LATIN.test(cp[j]!)) j++;
                emit(this.foreign ? this.foreign(cp.slice(i, j).join("")) : "");
                i = j;
            } else {
                // punctuation → pending pause; other → skip
                const mk = CLAUSE_MARK[ch];
                if (mk && out !== "") pending = mk;
                i++;
            }
        }
        if (pending !== null && out !== "") out += ` ${pending}`;
        return out;
    }
}

/** Load the Mandarin data (beside this file) and build the phonemizer. `foreign` handles embedded Latin. */
export function createMandarin(foreign?: ForeignPhonemizer): Phonemizer {
    const syllableIpa = loadTsvMap(import.meta.url, "syllable-ipa.tsv");
    const chars = loadTsvMap(import.meta.url, "chars.tsv", (v) => v.split(","));
    const phrases = loadTsvMap(import.meta.url, "phrases.tsv");
    // Longest phrase key (code points) — the scan bound; ≥2 so a single-char run always has room. reduce (not
    // Math.max(...spread)) so a 47k-key map can't blow the call-argument limit.
    const maxPhrase = [...phrases.keys()].reduce(
        (m, k) => Math.max(m, Array.from(k).length),
        2,
    );

    const st = MANIFEST.sandhi.thirdThird;
    const tables: MandarinTables = {
        syllableIpa,
        tones: MANIFEST.tones,
        thirdToneSandhi: {
            from: Number(st.from),
            before: Number(st.before),
            to: Number(st.to),
        },
    };
    return new MandarinPhonemizer(
        tables,
        { chars, phrases, maxPhrase },
        foreign,
    );
}
