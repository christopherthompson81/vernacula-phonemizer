/**
 * Min Dong / Eastern Min (cdo) — Fuzhou dialect (Fuzhounese), Sinitic, tonal (~9M speakers). This phonemizer
 * consumes **Bàng-uâ-cê (BUC / Foochow Romanized)** — the phonemic missionary Latin orthography used by the cdo
 * Wikipedia and historical Bible/press — and converts it to canonical IPA, mirroring the Min Nan direct-Tâi-lô
 * path. The converter (mindong.jsonc): strip the tone diacritic (which identifies the tone) → [initial] + rime
 * → IPA + Chao tone letters.
 *
 * ⚠ BUC FOLLOWS THE MISSIONARY CONVENTION, so the plain stop letters are ASPIRATED: ⟨p t k⟩ = [pʰ tʰ kʰ] and
 * ⟨b d g⟩ = [p t k]. ⟨c⟩ = [t͡s], ⟨ch⟩ = [t͡sʰ], ⟨ng⟩ = [ŋ].
 *
 * SEGMENTAL + CITATION tone, with the 韻變 (rime alternation) MODELLED: each rime has a TIGHT form and, where
 * it alternates, a LOOSE form, selected by the tone register (LOOSE under the acute/circumflex tones 陰去/陰入/
 * 陽去, tight otherwise); the ⟨io⟩-family additionally picks its medial [y]/[u] by the initial place.
 *
 * DEFERRED: the Han front-end (no independent Han→reading dictionary exists — the only source is Wiktionary,
 * which is also the referee's source, so it would be circular), tone sandhi (連讀變調), and initial
 * assimilation (聲母類化).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses, clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { normalizeMinDong } from "./normalize.ts";

interface MinDongDef {
    initials: Record<string, string>;
    rimes: Record<string, string>; // tight (citation) rime → IPA
    rimesLoose: Record<string, string>; // the LOOSE 韻變 variant, for rimes that alternate
    ioFamily: Record<string, string>; // ⟨io/iong/iok/ioh⟩ keyed "rime|medial|register" (medial by initial place)
    toneMark: Record<string, string>; // combining diacritic (NFD) → tone number
    looseMarks: string[]; // the tone diacritics (acute/circumflex) that select the LOOSE rime register
    toneChao: Record<string, string>; // tone number → Chao contour letters
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<MinDongDef>(import.meta.url, "mindong.jsonc");
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
    // ⚠ `Object.hasOwn`, not `in`: an object LITERAL inherits Object.prototype, so `"constructor" in
    // SYLLABIC_NASAL` was true and this returned a FUNCTION, throwing at `seg.endsWith` one frame up. The
    // manifest records are null-prototype (core/jsonc.ts) — this one is spelled in source, so it needs the
    // guard here.
    if (Object.hasOwn(SYLLABIC_NASAL, base)) return SYLLABIC_NASAL[base]!;
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

/** A BUC word (hyphen/space-joined syllables) → IPA. each syllable keeps its CITATION tone (sandhi
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

// ── Numbers ──────────────────────────────────────────────────────────────────────────────────────────
// Digit runs were dropped entirely (the tokenizer had no (\d+) branch). Min Dong is Sinitic, so the composition is
// the shared Chinese one — myriad grouping with 萬 10⁴ and 億 10⁸, an internal zero spoken as 零 — but UNLIKE
// cantonese.ts/minnan.ts the numerals CANNOT be routed through a Han reading dictionary: cdo has no independent
// Han→reading dict (the only source is Wiktionary, which is this engine's referee → circular; see the module
// header). So the compositor emits BÀNG-UÂ-CÊ words, the engine's own orthography, and the ordinary BUC→IPA
// converter reads them — no IPA is authored here.
//
// Fuzhou specifics encoded below:
//  • a magnitude multiplier of 1 is 蜀 siŏh, not 一 ék (蜀百 siŏh-báh 100, 蜀千 siŏh-chiĕng, 蜀萬 siŏh-uâng,
//    蜀億 siŏh-é); ék is the bare/final unit digit (十一 sék-ék);
//  • a multiplier of 2 is 兩 lâng before 百/千/萬/億 (兩百 lâng-báh, 兩千 lâng-chiĕng) but 二 nê before 十
//    (二十 nê-sék);
//  • ⚠ 百 IS ⟨báh⟩ IN THE NUMBER, NOT ⟨báik⟩ — 八 báik (8) and 百 báh (100) are NOT homophones. See below.
// Source: Wikivoyage "Fuzhou dialect phrasebook" Numbers section (https://en.wikivoyage.org/wiki/Fuzhou_dialect_phrasebook)
// — 0 lìng, 1 ék/蜀 siŏh, 2 nê/兩 lâng, 3 săng, 4 sé, 5 ngô, 6 lĕ̤k, 7 chék, 8 báik, 9 gāu, 10 sék, 11 sék-ék,
// 20 nê-sék, 21 niék-ék, 1000 siŏh-chiĕng, 2000 lâng-chiĕng, 10⁴ siŏh-uâng, 10⁸ siŏh-é.
//
// ⚠ 百 — WHERE THE PHRASEBOOK IS OVERRULED. Wikivoyage gives 100 as *siŏh-báik / 200 *lâng-báik and that is what
// this table shipped. It is the LITERARY reading in the numeral slot. Two independent sources say the number is
// the VERNACULAR ⟨báh⟩:
//  • Wiktionary 百, Eastern Min (Fuzhou): "báh — vernacular ('hundred'); báik — literary ('numerous')" — the gloss
//    itself assigns the counting sense to báh;
//  • cdo.wikipedia's OWN BUC prose, which is the corpus this engine is measured against. Its number articles are
//    decisive: `100` reads "({{Siăng|Cdo-fzho 100 (siŏh-báh).ogg|siŏh báh}}, siŏh báik)" — báh first, with the
//    recorded audio, báik as a parenthesised alternate; `200` reads "lâng-báh" with audio and NO variant; `300`
//    reads "săng-báh" with audio. Corpus-wide `insource:` counts: siŏh-báh 10 / siŏh-báik 2, lâng-báh 2 /
//    lâng-báik 0, báh-uâng 36 / báik-uâng 1 — and that single báik-uâng is 八萬 80 000 ("ô báik-uâng séng-dù …
//    ô lĕ̤k-uâng", 8万/6万 in one sentence), i.e. a hit for 八, not for 百. Zero real counter-examples.
// So the VERNACULAR báh is the number and the LITERARY báik is not conditioned by any context this compositor can
// see (the two live siŏh-báik hits are 一百年 in running prose, free variation, not a rule). 八 keeps báik.
// This is also what the normalization layer already assumes: it inserts 百分之 as ⟨báh-hŭng-cĭ⟩, so before this
// fix one engine read 百 two different ways depending on which path reached it.
// JUDGMENT CALLS: (a) the phrasebook leaves 30–90 blank — they are composed unit+sék on the attested
// 二十 nê-sék pattern; (b) 20 is composed as the counting form 二十 nê-sék rather than the counter-word form 廿 niék,
// which the phrasebook says is used with classifiers.
const BUC_DIGITS = ["lìng", "ék", "nê", "săng", "sé", "ngô", "lĕ̤k", "chék", "báik", "gāu"];
const BUC_SMALL = ["", "sék", "báh", "chiĕng"]; // 10¹ 十 · 10² 百 (VERNACULAR báh — see above) · 10³ 千
const BUC_MYRIAD = "uâng"; // 萬 10⁴
const BUC_YI = "é"; // 億 10⁸

/** The multiplier form of a digit before the magnitude at power `p`: 1 → 蜀 siŏh, 2 → 兩 lâng (but 二 nê before 十). */
function bucMultiplier(unit: number, p: number): string {
    if (p === 0) return BUC_DIGITS[unit]!;
    if (unit === 1) return "siŏh";
    if (unit === 2 && p >= 2) return "lâng";
    return BUC_DIGITS[unit]!;
}

