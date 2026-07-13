import { type ThaiConsonantClass, type ThaiTone, type ThaiToneMark, computeThaiTone, thaiConsonantClass, thaiEffectiveClass } from "./thaiTone.ts";

// Thai / Burmese / Hangul script segmentation (arch-review latent extraction; C#-UNPORTED, no Normalize.* counterpart).


/** Thai leading (pre-posed) vowels: เ แ โ ใ ไ (U+0E40-U+0E44). */
const THAI_LEADING_VOWEL_RE = /[เ-ไ]/;

/** Thai consonant ก-ฮ (U+0E01-U+0E2E). */
const isThaiConsonant = (c: string): boolean => c >= "ก" && c <= "ฮ";

/**
 * Irregular Thai words whose ORTHOGRAPHY doesn't yield the right pronunciation through
 * the regular L2S — rewritten to an orthographic form that DOES (the rewrite is captured
 * for tone BEFORE stripThaiMarks). ก็ = /kɔ̂ː/ ("also / then", extremely common): its
 * mai-taikhu ็ is lexicalised, not the usual vowel-shortener, and stripThaiMarks would
 * drop it leaving a bare ก. ก่อ gives the right result — mid-class + mai-ek → low tone,
 * อ → ɔː. Applied only TOKEN-INITIALLY so mid-word ก็ (เก็บ → kèp) is untouched.
 */
const THAI_LEXICAL_FIXUPS: ReadonlyArray<readonly [string, string]> = [
  ["ก็", "ก่อ"],
];

export function thaiLexicalFixup(text: string): string {
  for (const [from, to] of THAI_LEXICAL_FIXUPS) {
    if (text.startsWith(from)) return to + text.slice(from.length);
  }
  return text;
}

export function reorderThaiLeadingVowels(text: string): string {
  if (!THAI_LEADING_VOWEL_RE.test(text)) return text;
  const cs = [...text];
  for (let i = 0; i < cs.length - 1; i++) {
    if (!(THAI_LEADING_VOWEL_RE.test(cs[i]!) && isThaiConsonant(cs[i + 1]!))) continue;
    // A silent ห leader before a raisable sonorant is part of the ONSET (หม/หน/หว…),
    // so the leading vowel belongs AFTER both (ใหม่ → ห·ม·ใ → màj, not ห·ใ·ม). Rotate
    // [v, ห, sonorant] → [ห, sonorant, v]; the silent ห is then dropped downstream.
    if (cs[i + 1] === "ห" && THAI_H_RAISABLE.has(cs[i + 2] ?? "")) {
      const v = cs[i]!;
      cs[i] = cs[i + 1]!; cs[i + 1] = cs[i + 2]!; cs[i + 2] = v;
      i += 2; // skip past ห and the sonorant onset
      continue;
    }
    // อักษรนำ under a เ frame: เ + high/mid LEADER + non-cluster sonorant + trailing อ. The leader
    // takes an inherent short 'a' and the เ…อ frame belongs to the sonorant's syllable, which the
    // leader then raises (เสนอ → ส·น·เ·อ → sa.nɤ̌ː, not seː.nɔː). Rotate [เ, C1, C2] → [C1, C2, เ].
    // Gated on the trailing อ, which forces the sonorant to be an ONSET (distinguishes เสนอ from
    // เบน, where น is a coda and เ belongs to the single onset บ). Non-cluster sonorant only, so a
    // real เ-cluster (เกลอ, เปรอะ) is untouched (its C2 ∈ ร/ล/ว).
    const c1cls = thaiConsonantClass(cs[i + 1]!);
    if (cs[i] === "เ" && (c1cls === "high" || c1cls === "mid")
        && THAI_LEADER_SONORANT.has(cs[i + 2] ?? "") && cs[i + 3] === "อ") {
      const v = cs[i]!;
      cs[i] = cs[i + 1]!; cs[i + 1] = cs[i + 2]!; cs[i + 2] = v;
      i += 2;
      continue;
    }
    [cs[i], cs[i + 1]] = [cs[i + 1]!, cs[i]!];
    i++; // don't re-process the moved consonant
  }
  return cs.join("");
}

