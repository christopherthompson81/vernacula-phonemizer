/**
 * Tashelhit / Shilha (shi) — Taclḥit, a Berber (Amazigh) language of SW Morocco (the Souss), ~7–9M. This phonemizer
 * consumes BOTH community scripts — the **Berber Latin alphabet** AND **Neo-Tifinagh** (ⵜⵉⴼⵉⵏⴰⵖ, Morocco's
 * constitutionally-official IRCAM script) — auto-detecting per word by codepoint (Tifinagh is U+2D30–2D7F). Both are
 * phonemic alphabets for the same language, so they yield IDENTICAL IPA (validated 500/500 self-consistent). (The
 * Arabic manuscript script is deferred — a defective non-standard abjad.) The orthography is near-1:1 PHONEMIC, so it
 * is a greedy grapheme scan plus two rules the table can't express:
 *   - LABIALISATION: a consonant followed by ⟨ʷ⟩ (U+02B7) → the labialised [Cʷ] (gʷ→ɡʷ, kʷ→kʷ, xʷ→χʷ);
 *   - GEMINATION: a doubled consonant letter → a LONG consonant [Cː] (phonemic in Berber: kk→kː, ll→lː, ṭṭ→tˤː).
 * Emphatics are pharyngealised (dot-below): ḍ→dˤ, ṭ→tˤ, ṣ→sˤ, ẓ→zˤ, ṛ→rˤ; pharyngeals ḥ→ħ, ɛ→ʕ; uvulars ɣ→ʁ~ɣ,
 * x→χ, q; ⟨c⟩→ʃ, ⟨j⟩→ʒ, ⟨y⟩→j, ⟨e⟩→ə. Validated against wikipron shi_latn + kaikki Tashelhit (both Wiktionary →
 * 🔷 single-source-family, correlated). Vowel-lessness / syllabic consonants are left as-is (Berber allows them).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses, clauseSink } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords, readDigits } from "./numbers.ts";

interface TashelhitDef {
    graphemes: Record<string, string>; // Berber Latin alphabet → IPA
    tifinagh: Record<string, string>; // Neo-Tifinagh (IRCAM) letter → IPA (same phonemes; the official Moroccan script)
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<TashelhitDef>(import.meta.url, "tashelhit.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// The labialisation marker differs by script: Latin ⟨ʷ⟩ (U+02B7) vs Tifinagh ⵯ Tamatart (U+2D6F).
const isTifinagh = (ch: string) => { const c = ch.codePointAt(0)!; return c >= 0x2d30 && c <= 0x2d7f; };

/** One Tashelhit word → IPA, script auto-detected (Berber Latin OR Neo-Tifinagh — two spellings of the same
 *  phonemic system, so identical IPA). Scan graphemes → apply labialisation (C + the script's labial marker) →
 *  collapse a doubled consonant to a long [Cː] (gemination). Unknown characters are left visible. */
function phonemize(word: string): string {
    const tif = [...word].some(isTifinagh);
    const G = tif ? DEF.tifinagh : DEF.graphemes;
    const LABIAL = tif ? "ⵯ" : "ʷ"; // Tifinagh Tamatart (U+2D6F) vs Latin ⟨ʷ⟩
    const w = tif ? word : word.normalize("NFC").toLowerCase(); // Tifinagh is caseless + already atomic
    // 1. grapheme scan → IPA tokens (the labialisation marker merges into the previous token).
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
        // `assembleClauses` rather than a private exec loop: this loop was already that shape and only
        // predated the shared helper, so it never got the GAP PASS and a run in a script it does not claim
        // was dropped outright. Routed by core/scripts.ts.
                // NFC first so a precomposed regex class matches emphatics even on NFD input (combining dot-below U+0323
        // would otherwise shatter the word); phonemize() re-NFCs (idempotent). The class also allows the combining
        // dot-below/marks (U+0300–036F) defensively for any letter without a precomposed form.
        const nfc = input.normalize("NFC");
        // Latin (with emphatic dot-below + combining marks) OR Tifinagh LETTERS (U+2D30–2D6F, incl. the Tamatart
        // labial ⵯ) — one word class; the Tifinagh separator ⵰ (U+2D70) is punctuation, not a letter.
        // A DIGIT group was missing entirely, so numbers used to be dropped silently; ٠-٩ (Arabic-Indic) are
        // accepted alongside 0-9 because Moroccan text mixes them.
        // ⚠ The word class is the SCRIPTS (Latin + Tifinagh), not a letter list — see core/hostWord.ts.
        const tok = new RegExp(
            `(${hostWordRun(["Latin", "Tifinagh"])})|([0-9٠-٩]+)|([.,?!;:،؟⵰])`,
            "gu",
        );

        return assembleClauses(nfc, tok, (m, sink) => {
            if (m[1]) sink.emit(phonemize(nat(m[1])));
            else if (m[2]) {
                const d = [...m[2]].map((c) => (c >= "٠" && c <= "٩" ? String(c.codePointAt(0)! - 0x0660) : c)).join("");
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string.
                const words = d.length <= 12 ? numberToWords(Number(d)) : readDigits(d);
                for (const wd of words.split(" ")) sink.emit(phonemize(wd));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
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

/**
 * This language's OWN inventory — the token word class as it stood before the widening above, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it is no longer also
 * deciding where the script boundary falls.
 */
const NATIVE_CLASS = "[a-zɣġšžčɛḍṭṣẓṛḥḷṇʷ̀-ͯⴰ-ⵯA-ZƔĠŠŽČƐḌṬṢẒṚḤḶṆ]";
const nat = makeNativiser(NATIVE_CLASS, "u");
