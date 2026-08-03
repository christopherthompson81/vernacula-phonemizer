/**
 * Mandarin Chinese (cmn) phonemizer — canonical IPA. Phase 1: the pinyin input path (tokenized pinyin with
 * tone digits → IPA with Chao tones + third-tone sandhi). Phase 2 adds the Hanzi front-end (pypinyin char +
 * phrase dicts → polyphone-aware pinyin), Phase 3 numbers + normalization. The data (syllable→IPA table,
 * tone system, sandhi) lives beside this file; this module wires it into the Phonemizer interface.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { makePinyinToIpa, type MandarinTables } from "./pinyinToIpa.ts";
import { segment, type PinyinTables } from "./segment.ts";
import { applyYiBuSandhi } from "./yiBuSandhi.ts";
import { integerToChinese, digitsToChinese } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeMandarin } from "./normalize.ts";
import { clauseSink } from "../../core/clauses.ts";
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

// #562 symbol normalization — Mandarin: 百分之 PRECEDES the number (百分之九十三); units follow.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["百分之"],
    percentPrefix: true,
    // Currency: the sign was DROPPED outright ($50 read as 五十, losing 美元). Mandarin says the unit after
    // the number, which is what the shared tier emits. Degrees likewise: °C was falling through to the
    // English reading of the bare letter C.
    currency: { "$": ["美元"], "€": ["欧元"], "£": ["英镑"], "¥": ["元"], "₤": ["英镑"] },
    units: { mm: ["毫米"], cm: ["厘米"], km: ["公里"], m: ["米"], kg: ["千克"], g: ["克"],
        "km/h": ["公里每小时"], "°c": ["摄氏度"], "°f": ["华氏度"], "°": ["度"] },
    // `km²` → 平方公里. The measure word PRECEDES the unit and fuses to it with no space, which is the
    // `compound` position — the same one Japanese uses for 平方キロメートル. `before` would emit "平方 公里",
    // splitting one Han run into two and losing the segmenter's chance to see the compound.
    // Attested in the artifact itself: 公园占地 19500 平方公里 · 783,562 平方公里（300,948 平方英里）.
    // One form each, because a Chinese measure word does not agree with its count.
    exponentWords: { squared: ["平方"], cubed: ["立方"], position: "compound" },
    // Chinese groups by MYRIADS, so the magnitude word between a number and its unit is 万 (10⁴) or 亿 (10⁸),
    // not "million". Undeclared, the tier's number–unit adjacency broke on it and the unit fell through to
    // the English letter reading: `5 万 km²` came out as *ˈʊkm*, which is worse than the raw text. The
    // artifact writes the magnitude against a currency NOUN (13 万日元, 40 万例) rather than against a Latin
    // unit, so this guards a plausible input rather than a sampled one.
    magnitudes: ["万", "亿", "兆"],
});

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
        num = num.replace(/,/gu, ""); // grouping commas are not part of the value
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
        // Comma grouping is part of the number, not a clause boundary. Without this, "783,562" was read as
        // two numbers with a PAUSE between them (七百八十三 , 五百六十二) instead of 七十八万三千五百六十二.
        // 61 occurrences in the corpus.
        const re = /\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(input)) !== null) {
            if (m.index > last)
                for (const c of input.slice(last, m.index)) {
                    cp.push(c);
                    exempt.push(false);
                }
            // The following character must be found ACROSS WHITESPACE. The corpus writes "2009 年" and
            // "2 个人" with a space — 272 years and every 两 case — and taking the literal next character
            // saw the space, so the year rule and the 两 rule both silently failed: 2009 年 came out as the
            // cardinal 两千零九年 instead of the digit-by-digit 二零零九年.
            const rest = input.slice(m.index + m[0].length);
            const after = /^\s*(\S)/u.exec(rest)?.[1];
            this.appendNumber(cp, exempt, m[0], after);
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
        // #562: the Mandarin-specific rewrite (fraction order) before the shared symbol tier.
        input = SYMBOLS(normalizeMandarin(input));
        // Tone-marked pinyin input (letters + a tone digit, no Han) keeps the direct path (e.g. "ni3 hao3").
        if (!HAN.test(input) && /[1-5]/.test(input) && PINYIN_INPUT.test(input))
            return this.pinyinToIpa(input);

        const { cp, exempt } = this.substituteNumbers(input);
        // Code-point run scanner (Han / Latin / punctuation), not a single regex — so it drives clauseSink()
        // directly rather than going through assembleClauses, but reuses the shared emit/pause/flush assembly.
        const { sink, finish } = clauseSink();
        let i = 0;
        while (i < cp.length) {
            const ch = cp[i]!;
            if (HAN.test(ch)) {
                // Han run (may include synthesized numerals)
                let j = i;
                while (j < cp.length && HAN.test(cp[j]!)) j++;
                sink.emit(this.hanRun(cp.slice(i, j), exempt.slice(i, j)));
                i = j;
            } else if (LATIN.test(ch)) {
                // Latin run → foreign (en)
                let j = i;
                while (j < cp.length && LATIN.test(cp[j]!)) j++;
                sink.emit(
                    this.foreign ? this.foreign(cp.slice(i, j).join("")) : "",
                );
                i = j;
            } else {
                // punctuation → pending pause; other → skip
                const mk = CLAUSE_MARK[ch];
                if (mk) sink.pause(mk);
                i++;
            }
        }
        return finish();
    }
}

/** A bare pinyin-syllable → segmental IPA converter (no Hanzi / number / clause front-end). Used by the referee
 *  eval, which compares our syllable inventory against epitran's toneless pinyin→IPA table. */
export function createPinyinPhonemizer(): (pinyin: string) => string {
    const st = MANIFEST.sandhi.thirdThird;
    return makePinyinToIpa({
        syllableIpa: loadTsvMap(import.meta.url, "syllable-ipa.tsv"),
        tones: MANIFEST.tones,
        thirdToneSandhi: { from: Number(st.from), before: Number(st.before), to: Number(st.to) },
    });
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
