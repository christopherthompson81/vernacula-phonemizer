/**
 * Native Nigerian Pidgin / Naija (pcm) text phonemizer — canonical IPA, espeak-independent. The FIRST
 * English-lexified creole in the project. Targets the English-etymological MEDIA orthography (BBC Pidgin /
 * social media — the norm people actually read and write), NOT the academic phonemic NLA orthography. Two layers:
 *   (1) a LEXICON (naija.jsonc) of high-frequency words whose media spelling is irregular (English-etymological:
 *       dey→dɛ, e→i, make→mek, say→se) or whose mid-vowel quality needs adjudication (comot→kɔmɔt, go→ɡo);
 *   (2) a Naija-phonology RULE g2p for everything else — 7 vowels /i e ɛ a ɔ o u/, TH-stopping (th→t), NO schwa
 *       reduction (full vowels), labial-velars ⟨gb⟩→ɡ͡b ⟨kp⟩→k͡p, ⟨ch⟩→t͡ʃ ⟨sh⟩→ʃ ⟨ny⟩→ɲ ⟨ng⟩→ŋ, ⟨r⟩→ɾ.
 * Because Naija NATIVISES English loans (reads them with Naija values), the rule g2p is applied to English-spelled
 * tokens rather than routing them to the English phonemizer (which is wired as `foreign` but not auto-used —
 * nativising is more correct for the creole). Tone (H/L) is UNMARKED in the media orthography → out of scope
 * (segmental output, no stress/tone marks). No independent referee exists; the anchor is the adjudicated gold in
 * test/naija.test.ts (Faraclas 1996 + NLA). See docs/investigations/pcm_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface NumbersDef {
    units: string[];
    teens: string[];
    tens: string[];
    hundred: string;
    thousand: string;
    million: string;
    billion: string;
    and: string;
}
interface NaijaDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    lexicon: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<NaijaDef>(import.meta.url, "naija.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

/** Dict-only English lookup: the CMUdict-derived citation IPA if the word is known English, else undefined
 *  (an OOV word — likely a substrate loan — that the rule g2p reads phonemically instead). */
export type ForeignPhonemizer = (latin: string) => string | undefined;

// NATIVISATION: standard-English CMUdict IPA → Naija phonology. Nigerian Pidgin is English-lexified and written
// (BBC-Pidgin / media style) mostly in ENGLISH spelling, so a known-English word is realised with Naija values:
// the 7-vowel system /i e ɛ a ɔ o u/ (no schwa reduction, no vowel-length), TH-stopping (θ→t, ð→d), NON-RHOTIC
// codas (car→ka, water→wata; onset r→ɾ). Lexical mergers inherited from the GenAm source (LOT/PALM, TRAP/BATH)
// are unresolved — a documented ceiling (see the diaphonemic-source note in pcm_native_bringup_investigation.md).
const V = "iɪeɛæaɑɔoʊuʌəɐ"; // English vowels (for the onset-/r/ lookahead), before nativisation collapses them
function nativise(en: string): string {
    return en
        .normalize("NFC")
        .replace(/[ˈˌː]/gu, "") // stress, length
        .replace(/aᶦ/gu, "ai").replace(/aᶷ/gu, "au").replace(/[ɔo]ᶦ/gu, "ɔi") // PRICE/MOUTH/CHOICE
        .replace(/eᶦ/gu, "e").replace(/[oə]ᶷ/gu, "o") // FACE→e, GOAT→o
        .replace(/ɝ/gu, "ɔ").replace(/ɚ/gu, "a") // NURSE/lettER — the r is absorbed
        .replace(/ʰ/gu, "").replace(/̬/gu, "") // deaspirate, un-flap
        .replace(/θ/gu, "t").replace(/ð/gu, "d") // TH-stopping
        .replace(/ɫ/gu, "l").replace(/ʲ/gu, "j") // dark-l → l; palatal glide (abbreviate→abɾivijet) → j
        .replace(new RegExp(`[ɹr](?=[${V}])`, "gu"), "ɾ") // ONSET r → tap
        .replace(/[ɹr]/gu, "") // CODA r → dropped (Naija is non-rhotic)
        .replace(/[iɪᵻ]/gu, "i").replace(/[uʊ]/gu, "u") // FLEECE/KIT, GOOSE/FOOT
        .replace(/[ʌɐ]/gu, "ɔ").replace(/ə/gu, "a") // STRUT→ɔ; schwa→a (lossy — see note)
        .replace(/[ɔɒ]/gu, "ɔ").replace(/[æɑ]/gu, "a"); // THOUGHT/LOT→ɔ; TRAP/PALM→a
}