/** Any Thai mark touched by stripThaiMarks: phinthu, mai-taikhu..thanthakhat..nikhahit. */
const THAI_MARK_RE = /[ฺ็-ํ]/u;

/**
 * Strip Thai marks that are segmentally inert (mirrors epitran tha-Thai's
 * preprocessor deletions, IN ITS ORDER), applied AFTER the leading-vowel reorder:
 *  1. tone marks ◌่◌้◌๊◌๋ (U+0E48-0E4B) — deleted FIRST (epitran), so a tone mark
 *     between a consonant and its thanthakhat doesn't shield the consonant from (2).
 *  2. thanthakhat ◌์ (U+0E4C) SILENCES the consonant it sits on, so drop that
 *     preceding char AND the mark (`สัตว์ → สัต`; epitran `.◌์ → 0`, single char —
 *     this DELIBERATELY matches epitran even where Thai silences a fuller cluster).
 *  3. mai-taikhu ◌็ (U+0E47, vowel-shortener), nikhahit ◌ํ (U+0E4D), phinthu ◌ฺ
 *     (U+0E3A) — segmentally inert here (tone/length are a later phase); deleting
 *     them lets the L2S see adjacent consonants (`ด้วย`'s ◌้ no longer breaks the
 *     inherent-vowel lookahead).
 */
export function stripThaiMarks(text: string): string {
  if (!THAI_MARK_RE.test(text)) return text;
  return text
    .replace(/[่-๋]/gu, "") // (1) tone marks (U+0E48-0E4B)
    .replace(/.์/gu, "") //    (2) thanthakhat-silenced consonant
    .replace(/[็ํฺ]/gu, ""); // (3) mai-taikhu, nikhahit, phinthu
}

/**
 * Inherent-vowel markers inserted by syllabifyThai into the grapheme stream.
 * Private-Use chars so they can't collide with Thai script; the authored th_rules
 * map them to the short vowels o / a (with word-final ʔ-epenthesis). A consonant
 * FOLLOWED by one is unambiguously an onset; one not followed by a vowel/marker is
 * a coda — which is what lets the L2S drop all onset/coda guessing.
 */


/** อ acting as the VOWEL ɔː (vs the glottal-stop consonant ʔ). The syllabifier
 *  decides which by the FOLLOWING grapheme; emitting a distinct marker keeps the L2S
 *  unambiguous — the bare อ grapheme then always maps to ʔ, this marker to ɔː, so
 *  อำนาจ → ɔːamnaːt even though ำ is a following vowel (ำ ∈ L05). */

/** ว acting as the medial VOWEL /ua/ in a CวC syllable (ส่วน → sŭan, not sawon). Thai
 *  writes /ua/-before-a-coda as a bare ว (the ◌ั is dropped); a distinct marker keeps
 *  the L2S unambiguous so the bare ว grapheme still maps to the consonant /w/. */
export const THAI_UA_VOWEL = "";

/**
 * Per-tone IR markers (PUA U+F710-F714) that syllabifyThaiWithTones appends at each
 * syllable's END. th_rules maps each to a ph_shan tone phoneme (rising=1 … falling=5)
 * whose contour IPA is pinned in the th job phonemeIpaOverrides — espeak drops a tone
 * phoneme with no ipa (ipa.ts), so the GLYPH is our declared rendering choice (the
 * standard Thai contour). Keep these codepoints in sync with th_rules.
 */

/**
 * Thai consonant grapheme → its onset phoneme class (for the epitran simulation:
 * cluster-former detection in rule 5 and neutralization in rule 4). This is a
 * SECOND encoding of the consonant table in `tools/thai-gold/gen_th_rules.py`
 * (`CONS`/`CLUSTER`) — keep them in sync: this side drives marker PLACEMENT, that
 * side the L2S phonemes; a divergence (e.g. changing a cluster former) silently
 * desyncs them. (The Phase-2 Module:th-pron port collapses both to one source.)
 */
