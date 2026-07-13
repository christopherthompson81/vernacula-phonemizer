/**
 * Tamil grapheme→phoneme engine (abugida), espeak-independent. Tamil script is parsed into aksharas
 * (consonant + inherent/sign vowel, or independent vowel; pulli ் removes the inherent vowel), then the
 * Dravidian plosive allophony is applied:
 *   - voiceless stops க/ட/த/ப voice INTERVOCALICALLY and POST-NASALLY (மகன்→mɐɡɐn, தம்பி→t̪ɐmbɪ);
 *   - ச is the exception — voiceless t͡ɕ between vowels, but d͡ʒ after a nasal (பசி→pɐt͡ɕɪ, பஞ்சு→pɐɲd͡ʒʊ);
 *   - a doubled stop geminates to a voiceless Cː (வணக்கம்→ʋɐɳɐkːɐm); other doubled consonants → Cː;
 *   - ற → r, but ற்ற → ʈr.
 * Three coronal nasals (ந n̪ / ன n / ண ɳ), two rhotics (ர ɾ / ற r), the retroflex approximant ழ→ɻ, dental
 * த→t̪. Stress is word-initial. See docs/ta_native_bringup_investigation.md.
 */

// Independent vowels (syllable-initial) and vowel signs (matra) share the same IPA.
const INDEP: Record<string, string> = {
  "அ": "a", "ஆ": "aː", "இ": "ɪ", "ஈ": "iː", "உ": "ʊ", "ஊ": "uː",
  "எ": "e", "ஏ": "eː", "ஐ": "aᶦ", "ஒ": "o", "ஓ": "oː", "ஔ": "aᶷ",
};
const SIGN: Record<string, string> = {
  "ா": "aː", "ி": "ɪ", "ீ": "iː", "ு": "ʊ", "ூ": "uː",
  "ெ": "e", "ே": "eː", "ை": "aᶦ", "ொ": "o", "ோ": "oː", "ௌ": "aᶷ",
};
const PULLI = "்"; // virama — removes the inherent vowel

// Consonant base phonemes.
const CONS: Record<string, string> = {
  "க": "k", "ங": "ŋ", "ச": "t͡ɕ", "ஞ": "ɲ", "ட": "ʈ", "ண": "ɳ", "த": "t̪", "ந": "n̪",
  "ப": "p", "ம": "m", "ய": "j", "ர": "ɾ", "ல": "l", "வ": "ʋ", "ழ": "ɻ", "ள": "ɭ",
  "ற": "r", "ன": "n", "ஜ": "d͡ʒ", "ஷ": "ʂ", "ஸ": "s", "ஹ": "h", "ஶ": "ɕ",
};
const VOICE: Record<string, string> = { k: "ɡ", "ʈ": "ɖ", "t̪": "d̪", p: "b" }; // க/ட/த/ப voice
const NASALS = new Set(["m", "n", "n̪", "ɳ", "ŋ", "ɲ"]);
// Voiceless obstruents that BLOCK voicing of a following stop (a stop after a voiceless stop stays voiceless).
const VOICELESS_OBSTR = new Set(["k", "t͡ɕ", "ʈ", "t̪", "p", "s", "ʂ", "ɕ", "h", "kʂ"]);
const VOWELS = new Set([..."aɐɪiʊueo"]); // for the stress test (first char of a vowel IPA)

interface Tok { c?: string; ph: string; vowel?: string } // c = source consonant letter; vowel present if a C carries one

/** Parse Tamil text into an ordered token list (consonants keep their source letter for allophony). */
function parse(word: string): Tok[] {
  const chars = [...word];
  const toks: Tok[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch in INDEP) { toks.push({ ph: INDEP[ch]! }); continue; }
    if (ch in CONS) {
      const nx = chars[i + 1] ?? "";
      if (nx === PULLI) { toks.push({ c: ch, ph: CONS[ch]! }); i++; }               // bare consonant (coda/cluster)
      else if (nx in SIGN) { toks.push({ c: ch, ph: CONS[ch]!, vowel: SIGN[nx]! }); i++; }
      else toks.push({ c: ch, ph: CONS[ch]!, vowel: "ɐ" });                          // inherent ɐ
    }
    // else: skip (spaces / non-Tamil)
  }
  return toks;
}

