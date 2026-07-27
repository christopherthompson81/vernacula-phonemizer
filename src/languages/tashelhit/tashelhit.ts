/**
 * Tashelhit / Shilha (shi) — Taclḥit, a Berber (Amazigh) language of SW Morocco (the Souss), ~7–9M. This phonemizer
 * consumes the **Berber Latin alphabet** (the academic/community Latin orthography; Tifinagh + Arabic are the other
 * scripts) and converts it to canonical IPA. The orthography is near-1:1 PHONEMIC, so it is a greedy grapheme scan
 * plus two rules the table can't express:
 *   - LABIALISATION: a consonant followed by ⟨ʷ⟩ (U+02B7) → the labialised [Cʷ] (gʷ→ɡʷ, kʷ→kʷ, xʷ→χʷ);
 *   - GEMINATION: a doubled consonant letter → a LONG consonant [Cː] (phonemic in Berber: kk→kː, ll→lː, ṭṭ→tˤː).
 * Emphatics are pharyngealised (dot-below): ḍ→dˤ, ṭ→tˤ, ṣ→sˤ, ẓ→zˤ, ṛ→rˤ; pharyngeals ḥ→ħ, ɛ→ʕ; uvulars ɣ→ʁ~ɣ,
 * x→χ, q; ⟨c⟩→ʃ, ⟨j⟩→ʒ, ⟨y⟩→j, ⟨e⟩→ə. Validated against wikipron shi_latn + kaikki Tashelhit (both Wiktionary →
 * 🔷 single-source-family, correlated). Vowel-lessness / syllabic consonants are left as-is (Berber allows them).
 * See docs/investigations/shi_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface TashelhitDef {
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<TashelhitDef>(import.meta.url, "tashelhit.jsonc");
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const LABIAL = "ʷ"; // U+02B7 modifier letter small w — the labialisation diacritic in the Berber Latin orthography

/** One Tashelhit (Berber-Latin) word → IPA. Scan graphemes → apply labialisation (C + ⟨ʷ⟩) → collapse a doubled
 *  consonant to a long [Cː] (gemination). Unknown characters are left visible for the residual report. */
function phonemize(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    // 1. grapheme scan → IPA tokens (labialisation ⟨ʷ⟩ merges into the previous token).
    const toks: string[] = [];
    for (const ch of w) {
        if (ch === LABIAL) { if (toks.length) toks[toks.length - 1] += "ʷ"; continue; }
        toks.push(G[ch] ?? ch);
    }
    // 2. gemination: a doubled consonant → one LONG consonant [Cː] (Berber phonemic length). Compare the BASE
    //    consonant (ignoring labialisation/length) so ⟨ggʷ⟩ = ɡ + ɡʷ collapses to a long labialised [ɡʷː] and
    //    ⟨ṭṭ⟩ = tˤ + tˤ → [tˤː]; the length + labial mark are carried onto the single long segment.
    const isVowel = (x: string) => "aiuəo".includes(x);
    const bare = (x: string) => x.replace(/[ʷː]/gu, "");
    const out: string[] = [];
    for (const t of toks) {
        const prev = out.length ? out[out.length - 1]! : undefined;
        if (prev !== undefined && bare(prev) === bare(t) && !isVowel(bare(t))) {
            out[out.length - 1] = bare(t) + ((prev + t).includes("ʷ") ? "ʷ" : "") + "ː";
        } else out.push(t);
    }
    return out.join("");
}

class TashelhitPhonemizer implements Phonemizer {
    text(input: string): string {
        const { sink, finish } = clauseSink();
        // NFC first so a precomposed regex class matches emphatics even on NFD input (combining dot-below U+0323
        // would otherwise shatter the word); phonemize() re-NFCs (idempotent). The class also allows the combining
        // dot-below/marks (U+0300–036F) defensively for any letter without a precomposed form.
        const nfc = input.normalize("NFC");
        const tok = /([a-zɣġšžčɛḍṭṣẓṛḥḷṇʷ̀-ͯA-ZƔĠŠŽČƐḌṬṢẒṚḤḶṆ]+)|([.,?!;:،؟])/gu;
        let m: RegExpExecArray | null;
        while ((m = tok.exec(nfc))) {
            if (m[1]) sink.emit(phonemize(m[1]));
            else if (m[2]) {
                const mk = CLAUSE_MARK[m[2]];
                if (mk) sink.pause(mk);
            }
        }
        return finish();
    }
}

/** Build the Tashelhit (Shilha) phonemizer — Berber Latin → IPA (segmental; gemination + labialisation modelled). */
export function createTashelhit(): Phonemizer {
    return new TashelhitPhonemizer();
}

/** Bare word → IPA (tests / referee eval). */
export function phonemizeWord(word: string): string {
    return phonemize(word);
}
