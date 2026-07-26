/**
 * Min Dong / Eastern Min (cdo) — Fuzhou dialect (Fuzhounese), Sinitic, tonal (~9M speakers), the only major Sinitic
 * branch otherwise absent from the fleet. This phonemizer consumes **Bàng-uâ-cê (BUC / Foochow Romanized)** — the
 * phonemic missionary Latin orthography (used by the cdo Wikipedia + historical Bible/press) — and converts it to
 * canonical IPA, mirroring the Min Nan (nan) direct-Tâi-lô path. The converter (foochow.jsonc): strip the tone
 * diacritic (identifies the tone) → [initial] + rime → IPA + Chao tone letters. BUC follows the missionary
 * convention where the plain stop letters are ASPIRATED: ⟨p t k⟩ = [pʰ tʰ kʰ], ⟨b d g⟩ = [p t k]; ⟨c⟩ = [tsʰ],
 * ⟨z⟩ = [ts]; ⟨ng⟩ = [ŋ].
 *
 * Phase 1 = SEGMENTAL + CITATION tone. The Han front-end is DEFERRED (no independent Han→reading dict exists — the
 * only source is Wiktionary, which is the referee's source → circular). Tone sandhi (連讀變調), initial assimilation
 * (聲母類化), and rime alternation (韻變, the 鬆/緊 tight/loose split) are deferred — the eval folds tones and validates
 * the segmental backbone. Referee: BUC↔IPA pairs from the kaikki Chinese dump (Wiktionary Module:cdo-pron output) →
 * 🔷 reference-implementation parity, not independent human attestation. See docs/investigations/cdo_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface FoochowDef {
    initials: Record<string, string>;
    rimes: Record<string, string>;
    toneMark: Record<string, string>; // combining diacritic (NFD) → tone number
    toneChao: Record<string, string>; // tone number → Chao contour letters
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<FoochowDef>(import.meta.url, "foochow.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Onset consonants tried longest-first so ⟨ng⟩ beats ⟨n⟩+⟨g⟩.
const INITIALS = Object.keys(DEF.initials).sort((a, b) => b.length - a.length);

// A bare initial with no rime is a SYLLABIC NASAL (唔 ng → ŋ̍, m → m̩, n → n̩).
const SYLLABIC_NASAL: Record<string, string> = { m: "m̩", n: "n̩", ng: "ŋ̍" };

/** A toneless BUC base syllable (lowercased, diacritics already stripped) → segmental IPA: [initial] + rime. */
function baseToIpa(base: string): string {
    if (base in SYLLABIC_NASAL) return SYLLABIC_NASAL[base]!;
    let ini = "";
    for (const k of INITIALS)
        if (base.startsWith(k)) { ini = k; break; }
    // A zero-initial syllable begins with a vowel — no onset consumed (take the whole base as the rime).
    const rest = ini && DEF.rimes[base.slice(ini.length)] !== undefined ? base.slice(ini.length) : base;
    const iniIpa = rest === base ? "" : (DEF.initials[ini] ?? "");
    const rimeIpa = DEF.rimes[rest];
    if (rimeIpa === undefined) return base; // unknown rime → leave visible for the residual report
    return iniIpa + rimeIpa;
}

/** One BUC syllable → (segmental IPA, tone number). The tone is carried by a combining diacritic (macron/grave/
 *  acute/circumflex/breve) on a vowel. The CHECKED tones (rime ends in a stop [ʔ]) are the checked counterparts of
 *  the acute/breve categories: acute 陰去 4 → 陰入 6, breve 陰平 1 → 陽入 7. A syllable with no mark defaults to tone 1. */
function syllableParts(syl: string): { seg: string; tone: string } | null {
    const nfd = syl.normalize("NFD");
    let tone = "";
    for (const ch of nfd) if (DEF.toneMark[ch]) tone = DEF.toneMark[ch]!;
    const base = [...nfd].filter((c) => !(c in DEF.toneMark)).join("").normalize("NFC").toLowerCase();
    if (!base) return null;
    const seg = baseToIpa(base);
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
