/**
 * Slovak (sk) grapheme→phoneme engine — West Slavic, Latin script, canonical IPA. Slovak is
 * fairly phonemic; the context systems handled here:
 *   - palatalisation: d/t/n/l → ɟ/c/ɲ/ʎ before i, í and the i-diphthongs ⟨ia ie iu⟩ (deti→ɟeci, list→ʎist). y/ý are
 *     HARD (milý→miliː). Palatalisation before ⟨e⟩ is LEXICAL (deti vs ten) → not modelled by rule.
 *   - diphthongs: ⟨ia ie iu⟩ → ɪ̯a ɪ̯e ɪ̯u (rising; the leading i palatalises a preceding d/t/n/l), ⟨ô⟩ → u̯ɔ.
 *   - syllabic liquids: r/l between consonants → r̩/l̩ (vlk→vl̩k, krv→kr̩v); long ⟨ĺ ŕ⟩ → l̩ː/r̩ː.
 *   - voicing assimilation: regressive within obstruent clusters + word-final devoicing (chlieb→xʎɪ̯ep, kde→ɡde).
 *     ⟨v⟩ is a LIMITED target — it devoices to [f] before a voiceless obstruent (vták→ftaːk) but stays [v] word-finally
 *     (stav→stav, unlike Czech v→f) and before voiced/sonorant (dievča→ɟɪ̯evt͡ʃa); v never triggers. ⟨h⟩=ɦ pairs with ⟨ch⟩=x.
 * Vowels short a e i/y o u → a e i ɔ u, long á é í/ý ó ú → aː eː iː ɔː uː, ⟨ä⟩ → æ. Stress (first-syllable) is
 * applied in slovak.ts.
 */
import { MANIFEST } from "./manifest.ts";

const VOWEL = MANIFEST.vowels;
const PALAT = MANIFEST.palatalisation.map;
const PALAT_TRIGGER = new Set(MANIFEST.palatalisation.triggers); // d/t/n/l palatalise before these (i/í/e; i-diphthongs via their leading "i")
const CONS = MANIFEST.consonants;
const TO_VOICELESS = MANIFEST.voicing.toVoiceless;
const TO_VOICED = MANIFEST.voicing.toVoiced;
const isObstruent = (p: string): boolean => p in TO_VOICELESS || p in TO_VOICED;
const isVoiced = (p: string): boolean => p in TO_VOICELESS; // voiced obstruents are the keys of the devoicing map

export interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Scan Slovak orthography into IPA phoneme segments (digraphs + diphthongs + palatalisation), before voicing/syllabicity. */
function scan(word: string): Seg[] {
    const c = [...word.toLowerCase()];
    const segs: Seg[] = [];
    for (let i = 0; i < c.length; i++) {
        const ch = c[i]!;
        const next = c[i + 1] ?? "";
        // digraphs: ch → x, dz → d͡z, dž → d͡ʒ (before the d/z/c singles)
        if (ch === "c" && next === "h") { segs.push({ ph: "x", nucleus: false }); i++; continue; }
        if (ch === "d" && next === "z") { segs.push({ ph: "d͡z", nucleus: false }); i++; continue; }
        if (ch === "d" && next === "ž") { segs.push({ ph: "d͡ʒ", nucleus: false }); i++; continue; }
        // ⟨x⟩ → k s
        if (ch === "x") { segs.push({ ph: "k", nucleus: false }, { ph: "s", nucleus: false }); continue; }
        // rising diphthongs ⟨ia ie iu⟩ → ɪ̯a/ɪ̯e/ɪ̯u (the glide is the near-close ɪ̯ in the referee), ⟨ô⟩ → u̯ɔ
        if (ch === "i" && (next === "a" || next === "e" || next === "u")) {
            segs.push({ ph: next === "a" ? "ɪ̯a" : next === "e" ? "ɪ̯e" : "ɪ̯u", nucleus: true });
            i++;
            continue;
        }
        if (ch === "ô") { segs.push({ ph: "u̯ɔ", nucleus: true }); continue; }
        // long syllabic liquids ⟨ĺ ŕ⟩
        if (ch === "ĺ") { segs.push({ ph: "l̩ː", nucleus: true }); continue; }
        if (ch === "ŕ") { segs.push({ ph: "r̩ː", nucleus: true }); continue; }
        // plain vowel (incl. ä)
        if (ch in VOWEL) { segs.push({ ph: VOWEL[ch]!, nucleus: true }); continue; }
        // d/t/n/l palatalise before a trigger (i/í/e); an i-diphthong ⟨ia ie iu⟩ is covered because its leading "i"
        // is itself a trigger (deti→ɟeci, diabol→ɟɪ̯abɔl).
        if (ch in PALAT && PALAT_TRIGGER.has(next)) {
            segs.push({ ph: PALAT[ch]!, nucleus: false });
            continue;
        }
        const cons = CONS[ch];
        if (cons !== undefined) segs.push({ ph: cons, nucleus: false });
        // else: unknown char (skip)
    }
    return segs;
}

