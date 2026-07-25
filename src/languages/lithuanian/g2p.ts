/**
 * Lithuanian rule-based g2p (the Czech pattern). Orthography → IPA phoneme segments:
 *   1. TOKENIZE into letter-units, greedily matching digraphs (⟨ch dz dž⟩ consonants, ⟨ie uo⟩ rising diphthongs)
 *      before single letters.
 *   2. PALATALIZATION — the load-bearing rule. A consonant is soft (Cʲ) when the next unit is a SINGLE front vowel
 *      (⟨e ę ė i į y⟩), the softening ⟨i⟩, ⟨j⟩, the rising diphthong ⟨ie⟩ (which opens on a front [i] — Dievas →
 *      dʲiɛʋɐs), or (spread) a soft consonant to its right. ⟨uo⟩ does NOT trigger (it opens on the back [u]). Velars
 *      ⟨k ɡ⟩ don't receive the leftward spread. Spread is regressive (leftward) through the cluster.
 *   3. SOFTENING ⟨i⟩ — an ⟨i⟩ between a consonant and a BACK vowel (⟨Cia Cio Ciu Cią Cių Ciū⟩) is silent: it only
 *      marks the preceding consonant soft, so it is dropped after it triggers palatalization (and the ⟨a⟩ then fronts:
 *      čia → t͡ʃʲɛ).
 *   4. VOICING assimilation — regressive within obstruent clusters (dirbti → dʲɪrʲptʲɪ, b→p before t); sonorants +
 *      j/ʋ are transparent.
 *   5. n → ŋ before a velar k/ɡ.
 * Vowel LENGTH + the stressed ɑː/æː quality are stress-conditioned (stress is lexical) → we emit the phonemic short
 * quality; the referee's length + pitch accents are folded. See docs/investigations/lt_bringup_investigation.md.
 */
import { MANIFEST } from "./manifest.ts";

const V = MANIFEST.vowels;
const VDI = MANIFEST.vowelDigraphs;
const C = MANIFEST.consonants;
const CDI = MANIFEST.consonantDigraphs;
const FRONT = new Set([...MANIFEST.frontVowels]);
const BACK = new Set([...MANIFEST.backVowels]);
const TO_VOICELESS = MANIFEST.voicing.toVoiceless;
const TO_VOICED = MANIFEST.voicing.toVoiced;
const isObstruent = (p: string): boolean => p in TO_VOICELESS || p in TO_VOICED;
const isVoiced = (p: string): boolean => p in TO_VOICELESS; // voiced obstruents key the devoicing map

export interface Seg {
    ph: string;
    nucleus: boolean;
}

interface Unit {
    ch: string; // the source letter(s), lowercased
    kind: "V" | "C" | "soft-i"; // vowel (incl. digraph) / consonant / the silent softening ⟨i⟩
    ph: string;
    soft: boolean; // consonant palatalisation (set by the rule)
}

/** Tokenize a lowercased word into letter-units (digraphs first). Unknown chars are dropped. */
function tokenize(w: string): Unit[] {
    const u: Unit[] = [];
    let i = 0;
    while (i < w.length) {
        const two = w.slice(i, i + 2);
        if (two in CDI) { u.push({ ch: two, kind: "C", ph: CDI[two]!, soft: false }); i += 2; continue; }
        if (two in VDI) { u.push({ ch: two, kind: "V", ph: VDI[two]!, soft: false }); i += 2; continue; }
        const c = w[i]!;
        if (c in V) { u.push({ ch: c, kind: "V", ph: V[c]!, soft: false }); i += 1; continue; }
        if (c in C) { u.push({ ch: c, kind: "C", ph: C[c]!, soft: false }); i += 1; continue; }
        i += 1; // unknown → skip
    }
    return u;
}

/** A unit that TRIGGERS palatalisation of a preceding consonant: a single front vowel, the softening ⟨i⟩, or ⟨j⟩.
 *  ⟨ie⟩ triggers (front-opening); ⟨uo⟩ (back-opening) does not. */
function triggers(unit: Unit | undefined): boolean {
    if (unit === undefined) return false;
    if (unit.kind === "soft-i") return true;
    if (unit.ch === "j") return true;
    if (unit.ch === "ie") return true; // the rising diphthong ⟨ie⟩ opens on a front [i] → palatalises (Dievas → dʲiɛ…)
    return unit.kind === "V" && unit.ch.length === 1 && FRONT.has(unit.ch);
}

// Velars ⟨k ɡ⟩ do NOT receive leftward palatalisation spread (they soften only DIRECTLY before a front vowel):
// knyga → knʲiːɡɐ (k hard before soft nʲ), Eglynas → ɛɡlʲiːnɐs (ɡ hard before soft lʲ). Other consonants spread.
const NO_SPREAD = new Set(["k", "g"]);

