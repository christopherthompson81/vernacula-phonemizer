/**
 * Native Sundanese / Basa Sunda (su) text phonemizer — canonical IPA. Austronesian (West
 * Java), modern LATIN orthography (+ the revived Aksara Sunda abugida, transliterated to Latin by sundaAksara.ts — identical IPA). Shallow and near-phonemic (the id/jv pattern), so a flat left-to-right scan:
 * digraphs (the central vowel ⟨eu⟩→[ɨ], ng→[ŋ], ny→[ɲ]) then single letters, ⟨e⟩→schwa [ə] / ⟨é⟩→[e], c→[t͡ʃ],
 * j→[d͡ʒ]. Glottal stop is inserted at a word-initial vowel (awi→ʔawi) and in a same-vowel hiatus (naam→naʔam).
 * Penultimate (weak) stress, skipping a schwa nucleus. Validated against kaikki su.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { aksaraToLatin, isAksaraSunda, normalizeSundaDigits } from "./sundaAksara.ts";
import { normalizeSundanese } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    belas: string;
    puluh: string;
    ratus: string;
    rebu: string;
    yuta: string;
    seprefix: string;
}
interface SundaneseDef {
    digraphs: Record<string, string>;
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    glottal: string;
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<SundaneseDef>(import.meta.url, "sundanese.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;
const VOWEL_PH = "aeiouəɨ";
const isVowelPh = (s: string): boolean => VOWEL_PH.includes(s);

/** One Sundanese word → canonical IPA. Accepts BOTH scripts: the Latin orthography and Aksara Sunda (ᮃᮊ᮪ᮞᮛ) —
 *  Aksara Sunda is transliterated to Latin first (identical IPA), then the shared g2p + glottal + stress runs. */
export function phonemizeWord(word: string): string {
    const latin = isAksaraSunda(word) ? aksaraToLatin(word) : word;
    const s = [...latin.toLowerCase().normalize("NFC")];
    const segs: string[] = [];
    for (let i = 0; i < s.length; ) {
        const two = s[i]! + (s[i + 1] ?? "");
        if (DEF.digraphs[two] !== undefined) {
            segs.push(DEF.digraphs[two]!);
            i += 2;
            continue;
        }
        const c = s[i]!;
        if (DEF.vowels[c] !== undefined) segs.push(DEF.vowels[c]!);
        else if (DEF.consonants[c] !== undefined) segs.push(DEF.consonants[c]!);
        // else: unknown char → skip
        i++;
    }
    // Glottal stop: word-initial vowel (ʔawi), and between two IDENTICAL adjacent vowels (naam→naʔam).
    if (segs.length && isVowelPh(segs[0]!)) segs.unshift(DEF.glottal);
    for (let i = segs.length - 1; i > 0; i--) {
        if (isVowelPh(segs[i]!) && segs[i] === segs[i - 1]) segs.splice(i, 0, DEF.glottal);
    }
    // Penultimate (weak) stress on the penult vowel nucleus — but a schwa penult can't bear stress, so it shifts
    // to the final vowel (the Indonesian/Malay pattern: hese→hesˈe, not hˈəse).
    const vidx = segs.map((ph, idx) => (isVowelPh(ph) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length >= 2) {
        const penult = vidx[vidx.length - 2]!;
        const at = segs[penult] === "ə" ? vidx[vidx.length - 1]! : penult;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// Austronesian decimal composition (Sundanese): units + -belas teens + -puluh tens + ratus/rebu/yuta; a leading
// "1" of a magnitude is the sa- prefix (sapuluh, saratus). Word forms are read back through the g2p.
function toWords(n: number): string {
    if (n < 10) return NUM.units[n]!;
    if (n < 20) return n === 10 ? NUM.seprefix + NUM.puluh : n === 11 ? NUM.seprefix + NUM.belas : NUM.units[n - 10]! + " " + NUM.belas;
    if (n < 100) {
        const t = Math.floor(n / 10),
            u = n % 10;
        return NUM.units[t]! + " " + NUM.puluh + (u ? " " + NUM.units[u]! : "");
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return (h === 1 ? NUM.seprefix + NUM.ratus : NUM.units[h]! + " " + NUM.ratus) + (r ? " " + toWords(r) : "");
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return (th === 1 ? NUM.seprefix + NUM.rebu : toWords(th) + " " + NUM.rebu) + (r ? " " + toWords(r) : "");
    }
    const m = Math.floor(n / 1_000_000),
        r = n % 1_000_000;
    return (m === 1 ? NUM.seprefix + NUM.yuta : toWords(m) + " " + NUM.yuta) + (r ? " " + toWords(r) : "");
}
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time instead, THROUGH THE SAME COMPOSER: a one-digit number is a call this engine already
    // answers, so the fallback cannot invent a word. See core/numbers.ts `spellDigits` for the full
    // account and the cost — above 2^53 the reading is a digit string, not a quantity.
    const words = Number.isSafeInteger(n) ? toWords(n) : [...digits].map((d) => toWords(Number(d))).join(" ");
    return words.split(" ").map(phonemizeWord).join(" ");
}

// A word — Latin (incl. é) OR Aksara Sunda (letters + signs U+1B80–1BAF, 1BBA–1BBF; digits normalised to ASCII).
const TOKEN = new RegExp(`(${hostWordRun(["Latin", "Sundanese"])})|(\\d+)|([.?!,;:…])`, "giu");
/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it is no longer also
 * deciding where the script boundary falls.
 */
const NATIVE_CLASS = "[a-zéÉ\\u{1B80}-\\u{1BAF}\\u{1BBA}-\\u{1BBF}]";
const nat = makeNativiser(NATIVE_CLASS, "iu");


class SundanesePhonemizer implements Phonemizer {
    text(input: string): string {
        // NORMALIZATION runs first — pure text→text, so everything it emits is then read by the ordinary word,
        // number and clause paths below. It must see the text BEFORE tokenization, because most of what it
        // repairs (a grouping `.`, a decimal `,`, a clock `:`) is a character `TOKEN` would otherwise hand to
        // `clausePunctuation` as a pause. ⚠ AFTER `normalizeSundaDigits`, so Aksara Sunda digits are already
        // ASCII and the number rules see one digit set rather than two.
        return assembleClauses(normalizeSundanese(normalizeSundaDigits(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Sundanese phonemizer. */
export function createSundanese(): Phonemizer {
    return new SundanesePhonemizer();
}
