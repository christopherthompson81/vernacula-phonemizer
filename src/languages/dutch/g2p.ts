/**
 * Dutch (Northern Standard) grapheme→phoneme engine. Latin, largely rule-governed. Handles the open/closed
 * syllable vowel-length system (tense in an open syllable, lax in a closed one), the Dutch diphthongs
 * (ij/ei→ɛi̯, ui→œy̯, ou/au→ɑu̯, eu→øː, oe→u), the g→ɣ (onset) / x (coda) split, sch→sx, w→ʋ, h→ɦ, and final
 * devoicing (hond→hɔnt, dag→dɑx). Stress is added downstream (dutch.ts). See
 * docs/investigations/nl_native_bringup_investigation.md.
 */
import { MANIFEST } from "./manifest.ts";

const LONG = MANIFEST.vowels.long;
const SHORT = MANIFEST.vowels.short;
const CONS = MANIFEST.consonants;
const VOICED_FINAL = MANIFEST.voicedFinal;

// Plain + trema vowel letters. The trema letters (ë ï ö ü) are vowels but never combine with a preceding vowel
// into a digraph (the scanner's digraph tests only match the plain letters), so ⟨tweeën⟩ scans twe·e·ën.
const VOWELS = "aeiouyáéíóúàèäëïöü";
const isV = (c: string): boolean => c !== "" && VOWELS.includes(c);
const isLiquid = (c: string): boolean => c === "l" || c === "r";

export interface Seg {
    ph: string;
    s: number;
    vowel: boolean;
}

/** Number of consonant letters from index j up to the next vowel or word end. */
function consRun(w: string, j: number): number {
    let n = 0;
    while (j < w.length && !isV(w[j]!)) {
        n++;
        j++;
    }
    return n;
}

/** Is the single vowel at index i in an OPEN syllable (→ tense/long)? Open = word-final (ja, nu), a hiatus
 *  vowel (open), or a single consonant followed by another vowel (wa·ter → aː). Closed (VC#, VCC → lax): dag→ɑ,
 *  man→ɑ, kort→ɔ. Doubled vowels (aa/ee/oo/uu) are handled before this is called (always long). */
function isOpen(w: string, i: number): boolean {
    const run = consRun(w, i + 1);
    if (run === 0) return true; // word-final vowel, or hiatus (na·ïef, ze·e) → open
    if (run === 1) return isV(w[i + 2] ?? ""); // V.CV (open) vs VC# (closed)
    return false; // VCC… → closed
}

