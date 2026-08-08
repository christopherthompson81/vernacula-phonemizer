/**
 * The universal IPA phone classes — notation constants, NOT per-language data.
 *
 * A vowel is a vowel whichever language emits it, so a per-engine "these are my vowels" list is a copy of
 * this one with whatever its author happened to need. 31 engines had such a copy under nine different names
 * (IPA_VOWEL, VOWEL_PH, VOWEL_IPA, NUCLEI, …), and the copies had drifted: see
 * docs/ipa_classes_investigation.md, where Icelandic's omitted ⟨e⟩ turned out to suppress the hiatus glide
 * its own rule documents.
 *
 * ⚠ WHAT BELONGS HERE VS IN A MANIFEST. This file is for classes that are true of the NOTATION: every IPA
 * vowel letter, whoever writes it. A language's own INVENTORY — the subset it actually uses, or a class
 * whose members are language-specific (Irish's palatalized liquids ⟨ɾˠ ɾʲ l̪ˠ lʲ⟩, Tibetan's Wylie voicing
 * classes) — is that language's data and belongs in its manifest. The test is whether another language
 * could disagree: nobody can disagree that [ɛ] is a vowel; plenty can disagree about what their liquids are.
 */

/**
 * The vowel letters as a STRING, so it can go straight into a regex character class
 * (`new RegExp(\`[${IPA_VOWELS}]\`)`). Length/stress/tone marks and combining diacritics are NOT here —
 * they attach to a vowel, they are not one. A composed nasal vowel like ⟨ɨ̃⟩ is likewise absent: it is two
 * codepoints, so it can never match a single-character test (see the Guaraní note in guarani.ts).
 *
 * ⚠ THIS IS THE STRESS-NUCLEUS CLASS, AND IT IS DELIBERATELY NARROWER THAN `IPA_VOWEL` BELOW. Its readers
 * are `core/weightStress.ts` and the Indic engines, where it decides which syllables are WEIGHT-BEARING.
 * Adding a letter here therefore moves stress. Measured, not assumed: adding ⟨ɑ⟩ moves 11 urdu/bhojpuri
 * goldens (انبار ˈəmbɑːɾ → əmbˈɑːɾ). That may well be a FIX — a weight rule should stress the long
 * syllable — but it needs the ur/bho referee corpora to settle, and those are not in-repo. See
 * docs/ipa_classes_investigation.md Run 5. Do not widen this to "all vowels" without those numbers.
 */
export const IPA_VOWELS = "əaeiouɪʊɛɔɐæyøɘɤʌɯɵœɜɞʉɨɶ";

/**
 * The MEMBERSHIP class: every IPA vowel letter, for the per-segment "is this a vowel?" tests the engines
 * do. Derived from the string above plus the three letters that class omits, so there is one list to edit
 * and the difference between the two is explicit rather than a second hand-written copy.
 *
 * ⚠ ⟨ɑ ɒ ʏ⟩ are load-bearing here and were missing from every shared constant before #748: ɑ in the Turkic
 * engines (bashkir, tatar, turkmen, karakalpak, crimeantatar), ɒ in uzbek and bavarian, ʏ in icelandic.
 * They are added ONLY on this side, which no stress rule reads.
 */
export const IPA_VOWEL: ReadonlySet<string> = new Set([...IPA_VOWELS, ..."ɑɒʏ"]);

/**
 * Does this phone STRING carry a vowel anywhere? The engines' segments are not always one character —
 * a diphthong (`ei`), an affricate with a tie bar, a phone plus a length mark — so a membership test on
 * the whole string would fail where a per-character one succeeds.
 */
export function hasVowel(ph: string): boolean {
    for (const c of ph) if (IPA_VOWEL.has(c)) return true;
    return false;
}

/**
 * Does this phone string BEGIN with a vowel? ⚠ Use this rather than `IPA_VOWEL.has(ph[0])`: a JS index
 * takes a UTF-16 unit, which splits an astral codepoint, and the diphthong values that make this question
 * interesting are exactly the multi-character ones.
 */
export function startsWithVowel(ph: string): boolean {
    const first = [...ph][0];
    return first !== undefined && IPA_VOWEL.has(first);
}

/** Does this phone string END with a vowel? (Length marks count as part of the vowel — ⟨aː⟩ ends in one.) */
export function endsWithVowel(ph: string): boolean {
    const chars = [...ph];
    for (let i = chars.length - 1; i >= 0; i--) {
        const c = chars[i]!;
        if (IPA_VOWEL.has(c)) return true;
        if (c !== "ː" && c !== "ˑ" && c !== "̃") return false; // a mark that attaches to the vowel — keep looking
    }
    return false;
}
