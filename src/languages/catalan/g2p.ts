/**
 * Catalan (Central/Eastern) grapheme→phoneme scanner. Left-to-right, small context rules, no lexicon. Produces
 * a segment list; STRESS, unstressed-vowel REDUCTION, spirantization, palatal nasal assimilation and final
 * devoicing are applied downstream (catalan.ts). Each vowel segment carries both its stressed and reduced IPA
 * so the reduction pass can pick once stress is known. See docs/ca_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";

const V = MANIFEST.vowels;
const ACCENTED = MANIFEST.accentedVowels;
const FRONT = MANIFEST.frontVowels;
const VOWEL_CHARS = Object.keys(V).join("");
const STRONG = "aeoàèéòó"; // each its own nucleus (two adjacent = hiatus)

const isVowel = (c: string): boolean => c !== "" && VOWEL_CHARS.includes(c);
const isFront = (c: string): boolean => c !== "" && FRONT.includes(c);
const isAccented = (c: string): boolean => c !== "" && ACCENTED.includes(c);

export interface Seg {
    ph: string; // consonant IPA, or the vowel's STRESSED IPA (reduction picks `reduced` downstream)
    nucleus: boolean; // syllable nucleus (a vowel, not a glide)
    accent: boolean; // bears a written accent → lexically stressed
    reduced?: string; // the vowel's UNSTRESSED IPA (Central reduction); undefined for consonants/glides
}

/** Classify a maximal vowel run into nucleus vs glide. Strong + accented-weak (í ú ï ü) are nuclei. A plain i/u
 *  is a glide ONLY as an OFFGLIDE (a nucleus precedes it in the run: ai→aj, au→aw, iu→iw, ui→uj) or as a
 *  WORD-INITIAL onglide (iogurt→ju). Catalan Cia/Cio is HIATUS — the onglide i/u stays a nucleus (unlike es). */
function classifyRun(run: string, atWordStart: boolean): boolean[] {
    const chars = [...run];
    const nucleus = chars.map((c) => STRONG.includes(c) || isAccented(c));
    chars.forEach((c, k) => {
        if (nucleus[k]) return;
        const precededByNucleus = nucleus.slice(0, k).some(Boolean);
        const wordInitialOnglide = atWordStart && k === 0 && chars.length > 1;
        if (!precededByNucleus && !wordInitialOnglide) nucleus[k] = true; // onglide i/u → hiatus nucleus
    });
    if (!nucleus.some(Boolean)) nucleus[nucleus.length - 1] = true; // safety
    return nucleus;
}