const THAI_CONS_PH: Readonly<Record<string, string>> = {
  ก: "k", ข: "kh", ฃ: "kh", ค: "kh", ฅ: "kh", ฆ: "kh", ง: "N", จ: "tS", ฉ: "tSh",
  ช: "tSh", ฌ: "tSh", ซ: "s", ญ: "j", ฎ: "d", ด: "d", ฏ: "t", ต: "t", ฐ: "th",
  ฑ: "th", ฒ: "th", ถ: "th", ท: "th", ธ: "th", ณ: "n", น: "n", บ: "b", ป: "p",
  ผ: "ph", พ: "ph", ภ: "ph", ฝ: "f", ฟ: "f", ม: "m", ย: "j", ร: "r", ล: "l",
  ฬ: "l", ว: "w", ศ: "s", ษ: "s", ส: "s", ห: "h", ฮ: "h", ฤ: "r",
};

/** Consonant graphemes (incl. อ, which can be the glottal-stop consonant ʔ). */
const THAI_CONS = new Set([...Object.keys(THAI_CONS_PH), "อ"]);

/** Standalone vowel signs (always one-grapheme vowels). ำ is NOT here — it is a
 *  glide-bearing span (am), handled explicitly in thaiVowelSpan. */
const THAI_VSIGN = new Set([..."ะาิีึืุูัๅ"]);

/** อ is the glottal-stop CONSONANT ʔ when followed by one of these (epitran's
 *  vowel-diacritic list for `อ→ʔ`); otherwise อ is the vowel ɔː. ำ and ๅ are
 *  deliberately ABSENT (epitran keeps อ as ɔː before them: อำนาจ → ɔːamnaːt). */
const THAI_O_GLOTTAL_NEXT = new Set([..."าีูเแืโอะิุึไใั"]);

/** Longest-first เ-combinations (post-reorder: เ sits after its consonant). */
const THAI_E_COMBOS = ["เือะ", "เือ", "เียะ", "เีย", "เาะ", "เา", "เอะ", "เอ", "เิ", "เะ", "เ"];

const THAI_CLUSTER_FORMER: Readonly<Record<string, string>> = {
  k: "k", kh: "k", p: "p", ph: "p", t: "t", th: "t",
};

// A vowel UNIT carries its graphemes plus an optional trailing GLIDE consonant:
// ไ/ใ (aj) and ำ (am) are vowel + a glide (j / m) that, like any consonant, fills
// the coda slot so a FOLLOWING consonant opens a new syllable (ใหม่ → hajmaʔ, ม is
// an onset). The centering diphthongs เีย/เือ/ัว (ia̯/ɯa̯/ua̯) are pure vowels — no glide.
type ThaiUnit =
  | { kind: "C"; g: string; ph: string }
  | { kind: "V"; gs: string[]; glide?: "j" | "m" };

