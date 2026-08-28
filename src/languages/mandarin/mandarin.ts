/**
 * Mandarin Chinese (cmn) phonemizer — canonical IPA. Two input paths, one converter:
 *   · HANZI → pinyin via the pypinyin char + phrase dicts (polyphone-aware), then pinyin → IPA;
 *   · direct tokenized pinyin with tone digits → IPA.
 * The converter emits Chao tone letters and applies third-tone sandhi within a Han run, plus 一/不 sandhi.
 * Numbers and text normalization run ahead of it. The data (syllable→IPA table, tone system, sandhi) lives
 * beside this file; this module wires it into the Phonemizer interface.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { makePinyinToIpa, type MandarinTables } from "./pinyinToIpa.ts";
import { segment, type PinyinTables } from "./segment.ts";
import { applyYiBuSandhi } from "./yiBuSandhi.ts";
import { integerToChinese, digitsToChinese } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeMandarin, spellInitialisms } from "./normalize.ts";
import { clauseSink } from "../../core/clauses.ts";
import { beginToken, endToken, enterEngine } from "../../core/trace.ts";
import { readForeignRun } from "../../core/foreign.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

const HAN = /\p{Script=Han}/u;
// ⚠ `\p{Script=Latin}`, NOT `[A-Za-z]`. The ASCII class split an accented Latin word into pieces at every
// diacritic and handed each fragment to the English reader separately: `Haldarsvík` became `Haldarsv` + `k`, read
// as two words with the `í` dropped outright. yue fixed this and PINS it (`yue("Müslüm") === phonemize(…, "en")`,
// its comment: "[A-Za-z]+ split Müslüm into M / sl / m"); cmn carried the same bug unfixed.
// It also has to be right before the foreign-run branch below can be: with an ASCII test, a bare `í` is neither
// Han nor "Latin", so it would reach the script router as a one-letter foreign run and be read as a LETTER NAME.
// Fixing the router branch without this made those readings worse rather than better — measured on 13 cmn
// utterances, all of them accented Latin proper nouns.
const LATIN = /\p{Script=Latin}/u;
/** Continuation of a Latin run: the script plus combining marks, so a decomposed accent stays attached. */
const LATIN_RUN = /[\p{Script=Latin}\p{M}]/u;
/** A letter or combining mark that is neither Han nor Latin — the run the script router should read. `\p{M}` is
 *  included so an abugida's matras stay inside their own run instead of splitting it. */
const FOREIGN_CHAR = /[\p{L}\p{M}]/u;
// Clause punctuation + the measure-word set are DATA (cmn.jsonc). A standalone 2 before a measure word reads
// colloquial 两 (两个, 两天), not 二.
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const MEASURE_WORDS = MANIFEST.measureWords;
// A whitespace-separated pinyin string with at least one tone digit takes the direct pinyin path. Requiring
// a tone digit keeps bare Latin words (hello, iPhone) and number-bearing tokens out of it → routed properly.
// ⚠ CASE-SENSITIVE. Pinyin is written lowercase; with the `i` flag this used to match an ALL-CAPS
// alphanumeric token — `MP3` took the direct pinyin path, found no syllable, and was returned VERBATIM,
// so the engine emitted the STRING "MP3" into the phoneme stream. An all-caps run is a designation.
const PINYIN_INPUT = /^[a-zü:]+[1-5]?(?:\s+[a-zü:]+[1-5]?)*$/u;

/** Embedded Latin → foreign (en) phonemizer, injected by the registry (lazy, like Hindi). */
export type ForeignPhonemizer = (latin: string) => string;

