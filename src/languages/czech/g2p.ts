/**
 * Czech (cs) grapheme→phoneme engine — West Slavic, Latin script, canonical IPA. Czech
 * orthography is fairly phonemic but with three context systems handled here:
 *   - palatalisation: d/t/n → ɟ/c/ɲ before i, í, ě (NOT before y, ý, e): divadlo→ɟɪvadlo, ticho→cɪxo; but
 *     typ→tɪp, den→dɛn.
 *   - ⟨ě⟩: after d/t/n it palatalises the consonant and is plain ɛ (děti→ɟɛcɪ); after m it is mɲɛ (měl→mɲɛl);
 *     after a labial b/p/v/f it is jɛ (běh→bjɛx); else ɛ.
 *   - voicing assimilation: regressive within obstruent clusters + word-final devoicing (led→lɛt, kde→ɡdɛ,
 *     prosba→prozba, vstup→fstup). v is a target (→f) but does NOT trigger voicing (svět→svjɛt); ř has a
 *     voiceless form r̝̊.
 * Vowels short a e i/y o u → a ɛ ɪ o u, long á é í/ý ó ú/ů → aː ɛː iː oː uː; diphthong ou → oᶷ. Syllabic r̩/l̩
 * between consonants (krk→kr̩k, vlk→vl̩k). Stress (first-syllable) is applied in czech.ts.
 */

import { MANIFEST } from "./manifest.ts";

// All Czech DATA — vowel/consonant maps, palatalisation table, voicing-assimilation pairs — is consolidated in
// czech.jsonc; here we bind it to the readable local names the parsing algorithm below uses.
const VOWEL = MANIFEST.vowels;
const PALAT = MANIFEST.palatalisation.map;
const PALAT_TRIGGER = new Set(MANIFEST.palatalisation.triggers); // d/t/n palatalise before these
const CONS = MANIFEST.consonants;
const TO_VOICELESS = MANIFEST.voicing.toVoiceless;
const TO_VOICED = MANIFEST.voicing.toVoiced;
const isObstruent = (p: string): boolean => p in TO_VOICELESS || p in TO_VOICED;
const isVoiced = (p: string): boolean => p in TO_VOICELESS; // voiced obstruents are the keys of the devoicing map

export interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Scan Czech orthography into IPA phoneme segments (palatalisation + ě + digraphs), before voicing/syllabicity. */
function scan(word: string): Seg[] {
    const c = [...word.toLowerCase()];
    const segs: Seg[] = [];
    for (let i = 0; i < c.length; i++) {
        const ch = c[i]!,
            next = c[i + 1] ?? "",
            prev = c[i - 1] ?? "";
        // digraph ch → x
        if (ch === "c" && next === "h") {
            segs.push({ ph: "x", nucleus: false });
            i++;
            continue;
        }
        // diphthongs ou/au/eu → oᶷ/aᶷ/ɛᶷ
        if (next === "u" && (ch === "o" || ch === "a" || ch === "e")) {
            segs.push({
                ph: ch === "o" ? "oᶷ" : ch === "a" ? "aᶷ" : "ɛᶷ",
                nucleus: true,
            });
            i++;
            continue;
        }
        // vowel
        if (ch in VOWEL) {
            segs.push({ ph: VOWEL[ch]!, nucleus: true });
            // hiatus: i/í/y/ý before another vowel → a glide j (policie→polɪt͡sɪjɛ, využití→vɪjuʒɪciː)
            if ("iíyý".includes(ch) && (next in VOWEL || next === "ě"))
                segs.push({ ph: "j", nucleus: false });
            continue;
        }
        // ě — realisation depends on the preceding consonant letter
        if (ch === "ě") {
            if (prev === "m")
                segs.push(
                    { ph: "ɲ", nucleus: false },
                    { ph: "ɛ", nucleus: true },
                );
            else if ("bpvf".includes(prev))
                segs.push(
                    { ph: "j", nucleus: false },
                    { ph: "ɛ", nucleus: true },
                );
            else segs.push({ ph: "ɛ", nucleus: true }); // after d/t/n (already palatalised) or default
            continue;
        }
        // d/t/n palatalise before i/í/ě
        if (ch in PALAT && PALAT_TRIGGER.has(next)) {
            segs.push({ ph: PALAT[ch]!, nucleus: false });
            continue;
        }
        if (ch === "x") {
            segs.push({ ph: "k", nucleus: false }, { ph: "s", nucleus: false });
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

/** Regressive voicing assimilation + word-final devoicing, right-to-left over the obstruent clusters. */
function applyVoicing(segs: Seg[]): void {
    for (let i = segs.length - 1; i >= 0; i--) {
        const p = segs[i]!.ph;
        if (!isObstruent(p)) continue;
        const nx = segs[i + 1];
        let target: "voiced" | "voiceless" | null = null;
        if (nx === undefined)
            target = "voiceless"; // word-final devoicing
        else if (nx.ph === "ɦ")
            target = "voiceless"; // before ɦ a voiced obstruent devoices (rozhodně→rosɦodɲɛ)
        else if (
            isObstruent(nx.ph) &&
            nx.ph !== "v" &&
            nx.ph !== "r̝" &&
            nx.ph !== "r̝̊"
        ) {
            // v and ř do not trigger
            target = isVoiced(nx.ph) ? "voiced" : "voiceless";
        } // before a sonorant/vowel: keep base voicing
        if (target === "voiceless" && p in TO_VOICELESS)
            segs[i]!.ph = TO_VOICELESS[p]!;
        else if (target === "voiced" && p in TO_VOICED)
            segs[i]!.ph = TO_VOICED[p]!;
    }
    // ř additionally devoices PROGRESSIVELY after a voiceless consonant (tři→tr̝̊ɪ, přítel→pr̝̊iːtɛl).
    for (let i = 1; i < segs.length; i++) {
        if (segs[i]!.ph === "r̝" && segs[i - 1]!.ph in TO_VOICED)
            segs[i]!.ph = "r̝̊";
    }
}

/** n → ŋ before a velar k/ɡ (venku→vɛŋku, funguje→fuŋɡujɛ). */
function nasalAssim(segs: Seg[]): void {
    for (let i = 0; i < segs.length - 1; i++) {
        if (
            segs[i]!.ph === "n" &&
            (segs[i + 1]!.ph === "k" || segs[i + 1]!.ph === "ɡ")
        )
            segs[i]!.ph = "ŋ";
    }
}

/** Degeminate doubled n → n (činnost→t͡ʃɪnost) and n+ɲ → ɲ (denně→dɛɲɛ). Other geminates are kept (vyšší→vɪʃʃiː). */
function degeminate(segs: Seg[]): void {
    for (let i = segs.length - 1; i > 0; i--) {
        const a = segs[i - 1]!,
            b = segs[i]!;
        if (a.ph === "n" && (b.ph === "n" || b.ph === "ɲ"))
            segs.splice(i - 1, 1);
    }
}

/** Czech word → IPA phoneme segments (scan + syllabic + degemination + voicing + nasal assimilation). */
export function toSegments(word: string): Seg[] {
    const segs = scan(word);
    markSyllabic(segs);
    degeminate(segs);
    applyVoicing(segs);
    nasalAssim(segs);
    return segs;
}
