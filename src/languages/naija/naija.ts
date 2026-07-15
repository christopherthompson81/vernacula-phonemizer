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
 * test/naija.test.ts (Faraclas 1996 + NLA). See docs/pcm_native_bringup_investigation.md.
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

export type ForeignPhonemizer = (latin: string) => string;

/** Scan a lowercased Naija word with the rule g2p (digraphs first, then single letters, Naija values). Naija has
 *  no geminates, so doubled letters (English-spelling artifacts: jollof, garri) collapse to one first. */
function scan(w: string): string {
    const s = [...w.replace(/(.)\1+/gu, "$1")];
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

/** One Naija word → canonical IPA (lexicon first, then the rule g2p). Segmental only — Naija tone is unmarked
 *  in the media orthography, so no tone/stress mark is emitted. */
export function phonemizeWord(word: string): string {
    const lw = word.toLowerCase();
    const lex = DEF.lexicon[lw];
    if (lex !== undefined) return lex;
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
    return String(n); // beyond the compositor → leave as digits
}

const TOKEN = /([A-Za-z]+)|(\d+)|([.?!,;:])/gu;

class NaijaPhonemizer implements Phonemizer {
    // `foreign` (the English phonemizer) is wired and available, but Naija nativises loans so the rule g2p is the
    // default reading for English-spelled tokens; `foreign` is the hook for a future explicit code-switch path.
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        void this.foreign;
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
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