/** 1…9999 → BUC syllables (an internal zero becomes 零 lìng; a leading 一十 is the bare sék). */
function bucUnder10000(n: number): string[] {
    const out: string[] = [];
    let zero = false;
    for (let p = 3; p >= 0; p--) {
        const unit = Math.floor(n / 10 ** p) % 10;
        if (unit === 0) {
            if (out.length) zero = true;
            continue;
        }
        if (zero) out.push(BUC_DIGITS[0]!);
        zero = false;
        if (p === 1 && unit === 1 && !out.length) out.push(BUC_SMALL[1]!); // leading 一十 → 十 sék
        else out.push(bucMultiplier(unit, p), ...(p > 0 ? [BUC_SMALL[p]!] : []));
    }
    return out;
}

/** An integer → the ordered Bàng-uâ-cê number words that speak it (myriad grouping 萬/億). */
export function numberToBucWords(n: number, raw?: string): string[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => BUC_DIGITS[Number(d)]!);
    }
    if (n === 0) return [BUC_DIGITS[0]!];
    const yi = Math.floor(n / 1_0000_0000);
    const wan = Math.floor((n % 1_0000_0000) / 10000);
    const rest = n % 10000;
    const out: string[] = [];
    // A bare 1 / 2 multiplying 萬 or 億 takes the same 蜀 siŏh / 兩 lâng forms as before 百/千 (蜀萬, 蜀億).
    const group = (q: number): string[] => (q === 1 || q === 2 ? [bucMultiplier(q, 2)] : bucUnder10000(q));
    if (yi) out.push(...(yi < 10000 ? group(yi) : numberToBucWords(yi)), BUC_YI);
    if (wan) out.push(...group(wan), BUC_MYRIAD);
    if (rest) {
        if ((yi || wan) && rest < 1000) out.push(BUC_DIGITS[0]!);
        out.push(...bucUnder10000(rest));
    }
    return out;
}

