/**
 * Lingala / Lingála (ln) phonemizer — Bantu (C30B), Latin orthography, canonical IPA. A major lingua franca of
 * the Congo basin (~20M native + ~20–25M L2). Authored from Meeuwis (2020), "A Grammatical Overview of
 * Lingála" (Revised & Extended Edition), which describes the prestige KINSHASA variety.
 *
 * A greedy longest-match g2p plus accent-based tone:
 *   · prenasalised obstruents are SINGLE onset units — ⟨mb nd ng nz⟩ → ᵐb ⁿd ᵑɡ ⁿz (homorganic ᵐ/ⁿ/ᵑ; §2.2);
 *     ⟨ny⟩ → ɲ, semi-vowels ⟨w y⟩ → w j. Only 13 consonant phonemes; no native /r/ or /h/ (loan graphemes).
 *   · 7 vowel graphemes a e ɛ i o ɔ u rendered as written. ⚠ Kinshasa is phonemically 5-vowel (ɛ/ɔ merged into
 *     e/o; §2.1.1), so the ⟨e⟩=/e/~/ɛ/ collapse of casual spelling is an unrecoverable gap — ɛ/ɔ are rendered
 *     only where the (careful/northwestern) orthography writes them. NO diphthongs: vowel sequences are
 *     HIATUS, each vowel its own tone-bearing nucleus (mái = ma.i; §2.1.5). No vowel harmony, length, or
 *     phonemic nasalisation.
 *   · TONE (H/L, meaning-distinctive; §2.4) is marked only in careful writing: acute → H (˥), háček → rising
 *     (˩˥), circumflex → falling (˥˩), unmarked → L (˩). Applied per nucleus; casual toneless input → all L.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface LingalaDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ordinals: string[]; zero: string; ten: string; tens: string; hundred: string;
        thousand: string; and: string; firstCard: string;
        tenThousand: string; tenThousands: string;
        hundredThousand: string; hundredThousands: string;
        million: string; millions: string;
        billion: string; billions: string;
    };
}

const DEF = loadManifest<LingalaDef>(import.meta.url, "lingala.jsonc");
// Consonant grapheme keys, longest first (digraphs mb/nd/ny before singles).
const CKEYS = Object.keys(DEF.consonants).sort((a, b) => b.length - a.length);
const ACUTE = "́", GRAVE = "̀", CIRC = "̂", CARON = "̌";
const TONE: Record<string, string> = { [ACUTE]: "˥", [GRAVE]: "˩", [CIRC]: "˥˩", [CARON]: "˩˥" };

/** One Lingala word → canonical IPA (segmental + per-nucleus tone). */
export function phonemizeWord(word: string): string {
    const s = word.toLowerCase().normalize("NFD");
    let out = "";
    let i = 0;
    while (i < s.length) {
        // consonant graphemes (prenasalised digraphs before singles)
        let matched = false;
        for (const k of CKEYS) {
            if (s.startsWith(k, i)) { out += DEF.consonants[k]; i += k.length; matched = true; break; }
        }
        if (matched) continue;
        const c = s[i]!;
        if (c in DEF.vowels) {
            out += DEF.vowels[c];
            const mark = s[i + 1] ?? "";
            out += TONE[mark] ?? "˩"; // tone from the combining accent; unmarked → L
            i += mark in TONE ? 2 : 1;
            continue;
        }
        // ⚠ NOT SILENTLY: a letter this g2p has no rule for still denotes a sound, and dropping it deletes
        // content the writer typed. `latinPhone` is consulted HERE, after every digraph and single-letter rule
        // has been tried, so it can never override a reading this language has an opinion about.
        out += latinPhone(c, { initial: i === 0 }) ?? "";
        i += 1;
    }
    return out.normalize("NFC");
}

// ── Numbers (Meeuwis §3.6: cardinal = the connective ya + the ordinal; compounds joined by na) ──────────────
const NUM = DEF.numbers;
function cardinalWords(n: number): string {
    if (n < 0) return "";
    if (n === 0) return NUM.zero; // libungutúlu
    if (n <= 10) return NUM.ordinals[n - 1]!;
    if (n < 20) return `${NUM.ten} ${NUM.and} ${NUM.ordinals[(n % 10) - 1]}`;
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        const tens = `${NUM.tens} ${NUM.ordinals[t - 1]}`;
        return u === 0 ? tens : `${tens} ${NUM.and} ${NUM.ordinals[u - 1]}`;
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        const hun = `${NUM.hundred} ${NUM.ordinals[h - 1]}`;
        return r === 0 ? hun : `${hun} ${NUM.and} ${cardinalWords(r)}`;
    }
    // The scale ladder above kámá. ⚠ THE SCALES DO NOT SHARE ONE SHAPE: kóto is INVARIANT and always carries an
    // explicit multiplier (kóto mǒkó = 1 000), while the higher scales are class-alternating nouns whose
    // SINGULAR stands alone for a multiplier of 1 and whose PLURAL takes the multiplier (efúku = 10⁶,
    // bifúku míbalé = 2×10⁶). Driving them all off one multiplier list collapses 100 000, 10⁶ and 10⁹ together.
    const SCALES: [number, string, string | null][] = [
        [1_000_000_000, NUM.billion, NUM.billions],
        [1_000_000, NUM.million, NUM.millions],
        [100_000, NUM.hundredThousand, NUM.hundredThousands],
        [10_000, NUM.tenThousand, NUM.tenThousands],
        [1000, NUM.thousand, null], // invariant → always "kóto <multiplier>"
    ];
    for (const [value, sg, pl] of SCALES) {
        if (n < value) continue;
        const q = Math.floor(n / value), r = n % value;
        const head = pl === null
            ? `${sg} ${cardinalWords(q)}`
            : q === 1 ? sg : `${pl} ${cardinalWords(q)}`;
        return r === 0 ? head : `${head} ${NUM.and} ${cardinalWords(r)}`;
    }
    return "";
}

const TOKEN = /([a-zɛɔ̀-ͯ]+)|(\d+)|([.?!,;:])/giu;

/** Build the Lingala phonemizer. */
export function createLingala(): Phonemizer {
    return {
        text(input: string): string {
            // NFD so precomposed accented vowels (á í ǒ …) become base+combining and are captured by TOKEN's
            // combining-mark range (else the accent splits the word and the vowel is dropped).
            return assembleClauses(input.normalize("NFD"), TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(m[1]));
                else if (m[2]) {
                    const num = Number(m[2]);
                    if (Number.isSafeInteger(num) && num >= 0 && num < 1e12) for (const w of cardinalWords(num).split(" ")) sink.emit(phonemizeWord(w));
                    else sink.emit(m[2]);
                } else if (m[3]) {
                    const mk = DEF.clausePunctuation[m[3]];
                    if (mk) sink.pause(mk);
                }
            });
        },
    };
}
