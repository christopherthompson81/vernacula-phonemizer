/**
 * Polish (pl) grapheme→phoneme engine — West Slavic, Latin script, canonical IPA. See
 * polish.jsonc for the rule overview. Pipeline: scan (digraphs + the ⟨i⟩ palatalizer) → nasal-vowel realization →
 * voicing assimilation.
 */
import { MANIFEST } from "./manifest.ts";

const VOWEL = MANIFEST.vowels;
const NASAL = MANIFEST.nasalVowels;
const CONS = MANIFEST.consonants;
const DIGRAPH = MANIFEST.digraphs;
const SOFT_I = MANIFEST.softI; // c/s/z/n + i → the soft series
const TO_VOICELESS = MANIFEST.voicing.toVoiceless;
const TO_VOICED = MANIFEST.voicing.toVoiced;

const isObstruent = (p: string): boolean => p in TO_VOICELESS || p in TO_VOICED;
const isVoiced = (p: string): boolean => p in TO_VOICELESS;
const isVowelLetter = (ch: string): boolean => ch.length === 1 && "aeiouóyąę".includes(ch);

export interface Seg {
    ph: string;
    nucleus: boolean;
    nasal?: boolean; // an ą/ę nasal vowel, resolved by nasalRealization
    rz?: boolean; // a ⟨rz⟩ [ʐ]: devoices progressively after a voiceless obstruent and does NOT trigger regressive voicing (cf. ż)
}

/** Scan Polish orthography → IPA segments (digraphs, the ⟨i⟩ palatalizer, nasal-vowel marking). */
function scan(word: string): Seg[] {
    const w = [...word.toLowerCase()];
    const segs: Seg[] = [];
    const n = w.length;
    for (let i = 0; i < n; ) {
        const ch = w[i]!;
        // trigraph dzi (soft dz): d͡ʑ; the i is silent before a vowel (ludzie→lud͡ʑɛ), else the [i] vowel (dzik→d͡ʑik)
        if (ch === "d" && w[i + 1] === "z" && w[i + 2] === "i") {
            segs.push({ ph: "d͡ʑ", nucleus: false });
            if (!isVowelLetter(w[i + 3] ?? "")) segs.push({ ph: "i", nucleus: true });
            i += 3;
            continue;
        }
        // 2-char digraphs
        const dg = ch + (w[i + 1] ?? "");
        if (DIGRAPH[dg]) {
            segs.push({ ph: DIGRAPH[dg]!, nucleus: false, rz: dg === "rz" });
            i += 2;
            continue;
        }
        // coronal soft-i: c/s/z/n + i
        if (SOFT_I[ch] && w[i + 1] === "i") {
            segs.push({ ph: SOFT_I[ch]!, nucleus: false });
            i = advanceSoft(w, segs, i);
            continue;
        }
        // ⟨i⟩ before another vowel → a [j] glide (pies→pjɛs, radio→radjɔ, kiedy→kjɛdɨ); otherwise the [i] vowel
        // (nogi→nɔɡi). Velars are NOT specially palatalized (the wikipron convention; epitran writes kʲ/ɡʲ).
        if (ch === "i") {
            if (isVowelLetter(w[i + 1] ?? "")) segs.push({ ph: "j", nucleus: false });
            else segs.push({ ph: "i", nucleus: true });
            i++;
            continue;
        }
        // oral vowels; ⟨u⟩ after ⟨a⟩ is the [w] glide (au→aw). Only ⟨au⟩: eu/ou stay hiatus (Europa→ɛurɔpa, below),
        // and ⟨i⟩ never reaches here (the ⟨i⟩ branch above makes it [j] before a vowel, else [i]: Kraina→kraina).
        if (VOWEL[ch]) {
            // au → aw (u-glide) in loanwords (auto→awtɔ, pauza→pawza); but the na-/za- PREFIX + u-root is hiatus
            // (nauka→na.u.ka, zaufanie→za.u.faɲɛ), so skip the glide there. eu/ou stay hiatus (loan-ambiguous).
            const auPrefix = i === 2 && (w[0] === "n" || w[0] === "z");
            if (ch === "u" && w[i - 1] === "a" && !auPrefix) segs.push({ ph: "w", nucleus: false });
            else segs.push({ ph: VOWEL[ch]!, nucleus: true });
            i++;
            continue;
        }
        // nasal vowels ą/ę
        if (NASAL[ch]) {
            segs.push({ ph: NASAL[ch]!, nucleus: true, nasal: true });
            i++;
            continue;
        }
        // single consonant
        if (CONS[ch]) segs.push({ ph: CONS[ch]!, nucleus: false });
        i++;
    }
    return segs;
}

/** After a soft/velar consonant + ⟨i⟩ at index i: consume "Ci"; the i is silent before a vowel, else the [i] vowel. */
function advanceSoft(w: string[], segs: Seg[], i: number): number {
    const after = w[i + 2] ?? "";
    if (!isVowelLetter(after)) segs.push({ ph: "i", nucleus: true });
    return i + 2;
}

/** Resolve ą/ę by the following segment (see nasalBefore): an oral vowel + a homorganic nasal stop, or + a [w̃]
 *  glide, or a nasalized vowel before a sonorant. Word-final ą is [ɔw̃]; word-final ę denasalizes to [ɛ]. */
