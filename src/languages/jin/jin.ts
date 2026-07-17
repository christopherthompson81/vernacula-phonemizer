/**
 * Jin Chinese / 晋语 (cjy), Taiyuan 太原 dialect — canonical IPA. The fifth Sinitic language (after Mandarin,
 * Cantonese, Wu, and Min Nan). Jin is treated as a primary branch of Sinitic, distinguished from Mandarin by its
 * retention of the Middle Chinese 入声 (checked/entering tone) as a glottal-stop coda -ʔ (月→yəʔ, 十→səʔ) and by
 * rich tone sandhi. Taiyuan has a five-tone citation system: 平 ˩˩ (11), 上 ˥˧ (53), 去 ˦˥ (45), 阴入 ˨ (2,
 * checked), 阳入 ˥˦ (54, checked).
 *
 * Written in Han characters. The front-end maps Han → IPA via dict.tsv (word→reading) with greedy longest-match
 * segmentation, so multi-char words carry their baked tone sandhi (the reading writes underlying⁻surface, e.g.
 * 九十→t͡ɕiəu⁵³⁻¹¹ səʔ⁵⁴). Each dict reading is already Sinological IPA (segmental IPA + a superscript pitch-number
 * tone); the runtime only converts the pitch digits → Chao contour letters and takes the SURFACE tone after a
 * sandhi arrow ⁻. SINGLE authoritative source (Wiktionary/kaikki Taiyuan Sinological-IPA), no independent
 * referee → 🔷. See docs/jin_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

interface JinDef {
    chao: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<JinDef>(import.meta.url, "jin.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    return (DICT ??= loadTsvMap(import.meta.url, "dict.tsv"));
}
const MAX_WORD = 7; // greedy segmentation window (longest dict key is 7 chars)

const HAN = /\p{Script=Han}/u;
// Superscript pitch digits ⁰–⁹ and the sandhi arrow ⁻ used by the Sinological-IPA tone notation.
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const TONE_CHARS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁻";

/**
 * One dict syllable (segmental IPA + a trailing superscript tone, possibly a sandhi arrow) → canonical IPA:
 * the segmental part unchanged + the tone as Chao contour letters. A sandhi arrow ⁵³⁻¹¹ means underlying 53 →
 * SURFACE 11 — we render the surface tone (what is actually pronounced).
 */
function syllableToIpa(syl: string): string {
    // Split the trailing tone block (superscript digits + arrows) from the segmental body.
    let cut = syl.length;
    for (const ch of [...syl].reverse()) {
        if (TONE_CHARS.includes(ch)) cut -= ch.length;
        else break;
    }
    const body = syl.slice(0, cut);
    const toneBlock = syl.slice(cut);
    if (!toneBlock) return syl; // no tone (neutral/轻声 or a stray) → leave as-is
    // Surface tone = the digit group after the LAST sandhi arrow.
    const surface = toneBlock.split("⁻").pop()!;
    let chao = "";
    for (const ch of surface) {
        const d = SUP[ch];
        if (d !== undefined) chao += DEF.chao[d] ?? "";
    }
    return body + chao;
}

/** A space-separated dict reading → IPA. */
function readingToIpa(reading: string): string {
    return reading.trim().split(/\s+/u).map(syllableToIpa).join(" ");
}

/** A Han run → IPA (greedy longest-match over the dictionary; unknown chars are skipped). */
function hanRun(run: string): string {
    const chars = [...run];
    const out: string[] = [];
    for (let i = 0; i < chars.length; ) {
        let matched = "";
        let reading = "";
        for (let len = Math.min(MAX_WORD, chars.length - i); len >= 1; len--) {
            const word = chars.slice(i, i + len).join("");
            const hit = dict().get(word);
            if (hit) {
                matched = word;
                reading = hit;
                break;
            }
        }
        if (reading) {
            out.push(readingToIpa(reading));
            i += [...matched].length;
        } else i++; // no reading for this char → skip
    }
    return out.join(" ");
}

// Han numeral composition (shared Chinese system) — the Han string is then read through the dict, so number
// words pick up their sandhi and no separate number IPA is authored.
const DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const SMALL = ["", "十", "百", "千"];
function under10000(n: number): string {
    if (n === 0) return "";
    let out = "";
    let zero = false;
    for (let p = 3; p >= 0; p--) {
        const unit = Math.floor(n / 10 ** p) % 10;
        if (unit === 0) {
            if (out) zero = true;
        } else {
            if (zero) out += DIGITS[0];
            zero = false;
            out += (p === 1 && unit === 1 && !out ? "" : DIGITS[unit]!) + SMALL[p]!;
        }
    }
    return out;
}
function integerToHan(n: number): string {
    if (n === 0) return DIGITS[0]!;
    if (n < 0) return "";
    const yi = Math.floor(n / 1_0000_0000);
    const wan = Math.floor((n % 1_0000_0000) / 10000);
    const rest = n % 10000;
    let out = "";
    if (yi) out += integerToHan(yi) + "億";
    if (wan) out += under10000(wan) + "萬";
    if (rest) {
        if ((yi || wan) && rest < 1000) out += DIGITS[0];
        out += under10000(rest);
    }
    return out;
}

export type ForeignPhonemizer = (latin: string) => string;

class JinPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        const { sink, finish } = clauseSink();
        const tok = /(\p{Script=Han}+)|(\d+)|([A-Za-z]+)|([。，、？！；：.,?!;:])/gu;
        let m: RegExpExecArray | null;
        while ((m = tok.exec(input))) {
            if (m[1]) sink.emit(hanRun(m[1]));
            else if (m[2]) {
                const n = Number(m[2]);
                if (Number.isSafeInteger(n)) sink.emit(hanRun(integerToHan(n)));
            } else if (m[3]) sink.emit(this.foreign ? this.foreign(m[3]) : "");
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        }
        return finish();
    }
}

/** Build the Jin Chinese phonemizer. `foreign` handles embedded Latin runs. */
export function createJin(foreign?: ForeignPhonemizer): Phonemizer {
    return new JinPhonemizer(foreign);
}

/** Bare word→IPA (tests / eval): a Han run → IPA. */
export function phonemizeWord(word: string): string {
    return HAN.test(word) ? hanRun(word) : "";
}
