/**
 * Bambara / Bamanankan cardinal number → words. DECIMAL, with two lexicalised irregularities that rule out the
 * shared `westernNumberWords`: 10 tan and 20 mugan are unrelated to the bi- tens series, and every magnitude
 * word takes a FOLLOWING multiplier (kɛmɛ fila = 100×2) while 100 itself is the bare kɛmɛ —
 *   0–9    fu, kelen, fila, saba, naani, duuru, wɔɔrɔ, wolonwula, segin, kɔnɔntɔn
 *   10, 20 tan, mugan (both lexical, NOT bi-derived)
 *   30–90  bi- + unit, written solid: bisaba, binaani, biduuru, biwɔɔrɔ, biwolonwula, bisegin, bikɔnɔntɔn
 *   11–99  TENS ni UNIT (tan ni kelen 11, mugan ni kelen 21, bisaba ni fila 32) — ni 'and'
 *   100s   kɛmɛ (100) / kɛmɛ + multiplier (kɛmɛ fila 200); 1000s ba + multiplier (ba kelen 1000)
 * Bambara is NOT quinary: 6–9 are opaque monomorphemic stems (wɔɔrɔ, wolonwula, segin, kɔnɔntɔn), so unlike
 * its Atlantic neighbours Wolof/Fula there is no 5+n formation to model. It is NOT vigesimal either, despite
 * the areal reputation of Mande numeral systems: tan/mugan are a lexical fossil, but bi- is ×10 everywhere —
 * Bamadaba glosses bisaba/biwɔɔrɔ/bikɔnɔntɔn as trente/soixante/quatre-vingt.dix, An ka taa glosses bì as
 * "numerical marker for a set of TEN", and bm.wikipedia writes 66 as `biwɔɔrɔ ni wɔɔrɔ (66)`. No base-20 branch.
 *
 * SOURCES (authored DATA — every form attested, none reconstructed):
 *   [c] Bamadaba, Dictionnaire électronique bambara-français (Bailleul, Dictionnaire Bambara-Français 3e éd.
 *       2007, re-arranged and variant-standardised 2010–2020 by the Corpus Bambara de Référence group:
 *       Vydrin, Davydov, Erman, Maslinsky, Méric) — cormand.huma-num.fr, 11,489 toolbox records, CC BY-NC-SA.
 *       THE authority here: tone-marked, corpus-driven, and it distinguishes the homographs the untoned
 *       orthography merges. Every literal below is its \lx headword.
 *   [c] An ka taa Manding–English–French dictionary (dictionary.ankataa.com) — the variant lists, and the
 *       gloss of the tens prefix bì as a marker "for a set of ten".
 *   [c] Omniglot, "Numbers in Bambara (Bamanankan)" — the doublets (seegin/ségin, bi seegin/bi segi,
 *       waa kelen/ba kelen), and the -na(n) ordinal suffix.
 *   [c] languagesandnumbers.com "Bambara numbers" (bam) — the ni-joined slot order, from its worked 1234.
 *   [c] bm.wikipedia in full (2,359 paragraphs / 430,646 chars) — which glosses its own composition:
 *       `biwɔɔrɔ ni wɔɔrɔ (66)`, `tone ba saba dɔrɔn (3 000 tonnes)`, `tone ba kɛmɛ fila (200 000 tonnes)`,
 *       `mugan ni wolonwula` for the 27 letters of the alphabet, and 1879 spelled out in one 20th-c. birth date.
 *   [c] kasahorow "Bambara Numbers Zero To 20" — fu 'zero' (= Bamadaba \lx fú \ge zéro).
 *
 * WHERE THE SOURCES SPLIT, and how each was decided (docs/investigations/bm_normalization_investigation.md,
 * Runs 5–9 — an earlier revision of this file shipped the losing side of the first four):
 *   8    segin, not seegin.   Bamadaba \lx ségin with \va séegin; An ka taa headword segin. ⚠ Untoned, this
 *        collides with the VERB sègin 'revenir' — a different lexeme by tone, and the reason the corpus's 24
 *        bare `segin` are 23 verbs and one numeral. The count is not the evidence; the headword is.
 *   80   bisegin, not biseegin. Bamadaba \lx bíségin lists NO seegin variant. Corpus: neither form occurs.
 *   90   bikɔnɔntɔn KEEPS its medial n. All four sources agree; bm.wikipedia's `bikɔnɔtɔn` ×2 is a minority
 *        spelling in one repeated construction, and the same wiki writes the UNIT kɔnɔntɔn ×4 with the n.
 *   1000 ba, not waga.  Bamadaba has NO numeral waga — wàga is brousse / rayon de miel / a verb, wága is
 *        panier de kolas. The thousand words are bà (num) and wáa (n); Omniglot lists "waa kelen, ba kelen".
 *        ba over waa because Bamadaba tags bà as num, and because the corpus writes ba ×10 and waa ×0.
 *   10⁶  miliyɔn, not milyɔn. Bamadaba \lx míliyɔn; corpus miliyɔn ×27, milyɔn ×0. (Omniglot/l&n write the
 *        French-shaped mílyɔn, which the corpus-driven lexicon does not carry.)
 *   70   biwolonwula STANDS. It is Bamadaba's headword, with bí.wólonfila as the \va; l&n writes only the
 *        variant. The corpus has one of each and cannot decide it.
 * TRADITIONAL vs MODERN: the inherited decimal system throughout 0–999,999; miliyɔn and miliyari are loans,
 * because Bambara has no inherited numeral above ba. Tone is lexical and unwritten in the standard
 * orthography, so (as everywhere in this engine) the numerals are written untoned.
 * ⚠ espeak ships no Bambara at all, so there is no phonetic cross-check on any of these spellings —
 * the lexica above and bm.wikipedia are the entire evidence base.
 *
 * SCRIPTS: the composer is orthography-level, so it serves BOTH registered scripts — N'Ko digits (߀–߉,
 * U+07C0–07C9) are folded to ASCII by bambara.ts before this runs, and the resulting Latin numerals go through
 * the same g2p the N'Ko path already uses (identical IPA).
 */