class MinDongPhonemizer implements Phonemizer {
    text(input: string): string {
        // NFD so a syllable is a base letter + trailing combining marks (tone diacritics U+0300–036F + the quality
        // diaeresis-below U+0324) — robust to NFC input, where precomposed vowels (ā, and esp. ṳ = U+1E73) are single
        // codepoints a literal class would miss. Syllables join by - or ·. bucToIpa re-NFDs (idempotent).
        const tok = /([a-zŋ][a-zŋ\u0300-\u036f\u207f]*(?:[-·][a-zŋ\u0300-\u036f\u207f]*)*)|(\d+)|([。，、？！；：.,?!;:])/giu;
        // `assembleClauses` over the NFD copy — this loop was already that shape and only predated the
        // helper, so it never got the GAP PASS and any script it does not claim was dropped. Min Dong is
        // written in a LATIN romanisation (BUC), so its own token class is Latin; the gap pass therefore
        // matters here for Han and every other script, routed via core/scripts.ts.
        // ⚠ NORMALIZATION RUNS FIRST AND THE NFD FOLD RUNS AFTER IT, in that order. The layer INSERTS BUC
        // words (`dô`, `gáu`, `báh-hŭng-cĭ`), which are written NFC in the source file; folding first would
        // leave those insertions in NFC inside an otherwise-NFD string and the tokenizer's combining-mark
        // class would truncate them — the same precomposed-⟨ṳ⟩ hazard the test below pins. Folding last
        // means a word this layer inserts is tokenized exactly like one the corpus wrote.
        const nfd = normalizeMinDong(input).normalize("NFD");
        return assembleClauses(nfd, tok, (m, sink) => {
            if (m[1]) sink.emit(bucToIpa(m[1]));
            else if (m[2]) sink.emit(bucToIpa(numberToBucWords(Number(m[2]), m[2]).join("-")));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Min Dong (Fuzhou) phonemizer — BUC → IPA (segmental + citation tone; Han front-end deferred). */
export function createMinDong(): Phonemizer {
    return new MinDongPhonemizer();
}

/** Bare BUC word → IPA (tests / referee eval). */
export function phonemizeWord(word: string): string {
    return bucToIpa(word);
}
