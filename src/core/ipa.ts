/**
 * The universal IPA phone classes — notation constants, NOT per-language data.
 *
 * A vowel is a vowel whichever language emits it, so a per-engine "these are my vowels" list is a copy of
 * this one with whatever its author happened to need. 31 engines had such a copy under nine different names
 * (IPA_VOWEL, VOWEL_PH, VOWEL_IPA, NUCLEI, …); 26 now read this one.
 *
 * ⚠ A NARROWER LOCAL LIST IS NOT AUTOMATICALLY A BUG — sometimes it is load-bearing. Icelandic's omits
 * plain ⟨e⟩, which suppresses its hiatus glide before the ⟨ei ey⟩ diphthongs, and the referee ATTESTS that
 * glideless reading; switching it to this class measurably loses ground (docs/ipa_classes_investigation.md
 * Run 7). Before converting an engine, check what its narrowness is doing, and measure with
 * tools/referee-eval/eval.ts rather than reasoning from the shape of the list.
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
 * ⚠ THIS IS ALSO THE STRESS-NUCLEUS CLASS — `core/weightStress.ts` builds its VOWEL regex from it, so a
 * letter missing here is a syllable the weight rule cannot see. That is not a subtle bias: a word whose
 * every vowel is invisible gets NO STRESS AT ALL. Until #752 ⟨ɑ⟩ was missing and everyday Urdu came out
 * bare — آپ→ɑːp, کام→kɑːm, بازار→bɑːzɑːɾ — while the minimal pair kaːm→kˈaːm was stressed normally.
 * Anything added here must be a genuine vowel LETTER, and anything genuinely a vowel belongs here.
 */
export const IPA_VOWELS = "əaeiouɪʊɛɔɐæyøɘɤʌɯɵœɜɞʉɨɶɑɒʏ";

/**
 * The same class as a set, for the per-segment "is this a vowel?" tests the engines do.
 *
 * ⚠ THE TWO WERE BRIEFLY DIFFERENT and are not any more. #748 added ⟨ɑ ɒ ʏ⟩ here only, keeping them out
 * of the nucleus string above because widening it moved 11 urdu/bhojpuri goldens and no referee could
 * adjudicate the placement. #752 found the rest of the story — the same omission was deleting stress
 * outright on words whose only vowel is ⟨ɑ⟩ — and unified them. One list, one meaning of "vowel".
 */
export const IPA_VOWEL: ReadonlySet<string> = new Set(IPA_VOWELS);
