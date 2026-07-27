/**
 * Min Dong / Eastern Min (cdo) — Fuzhou dialect (Fuzhounese), Sinitic, tonal (~9M speakers), the only major Sinitic
 * branch otherwise absent from the fleet. This phonemizer consumes **Bàng-uâ-cê (BUC / Foochow Romanized)** — the
 * phonemic missionary Latin orthography (used by the cdo Wikipedia + historical Bible/press) — and converts it to
 * canonical IPA, mirroring the Min Nan (nan) direct-Tâi-lô path. The converter (foochow.jsonc): strip the tone
 * diacritic (identifies the tone) → [initial] + rime → IPA + Chao tone letters. BUC follows the missionary
 * convention where the plain stop letters are ASPIRATED: ⟨p t k⟩ = [pʰ tʰ kʰ], ⟨b d g⟩ = [p t k]; ⟨c⟩ = [t͡s],
 * ⟨ch⟩ = [t͡sʰ]; ⟨ng⟩ = [ŋ].
 *
 * SEGMENTAL + CITATION tone, with the 韻變 (rime alternation) MODELLED: each rime has a TIGHT form and, where it
 * alternates, a LOOSE form, selected by the tone register (LOOSE under the acute/circumflex tones 陰去/陰入/陽去,
 * tight otherwise); the ⟨io⟩-family additionally picks its medial [y]/[u] by the initial place. Still DEFERRED: the
 * Han front-end (no independent Han→reading dict exists — the only source is Wiktionary, the referee's source →
 * circular), tone sandhi (連讀變調), and initial assimilation (聲母類化). The eval folds tones (Chao letters stripped
 * both sides) and validates the segmental backbone. Referee: BUC↔IPA pairs from the kaikki Chinese dump (Wiktionary
 * Module:cdo-pron output) → 🔷 reference-implementation parity, not independent human attestation.
 * See docs/investigations/cdo_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface FoochowDef {
    initials: Record<string, string>;
    rimes: Record<string, string>; // tight (citation) rime → IPA
    rimesLoose: Record<string, string>; // the LOOSE 韻變 variant, for rimes that alternate
    ioFamily: Record<string, string>; // ⟨io/iong/iok/ioh⟩ keyed "rime|medial|register" (medial by initial place)
    toneMark: Record<string, string>; // combining diacritic (NFD) → tone number
    looseMarks: string[]; // the tone diacritics (acute/circumflex) that select the LOOSE rime register
    toneChao: Record<string, string>; // tone number → Chao contour letters
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<FoochowDef>(import.meta.url, "foochow.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Onset consonants tried longest-first so ⟨ng⟩ beats ⟨n⟩+⟨g⟩.
const INITIALS = Object.keys(DEF.initials).sort((a, b) => b.length - a.length);
const LOOSE_MARK = new Set(DEF.looseMarks);
// The ⟨io⟩-family medial is [y] after a velar/laryngeal/zero onset (氣求語喜 + zero), [u] after a coronal/labial.
const VELAR_LARYNGEAL = new Set(["g", "k", "h", "ng", ""]);
const IO_RIMES = new Set(["io", "iong", "iok", "ioh"]);

// A bare initial with no rime is a SYLLABIC NASAL (唔 ng → ŋ̍, m → m̩, n → n̩).
const SYLLABIC_NASAL: Record<string, string> = { m: "m̩", n: "n̩", ng: "ŋ̍" };

/** A toneless BUC base syllable → segmental IPA: [initial] + rime, with the 韻變 register (tight/loose) selecting the
 *  rime variant. `register` is "L" (loose) or "T" (tight), from the tone diacritic (see syllableParts). */
