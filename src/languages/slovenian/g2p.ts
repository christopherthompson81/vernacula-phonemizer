/**
 * Slovenian (sl) grapheme→phoneme engine — South Slavic, Latin script, canonical IPA. Slovene
 * spelling is shallow at the consonant level but UNDERSPECIFIES the vowels (quality/length/pitch/schwa are all
 * unwritten). This scan handles the consonant systems; the vowel quality is emitted at the open-mid ɛ/ɔ default and
 * folded downstream. Context systems:
 *   - ⟨lj⟩ / ⟨nj⟩: → l+j / n+j before a vowel (polje→pɔljɛ); the j DROPS in coda/final (kralj→kral, konj→kɔn).
 *   - ⟨l⟩ → l. Coda ⟨l⟩-vocalization (bel→bɛʋ) is LEXICAL (native vocalizes, loans keep [l]) → deferred to a lexicon.
 *   - syllabic ⟨r⟩: an r with no vowel neighbour takes a preceding schwa → ə r (prst→pərst, vrt→ʋərt).
 *   - voicing: regressive assimilation in obstruent clusters + word-final devoicing (grad→ɡrat, glasba→ɡlazba). ⟨v⟩→ʋ
 *     is sonorant-inert (coda ⟨v⟩ is [w], never [f]); ⟨f⟩ voices to ʋ before a voiced obstruent (Afganistan→aʋɡanistan).
 */
import { MANIFEST } from "./manifest.ts";

const VOWEL = MANIFEST.vowels; // a e i o u → a ɛ i ɔ u
const CONS = MANIFEST.consonants;
const TO_VOICELESS = MANIFEST.voicing.toVoiceless;
const TO_VOICED = MANIFEST.voicing.toVoiced;
const isObstruent = (p: string): boolean => p in TO_VOICELESS || p in TO_VOICED;
const isVoiced = (p: string): boolean => p in TO_VOICELESS; // voiced obstruents are the keys of the devoicing map
const isVowelLetter = (ch: string): boolean => ch in VOWEL; // "" in VOWEL is already false

export interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Scan Slovene orthography into IPA segments (digraphs + l-vocalization + lj/nj), before syllabic-r and voicing. */
function scan(word: string): Seg[] {
    const c = [...word.toLowerCase()];
    const segs: Seg[] = [];
    for (let i = 0; i < c.length; i++) {
        const ch = c[i]!;
        const next = c[i + 1] ?? "";
        const next2 = c[i + 2] ?? "";

        // ⟨dž⟩ → d͡ʒ (loanwords)
        if (ch === "d" && next === "ž") { segs.push({ ph: "d͡ʒ", nucleus: false }); i++; continue; }
        // ⟨lj⟩ / ⟨nj⟩: l+j / n+j before a vowel; the j drops in coda/final.
        if (ch === "l" && next === "j") {
            segs.push({ ph: "l", nucleus: false });
            if (isVowelLetter(next2)) segs.push({ ph: "j", nucleus: false });
            i++;
            continue;
        }
        if (ch === "n" && next === "j") {
            segs.push({ ph: "n", nucleus: false });
            if (isVowelLetter(next2)) segs.push({ ph: "j", nucleus: false });
            i++;
            continue;
        }
        // ⟨l⟩ → l. NOTE: Slovene coda ⟨l⟩-vocalization (bel→bɛʋ) is LEXICAL (native words vocalize, loans/proper nouns
        // keep [l]: Balkan→balkan, Ahil→axil) — not spelling-predictable. A blanket coda-l→ʋ rule was MEASURED net
        // -2.0pp on the (name-heavy) referee (233 kept-[l] vs 101 vocalized), so vocalization is DEFERRED to a future
        // lexicon (the rule-then-lexicon discipline). ⟨lj⟩'s l (handled above) likewise stays [l].
        if (ch === "l") {
            segs.push({ ph: "l", nucleus: false });
            continue;
        }
        // foreign ⟨x⟩ → k s
        if (ch === "x") { segs.push({ ph: "k", nucleus: false }, { ph: "s", nucleus: false }); continue; }
        // plain vowel
        if (ch in VOWEL) { segs.push({ ph: VOWEL[ch]!, nucleus: true }); continue; }
        // single consonant
        const cons = CONS[ch];
        if (cons !== undefined) segs.push({ ph: cons, nucleus: false });
        // else: unknown char (skip)
    }
    return segs;
}

/** A syllabic ⟨r⟩ (an r with no vowel-nucleus neighbour) takes a preceding schwa: prst→p ə r s t, vrt→ʋ ə r t,
 *  čmrlj→t͡ʃ m ə r l. Only ⟨r⟩ — Slovene has no productive syllabic /l/ (the rare loan C-l-C is left as-is; the
 *  Slovak engine's syllabic-l is not Slovene). A liquid before the glide j is an onset, so this never fires there. */
function syllabicR(segs: Seg[]): void {
    for (let i = segs.length - 1; i >= 0; i--) {
        if (segs[i]!.ph !== "r") continue;
        const leftV = segs[i - 1]?.nucleus ?? false;
        const rightV = segs[i + 1]?.nucleus ?? false;
        if (!leftV && !rightV) segs.splice(i, 0, { ph: "ə", nucleus: true });
    }
}

/** Regressive voicing assimilation + word-final devoicing, right-to-left over obstruent clusters. Sonorants
 *  (incl. ʋ/j/m/n/l/r) are transparent (they block assimilation across themselves and never trigger it). */
function applyVoicing(segs: Seg[]): void {
    for (let i = segs.length - 1; i >= 0; i--) {
        const p = segs[i]!.ph;
        if (!isObstruent(p)) continue; // sonorants (incl. ʋ) are inert
        const nx = segs[i + 1];
        let target: "voiced" | "voiceless" | null = null;
        if (nx === undefined) target = "voiceless"; // word-final devoicing
        // ⟨h⟩=[x] (and its voiced ɣ) is voicing-NEUTRAL — it does not trigger assimilation on a preceding obstruent
        // (Abhazija→abxazija, b stays b), so exclude it as a trigger.
        else if (isObstruent(nx.ph) && nx.ph !== "x" && nx.ph !== "ɣ")
            target = isVoiced(nx.ph) ? "voiced" : "voiceless";
        // before a sonorant/vowel: keep base voicing
        if (target === "voiceless" && p in TO_VOICELESS) segs[i]!.ph = TO_VOICELESS[p]!;
        else if (target === "voiced" && p in TO_VOICED) segs[i]!.ph = TO_VOICED[p]!;
    }
}

/** Slovene word → IPA phoneme segments (scan + syllabic-r + voicing). */
export function toSegments(word: string): Seg[] {
    const segs = scan(word);
    syllabicR(segs);
    applyVoicing(segs);
    return segs;
}