function nasalRealization(segs: Seg[]): void {
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (!s.nasal) continue;
        const nx = segs[i + 1];
        if (nx === undefined) {
            // word-final: ą → [ɔw̃] (nasal + w-offglide), ę → [ɛ] (denasalized)
            if (s.ph === "ɛ") continue; // ę-final = ɛ
            s.ph = "ɔw̃"; // ą-final = ɔw̃
            continue;
        }
        const homorganic = nasalBefore(nx.ph);
        if (homorganic === "w̃") s.ph = s.ph + "w̃"; // before a non-velar fricative → a nasal w-glide (gęś→ɡɛw̃ɕ, wąs→vɔw̃s)
        else if (homorganic) segs.splice(i + 1, 0, { ph: homorganic, nucleus: false });
        else s.ph = s.ph + "̃"; // before a sonorant → nasalized vowel
    }
}

/** ą/ę → oral vowel + a homorganic nasal element before a following consonant: [m]/[n]/[ɲ]/[ŋ] before a stop or
 *  affricate, pure vowel-nasalization before a sonorant, and before a FRICATIVE a choice per place (#1522, #1551):
 *    · labial f/v, dental/retroflex s z ʂ ʐ and palatal ɕ/ʑ → the [w̃] glide (trąf→trɔw̃f, wąs→vɔw̃s,
 *      język→jɛw̃zɨk, gęś→ɡɛw̃ɕ). The labial was [m] until #1522: wikipron (human) writes [w̃] there in all 13 rows
 *      and [m] in none (+13 on it). s z ʂ ʐ were [n] until #1551, and that one is a CHOICE, NOT A MEASUREMENT:
 *      wikipron lists [n] and [w̃] side by side in ~1,500 rows, so the two score identically on it and on epitran.
 *      [w̃] is standard orthoepy's asynchronous nasal vowel before a fricative; a study of student speech finds ę
 *      before a hard fricative nasal, and before a soft one only optionally (sources in the pl investigation log).
 *    · velar x → [ŋ] (wąchać→vɔŋxat͡ɕ): wikipron 92 rows [ŋ], 0 rows [w̃]; [w̃] here measured −80.
 *  Returns the nasal consonant, "w̃" for the glide, or null → nasalize the vowel. */
function nasalBefore(p: string): string | null {
    if (p === "p" || p === "b") return "m"; // labial stop
    if (p === "f" || p === "v" || p === "s" || p === "z" || p === "ʂ" || p === "ʐ" || p === "ɕ" || p === "ʑ")
        return "w̃"; // a non-velar fricative → nasal glide
    if (p === "t͡ɕ" || p === "d͡ʑ") return "ɲ"; // palatal affricate
    if (p === "k" || p === "ɡ" || p === "x") return "ŋ"; // velar
    if ("td".includes(p) || p === "t͡s" || p === "d͡z" || p === "t͡ʂ" || p === "d͡ʐ")
        return "n"; // dental / alveolar / retroflex stop or affricate
    return null; // sonorant (l, ł→w, r, j, nasals) → nasalized vowel
}

/** Regressive voicing assimilation + word-final devoicing; progressive devoicing of v/ʐ after a voiceless obstruent. */
function applyVoicing(segs: Seg[]): void {
    // regressive, right-to-left
    for (let i = segs.length - 1; i >= 0; i--) {
        const p = segs[i]!.ph;
        if (!isObstruent(p)) continue;
        const nx = segs[i + 1];
        let target: "voiced" | "voiceless" | null = null;
        if (nx === undefined) target = "voiceless"; // final devoicing
        // v (from w) and ⟨rz⟩ are TARGETS of assimilation but do NOT trigger it (they devoice progressively below).
        else if (isObstruent(nx.ph) && nx.ph !== "v" && !nx.rz)
            target = isVoiced(nx.ph) ? "voiced" : "voiceless";
        if (target === "voiceless" && p in TO_VOICELESS) segs[i]!.ph = TO_VOICELESS[p]!;
        else if (target === "voiced" && p in TO_VOICED) segs[i]!.ph = TO_VOICED[p]!;
    }
    // progressive: v (from w) and ⟨rz⟩ [ʐ] devoice after a voiceless obstruent (świat→ɕfjat, przez→pʂɛs, trzy→tʂɨ)
    for (let i = 1; i < segs.length; i++) {
        const prev = segs[i - 1]!.ph;
        if ((segs[i]!.ph === "v" || (segs[i]!.rz && segs[i]!.ph === "ʐ")) && isObstruent(prev) && !isVoiced(prev))
            segs[i]!.ph = segs[i]!.ph === "v" ? "f" : "ʂ";
    }
}

/** n → ŋ before a velar k/ɡ/x (bank→baŋk, abdanch→abdaŋx). */
function nasalAssim(segs: Seg[]): void {
    for (let i = 0; i < segs.length - 1; i++) {
        const nx = segs[i + 1]!.ph;
        if (segs[i]!.ph === "n" && (nx === "k" || nx === "ɡ" || nx === "x")) segs[i]!.ph = "ŋ";
    }
}

/** Polish word → IPA phoneme segments. */
export function toSegments(word: string): Seg[] {
    const segs = scan(word);
    nasalRealization(segs);
    nasalAssim(segs);
    applyVoicing(segs);
    return segs;
}