/** Parse a vowel SPAN starting at index i; returns {gs, glide} or null. */
function thaiVowelSpan(s: readonly string[], i: number): { gs: string[]; glide?: "j" | "m" } | null {
  const c = s[i]!;
  const at = (k: number) => s[i + k] ?? "";
  if (c === "เ") {
    // เ + ย = /ɤːj/ (เลย → lɤːj) when ย is the syllable's OFFGLIDE — i.e. ย is not
    // followed by a vowel. If a vowel follows, ย is the next syllable's onset (เขย่า →
    // kʰa.jàʔ, เยาว์ → jaw), so fall through to the normal เ-combo handling.
    const at2 = at(2);
    if (at(1) === "ย" && !(THAI_VSIGN.has(at2) || THAI_LEADING_VOWEL_RE.test(at2) || at2 === "อ")) {
      return { gs: ["เ", "ย"], glide: "j" };
    }
    for (const pat of THAI_E_COMBOS) {
      if (s.slice(i, i + pat.length).join("") === pat) return { gs: [...pat] };
    }
  }
  if (c === "ั") {
    if (at(1) === "ว" && at(2) === "ะ") return { gs: ["ั", "ว", "ะ"] };
    if (at(1) === "ว") return { gs: ["ั", "ว"] };
    return { gs: ["ั"] };
  }
  if (c === "ไ") return at(1) === "ย" ? { gs: ["ไ", "ย"], glide: "j" } : { gs: ["ไ"], glide: "j" };
  if (c === "ใ") return { gs: ["ใ"], glide: "j" };
  if (c === "ำ") return { gs: ["ำ"], glide: "m" };
  if (c === "แ") return at(1) === "ะ" ? { gs: ["แ", "ะ"] } : { gs: ["แ"] };
  if (c === "โ") return at(1) === "ะ" ? { gs: ["โ", "ะ"] } : { gs: ["โ"] };
  // ◌ือ (sara uee + อ) is ONE long vowel /ɯː/ — the อ is a silent orthographic tail,
  // not the ɔː vowel. Consume both so อ never surfaces as a separate vowel (คือ → kʰɯː,
  // was kʰɯɔ); the silent tail is dropped by a left-context rule in th_rules.
  if (c === "ื" && at(1) === "อ") return { gs: ["ื", "อ"] };
  if (THAI_VSIGN.has(c)) return { gs: [c] };
  // อ as the vowel ɔː: when it is NOT acting as the glottal-stop consonant (i.e. the
  // next grapheme is not in the อ→ʔ list — epitran keys this on the FOLLOWING grapheme.
  // EXCEPTION: a WORD-INITIAL อ before ย is the silent อ of the อย words (อยู่/อย่าง);
  // keep it a consonant so thaiIsSilentLeader can drop it (else ปอย-type อ stays ɔː).
  // A WORD-INITIAL อ before a consonant is the glottal ONSET ʔ of a Sanskrit อ-syllable, not the
  // ɔː vowel — keep it a consonant so it takes an inherent vowel from the schwa fates (อธิบาย →
  // ʔa.tʰi.baːj, องค์ → ʔoŋ), and so thaiIsSilentLeader can drop the อย leader. (Generalises the
  // former อย-only guard; อำ stays ɔː since ำ is not a consonant — epitran-intentional, see above.)
  if (c === "อ" && !THAI_O_GLOTTAL_NEXT.has(s[i + 1] ?? "") && !(i === 0 && isThaiConsonant(s[i + 1] ?? ""))) return { gs: ["อ"] };
  // ว as the medial vowel /ua/ in a WORD-INITIAL CวC syllable: a single onset consonant
  // at the word start, ว, then a coda consonant (ส่วน → sŭan, ด้วย → dŭaj, ขวด → kʰŭat).
  // Restricted to i===1 because a mid-word ว after a coda starts a new ว-ONSET syllable
  // (สงวน → soŋ·won, ผนวก → pʰon·wok) — distinguishing onset from coda there needs the
  // schwa fates, which aren't available yet. ทวี/กว่า (ว before a vowel) stay consonant.
  // (อ after ว is the ɔː VOWEL of a cluster, not a coda — ควอ → kʰwɔ, not kʰua·ɔ.)
  // EXCEPTION: a k-class onset (a ว-cluster former) + ว + ร is the kʰw-cluster word ควร
  // (→ kʰwɔːn), not /ua/ — while the same onset + ว + other coda IS /ua/ (ควง/ควบ/ขวด).
  // EXCEPTION: a leading ห is a SILENT leader before ว (raisable), so หว is ห-silent +
  // ว-onset (หวง → wŏŋ), NOT a CวC nucleus — leave ว a consonant so thaiIsSilentLeader fires.
  if (c === "ว" && i === 1 && isThaiConsonant(s[0] ?? "") && isThaiConsonant(at(1)) && at(1) !== "อ"
      && s[0] !== "ห" && !("กขฃคฅฆ".includes(s[0] ?? "") && at(1) === "ร")) {
    return { gs: ["ว"] };
  }
  // ◌ว = /ua/ NUCLEUS under a silent ห-leader: หCวC (ห + raised sonorant onset + ว + coda) — หลวง →
  // lŭaŋ, หมวด → mŭat, หนวด → nŭat. The silent ห makes s[i-1] the real onset, so ว here is the nucleus
  // exactly like the CวC case above; ว just sits at i≥2 (after the leader). Fires word-initial AND
  // mid-word (เมืองหลวง → …lŭaŋ). Needs a following coda consonant (not a vowel/อ). Without this, ว fell
  // through to a bare /w/ consonant and the leader logic mangled the onset (หลวง → nwoŋ). Run 23.
  if (c === "ว" && i >= 2 && s[i - 2] === "ห" && s[i - 1] !== "ว" && THAI_H_RAISABLE.has(s[i - 1] ?? "")
      && isThaiConsonant(at(1)) && at(1) !== "อ") {
    return { gs: ["ว"] };
  }
  return null;
}

