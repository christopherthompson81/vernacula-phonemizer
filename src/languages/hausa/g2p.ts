/**
 * Hausa grapheme→phoneme engine (Kano standard, Boko orthography), espeak-independent and AUTHORED
 * beyond-espeak (espeak ships no Hausa). Boko spelling is shallow and near-1:1, so a longest-match scan —
 * digraphs/trigraphs (ƙw, 'y, aa, ai, sh, ts, kw, ky…) resolve before the bare letter. Fills the census gaps:
 * implosives ɓ ɗ, ejectives kʼ t͡sʼ, labialization kʷ ɡʷ, glottalized ʔʲ, palatals c ɟ, and ɸ.
 * Tone is NOT written in Boko — it is a lexical FACT overlaid from a Wiktionary-derived lexicon (tone.tsv);
 * out-of-lexicon words are left untoned. Stress is penultimate. See docs/ha_native_bringup_investigation.md.
 */
import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Longest-match orthography→IPA rules + tone-code→Chao map — authored DATA in hausa.jsonc.
const RULES = MANIFEST.rules;
const TONE_CHAO = MANIFEST.toneChao;

// Tone lexicon: word → per-nucleus tone codes (H/L/F/R). All-Low words are omitted; out-of-lexicon → untoned.
let TONE: Map<string, string> | undefined;
function toneLexicon(): Map<string, string> {
    if (TONE === undefined)
        TONE = loadTsvMap(import.meta.url, "tone.tsv", (v) => v.trim(), {
            optional: true,
        });
    return TONE;
}

interface Seg {
    ph: string;
    nuc: boolean;
}

/** Scan Boko orthography into IPA segments (longest-match); n → ŋ before a velar. */
function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const segs: Seg[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const [orth, ipa, nuc] of RULES) {
            if (w.startsWith(orth, i)) {
                // n → ŋ before a velar (k / g / ƙ), incl. their digraphs.
                if (orth === "n" && /[kgƙ]/.test(w[i + 1] ?? ""))
                    segs.push({ ph: "ŋ", nuc: false });
                else segs.push({ ph: ipa, nuc });
                i += orth.length;
                continue outer;
            }
        }
        i++; // unknown char (skip)
    }
    return segs;
}

/** One Hausa word → canonical IPA: segments + penultimate stress + lexical tone overlay. */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nucIdx = segs.map((s, i) => (s.nuc ? i : -1)).filter((i) => i >= 0);
    if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
    // Stress: the penultimate nucleus (the only one if monosyllabic).
    const stressIdx =
        nucIdx.length >= 2 ? nucIdx[nucIdx.length - 2]! : nucIdx[0]!;
    // Tone: per-nucleus codes from the lexicon (in nucleus order); untoned if absent.
    const codes =
        toneLexicon().get(word) ?? toneLexicon().get(word.toLowerCase()) ?? "";
    let out = "",
        n = 0;
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
        if (segs[i]!.nuc) {
            out += TONE_CHAO[codes[n] ?? ""] ?? "";
            n++;
        }
    }
    return out;
}