/** Scan a lowercased Dutch word into IPA segments (no stress; g/ch voicing, devoicing applied here). */
export function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const n = w.length;
    const segs: Seg[] = [];
    let i = 0;
    const push = (ph: string, s: number, vowel = false): void => {
        segs.push({ ph, s, vowel });
    };

    while (i < n) {
        const c = w[i]!,
            nx = w[i + 1] ?? "",
            nx2 = w[i + 2] ?? "",
            nx3 = w[i + 3] ?? "";
        const seenVowel = segs.some((s) => s.vowel);

        // ── Unstressed native suffixes (reduce their vowel). Gated so stressed monosyllables are untouched. ──
        if (c === "l" && nx === "i" && nx2 === "j" && nx3 === "k" && i > 0) {
            // -lijk suffix (mogelijk → …lək): ⟨ij⟩ → ə. Word-initial ⟨lijk⟩ (the noun "corpse" → lɛi̯k) is excluded
            // by i>0. Matches -lijk / -lijke / -lijkheid (only the ⟨lijk⟩ span is consumed).
            push("l", i);
            push("ə", i, true);
            push("k", i);
            i += 4;
            continue;
        }

        // ── Glide-final vowel sequences (longest first). A ⟨w⟩ closing an u-glide diphthong is absorbed. ──
        if (c === "i" && nx === "e" && nx2 === "u" && nx3 === "w") {
            push("i", i, true);
            push("u̯", i);
            i += 4;
            continue;
        } // ieuw → iu̯ (nieuw)
        if (c === "e" && nx === "e" && nx2 === "u" && nx3 === "w") {
            push("eː", i, true);
            push("u̯", i);
            i += 4;
            continue;
        } // eeuw → eːu̯ (leeuw)
        if (c === "a" && nx === "a" && nx2 === "i") {
            push("aː", i, true);
            push("i̯", i);
            i += 3;
            continue;
        } // aai → aːi̯ (draai)
        if (c === "o" && nx === "o" && nx2 === "i") {
            push("oː", i, true);
            push("i̯", i);
            i += 3;
            continue;
        } // ooi → oːi̯ (mooi)
        if (c === "o" && nx === "e" && nx2 === "i") {
            push("u", i, true);
            push("i̯", i);
            i += 3;
            continue;
        } // oei → ui̯ (moeite)

        // ── Two-letter vowel digraphs. ──
        if (c === "i" && (nx === "j" || nx === "e") && !(nx === "e" && isV(nx2))) {
            // ij / ei-less i... ⟨ij⟩ → ɛi̯; ⟨ie⟩ → i (long). ⟨ie⟩ before another vowel (Italië) is i + hiatus, but
            // word-medial ⟨ie⟩ stays i here (the following vowel is a separate nucleus).
            if (nx === "j") {
                push("ɛi̯", i, true);
                i += 2;
                continue;
            }
            push("i", i, true);
            i += 2;
            continue;
        } // ij → ɛi̯ ; ie → i
        if ((c === "e" || c === "a") && nx === "i") {
            push("ɛi̯", i, true);
            i += 2;
            continue;
        } // ei / aai-less ai → ɛi̯ (klein; ⟨ai⟩ loans → ɛi̯)
        if (c === "u" && nx === "i") {
            push("œy̯", i, true);
            i += 2;
            continue;
        } // ui → œy̯ (huis)
        if ((c === "o" || c === "a") && nx === "u") {
            push("ɑu̯", i, true);
            i += nx2 === "w" ? 3 : 2; // ⟨ouw⟩/⟨auw⟩ → ɑu̯ (the closing w is absorbed: vrouw → vrɑu̯)
            continue;
        } // ou / au → ɑu̯ (koud, auto)
        if (c === "e" && nx === "u") {
            push("øː", i, true);
            i += 2;
            continue;
        } // eu → øː (deur)
        if (c === "o" && nx === "e") {
            push("u", i, true);
            i += 2;
            continue;
        } // oe → u (boek)
        // Doubled vowel → one long/tense vowel (aa/ee/oo/uu).
        if (nx === c && "aeou".includes(c)) {
            push(LONG[c]!, i, true);
            i += 2;
            continue;
        }

        // ── Consonant digraphs / context. ──
        if (c === "s" && nx === "c" && nx2 === "h") {
            // sch → sx before a vowel (school → sxoːl, schip); word-final / before a consonant → s (typisch → …is,
            // mensch). The ⟨s⟩ + separate ⟨ch⟩ (this ⟨sch⟩) is the Dutch trigraph.
            if (isV(nx3)) {
                push("s", i);
                push("x", i);
            } else {
                push("s", i);
            }
            i += 3;
            continue;
        }
        if (c === "c" && nx === "h") {
            push("x", i);
            i += 2;
            continue;
        } // ch → x (acht, licht, lachen)
        if (c === "n" && nx === "g") {
            push("ŋ", i);
            i += 2;
            continue;
        } // ng → ŋ (zingen)
        if (c === "n" && nx === "k") {
            push("ŋ", i);
            push("k", i);
            i += 2;
            continue;
        } // nk → ŋk (bank)
        if (c === "t" && nx === "h") {
            push("t", i);
            i += 2;
            continue;
        } // th → t (thee)
        if (c === "d" && nx === "t") {
            push("t", i);
            i += 2;
            continue;
        } // dt → t (Brandt, hij wordt)
        if (c === "p" && nx === "h") {
            push("f", i);
            i += 2;
            continue;
        } // ph → f (loan)
        if (c === "q" && nx === "u") {
            push("k", i);
            push("ʋ", i);
            i += 2;
            continue;
        } // qu → kʋ
        if (c === "s" && nx === "j") {
            push("ʃ", i);
            i += 2;
            continue;
        } // sj → ʃ (sjaal, meisje)

        // ── Vowels (single letter). ──
        if (isV(c)) {
            // Word-final unstressed -ig suffix → əx (twintig → tʋɪntəx, gelukkig → …kəx). Gated on seenVowel so a
            // stressed monosyllable (big → bɪx, twijg) — where ⟨i⟩ is the first nucleus — keeps its full lax vowel.
            if (c === "i" && nx === "g" && nx2 === "" && seenVowel) {
                push("ə", i, true);
                push("x", i);
                i += 2;
                continue;
            }
            // Word-final Latinate -isch → is (tense ⟨i⟩ + s; the ⟨ch⟩ is silent): typisch → tipis, logisch → loːxis.
            if (c === "i" && nx === "s" && nx2 === "c" && nx3 === "h" && i + 4 === n) {
                push("i", i, true);
                push("s", i);
                i += 4;
                continue;
            }
            // A single ⟨e⟩ that is NOT the first vowel nucleus reduces to schwa (Dutch default stress is initial:
            // water → ʋaːtər, achterbos → ɑxtərbɔs, zeven → zeːvə, de → də). The ⟨ee/ei/eu/ie⟩ digraphs and the
            // stressed first ⟨e⟩ (eten → eːtə) are consumed earlier, so they keep their full quality. Non-initial
            // FULL-vowel ⟨e⟩ (loanword second-syllable stress, protest → proːtɛst) is the minority residual.
            if (c === "e" && seenVowel) {
                push("ə", i, true);
                i++;
                continue;
            }
            // Trema/accented letters and plain vowels use the open/closed length rule.
            const base = "áàä".includes(c) ? "a"
                : "éèë".includes(c) ? "e"
                : "íìï".includes(c) ? "i"
                : "óò".includes(c) ? "o"
                : "úù".includes(c) ? "u"
                : c;
            const long = LONG[base] ?? LONG[c] ?? "";
            const short = SHORT[base] ?? SHORT[c] ?? "";
            push(isOpen(w, i) ? long : short, i, true);
            i++;
            continue;
        }

        // ── Context-dependent consonants. ──
        if (c === "g") {
            // g → ɣ in the onset (before a vowel, or a liquid + vowel: geven→ɣ, groot→ɣr); → x in a coda
            // (dag→dɑx, magd, zorgt). ⟨gg⟩ → ɣ (zeggen → zɛɣə). Final devoicing already covered by the coda→x here.
            const onset = isV(nx) || (nx === "g" && isV(nx2)) || (isLiquid(nx) && isV(nx2));
            push(onset ? "ɣ" : "x", i);
            if (nx === "g") i++; // gg → single
            i++;
            continue;
        }
        if (c === "c") {
            push("eiyíé".includes(nx) ? "s" : "k", i);
            i++;
            continue;
        } // c → s before e/i/y, else k
        if (c === "h") {
            push("ɦ", i);
            i++;
            continue;
        } // h → ɦ (voiced glottal). Silent-h after a vowel (thee already handled via th) is rare; kept as onset.
        if (c === "x") {
            push("k", i);
            push("s", i);
            i++;
            continue;
        } // x → ks
        if (c === "r" && nx === "r") {
            i++;
            continue;
        } // rr → single r (falls through to the r switch next iteration)

        const cp = CONS[c];
        if (cp !== undefined) push(cp, i);
        i++;
    }

    // Collapse doubled consonants (Dutch writes them only to mark a short vowel: bakken→bɑkə, zeggen handled).
    const out: Seg[] = [];
    for (const s of segs) {
        const prev = out[out.length - 1];
        if (prev && !prev.vowel && !s.vowel && prev.ph === s.ph && s.ph.length === 1) continue;
        out.push(s);
    }
    finalDevoice(out);
    return out;
}

/** Auslautverhärtung: a voiced obstruent that is word-final or before a voiceless consonant devoices. */
function finalDevoice(segs: Seg[]): void {
    for (let k = 0; k < segs.length; k++) {
        const s = segs[k]!;
        const dev = VOICED_FINAL[s.ph];
        if (!dev) continue;
        const next = segs[k + 1];
        // Devoice a coda voiced obstruent word-finally, before a voiceless obstruent, or before another voiced
        // obstruent that will itself devoice (the whole coda cluster devoices). Before a sonorant/vowel it is an
        // onset and stays voiced (bever, adem).
        if (
            !next ||
            (!next.vowel &&
                ("ptksfxʃ".includes(next.ph[0] ?? "") || VOICED_FINAL[next.ph]))
        )
            s.ph = dev;
    }
}