function thaiTokenize(word: string): ThaiUnit[] {
  const s = [...word];
  const units: ThaiUnit[] = [];
  for (let i = 0; i < s.length;) {
    const span = thaiVowelSpan(s, i);
    if (span) {
      units.push({ kind: "V", gs: span.gs, glide: span.glide });
      i += span.gs.length;
      continue;
    }
    const c = s[i]!;
    if (THAI_CONS.has(c)) {
      units.push({ kind: "C", g: c, ph: c === "อ" ? "?" : THAI_CONS_PH[c]! });
    } else {
      units.push({ kind: "V", gs: [c] }); // unknown grapheme: inert, can't bear a schwa
    }
    i++;
  }
  return units;
}

/** Low sonorants a silent ห raises to HIGH class (and ย after a silent อ): หม/หน/หว…, อย. */
const THAI_H_RAISABLE = new Set([..."งญณนมยรลฬว"]);

/** Non-cluster low sonorants (THAI_H_RAISABLE minus the cluster glides ย/ร/ล/ว) — a leader's
 *  second consonant in the เ-frame อักษรนำ rotate, where C1+C2 can never be an onset cluster. */
const THAI_LEADER_SONORANT = new Set([..."งญณนมฬ"]);

/**
 * Is unit `i` a SILENT leading consonant — a ห before a raisable sonorant (หม/หน/หว/
 * หญ/หร/หล/หง) or the อ of the อย words (อย่า/อยาก/อยู่/อย่าง)? In correct Thai such a
 * leader is NOT pronounced; it only raises the syllable's tone class. The epitran-
 * faithful syllabifier would give it an inherent vowel (a spurious syllable, จังหวัด →
 * …ha.wat); both the segmentation (syllabifyThai) and the tone analysis
 * (thaiSyllableTones) skip it via this shared predicate so their syllable counts agree.
 */
function thaiIsSilentLeader(units: readonly ThaiUnit[], i: number): boolean {
  const u = units[i]; if (!u || u.kind !== "C") return false;
  const nx = units[i + 1];
  if (!nx || nx.kind !== "C") return false;
  return (u.g === "ห" && THAI_H_RAISABLE.has(nx.g)) || (i === 0 && u.g === "อ" && nx.g === "ย");
}

/**
 * Compute each consonant's inherent-vowel fate by simulating epitran tha-Thai's
 * post-processor (post/tha-Thai.txt) in file order on a [C, schwa]* / V sequence.
 * Returns the fate per consonant index: "o", "a", or null (deleted — onset before
 * a vowel, a coda, or a cluster onset). Order is load-bearing: neutralization
 * (rule 4, l/r→n) runs BEFORE the cluster rule, so a coda ร doesn't cluster.
 */