function baseToIpa(base: string, register: "T" | "L"): string {
    if (base in SYLLABIC_NASAL) return SYLLABIC_NASAL[base]!;
    let ini = "";
    for (const k of INITIALS)
        if (base.startsWith(k)) { ini = k; break; }
    // A zero-initial syllable begins with a vowel — no onset consumed (take the whole base as the rime).
    const validRime = (r: string) => DEF.rimes[r] !== undefined || DEF.rimesLoose[r] !== undefined || IO_RIMES.has(r);
    const rest = ini && validRime(base.slice(ini.length)) ? base.slice(ini.length) : base;
    const iniIpa = rest === base ? "" : (DEF.initials[ini] ?? ""); // rest===base ⇒ zero (vowel) onset
    // The ⟨io⟩-family: medial [y]/[u] by the initial place × the 韻變 register.
    if (IO_RIMES.has(rest)) {
        const med = VELAR_LARYNGEAL.has(rest === base ? "" : ini) ? "y" : "u";
        const io = DEF.ioFamily[`${rest}|${med}|${register}`];
        return io === undefined ? base : iniIpa + io;
    }
    // register L → loose form; else tight. A rime that exists ONLY in the loose map (a loose-only spelling seen with
    // a non-loose/absent tone in free text) still falls back to its loose form rather than the raw base.
    const rimeIpa = (register === "L" && DEF.rimesLoose[rest]) || DEF.rimes[rest] || DEF.rimesLoose[rest];
    if (rimeIpa === undefined) return base; // truly unknown rime → leave visible for the residual report
    return iniIpa + rimeIpa;
}

/** One BUC syllable → (segmental IPA, tone number). The tone is a combining diacritic (macron/grave/acute/
 *  circumflex/breve). The 韻變 register is LOOSE for the acute/circumflex tones (陰去/陰入/陽去), tight otherwise. The
 *  CHECKED tones (rime ends [ʔ]) are the checked counterparts: acute 陰去 4 → 陰入 6, breve 陰平 1 → 陽入 7. */
function syllableParts(syl: string): { seg: string; tone: string } | null {
    const nfd = syl.normalize("NFD");
    let tone = "", register: "T" | "L" = "T";
    for (const ch of nfd) if (DEF.toneMark[ch]) { tone = DEF.toneMark[ch]!; if (LOOSE_MARK.has(ch)) register = "L"; }
    const base = [...nfd].filter((c) => !(c in DEF.toneMark)).join("").normalize("NFC").toLowerCase();
    if (!base) return null;
    const seg = baseToIpa(base, register);
    tone = tone || "1";
    if (seg.endsWith("ʔ")) tone = tone === "1" ? "7" : tone === "4" ? "6" : tone; // open→checked counterpart
    return { seg, tone };
}

/** A BUC word (hyphen/space-joined syllables) → IPA. Phase 1: each syllable keeps its CITATION tone (sandhi
 *  deferred), so syllables convert independently and join with a space. */
function bucToIpa(word: string): string {
    return word
        .split(/[-\s·]+/u)
        .filter(Boolean)
        .map(syllableParts)
        .filter((s): s is { seg: string; tone: string } => s !== null)
        .map(({ seg, tone }) => seg + (DEF.toneChao[tone] ?? ""))
        .join(" ");
}

class FoochowPhonemizer implements Phonemizer {
    text(input: string): string {
        const { sink, finish } = clauseSink();
        // NFD so a syllable is a base letter + trailing combining marks (tone diacritics U+0300–036F + the quality
        // diaeresis-below U+0324) — robust to NFC input, where precomposed vowels (ā, and esp. ṳ = U+1E73) are single
        // codepoints a literal class would miss. Syllables join by - or ·. bucToIpa re-NFDs (idempotent).
        const tok = /([a-zŋ][a-zŋ\u0300-\u036f\u207f]*(?:[-·][a-zŋ\u0300-\u036f\u207f]*)*)|([。，、？！；：.,?!;:])/giu;
        const nfd = input.normalize("NFD");
        let m: RegExpExecArray | null;
        while ((m = tok.exec(nfd))) {
            if (m[1]) sink.emit(bucToIpa(m[1]));
            else if (m[2]) {
                const mk = CLAUSE_MARK[m[2]];
                if (mk) sink.pause(mk);
            }
        }
        return finish();
    }
}

/** Build the Min Dong (Fuzhou) phonemizer — BUC → IPA (segmental + citation tone; Han front-end deferred). */
export function createFoochow(): Phonemizer {
    return new FoochowPhonemizer();
}

/** Bare BUC word → IPA (tests / referee eval). */
export function phonemizeWord(word: string): string {
    return bucToIpa(word);
}
