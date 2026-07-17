/**
 * Native Sundanese / Basa Sunda (su) text phonemizer — canonical IPA, espeak-independent. Austronesian (West
 * Java), modern LATIN orthography. Shallow and near-phonemic (the id/jv pattern), so a flat left-to-right scan:
 * digraphs (the central vowel ⟨eu⟩→[ɨ], ng→[ŋ], ny→[ɲ]) then single letters, ⟨e⟩→schwa [ə] / ⟨é⟩→[e], c→[t͡ʃ],
 * j→[d͡ʒ]. Glottal stop is inserted at a word-initial vowel (awi→ʔawi) and in a same-vowel hiatus (naam→naʔam).
 * Penultimate (weak) stress, skipping a schwa nucleus. Validated against kaikki su. See
 * docs/investigations/su_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

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

/** One Sundanese word → canonical IPA. Returns the segment array joined, then stress + glottal post-processing. */
export function phonemizeWord(word: string): string {
    const s = [...word.toLowerCase().normalize("NFC")];
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
    // Penultimate (weak) stress on the penult vowel nucleus (skipping a final schwa where possible).
    const vidx = segs.map((ph, idx) => (isVowelPh(ph) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length >= 2) {
        const at = vidx[vidx.length - 2]!;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// Austronesian decimal composition (Sundanese): units + -belas teens + -puluh tens + ratus/rebu/yuta; a leading
// "1" of a magnitude is the sa- prefix (sapuluh, saratus). Word forms are read back through the g2p.
function toWords(n: number): string {
    if (n < 10) return NUM.units[n]!;
    if (n < 20) return (n === 10 ? NUM.seprefix + NUM.puluh : NUM.units[n - 10]! + " " + NUM.belas);
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
    if (!Number.isSafeInteger(n)) return digits;
    return toWords(n)
        .split(" ")
        .map(phonemizeWord)
        .join(" ");
}

const TOKEN = /([a-zéÉ]+)|(\d+)|([.?!,;:…])/giu;

export type ForeignPhonemizer = (latin: string) => string;

class SundanesePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
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
