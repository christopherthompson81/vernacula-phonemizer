/**
 * Georgian / ქართული (ka) phonemizer — Kartvelian, the Mkhedruli script, canonical IPA. Georgia
 * (~4M). Georgian orthography is essentially ONE-LETTER-ONE-PHONEME (a transparent alphabet, no digraphs), so the g2p
 * is a greedy longest-match scan over the 33-letter grapheme table (manifest.ts) + ONE context rule (word-final voiced
 * stop devoicing ბ/დ/გ→pʰ/tʰ/kʰ). Signatures: the
 * three-way stop/affricate contrast VOICED / ASPIRATED / EJECTIVE (ბ b · ფ pʰ · პ pʼ; …), uvulars ღ=ʁ, ხ=χ, ყ=qʼ, and
 * 5 vowels a ɛ i ɔ u. Stress is weak/non-contrastive → not marked. Numbers are VIGESIMAL and composed by
 * numbers.ts (30 = ოცდაათი 20+10, 40 = ორმოცი 2×20, 99 = ოთხმოცდაცხრამეტი 4×20+19).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeGeorgian } from "./normalize.ts";
import { renormalize } from "../../core/provenance.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

// WORD-FINAL DEVOICING: a word-final voiced STOP devoices to its aspirated voiceless counterpart (ბ→pʰ, დ→tʰ, გ→kʰ).
// The ONLY context rule in the Georgian g2p — categorical in the 20,894-word wikipron referee (final ⟨დ⟩→tʰ 1584/1585,
// ⟨ბ⟩→pʰ 100/101, ⟨გ⟩→kʰ 11/12); the voiced fricatives/affricates (ვ ზ ღ ძ ჯ) do NOT devoice finally. Keyed by the
// single output char b/d/ɡ, which can only come from a final ⟨ბ დ გ⟩ (⟨ღ⟩→ʁ, never ɡ).
const FINAL_DEVOICE: Record<string, string> = { b: "pʰ", d: "tʰ", ɡ: "kʰ" };

/** Phonemize a single Georgian word to canonical IPA (segmental + word-final stop devoicing; stress not marked). */
export function phonemizeWord(word: string): string {
    // Mkhedruli is caseless, but Mtavruli titlecase (U+1C90–1CBF, used for all-caps headings) must be lowercased to
    // the Mkhedruli block the table keys on — else those codepoints miss the scan and are silently dropped.
    const w = word.normalize("NFC").toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) {
                out += G[key]!;
                i += key.length;
                matched = true;
                break;
            }
        }
        // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound, and dropping it deletes
        // what the writer typed. Consulted only on the MISS branch, after every grapheme (including every
        // digraph) has been tried, so it can never override a reading this language has an opinion about.
        if (!matched) {
            out += latinPhone(w[i]!, { initial: i === 0, includeH: true }) ?? "";
            i += 1;
        }
    }
    const last = out.at(-1);
    if (last !== undefined && FINAL_DEVOICE[last] !== undefined) out = out.slice(0, -1) + FINAL_DEVOICE[last];
    return out;
}

// A word (Mkhedruli letters) / number / punctuation token. ჻ = the Georgian paragraph separator (sentence pause).
// Georgian SCRIPT only (was \p{L}, which claimed embedded Latin and then phonemized it to nothing —
// a silent drop). Narrowing it lets the shared unclaimed-run pass read Latin as foreign instead.
const TOKEN = /([\p{Script=Georgian}\p{M}]+)|(\d+)|([.!?…,;:჻])/gu;

class GeorgianPhonemizer implements Phonemizer {
    text(input: string): string {
        // NORMALIZE FIRST — a pure text→text pass (normalize.ts) that turns everything the TOKEN below
        // cannot read into Georgian words: the case suffix glued to a figure, the ordinal circumfix, the
        // clock, %, °C, the unit abbreviations, the era markers, currency and the signs. NFC first, because
        // that pass matches Mkhedruli literals and the g2p NFCs anyway.
        return assembleClauses(normalizeGeorgian(renormalize(input, "NFC")), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2]), m[2]).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Georgian phonemizer (greedy g2p + the vigesimal number compositor; stress not marked). */
export function createGeorgian(): Phonemizer {
    return new GeorgianPhonemizer();
}