function thaiSchwaFates(units: readonly ThaiUnit[]): Map<number, "o" | "a"> {
  // Token sym: a consonant phoneme, "V" (written vowel), "ə" (pending schwa), or —
  // after rules 6/7 — "o"/"a". owner = the consonant's unit index (-1 = none).
  type Tok = { sym: string; owner: number };
  let seq: Tok[] = [];
  units.forEach((u, ci) => {
    if (u.kind === "C") {
      seq.push({ sym: u.ph, owner: ci }, { sym: "ə", owner: ci });
    } else {
      seq.push({ sym: "V", owner: -1 });
      // A glide-final vowel (aj/am) ends in a CONSONANT (j/m) that fills the coda
      // slot — model it as a schwa-less consonant (never carries a marker).
      if (u.glide) seq.push({ sym: u.glide, owner: -1 });
    }
  });
  const isV = (t: Tok | undefined) => !!t && (t.sym === "V" || t.sym === "ə");
  const isC = (t: Tok | undefined) => !!t && !isV(t);

  // The rewrites mirror epitran post/tha-Thai.txt IN ORDER. Crucially they are
  // NON-OVERLAPPING (Python re.sub): a context-bearing match consumes its whole
  // span, so a trailing context char can't seed the next match (this is why
  // การศึกษา keeps the second ก's vowel: kaːnsɯkasaː, not kaːnsɯksaː).

  // 1: ə → 0 / _V  (right-context lookahead — drop ə before any vowel)
  seq = seq.filter((t, i) => !(t.sym === "ə" && isV(seq[i + 1])));

  // 2: ə → 0 / VC_#  (a coda schwa at word end)
  if (seq.length >= 3 && seq[seq.length - 1]!.sym === "ə"
    && isC(seq[seq.length - 2]) && isV(seq[seq.length - 3])) seq.pop();

  // 3: ə → 0 / VC_CV  (consume V·C·ə·C·V; advance past the trailing CV)
  seq = rewriteThai(seq, 5, (w) =>
    isV(w[0]) && isC(w[1]) && w[2]!.sym === "ə" && isC(w[3]) && isV(w[4]) ? [w[0]!, w[1]!, w[3]!, w[4]!] : null);

  // 4: neutralization before #/C (l/r→n runs BEFORE the cluster rule, so a coda
  //    ร doesn't cluster) — mutate consonant syms in place.
  for (let i = 0; i < seq.length; i++) {
    if (!isC(seq[i])) continue;
    if (isV(seq[i + 1])) continue; // before a vowel: an onset, no neutralization
    const p = seq[i]!.sym;
    seq[i]!.sym = p === "kh" ? "k"
      : (p === "tS" || p === "tSh" || p === "d" || p === "th" || p === "s") ? "t"
      : p === "ph" ? "p"
      : (p === "l" || p === "r") ? "n" : p;
  }

  // 5: cluster schwa-deletion — (k)_(l/r/w), (p)_(l/r), (t)_r  (consume C·ə·C)
  seq = rewriteThai(seq, 3, (w) => {
    if (!(isC(w[0]) && w[1]!.sym === "ə" && isC(w[2]))) return null;
    const former = THAI_CLUSTER_FORMER[w[0]!.sym], med = w[2]!.sym;
    const ok = former === "k" ? (med === "l" || med === "r" || med === "w")
      : former === "p" ? (med === "l" || med === "r")
      : former === "t" ? med === "r" : false;
    return ok ? [w[0]!, w[2]!] : null;
  });

  // 6: ə → o / _C(#|C)  (right-context lookahead — surfaces as o in a closed syllable)
  for (let i = 0; i < seq.length; i++) {
    if (seq[i]!.sym === "ə" && isC(seq[i + 1]) && (seq[i + 2] === undefined || isC(seq[i + 2]))) seq[i]!.sym = "o";
  }
  // 7: ə → a  (everything else)
  for (const t of seq) if (t.sym === "ə") t.sym = "a";

  const out = new Map<number, "o" | "a">();
  for (const t of seq) if (t.sym === "o" || t.sym === "a") out.set(t.owner, t.sym);
  return out;
}

/**
 * One NON-OVERLAPPING left-to-right rewrite pass: at each position try to match a
 * window of `width` tokens; if `apply` returns a replacement array, emit it and
 * advance PAST the whole window (consuming it); otherwise emit one token and step.
 */
function rewriteThai<T>(seq: T[], width: number, apply: (window: (T | undefined)[]) => T[] | null): T[] {
  const out: T[] = [];
  for (let i = 0; i < seq.length;) {
    const repl = i + width <= seq.length ? apply(seq.slice(i, i + width)) : null;
    if (repl) { out.push(...repl); i += width; } else { out.push(seq[i]!); i++; }
  }
  return out;
}



/** Short vowel signs (length feeds the dead-short/dead-long tone split). */
const THAI_SHORT_VSIGN = new Set([..."ะิึุั"]);

/** Sonorant codas that make a syllable LIVE. Nasals/liquids [มญณนรลฬง] plus the glide
 * codas ย/ว: a glide-final syllable is always live (sonorant coda), regardless of vowel
 * length — th-pron reaches the same result by folding ย/ว into the vowel nucleus (าย→aːj,
 * าว→aːw, open+long → live) and via THAI_LIVE_EXC for the short glide-vowels; our tokenizer
 * treats the glide as a coda unit, so it lives here instead. Fixes โดย→mid, สาว→rising, etc. */
const THAI_LIVE_CODA = new Set([..."มญณนรลฬงยว"]);