/** Scan a lowercased Naija word with the rule g2p (digraphs first, then single letters, Naija values). Naija has
 *  no geminates, so doubled letters (English-spelling artifacts: jollof, garri) collapse to one first. */
function scan(w: string): string {
    // Degeminate (Naija has no geminates), then apply the SOFT-C convention the English-etymological media
    // orthography inherits: ⟨c⟩ before e/i/y → /s/ (once→wɔns, since→sins); elsewhere ⟨c⟩→k (the consonant map).
    // Naija phonemic spelling uses ⟨k⟩/⟨s⟩ (not ⟨c⟩), so this only ever touches English-etymological ⟨c⟩.
    const s = [...w.replace(/c(?=[eiy])/gu, "s").replace(/(.)\1+/gu, "$1")];
    let out = "";
    for (let i = 0; i < s.length; ) {
        const dg = (s[i] ?? "") + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            out += DEF.digraphs[dg];
            i += 2;
            continue;
        }
        const c = s[i]!;
        if (c in DEF.consonants) out += DEF.consonants[c];
        else if (c in DEF.vowels) out += DEF.vowels[c];
        // else: unknown → skip
        i++;
    }
    return out;
}

/** One Naija word → canonical IPA. Order: (1) the Naija lexicon (respellings + substrate loans + irregulars);
 *  (2) if `known` resolves it as standard English → NATIVISE that (BBC-Pidgin text is mostly English spelling);
 *  (3) the nativising rule g2p (phonemically-spelled substrate loans: danfo, egusi). Segmental only — Naija tone
 *  is unmarked in the media orthography. `known` is omitted by the referee eval (rule path only; no referee). */
export function phonemizeWord(word: string, known?: ForeignPhonemizer): string {
    const lw = word.toLowerCase();
    const lex = DEF.lexicon[lw];
    if (lex !== undefined) return lex;
    const en = known?.(lw);
    if (en !== undefined) return nativise(en).normalize("NFC");
    return scan(lw).normalize("NFC");
}

// ── Numbers (nativised English, simple compositor) ────────────────────────────
function numberWords(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n < 20) return NUM.teens[n - 10]!;
    if (n < 100) {
        const t = Math.floor(n / 10),
            u = n % 10;
        return NUM.tens[t]! + (u ? " " + NUM.units[u] : "");
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return `${NUM.units[h]} ${NUM.hundred}${r ? " " + NUM.and + " " + numberWords(r) : ""}`;
    }
    if (n < 1000000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return `${numberWords(th)} ${NUM.thousand}${r ? " " + numberWords(r) : ""}`;
    }
    // The chain stopped at tauzin, so 10⁶+ leaked the raw digits into the IPA. English-lexified, so the scales are
    // the English ones read in Naija phonology (miliọn / biliọn — see naija.jsonc).
    for (const [value, scale] of [[1_000_000_000, NUM.billion], [1_000_000, NUM.million]] as const) {
        if (n >= value) {
            const q = Math.floor(n / value),
                r = n % value;
            return `${numberWords(q)} ${scale}${r ? " " + numberWords(r) : ""}`;
        }
    }
    return String(n); // beyond the compositor → leave as digits
}

const TOKEN = /([A-Za-z]+)|(\d+)|([.?!,;:])/gu;

class NaijaPhonemizer implements Phonemizer {
    // `foreign` = the English DICT lookup (knownWord): a known-English word is nativised, an OOV one (substrate
    // loan) falls through to the rule g2p. Wired in the registry from the English module.
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1], this.foreign));
            else if (m[2]) {
                const n = Number(m[2]);
                // numberWords already yields canonical IPA (the number words are media-spelled loans given
                // directly as IPA in the manifest) — emit them, don't re-run the g2p.
                if (Number.isSafeInteger(n))
                    for (const wd of numberWords(n).split(" "))
                        if (wd) sink.emit(wd);
                else sink.emit(m[2]);
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Nigerian Pidgin phonemizer. `foreign` (English) is available for code-switch but not auto-used. */
export function createNaija(foreign?: ForeignPhonemizer): Phonemizer {
    return new NaijaPhonemizer(foreign);
}
