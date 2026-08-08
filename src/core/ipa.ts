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
 * engines (bashkir, tatar, turkmen, karakalpak, crimeantatar), ɒ in uzbek and bavarian. ⟨ʏ⟩ is here for
 * completeness of the notation rather than for a current reader — icelandic emits it but keeps its own
 * list (see above). They are added ONLY on this side, which no stress rule reads.
 */
export const IPA_VOWEL: ReadonlySet<string> = new Set([...IPA_VOWELS, ..."ɑɒʏ"]);