/** One scanned syllable: `nucleus` is its vowel unit index (where the tone glyph is
 *  injected — BEFORE the vowel, so the engine repositions it after the syllabic vowel,
 *  Punjabi-style, without disrupting coda/glottal rules) and `tone` its lexical tone
 *  (undefined for an onsetless run). */
export interface ThaiSyllableScan {
  nucleus: number; tone: ThaiTone | undefined;
  onsetCs: string[];   // onset consonant graphemes (may include a silent ห/อ leader)
  nucUnit: ThaiUnit;   // the nucleus unit (C = inherent vowel, V = written vowel)
  codaG: string;       // coda consonant grapheme ("" if none)
  long: boolean; fate: "o" | "a" | undefined;
}
export type { ThaiUnit };

/**
 * Prepare a (reordered, pre-strip) Thai word for the syllable scan: capture each tone
 * mark against the char it sits on (BEFORE stripThaiMarks drops it), strip the marks,
 * tokenize, run the schwa fates, and project the marks onto the surviving units.
 */
export function thaiPrep(reordered: string): { units: ThaiUnit[]; fates: Map<number, "o" | "a">; unitMark: (ThaiToneMark | undefined)[]; shortMark: boolean[] } | null {
  const markAt: (ThaiToneMark | undefined)[] = [];
  // mai-taikhu ◌็ (U+0E47) shortens its syllable's vowel (เป็น /pen/, เล็ก /lék/). Like the tone
  // marks it is dropped by stripThaiMarks, so capture its position here (against the char it sits
  // on) before the strip, then project onto the surviving unit — used for BOTH the tone's
  // long/short input and the segmental short-vowel emission. #958.
  const shortAt: boolean[] = [];
  const cleaned: string[] = [];
  for (const c of [...reordered]) {
    if (/[่-๋̄]/u.test(c)) { if (cleaned.length) markAt[cleaned.length - 1] = c as ThaiToneMark; continue; }
    if (c === "็") { if (cleaned.length) shortAt[cleaned.length - 1] = true; continue; }
    cleaned.push(c);
  }
  const word = stripThaiMarks(cleaned.join(""));
  // Project each captured mark onto the SURVIVING word char it belongs to. stripThaiMarks
  // can delete chars (a thanthakhat-silenced consonant); carry a mark that sat on a
  // deleted char forward to the next surviving char so it isn't lost. (A residual
  // ambiguity remains when an identical char survives further along — rare in practice.)
  const unitMarkByChar: (ThaiToneMark | undefined)[] = [];
  const shortByChar: boolean[] = [];
  { let ci = 0; for (const wc of [...word]) { let m: ThaiToneMark | undefined; let sh = false; while (ci < cleaned.length && cleaned[ci] !== wc) { m = m ?? markAt[ci]; sh = sh || !!shortAt[ci]; ci++; } unitMarkByChar.push(markAt[ci] ?? m); shortByChar.push(!!shortAt[ci] || sh); ci++; } }
  if (![...word].some((c) => THAI_CONS.has(c))) return null;
  const units = thaiTokenize(word);
  const fates = thaiSchwaFates(units);
  const unitMark: (ThaiToneMark | undefined)[] = [];
  const shortMark: boolean[] = [];
  { let p = 0; for (const u of units) { const len = u.kind === "C" ? 1 : u.gs.length; let m: ThaiToneMark | undefined; let sh = false; for (let k = 0; k < len; k++) { m = m ?? unitMarkByChar[p + k]; sh = sh || !!shortByChar[p + k]; } unitMark.push(m); shortMark.push(sh); p += len; } }
  return { units, fates, unitMark, shortMark };
}

/**
 * Scan a prepared Thai word into syllables, computing each one's lexical tone via the
 * Phase-2a tone brain (consonant class × live/dead × length × mark). Drives BOTH the
 * tone list (thaiSyllableTones) and the tone-glyph injection (syllabifyThaiWithTones),
 * so segmental and tonal syllabification can never disagree. See investigation Run 6.
 */
