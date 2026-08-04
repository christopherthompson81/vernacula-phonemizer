/**
 * Standard Albanian (sq) phonemizer — Shqip (Tosk-based standard), Latin script, canonical IPA, espeak-independent.
 * The fleet's first Albanian-branch (Indo-European) language. Fairly phonemic: a longest-match scan over the digraph
 * system (⟨dh th sh zh xh⟩→[ð θ ʃ ʒ d͡ʒ], the palatals ⟨gj⟩→[ɟ] / ⟨q⟩→[c], ⟨nj⟩→[ɲ], ⟨ll⟩→[ɫ], ⟨rr⟩→[r]) then single
 * graphemes — the 7-vowel system (⟨e⟩→[ɛ], ⟨y⟩→[y], ⟨ë⟩→[ə]), ⟨c⟩→[t͡s], ⟨ç⟩→[t͡ʃ], ⟨x⟩→[d͡z], ⟨r⟩→[ɾ] (tap).
 * Penultimate stress (unwritten, the Albanian default). See docs/investigations/sq_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeNumberToWords, type AlbanianNumbers } from "./numbers.ts";

interface AlbanianDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    numbers: AlbanianNumbers;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<AlbanianDef>(import.meta.url, "albanian.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
/** Integer → Standard Albanian numeral words (decimal + the obligatory ⟨e⟩ connector; see numbers.ts). */
export const numberToWords = makeNumberToWords(DEF.numbers);
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
const VOWEL = new Set(["a", "ɛ", "i", "o", "u", "y", "ə"]);
const SIBILANT = new Set(["s", "z", "ʃ", "ʒ"]);
const NASAL = new Set(["m", "n", "ɲ", "ŋ"]);

/** Sonority class (higher = more sonorous): vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
function sonority(seg: string): number {
    if (VOWEL.has(seg)) return 6;
    if (seg === "j" || seg === "w") return 5;
    if (["l", "ɫ", "r", "ɾ"].includes(seg)) return 4;
    if (NASAL.has(seg)) return 3;
    if (seg.includes("͡")) return 1; // affricate (t͡s d͡z t͡ʃ d͡ʒ)
    if (["f", "v", "s", "z", "ʃ", "ʒ", "θ", "ð", "h"].includes(seg)) return 2;
    return 0; // stop (p b t d k ɡ c ɟ q)
}

/** Phonemize one Albanian word → canonical IPA: longest-match scan + penultimate stress. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const segs: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { segs.push(DIGRAPHS[key]!); i += key.length; continue outer; }
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Consulted AFTER every digraph and single-letter rule, so it cannot override this language (#663).
        const ph = G[w[i]!] ?? latinPhone(w[i]!);
        if (ph !== undefined) segs.push(ph);
        i += 1;
    }
    // Penultimate stress (the Albanian default; unwritten): ˈ before the MAXIMAL valid onset of the second-to-last
    // vowel's syllable (or the sole vowel of a monosyllable). Back up over the onset cluster by the sonority
    // sequencing principle (rising toward the vowel) + Albanian's sibilant-initial (st, sht, str) and nasal-initial
    // (mp, nd, mpr) onsets, but NOT the invalid ⟨tl dl⟩.
    const vidx = segs.map((s, idx) => (VOWEL.has(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx.length >= 2 ? vidx[vidx.length - 2]! : vidx[0]!;
        let at = nucleus;
        while (at > 0 && !VOWEL.has(segs[at - 1]!)) {
            const p = segs[at - 1]!,
                l = segs[at]!;
            const rising = sonority(p) < sonority(l) && !(["t", "d"].includes(p) && ["l", "ɫ"].includes(l));
            const sibilant = SIBILANT.has(p) && sonority(l) <= 2; // s/ʃ/z/ʒ + stop/affricate/fricative
            const nasal = NASAL.has(p) && sonority(l) <= 1; // m/n + stop/affricate (mp, nd, mpr)
            if (!(rising || sibilant || nasal)) break;
            at--;
        }
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// A word (Albanian Latin letters incl. ç ë) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zçëA-ZÇË]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class AlbanianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // Numbers: compose the Albanian numeral phrase, then phonemize each word through the same g2p.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Albanian phonemizer (direct digraph-rich g2p + penultimate stress). */
export function createAlbanian(): Phonemizer {
    return new AlbanianPhonemizer();
}
