/**
 * Wu Chinese / Shanghainese (wuu) phonemizer — canonical IPA. The third Sinitic language (after Mandarin and
 * Cantonese), and phonologically the most distinct: a THREE-WAY obstruent contrast that keeps the Middle Chinese
 * VOICED series (b d ɡ z d͡ʑ ʑ v ɦ — the yang register), glottalised yin sonorants (ʔm ʔn ʔl ʔŋ), a checked
 * glottal-stop coda (入声 → ʔ), front-rounded ø/y, the apical ɿ, and a LEFT-PROMINENT tone sandhi where the whole
 * prosodic word's melody is set by the first syllable's register.
 *
 * Written in Han characters; the front-end maps Han → Wugniu (zaonhe romanization) via dict.tsv (word→reading)
 * with greedy longest-match segmentation, so multi-char words carry their baked sandhi melody (上海 zaon2 he4)
 * and unknown chars fall back to per-char citation tone. The back-end (wu.jsonc) maps each Wugniu syllable →
 * IPA: [initial] + final + one of the tones as Chao contour letters. The dict is the rime-wugniu zaonhe schema;
 * the Wugniu→IPA back-end is authored here.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses, clauseSink } from "../../core/clauses.ts";
import { LATIN_RUN } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

interface WuDef {
    initials: Record<string, string>;
    finals: Record<string, string>;
    tones: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<WuDef>(import.meta.url, "wu.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Initials tried longest-first so digraphs win (tsh>ts>t, ngh>ng>n>g, gh>g, sh>s …).
const INITIALS = Object.keys(DEF.initials).sort((a, b) => b.length - a.length);
const VOWEL = "aeiouy";
const SYLLABIC: Record<string, string> = { m: "m̩", n: "n̩", ng: "ŋ̍" };

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    return (DICT ??= loadTsvMap(import.meta.url, "dict.tsv"));
}
const MAX_WORD = 8; // greedy segmentation window

const HAN = /\p{Script=Han}/u;
const WUGNIU = /^[a-z]+[0-9](?:\s+[a-z]+[0-9])*$/i;

/** One Wugniu syllable (e.g. "zaon2", "koq7") → IPA (initial + final + Chao tone). */
function syllableToIpa(syl: string): string {
    const m = /^([a-z]+?)([0-9])?$/i.exec(syl);
    if (!m) return syl;
    let body = m[1]!.toLowerCase();
    const tone = m[2] !== undefined ? (DEF.tones[m[2]] ?? "") : "";
    // Consonant onset (longest match) + final.
    for (const ini of INITIALS) {
        if (!body.startsWith(ini)) continue;
        const rime = body.slice(ini.length);
        const final = DEF.finals[rime];
        if (final !== undefined) return DEF.initials[ini]! + final + tone;
    }
    // Zero-onset: a whole-body final first (covers front-rounded yu/yun/yuq and the apical bare y), then the
    // glide onsets ⟨y⟩/⟨w⟩ + vowel (yi→ji, wa→wa), then a syllabic nasal.
    if (DEF.finals[body] !== undefined) return DEF.finals[body]! + tone;
    if ((body[0] === "y" || body[0] === "w") && VOWEL.includes(body[1] ?? "")) {
        const rest = DEF.finals[body.slice(1)];
        if (rest !== undefined) return (body[0] === "y" ? "j" : "w") + rest + tone;
    }
    if (SYLLABIC[body] !== undefined) return SYLLABIC[body]! + tone;
    return syl; // unknown rime → leave the romanization visible
}

/** A space-separated Wugniu reading → IPA. */
function wugniuToIpa(reading: string): string {
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
            out.push(wugniuToIpa(reading));
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

class WuPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // Whole-string Wugniu input (tone digits present) → direct path.
        if (WUGNIU.test(input.trim())) return wugniuToIpa(input);
        // `assembleClauses` rather than a private exec loop: this loop was already exactly that shape
        // (clauseSink + iterate the token regex), it just predated the shared helper — so it never got the
        // GAP PASS and a run in a script it does not own was dropped. The engine still claims Latin
        // itself; the gap pass covers everything else via the script router (core/scripts.ts).
                // ⚠ The Latin arm is ALL of Latin plus marks, not `[A-Za-z]+`: the ASCII class ended the token at a
                // diacritic and left that letter read as an English letter name (`Cañitas` → *kʰˈʌ ˈɛn ˈaᶦt̬əz*). The
                // engine routes a Latin run to the injected reader, so widening is the whole fix.
                const tok = new RegExp(`(\\p{Script=Han}+)|(\\d+)|(${LATIN_RUN})|([。，、？！；：.,?!;:])`, "gu");
        
        return assembleClauses(input, tok, (m, sink) => {
            if (m[1]) sink.emit(hanRun(m[1]));
            else if (m[2]) {
                const n = Number(m[2]);
                if (Number.isSafeInteger(n)) sink.emit(hanRun(integerToHan(n)));
            } else if (m[3]) sink.emit(this.foreign ? this.foreign(m[3]) : "");
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Wu Chinese phonemizer. `foreign` handles embedded Latin runs. */
export function createWu(foreign?: ForeignPhonemizer): Phonemizer {
    return new WuPhonemizer(foreign);
}

/** Bare word→IPA (tests / eval): Han → IPA, or a direct Wugniu reading. */
export function phonemizeWord(word: string): string {
    return HAN.test(word) ? hanRun(word) : wugniuToIpa(word);
}