// symbol normalization — Mandarin: 百分之 PRECEDES the number (百分之九十三); units follow.
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    bareExponent: MANIFEST.symbolTier.bareExponent,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    unspacedScript: MANIFEST.symbolTier.unspacedScript,
    multiply: MANIFEST.symbolTier.multiply,
    percentPrefix: MANIFEST.symbolTier.percentPrefix,
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
        const re = /[1-9]\d{0,2}(?:,\d{3})+|\d+(?:\.\d+)?/g;
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
        // the Mandarin-specific rewrite (fraction order) before the shared symbol tier.
        // ⚠ `spellInitialisms` LAST: the symbol tier reads a temperature's SCALE LETTER, so spelling the
        // ⟨C⟩ of `20°C` before it runs destroys the unit. See the note on that function.
        input = spellInitialisms(SYMBOLS(normalizeMandarin(input)));
        // Tone-marked pinyin input (letters + a tone digit, no Han) keeps the direct path (e.g. "ni3 hao3").
        if (!HAN.test(input) && /[1-5]/.test(input) && PINYIN_INPUT.test(input))
            return this.pinyinToIpa(input);

        const { cp, exempt } = this.substituteNumbers(input);
        // Code-point run scanner (Han / Latin / punctuation), not a single regex — so it drives clauseSink()
        // directly rather than going through assembleClauses, but reuses the shared emit/pause/flush assembly.
        const { sink, finish } = clauseSink();
        // ⚠ THIS ENGINE REPORTS TO THE TRACE ITSELF (#1150): it scans CODE POINTS, not a regex over the
        // string, so the recorder has no loop to derive spans from. `off` maps a code-point index to a UTF-16
        // offset, because a span must index `normalized` exactly — `cp` indices and string indices diverge the
        // moment a supplementary character appears, and Han has plenty.
        const traceText = cp.join("");
        const off: number[] = [0];
        for (const c of cp) off.push(off[off.length - 1]! + c.length);
        enterEngine(traceText);
        let i = 0;
        while (i < cp.length) {
            const ch = cp[i]!;
            if (HAN.test(ch)) {
                // Han run (may include synthesized numerals)
                let j = i;
                while (j < cp.length && HAN.test(cp[j]!)) j++;
                beginToken([off[i]!, off[j]!], cp.slice(i, j).join(""));
                sink.emit(this.hanRun(cp.slice(i, j), exempt.slice(i, j)));
                endToken();
                i = j;
            } else if (LATIN.test(ch)) {
                // Latin run → foreign (en)
                let j = i;
                while (j < cp.length && LATIN_RUN.test(cp[j]!)) j++;
                beginToken([off[i]!, off[j]!], cp.slice(i, j).join(""));
                sink.emit(
                    this.foreign ? this.foreign(cp.slice(i, j).join("")) : "",
                );
                endToken();
                i = j;
            } else if (FOREIGN_CHAR.test(ch)) {
                // A LETTER RUN THAT IS NEITHER HAN NOR LATIN → the script router (core/scripts.ts).
                //
                // Without this branch such a run fell to the `else` below and was SKIPPED, so Mandarin
                // silently deleted every non-Latin foreign script — Greek, Cyrillic, Thai, Devanagari, all of
                // it. `這個詞 Ελλάδα 意即` read as if the Greek were not there. The scanner's own comment
                // records the cause: it "drives clauseSink() directly rather than going through
                // assembleClauses", and `assembleClauses` is where `emitUnclaimed` calls the router — so
                // taking the fast path meant opting out of a fleet-wide fix without saying so.
                //
                // ⚠ THE COST WAS ITS OWN CORPUS. cmn's mined artifact is partly a Chinese article ABOUT THAI
                // GRAMMAR, quoting `เด็กๆ`, `คนอ้วน ๆ` and their glosses. The audit reported this as an
                // `iteration DROP` — a missing `ๆ` — and the truth was larger and simpler: the whole Thai run
                // was gone, and the `dˈʌk dˈʌk` in the output was the LATIN gloss `dek dek` read as English.
                // A dropped run is invisible to every leak-based check, so only the differential test saw
                // anything at all, and what it saw it mislabelled.
                //
                // Every sibling Sinitic engine already routed correctly (yue, wuu, nan) — this was cmn alone.
                // ⚠ THE RUN SPANS A SINGLE INTERIOR SPACE, and the iteration mark is why. Thai writes no space
                // between words but DOES separate a reduplication mark: `คนอ้วน ๆ`. Split at the space, `ๆ`
                // becomes a run of its own and reaches Thai with no antecedent to reduplicate, so the reading
                // lost a whole word — `kʰon ʔuan` for what Thai reads `kʰon ʔuan ʔuan`. Unspaced `เด็กๆ` was
                // already right, which is what made the difference visible.
                // Only ONE space, and only between two foreign letters, so a foreign run cannot reach across
                // Han or Latin text and swallow it.
                let j = i;
                while (j < cp.length) {
                    if (FOREIGN_CHAR.test(cp[j]!) && !HAN.test(cp[j]!) && !LATIN.test(cp[j]!)) { j++; continue; }
                    const next = cp[j + 1];
                    if (cp[j] === " " && next !== undefined
                        && FOREIGN_CHAR.test(next) && !HAN.test(next) && !LATIN.test(next)) { j += 2; continue; }
                    break;
                }
                beginToken([off[i]!, off[j]!], cp.slice(i, j).join(""));
                const routed = readForeignRun(cp.slice(i, j).join(""));
                if (routed !== undefined && routed !== "") sink.emit(routed);
                endToken();
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
