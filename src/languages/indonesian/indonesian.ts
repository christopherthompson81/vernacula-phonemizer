/**
 * Native Indonesian (id) text phonemizer — canonical IPA, espeak-independent. Bahasa Indonesia has a shallow,
 * near-phonemic Latin orthography, so this is a rule-based transliterator: digraphs (ng→ŋ, ny→ɲ, sy→ʃ, kh→x)
 * then single letters, ⟨e⟩→schwa [ə] by default, closed-syllable lax allophones (i→ɪ, u→ʊ, e→ɛ, o→ɔ), falling
 * diphthongs ai/au/oi, and syllable-final ⟨k⟩ → glottal stop [ʔ]. Penultimate stress (skips a schwa nucleus).
 * See docs/id_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface NumbersDef {
    units: string[];
    belas: string;
    puluh: string;
    ratus: string;
    ribu: string;
    juta: string;
    seprefix: string;
}
interface IndonesianDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    laxVowels: Record<string, string>;
    diphthongs: Record<string, string>;
    letterNames: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<IndonesianDef>(import.meta.url, "indonesian.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

export type ForeignPhonemizer = (latin: string) => string;

const isVowelLetter = (c: string): boolean => "aeiou".includes(c);
const VOWEL_PH = "aeiouəɛɔɪʊ";

interface Seg {
    ph: string;
    vowelLetter: string; // the source vowel letter (for lax resolution); "" for consonants
}

/** Scan a lowercased Indonesian word into segments (consonants + tense-default vowels). */
function scan(w: string): Seg[] {
    const s = [...w];
    const segs: Seg[] = [];
    for (let i = 0; i < s.length; ) {
        // Falling diphthong at word end (ai/au/oi): the two vowels form one nucleus.
        const di = s[i]! + (s[i + 1] ?? "");
        if (DEF.diphthongs[di] && i + 2 === s.length) {
            segs.push({ ph: DEF.diphthongs[di]!, vowelLetter: "" });
            i += 2;
            continue;
        }
        const dg = s[i]! + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            segs.push({ ph: DEF.digraphs[dg]!, vowelLetter: "" });
            i += 2;
            continue;
        }
        const c = s[i]!;
        if (isVowelLetter(c)) {
            segs.push({ ph: DEF.vowels[c]!, vowelLetter: c });
            i++;
        } else if (DEF.consonants[c]) {
            segs.push({ ph: DEF.consonants[c]!, vowelLetter: "" });
            i++;
        } else {
            i++; // unknown → skip
        }
    }
    return segs;
}

// NOTE: Indonesian /i u e o/ have lax closed-syllable allophones [ɪ ʊ ɛ ɔ], but the referee (and standard
// descriptions) apply them only erratically/dialectally — kecil→kətʃil, air→air keep TENSE vowels. We emit the
// tense phonemes for canonical consistency; the eval folds the tense/lax axis (config.ts). laxVowels stays in
// the manifest for reference.

/** Penultimate stress on the second-to-last vowel; if that nucleus is a schwa, shift to the final. */
function stressIndex(segs: Seg[]): number {
    const nuclei = segs
        .map((s, i) => (VOWEL_PH.includes(s.ph[0] ?? "") ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return -1;
    if (nuclei.length === 1) return nuclei[0]!;
    const penult = nuclei[nuclei.length - 2]!;
    if (segs[penult]!.ph === "ə") return nuclei[nuclei.length - 1]!; // schwa can't bear stress
    return penult;
}

/** One Indonesian word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // All-caps acronym → spell each letter by its Indonesian name (BBM → be-be-em → bebeem).
    if (/^[A-Z]{2,}$/.test(word))
        return [...word.toLowerCase()]
            .map((c) => DEF.letterNames[c] ?? "")
            .join("");
    const segs = scan(word.toLowerCase());
    if (segs.length === 0) return "";
    // Syllable-final /k/ → glottal stop [ʔ] (coda k, before a consonant or word end).
    for (let i = 0; i < segs.length; i++) {
        if (segs[i]!.ph !== "k") continue;
        const next = segs[i + 1];
        if (!next || (!VOWEL_PH.includes(next.ph[0] ?? "") && next.ph !== ""))
            segs[i]!.ph = "ʔ";
    }
    const stress = stressIndex(segs);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out.normalize("NFC");
}

// ── Numbers (regular, compositional) ─────────────────────────────────────────
function numberWords(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n < 12) return n === 10 ? NUM.seprefix + NUM.puluh : NUM.seprefix + NUM.belas;
    if (n < 20) return `${NUM.units[n - 10]} ${NUM.belas}`;
    if (n < 100) {
        const t = Math.floor(n / 10),
            r = n % 10;
        return `${NUM.units[t]} ${NUM.puluh}${r ? " " + numberWords(r) : ""}`;
    }
    if (n < 200) return `${NUM.seprefix}${NUM.ratus}${n % 100 ? " " + numberWords(n % 100) : ""}`;
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return `${NUM.units[h]} ${NUM.ratus}${r ? " " + numberWords(r) : ""}`;
    }
    if (n < 2000) return `${NUM.seprefix}${NUM.ribu}${n % 1000 ? " " + numberWords(n % 1000) : ""}`;
    if (n < 1000000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return `${numberWords(th)} ${NUM.ribu}${r ? " " + numberWords(r) : ""}`;
    }
    const m = Math.floor(n / 1000000),
        r = n % 1000000;
    return `${numberWords(m)} ${NUM.juta}${r ? " " + numberWords(r) : ""}`;
}

const TOKEN = /([a-zA-Z]+)|(\d+)|([.?!,;:])/gu;

class IndonesianPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const n = Number(m[2]);
                if (Number.isSafeInteger(n))
                    for (const wd of numberWords(n).split(" "))
                        sink.emit(phonemizeWord(wd));
                else sink.emit(m[2]);
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Indonesian phonemizer. */
export function createIndonesian(): Phonemizer {
    return new IndonesianPhonemizer();
}
