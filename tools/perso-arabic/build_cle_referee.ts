/**
 * Build an INDEPENDENT Urdu pronunciation referee from CLE Lahore's "Phonetically Rich Urdu Speech Corpus" — human
 * read-speech transcribed in CISAMPA, fully independent of Wiktionary (fills the gap ur.jsonc flagged: "no independent
 * diacritized-Urdu referee wired"). Word-aligns the Arabic text (space-separated) with the CISAMPA (## word bounds),
 * converts CISAMPA→IPA, and writes the ~5.6k-word referee. Corroborates wikipron at 87%.
 *
 *   # fetch + extract the corpus (CC-licensed, ~480MB with audio — we keep only the transcription-derived lexicon):
 *   curl -sL https://www.cle.org.pk/Downloads/ling_resources/UrduPhoneticSpeechCorpus.rar -o /tmp/c.rar
 *   unrar x /tmp/c.rar /tmp/clecorpus/
 *   npx tsx tools/perso-arabic/build_cle_referee.ts   # → tools/referee-eval/referees/ur.cle-speech.tsv
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { stripHarakat } from "../../src/core/harakatLexicon.ts";

const SRC = "/tmp/clecorpus";
const OUT = `${import.meta.dirname}/../referee-eval/referees/ur.cle-speech.tsv`;

// CISAMPA (CLE Case-Insensitive SAMPA) → our canonical IPA. Vowels: short A/I/U vs long AA/II/UU; AE=eː, AY=ɛː,
// O/OO=oː; N-suffix = nasalised. Dentals T_D/D_D, retroflex TT/DD/RR, affricates T_SH/D_ZZ, aspirates *_H.
const MAP: Record<string, string> = {
    A: "ə", AA: "ɑː", AAN: "ɑ̃ː", AE: "eː", AEN: "ẽː", AY: "ɛː", AYN: "ɛ̃ː", E: "eː",
    I: "ɪ", II: "iː", IIN: "ĩː", O: "oː", OO: "oː", ON: "õ", OON: "õː", U: "ʊ", UU: "uː", UUN: "ũː",
    B: "b", B_H: "bʱ", P: "p", P_H: "pʰ", T_D: "t̪", T_D_H: "t̪ʰ", TT: "ʈ", TT_H: "ʈʰ",
    D_D: "d̪", D_D_H: "d̪ʱ", DD: "ɖ", DD_H: "ɖʱ", T_SH: "t͡ʃ", T_SH_H: "t͡ʃʰ", D_ZZ: "d͡ʒ", D_ZZ_H: "d͡ʒʱ",
    K: "k", K_H: "kʰ", G: "ɡ", G_H: "ɡʱ", Q: "q", F: "f", V: "ʋ", V_H: "ʋʱ", S: "s", Z: "z",
    SH: "ʃ", ZZ: "ʒ", X: "x", "7": "ɣ", H: "ɦ", M: "m", N: "n", N_H: "nʱ", NG: "ŋ",
    L: "l", R: "ɾ", R_H: "ɾʱ", RR: "ɽ", RR_H: "ɽʱ", J: "j", Y: "j", SIL: "",
};

/** Convert a space-separated CISAMPA word to IPA. Returns null (→ word skipped) if it contains a phone the MAP
 *  doesn't cover — never silently drop a phone and ship a truncated "human" reading. */
function cisampaToIpa(phones: string): string | null {
    const out: string[] = [];
    for (const p of phones.split(/\s+/)) {
        if (!(p in MAP)) return null;
        out.push(MAP[p]!);
    }
    return out.join("");
}

if (!existsSync(SRC)) { console.error(`missing ${SRC} — fetch + extract the CLE corpus first (see header)`); process.exit(1); }

const ar = readFileSync(`${SRC}/Transcription-UNICODE-Arabic.txt`, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("<Format"));
const ci = readFileSync(`${SRC}/Transcription-CISAMPA.txt`, "utf8").split("\n").filter((l) => l.trim().startsWith("<s>"));
if (ar.length !== ci.length) process.stderr.write(`WARN: sentence-line counts differ (arabic ${ar.length} vs cisampa ${ci.length}) — index alignment may skew\n`);

const best = new Map<string, Map<string, number>>(); // skeleton → CISAMPA-string → count
for (let i = 0; i < Math.min(ar.length, ci.length); i++) {
    const aw = ar[i]!.trim().split(/\s+/);
    const cw = ci[i]!.replace(/<\/?s>/g, "").split("##").map((w) => w.trim()).filter(Boolean);
    if (aw.length !== cw.length) continue; // word-count-aligned sentences only
    for (let j = 0; j < aw.length; j++) {
        const skel = stripHarakat(aw[j]!.normalize("NFC"));
        if ([...skel].length < 2) continue;
        const m = best.get(skel) ?? best.set(skel, new Map()).get(skel)!;
        m.set(cw[j]!, (m.get(cw[j]!) ?? 0) + 1);
    }
}

const rows: string[] = [];
for (const [skel, m] of best) {
    const phones = [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const ipa = cisampaToIpa(phones);
    if (ipa) rows.push(`${skel}\t${ipa}`); // null (unknown phone) or "" (all-SIL) → skip
}
rows.sort();
writeFileSync(OUT, "# CLE Lahore Phonetically Rich Urdu Speech Corpus (human read-speech, CISAMPA→IPA) — INDEPENDENT of\n" +
    "# Wiktionary. Word-aligned from the corpus transcriptions. CC-licensed. Build: tools/perso-arabic/build_cle_referee.ts.\n" +
    rows.join("\n") + "\n");
process.stderr.write(`wrote ${rows.length} CLE (skeleton, IPA) referee rows → ur.cle-speech.tsv\n`);