/** Mark r/l as syllabic (r̩/l̩, a nucleus) when neither neighbour is a vowel nucleus. */
function markSyllabic(segs: Seg[]): void {
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (s.ph !== "r" && s.ph !== "l") continue;
        const leftV = segs[i - 1]?.nucleus ?? false;
        const rightV = segs[i + 1]?.nucleus ?? false;
        if (!leftV && !rightV) {
            s.ph = s.ph === "r" ? "r̩" : "l̩";
            s.nucleus = true;
        }
    }
}

/** Regressive voicing assimilation + word-final devoicing, right-to-left over obstruent clusters. ⟨v⟩ is a limited
 *  target: it devoices to [f] before a voiceless obstruent (onset clusters — vták→ftaːk, včera→ft͡ʃera) but stays [v]
 *  word-finally (stav→stav, NOT staf — the Slovak difference from Czech) and before voiced/sonorant; v never triggers. */
function applyVoicing(segs: Seg[]): void {
    for (let i = segs.length - 1; i >= 0; i--) {
        const p = segs[i]!.ph;
        if (p === "v") {
            const nx = segs[i + 1];
            // ONSET v (not preceded by a vowel) devoices to [f] before a voiceless obstruent (vták→ftaːk, včera→ft͡ʃera).
            // POST-VOCALIC (coda) v stays [v] (dievča→ɟɪ̯evt͡ʃa, stav→stav) — it is [u̯]-like, never [f].
            const codaV = segs[i - 1]?.nucleus ?? false;
            if (!codaV && nx !== undefined && isObstruent(nx.ph) && nx.ph !== "v" && !isVoiced(nx.ph)) segs[i]!.ph = "f";
            continue; // otherwise v is inert; and it never triggers voicing on a preceding obstruent
        }
        if (!isObstruent(p)) continue;
        const nx = segs[i + 1];
        let target: "voiced" | "voiceless" | null = null;
        if (nx === undefined) target = "voiceless"; // word-final devoicing
        else if (isObstruent(nx.ph) && nx.ph !== "v") {
            target = isVoiced(nx.ph) ? "voiced" : "voiceless";
        } // before a sonorant/vowel/v: keep base voicing
        if (target === "voiceless" && p in TO_VOICELESS) segs[i]!.ph = TO_VOICELESS[p]!;
        else if (target === "voiced" && p in TO_VOICED) segs[i]!.ph = TO_VOICED[p]!;
    }
}

/** Merge a doubled consonant into a geminate [Cː] (mäkký→mækːiː, vyšší→viʃːiː). Adjacent identical non-nucleus phs. */
function geminate(segs: Seg[]): void {
    for (let i = segs.length - 1; i > 0; i--) {
        const a = segs[i - 1]!;
        const b = segs[i]!;
        if (!a.nucleus && !b.nucleus && a.ph === b.ph) {
            a.ph = a.ph + "ː";
            segs.splice(i, 1);
        }
    }
}

/** Slovak word → IPA phoneme segments (scan + syllabic + gemination + voicing). NOTE: n→ŋ velar assimilation is
 *  deliberately NOT applied — the broad referee keeps [n] before k/ɡ (Danka→danka; ŋ appears in only ~0.1% of rows). */
export function toSegments(word: string): Seg[] {
    const segs = scan(word);
    markSyllabic(segs);
    geminate(segs);
    applyVoicing(segs);
    return segs;
}