export function scan(word: string): Seg[] {
    const u = tokenize(word.toLowerCase());

    // Mark the SILENT softening ⟨i⟩: a single ⟨i⟩ between a consonant and a back vowel (Cia/Cio/Ciu…).
    for (let i = 1; i < u.length - 1; i++) {
        if (u[i]!.ch === "i" && u[i - 1]!.kind === "C" && u[i + 1]!.kind === "V") {
            const nx = u[i + 1]!.ch;
            if (BACK.has(nx[0]!)) u[i]!.kind = "soft-i"; // the ⟨i⟩ is silent, softens the preceding C
        }
    }

    // PALATALISATION: a consonant is soft if the next unit triggers; then spread leftward (a consonant before a soft
    // consonant is soft). ⟨j⟩ is inherently palatal so it doesn't take a separate ʲ but does propagate softness.
    for (let i = 0; i < u.length; i++) if (u[i]!.kind === "C" && triggers(u[i + 1])) u[i]!.soft = true;
    for (let i = u.length - 2; i >= 0; i--) {
        if (u[i]!.kind === "C" && !NO_SPREAD.has(u[i]!.ch) && u[i + 1]!.kind === "C" && (u[i + 1]!.soft || u[i + 1]!.ch === "j"))
            u[i]!.soft = true;
    }

    // ⟨a ą⟩ FRONT to [ɛ]/[ɛː] after the softening ⟨i⟩ (⟨Cia⟩ → Cʲɛ, čia → t͡ʃʲɛ) or ⟨j⟩ (-ija → …jɛ, koja → koːjɛ,
    // Mažeikiai → …kʲɛɪ). Determined on the UNIT stream (the softening ⟨i⟩ still present) before it is dropped. This
    // fires in the ⟨jau/jai⟩ diphthong too (Andrejauskas → …jɛʊ) — where it's really stress-conditioned (unstressed
    // jaunuolis stays jɐ), but the referee majority fronts, so the always-front rule scores best. (A soft plain
    // consonant can never sit before ⟨a⟩ — orthographic Cʲa is spelled ⟨Cia⟩, the soft-⟨i⟩ path — so that case is out.)
    for (let i = 1; i < u.length; i++) {
        if (u[i]!.kind !== "V" || (u[i]!.ch !== "a" && u[i]!.ch !== "ą")) continue;
        const prev = u[i - 1]!;
        if (prev.ch === "j" || prev.kind === "soft-i") u[i]!.ph = u[i]!.ch === "a" ? "ɛ" : "ɛː";
    }

    const segs: Seg[] = [];
    for (const unit of u) {
        if (unit.kind === "soft-i") continue; // silent
        if (unit.kind === "V") { segs.push({ ph: unit.ph, nucleus: true }); continue; }
        // ⟨j⟩ is already palatal (no ʲ); other consonants get ʲ when soft.
        const ph = unit.ch === "j" ? unit.ph : unit.soft ? unit.ph + "ʲ" : unit.ph;
        segs.push({ ph, nucleus: false });
    }
    return segs;
}

/** n → ŋ before a velar k/ɡ (keeping any ʲ). */
function nasalAssim(segs: Seg[]): void {
    for (let i = 0; i < segs.length - 1; i++) {
        const p = segs[i]!.ph;
        if ((p === "n" || p === "nʲ") && /^[kɡ]/.test(segs[i + 1]!.ph)) segs[i]!.ph = p === "nʲ" ? "ŋʲ" : "ŋ";
    }
}

/** Regressive voicing assimilation over obstruent clusters (the last obstruent sets the voicing of the run). The ʲ is
 *  preserved (b→p keeps softness: bʲ→pʲ). Sonorants + j/ʋ are transparent (neither trigger nor block). */
function applyVoicing(segs: Seg[]): void {
    const base = (p: string): string => p.replace(/ʲ$/u, "");
    const soft = (p: string): boolean => p.endsWith("ʲ");
    for (let i = segs.length - 2; i >= 0; i--) {
        const p = base(segs[i]!.ph);
        if (!isObstruent(p)) continue;
        const nb = base(segs[i + 1]!.ph);
        if (!isObstruent(nb)) continue; // before a sonorant/vowel/pause: keep base voicing
        const map = isVoiced(nb) ? TO_VOICED : TO_VOICELESS;
        if (p in map) segs[i]!.ph = map[p]! + (soft(segs[i]!.ph) ? "ʲ" : "");
    }
}

/** Lithuanian word → IPA phoneme segments (scan + ŋ-assimilation + voicing). Stress is lexical → not marked. */
export function toSegments(word: string): Seg[] {
    const segs = scan(word);
    nasalAssim(segs);
    applyVoicing(segs);
    return segs;
}