export function thaiScanSyllables(units: readonly ThaiUnit[], fates: Map<number, "o" | "a">, unitMark: (ThaiToneMark | undefined)[], shortMark: readonly boolean[] = []): ThaiSyllableScan[] {
  // A silent ห/อ leader (หม/หน/หว…, อย) is NOT a nucleus — skip it (shared predicate
  // with emitThaiUnit, which drops the same leaders from the segment stream).
  const isNucleus = (i: number) => !thaiIsSilentLeader(units, i) && (units[i]!.kind === "V" || (units[i]!.kind === "C" && fates.has(i)));
  const out: ThaiSyllableScan[] = [];
  let onsetStart = 0;
  // อักษรนำ (implicit leading consonant): a light high/mid consonant with an inherent short
  // vowel and no coda (e.g. ถ in ถนน, ส in เสนอ) RAISES a following low-class sonorant syllable
  // to the leader's tone class — the unwritten counterpart of the ห/อ leader handled explicitly
  // below (Wiktionary spells it with หฺ: ถนน → ถะ-หฺนน → tʰa.nǒn rising). Carries the leader's own
  // class to the next syllable when that syllable's onset is a bare sonorant.
  let pendingLeaderClass: ThaiConsonantClass | undefined;
  for (let i = 0; i < units.length; i++) {
    if (!isNucleus(i)) continue;
    const u = units[i]!;
    const onsetCs: string[] = [];
    for (let j = onsetStart; j <= i; j++) { const uj = units[j]!; if (uj.kind === "C") onsetCs.push(uj.g); }
    if (onsetCs.length === 0) { onsetStart = i + 1; pendingLeaderClass = undefined; continue; } // adjacency broken by an onset-less nucleus
    let cls;
    if (onsetCs[0] === "ห" && onsetCs.length >= 2 && THAI_H_RAISABLE.has(onsetCs[1]!)) cls = thaiEffectiveClass(onsetCs[1]!, "ห");
    else if (onsetCs[0] === "อ" && onsetCs.length >= 2 && onsetCs[1] === "ย") cls = thaiEffectiveClass("ย", "อ");
    else if (onsetCs.length === 1 && pendingLeaderClass !== undefined && THAI_H_RAISABLE.has(onsetCs[0]!)) cls = pendingLeaderClass; // implicit อักษรนำ
    else cls = thaiEffectiveClass(onsetCs[0]!, undefined);
    const long = u.kind === "V" && !shortMark[i] ? !THAI_SHORT_VSIGN.has(u.gs[u.gs.length - 1]!) : false;
    const glideVowel = u.kind === "V" && u.glide !== undefined; // ไ/ใ/ำ — live
    let codaG = "";
    let nextI = i + 1;
    const un = units[nextI];
    // A ห before a low-class sonorant is that sonorant's LEADER (หมาย, หญิง), not this syllable's
    // coda — leave it in the next onset so the ห-raise fires there (fixes mid-word เป้าหมาย/ผู้หญิง).
    const nn = units[nextI + 1];
    const hLeaderNext = un?.kind === "C" && un.g === "ห" && nn?.kind === "C" && THAI_H_RAISABLE.has(nn.g);
    if (un?.kind === "C" && !fates.has(nextI) && nn?.kind !== "V" && !hLeaderNext) { codaG = un.g; nextI++; }
    const live = glideVowel || THAI_LIVE_CODA.has(codaG) || (codaG === "" && long);
    // the syllable's tone mark may sit on any onset or nucleus unit (อย่า → ก on the
    // middle ย); scan the whole onset→nucleus span, not just the ends.
    let mark: ThaiToneMark | undefined;
    for (let j = onsetStart; j <= i; j++) mark = mark ?? unitMark[j];
    out.push({
      nucleus: i, tone: cls === undefined ? undefined : computeThaiTone(cls, live ? "live" : "dead", long ? "long" : "short", mark),
      onsetCs: [...onsetCs], nucUnit: u, codaG, long, fate: fates.get(i),
    });
    // This syllable is a leader for the NEXT iff it is a bare high/mid consonant with an
    // inherent short 'a' vowel, no coda, and no tone mark (own class — a raised sonorant, being
    // low class, never qualifies, so the raise never chains).
    const ownCls = thaiConsonantClass(onsetCs[0]!);
    pendingLeaderClass = onsetCs.length === 1 && (ownCls === "high" || ownCls === "mid")
      && u.kind === "C" && fates.get(i) === "a" && codaG === "" && mark === undefined ? ownCls : undefined;
    onsetStart = nextI;
  }
  return out;
}


