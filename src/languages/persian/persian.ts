/**
 * Native Persian / Farsi (fa) phonemizer — Perso-Arabic abjad → canonical IPA. Logical order = phonetic order,
 * so RTL is a non-issue (as for Arabic/Urdu). Handles: consonant letters, long vowels written with ا/آ/و/ی,
 * a WORD-INITIAL glottal stop ʔ before a vowel (آب→ʔaːb), the خوا→[xʷaː] labialization, word-final ه → [e]
 * (خانه→xaːne), shadda gemination, short vowels from harakat WHEN present — and, for the usual undiacritized
 * text, a DEFAULT short vowel [a] (the crude stand-in for the deferred short-vowel-restoration subsystem, 🟠).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface PersianDef {
    consonants: Record<string, string>;
    harakat: Record<string, string>;
    sukun: string;
    shadda: string;
    inherentVowel: string;
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<PersianDef>(import.meta.url, "persian.jsonc");
const C = DEF.consonants;
const HARAKAT = DEF.harakat;
const INH = DEF.inherentVowel;
const CLAUSE_MARK = DEF.clausePunctuation;
const ALIF = "ا",
    ALIF_MADDA = "آ",
    WAW = "و",
    YA = "ی",
    YA_AR = "ي",
    HE = "ه";
const isV = (c: string): boolean => c === ALIF || c === WAW || c === YA || c === YA_AR;
const endsInVowel = (out: string): boolean => /[aeiouɒ]ː?$/u.test(out);

/** A long-vowel letter standing after a consonant → its long vowel. */
function longVowel(ch: string): string | undefined {
    if (ch === ALIF || ch === ALIF_MADDA) return "aː";
    if (ch === WAW) return "uː";
    if (ch === YA || ch === YA_AR) return "iː";
    return undefined;
}

/** Persian word → canonical IPA (consonant + long-vowel skeleton + default short vowel). */
function g2p(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let i = 0;

    // Word-initial vowel carrier: آ→ʔaː; ا+و→ʔuː, ا+ی→ʔiː; bare ا → ʔ + default short vowel.
    if (s[0] === ALIF_MADDA) {
        out += "ʔaː";
        i = 1;
    } else if (s[0] === ALIF) {
        if (s[1] === WAW) {
            out += "ʔuː";
            i = 2;
        } else if (s[1] === YA || s[1] === YA_AR) {
            out += "ʔiː";
            i = 2;
        } else {
            out += "ʔ" + INH;
            i = 1;
        }
    }

    while (i < n) {
        const ch = s[i]!;
        // Word-final ه after a consonant → the [e] vowel (خانه→xaːne); elsewhere it is [h].
        if (ch === HE) {
            if (i === n - 1 && out && !endsInVowel(out)) out += "e";
            else out += "h";
            i++;
            continue;
        }
        // Standalone glide/vowel letters: after a vowel → glide (v/j); after a consonant → long vowel.
        if (isV(ch)) {
            out += endsInVowel(out)
                ? ch === WAW
                    ? "v"
                    : "j"
                : (longVowel(ch) ?? "");
            i++;
            continue;
        }
        // Consonant.
        if (ch in C) {
            const ph = C[ch]!;
            i++;
            // خوا → [xʷaː]: خ + و (silent, labializes) + ا.
            if (ph === "x" && s[i] === WAW && s[i + 1] === ALIF) {
                out += "xʷaː";
                i += 2;
                continue;
            }
            out += ph;
            if (s[i] === DEF.shadda) {
                out += "ː";
                i++;
            }
            const hk = s[i] !== undefined ? HARAKAT[s[i]!] : undefined;
            if (s[i] === DEF.sukun) i++;
            else if (hk !== undefined) {
                out += hk;
                i++;
            } else {
                // ی/و before another vowel letter is a glide; a bare long-vowel letter is the nucleus.
                const glideNext =
                    (s[i] === YA || s[i] === WAW) && longVowel(s[i + 1] ?? "") !== undefined;
                const lv = glideNext ? undefined : longVowel(s[i] ?? "");
                if (lv !== undefined) {
                    out += lv;
                    i++;
                } else if (glideNext) {
                    out += s[i] === WAW ? "v" : "j";
                    i++;
                } else if (i < n && !(s[i] === HE && i === n - 1)) {
                    out += INH; // the abjad's omitted SHORT vowel: default [a]
                }
            }
            continue;
        }
        i++; // unknown / diacritic → skip
    }
    return out.normalize("NFC");
}

const VOWEL_G = /[aeiouɒ]/g;

/** One Persian word → canonical IPA (g2p + default-short-vowel deletion + final stress). */
export function phonemizeWord(word: string): string {
    let ipa = g2p(word);
    if (!ipa) return "";
    // Persian, like Urdu, drops the over-inserted default vowel in a medial C·a·C cluster (the shared Ohala
    // rule on /a/). The correct e/o quality needs the deferred restoration layer; the STRUCTURE is right.
    ipa = deleteMedialSchwa(ipa, "a");
    // Persian ALLOWS word-final consonant CLUSTERS (mard, duːst) — so a default [a] before a run of coda
    // consonants at word end is spurious; delete it when a vowel precedes (unlike Urdu, which retains it).
    ipa = ipa.replace(
        /([aeiouɒ]ː?[^aeiouɒː ]*)a(?!ː)(?=[^aeiouɒː ]+$)/gu,
        "$1",
    );
    // Persian stress is (mostly) word-FINAL: mark the last vowel nucleus.
    const vowels = [...ipa.matchAll(VOWEL_G)];
    if (vowels.length) {
        const last = vowels[vowels.length - 1]!.index!;
        ipa = ipa.slice(0, last) + "ˈ" + ipa.slice(last);
    }
    return ipa.normalize("NFC");
}

const EASTERN_DIGITS: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};
const DIGIT_CLASS = "0-9" + Object.keys(EASTERN_DIGITS).join("");
const PERSO_ARABIC_WORD = "ء-ٟٮ-ۓە-ۿ";
const toAscii = (d: string): string =>
    [...d].map((c) => EASTERN_DIGITS[c] ?? c).join("");
function number(digits: string): string {
    const nn = Number(toAscii(digits));
    if (!Number.isSafeInteger(nn)) return digits;
    return renderNumber(nn, DEF.numbers, phonemizeWord);
}
const TOKEN = new RegExp(
    `([${PERSO_ARABIC_WORD}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+)|([۔؟،؛.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

class PersianPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Persian phonemizer. `foreign` handles embedded Latin runs. */
export function createPersian(foreign?: ForeignPhonemizer): Phonemizer {
    return new PersianPhonemizer(foreign);
}