/** Scan a lowercased Catalan word into segments. */
export function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const segs: Seg[] = [];
    const n = w.length;
    let i = 0;
    const cons = (ph: string): void => {
        segs.push({ ph, nucleus: false, accent: false });
    };
    const lastPh = (): string => (segs.length ? segs[segs.length - 1]!.ph : "");

    while (i < n) {
        const c = w[i]!;
        const nx = w[i + 1] ?? "";
        const nx2 = w[i + 2] ?? "";

        // --- multi-letter units (longest first) ---
        if (c === "l" && nx === "·" && nx2 === "l") { cons("ɫː"); i += 3; continue; } // l·l geminate
        if (c === "n" && nx === "y") { cons("ɲ"); i += 2; continue; } // ny
        if (c === "l" && nx === "l") { cons("ʎ"); i += 2; continue; } // ll
        if (c === "r" && nx === "r") { cons("r"); i += 2; continue; } // rr → trill
        if (c === "s" && nx === "s") { cons("s"); i += 2; continue; } // ss → s
        if (c === "t" && nx === "x") { cons("t͡ʃ"); i += 2; continue; } // tx → t͡ʃ
        if (c === "t" && nx === "j") { cons("d͡ʒ"); i += 2; continue; } // tj → d͡ʒ
        if (c === "t" && nx === "g" && isFront(nx2)) { cons("d͡ʒ"); i += 2; continue; } // tg(e/i) → d͡ʒ
        if (c === "t" && nx === "z") { cons("d͡z"); i += 2; continue; } // tz → d͡z
        // consonant-preceded final ⟨ig⟩ → i + t͡ʃ (mig → mit͡ʃ, desig → dəzit͡ʃ): here the ⟨i⟩ IS a nucleus.
        // (Vowel-preceded ⟨ig⟩ like maig → mat͡ʃ, where the i is silent, is handled in the vowel-run block.)
        if (c === "i" && nx === "g" && i + 2 === n) {
            segs.push({ ph: V["i"]!.stressed, nucleus: true, accent: false, reduced: V["i"]!.reduced });
            cons("t͡ʃ"); i += 2; continue;
        }
        if (c === "q" && nx === "u") { cons("k"); if (nx2 === "a" || nx2 === "o" || nx2 === "ü") cons("w"); i += 2; continue; }
        if (c === "g" && nx === "u" && isFront(nx2)) { cons("ɡ"); i += 2; continue; } // gue/gui → ɡ (u silent)
        if (c === "g" && nx === "ü") { cons("ɡ"); cons("w"); i += 2; continue; } // güe/güi → ɡw
        if (c === "q" && nx === "ü") { cons("k"); cons("w"); i += 2; continue; }

        // --- vowel run → nuclei + glides ---
        if (isVowel(c)) {
            let j = i;
            while (j < n && isVowel(w[j]!)) j++;
            // ⟨ix⟩ after a vowel: the i is a silent digraph marker for ʃ (caixa → kaʃə); word-final ⟨ig⟩ after a
            // vowel → t͡ʃ (maig → mat͡ʃ, puig → put͡ʃ). In both the trailing plain ⟨i⟩ is silent, not a glide.
            let runEnd = j;
            const igFinal = w[j] === "g" && w[j - 1] === "i" && j + 1 === n && j - 1 > i;
            if (w[j] === "x" && w[j - 1] === "i" && j - 1 > i) runEnd = j - 1; // x→ʃ handled by the main loop (i=j)
            else if (igFinal) runEnd = j - 1;
            const run = w.slice(i, runEnd);
            const nuc = classifyRun(run, i === 0);
            [...run].forEach((vc, k) => {
                const real = V[vc]!;
                if (nuc[k]) segs.push({ ph: real.stressed, nucleus: true, accent: isAccented(vc), reduced: real.reduced });
                else cons(vc === "i" || vc === "í" ? "j" : "w"); // glide (on- or off-): i→j, u→w
            });
            if (igFinal) { cons("t͡ʃ"); i = n; continue; } // consume the silent i + g
            i = j;
            continue;
        }

        // --- single consonants ---
        switch (c) {
            case "b": case "v": cons("b"); break; // betacism + spirantized downstream
            case "c": cons(isFront(nx) ? "s" : "k"); break;
            case "ç": cons("s"); break;
            case "d": cons("d"); break;
            case "f": cons("f"); break;
            case "g": cons(isFront(nx) ? "ʒ" : "ɡ"); break;
            case "h": break; // silent
            case "j": cons("ʒ"); break;
            case "k": cons("k"); break;
            case "l": cons("ɫ"); break;
            case "m": cons("m"); break;
            case "n": cons("n"); break;
            case "p": cons("p"); break;
            case "r": { const p = lastPh(); cons(segs.length === 0 || p === "n" || p === "ɫ" || p === "s" ? "r" : "ɾ"); break; } // trill: initial / after n·l·s
            case "s": {
                const prevSeg = segs[segs.length - 1];
                // intervocalic s → z (casa → kazə); a preceding glide j/w counts as the left vowel too (pausa → pawzə)
                const prevVocalic = prevSeg !== undefined && (prevSeg.nucleus || prevSeg.ph === "j" || prevSeg.ph === "w");
                cons(prevVocalic && isVowel(nx) ? "z" : "s");
                break;
            }
            case "t": cons("t"); break;
            case "w": cons("w"); break;
            case "x": cons(segs.length === 0 ? "ʃ" : "ʃ"); break; // ⟨x⟩ → ʃ (initial + most; ks/ɡz learned = residual)
            case "y": cons("j"); break;
            case "z": cons("z"); break;
            default: if (/[a-zç]/.test(c)) cons(c); break; // unknown letter: pass through
        }
        i++;
    }
    return segs;
}