const isVowelPh = (ph: string): boolean => ph !== "" && VOWELS.has(ph[0]!);

/** One Tamil word → canonical IPA with initial stress. */
export function phonemizeWord(word: string): string {
  const toks = parse(word);
  const out: string[] = [];     // flat phoneme list (consonant realisations + vowels)
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.c === undefined) { out.push(t.ph); continue; } // independent vowel
    const prev = toks[i - 1], next = toks[i + 1];
    let ph = t.ph;
    // ற்ச → t͡ɕː (the ற assimilates to a following ச).
    if (t.c === "ற" && t.vowel === undefined && next?.c === "ச") {
      out.push("t͡ɕː");
      if (next.vowel !== undefined) out.push(next.vowel);
      i++; continue;
    }
    // Geminate: this bare consonant immediately followed by the same consonant.
    if (t.vowel === undefined && next?.c === t.c) {
      ph = t.c === "ற" ? "ʈr" : t.ph + "ː"; // ற்ற → ʈr; else voiceless long
      out.push(ph);
      if (next.vowel !== undefined) out.push(next.vowel);
      i++; // consume the second half
      continue;
    }
    // ர is a tap ɾ as an onset (has a vowel) but the trill/alveolar r as a bare coda (அவர்→aʋɐr, அரசு→aɾɐt͡ɕʊ).
    if (t.c === "ர" && t.vowel === undefined) ph = "r";
    // Voicing allophony. க/ட/த/ப voice everywhere EXCEPT word-initially, geminated, or after a voiceless
    // obstruent (Tamil stops are voiced after any vowel/sonorant). ச is the exception: voiceless t͡ɕ except
    // after a nasal (→ d͡ʒ). ற never voices.
    // A stop voices only as an ONSET (coda stops stay voiceless: டாக்டர்→ɖaːkʈɐr); blocked after a voiceless
    // obstruent OR the bare ற (which is a voiceless-blocker: ற்ப→rp, unlike the sonorant ர: ர்க→rɡ).
    const prevVoiceless = prev === undefined
      || (prev.vowel === undefined && (VOICELESS_OBSTR.has(prev.ph) || prev.c === "ற"));
    const postNasal = prev?.c !== undefined && prev.vowel === undefined && NASALS.has(prev.ph);
    // A WORD-FINAL bare stop after a vowel also voices (proclitic sandhi forms: இந்தப்→ɪn̪d̪ɐb).
    const wordFinalCoda = t.vowel === undefined && next === undefined
      && prev !== undefined && (prev.c === undefined || prev.vowel !== undefined);
    // Coda ட voices even mid-word before another consonant (நாட்கள்→n̪aːɖkɐɭ, கட்சி→kɐɖt͡ɕɪ).
    if (t.c === "ச") { if (postNasal) ph = "d͡ʒ"; }
    else if (ph in VOICE && !prevVoiceless && (t.vowel !== undefined || wordFinalCoda || t.c === "ட")) ph = VOICE[ph]!;
    out.push(ph);
    if (t.vowel !== undefined) out.push(t.vowel);
  }
  // Stress: primary ˈ on nucleus 0; secondary ˌ on even nucleus indices ≥2 that are NOT the last nucleus
  // (so 1–3-syllable words carry only the primary; 4+ get ˌ on syllables 3, 5, 7…).
  const last = out.reduce((n, ph, i) => (isVowelPh(ph) ? i : n), -1);
  let ni = -1, res = "";
  for (let i = 0; i < out.length; i++) {
    const ph = out[i]!;
    if (isVowelPh(ph)) {
      ni++;
      if (ni === 0) res += "ˈ";
      else if (ni >= 2 && ni % 2 === 0 && i !== last) res += "ˌ";
    }
    res += ph;
  }
  return res;
}