const ONES = ["fu", "kelen", "fila", "saba", "naani", "duuru", "wɔɔrɔ", "wolonwula", "segin", "kɔnɔntɔn"];
// Round tens. 10/20 are lexical; 30–90 are the solid bi- + unit derivations.
const TENS: Record<number, string> = {
    1: "tan", 2: "mugan", 3: "bisaba", 4: "binaani", 5: "biduuru",
    6: "biwɔɔrɔ", 7: "biwolonwula", 8: "bisegin", 9: "bikɔnɔntɔn",
};
const NI = "ni"; // additive coordinator between magnitude slots
const HUNDRED = "kɛmɛ";
const THOUSAND = "ba"; // Bamadaba \lx bà \ps num \ge mille (NOT waga, which is brousse)
const MILLION = "miliyɔn";
const MILLIARD = "miliyari"; // Bamadaba \lx míliyari \ge milliard; bm.wikipedia ×5, all with a figure

/** 0–99: lexical tan/mugan + the bi- tens, units added with ni. */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]!} ${NI} ${ONES[u]!}`;
}

/** 1–999: bare kɛmɛ for 100, kɛmɛ + multiplier above it; remainder added with ni. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = h === 1 ? HUNDRED : `${HUNDRED} ${ONES[h]!}`;
    return r === 0 ? head : `${head} ${NI} ${below100(r)}`;
}

/** Non-negative integer → Bambara words; beyond the attested magnitudes (≥ 10¹²) → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) {
        // No attested Bambara numeral above miliyari — read the digits rather than invent a "trillion".
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const head = `${THOUSAND} ${below1000(th)}`; // ba kelen 1000 (the multiplier is kept, unlike kɛmɛ), and
        //                                             the wiki's own `tone ba kɛmɛ fila (200 000 tonnes)` shows
        //                                             that multiplier can be a full 1–999, which below1000 gives.
        return r === 0 ? head : `${head} ${NI} ${below1000(r)}`;
    }
    if (n < 1e9) {
        const m = Math.floor(n / 1e6),
            r = n % 1e6;
        const head = `${MILLION} ${below1000(m)}`; // miliyɔn kelen 1000000
        return r === 0 ? head : `${head} ${NI} ${numberToWords(r)}`;
    }
    const g = Math.floor(n / 1e9),
        r = n % 1e9;
    const head = `${MILLIARD} ${below1000(g)}`; // miliyari kelen 1000000000
    return r === 0 ? head : `${head} ${NI} ${numberToWords(r)}`;
}

/** N'Ko digits ߀–߉ (U+07C0–07C9) → ASCII, so the number branch serves both registered scripts. */
export function foldNkoDigits(s: string): string {
    return [...s].map((ch) => {
        const c = ch.codePointAt(0)!;
        return c >= 0x07c0 && c <= 0x07c9 ? String(c - 0x07c0) : ch;
    }).join("");
}
