# Kabuverdianu (kriolu, kea) bring-up — Portuguese-lexified creole, Cape Verde, ~1M

Kabuverdianu (Cape Verdean Creole), a Portuguese-lexified creole (~870k in Cape Verde + a large diaspora). The
FIRST creole with a bespoke engine in the fleet. Latin script in the **ALUPEC / AK** unified orthography (Alfabeto
Kabuverdianu) — a **standardized PHONEMIC orthography** (one letter ≈ one sound). The **Santiago (Sotavento/Badiu)**
variety is targeted (it is what the anchor pronunciations attest).

## Run 1 — 2026-07-25 22:00 — authored ALUPEC g2p, anchored on the kaikki IPA set

**No machine pronunciation referee exists** — wikipron has no Kabuverdianu (kea_* = 404), and the kaikki
Kabuverdianu dump (1,062 words) carries IPA on only **7 words**. So this is an AUTHORED bring-up (the Madurese/Luo
pattern): the g2p is written from the ALUPEC orthography spec + standard Cape Verdean phonology (Lang 2002 / Quint
2000 / Wikipedia), and anchored on the 7 independent human-IPA kaikki words as a **falsifiable gold**
(test/kabuverdianu.test.ts): kobra→ˈkobrɐ, kóbra→ˈkɔbrɐ, diskabresta→diskɐˈbɾestɐ, barkinu→bɐɾˈkinu,
tabanka→tɐˈbãŋkɐ, talóti→tɐˈlɔti, sénpri→ˈsɛ̃pɾi.

**Phonology (derived from the 7 anchors + ALUPEC):**
- **Vowels**: ⟨a⟩→[ɐ] (Kabuverdianu /a/ is central), ⟨e⟩→[e] / ⟨é⟩→[ɛ], ⟨o⟩→[o] / ⟨ó⟩→[ɔ] (the acute marks the OPEN
  mid quality, as in Portuguese/Galician), ⟨i⟩→[i], ⟨u⟩→[u]. The circumflex ⟨ê ô⟩ = close [e o].
- **Consonants** (ALUPEC): ⟨s⟩→[s] always (NOT the Portuguese intervocalic [z]; ALUPEC writes ⟨z⟩ for [z]), ⟨x⟩→[ʃ],
  ⟨j⟩→[ʒ], ⟨r⟩→[ɾ] tap, ⟨rr⟩→[r] trill, and the DIGRAPHS ⟨dj⟩→[d͡ʒ], ⟨tx⟩→[t͡ʃ], ⟨nh⟩→[ɲ], ⟨lh⟩→[ʎ]. ⟨h⟩ is silent.
- **Nasalization**: a coda ⟨n/m⟩ (before a consonant or word-final) NASALIZES the preceding vowel; the nasal surfaces
  as [ŋ] before a velar (tabanka→tɐˈbãŋkɐ) and is otherwise ABSORBED into the nasal vowel (sénpri→ˈsɛ̃pɾi, no [m]).
- **Stress**: a written accent (á é í ó ú / â ê ô) marks the stressed syllable (talóti→…ˈlɔti); else PENULTIMATE
  (kobra→ˈkobrɐ, barkinu→bɐɾˈkinu) — the Ibero-Romance default.

## Run 1 results — 2026-07-25 22:10

The engine reproduces **all 7 kaikki IPA anchors** at the segment level (test/kabuverdianu.test.ts, all green):
kobra→kˈobɾɐ, kóbra→kˈɔbɾɐ, diskabresta→diskɐbɾˈestɐ, barkinu→bɐɾkˈinu, tabanka→tɐbˈãŋkɐ, talóti→tɐlˈɔti,
sénpri→sˈɛ̃pɾi. The two apparent segment diffs are the kaikki's own loose notation, not engine errors:
- **⟨r⟩ tap**: the kaikki writes ⟨r⟩ loosely (kobra→[ˈko.brɐ] with plain "r") in some entries and [ɾ] in others
  (diskabresta→/…bɾ…/); standard Kabuverdianu single ⟨r⟩ = the tap [ɾ] (⟨rr⟩ = trill), so our [ɾ] is correct.
- **ˈ placement**: the kaikki (Wiktionary) puts ˈ at the syllable ONSET (ˈko.brɐ); the fleet convention is ˈ at the
  NUCLEUS (kˈobɾɐ — as Spanish/Latvian/Macedonian all do). A notation difference, not a stress-syllable difference
  (the stressed SYLLABLE matches on all 7).
- **nasal /a/**: opens to [ã] (tabanka→tɐbˈãŋkɐ), so the nasalizer maps ɐ→ã (not ɐ̃); other nasal vowels take a
  combining tilde (sénpri→sˈɛ̃pɾi). Output is NFC so õ/ĩ/ũ/ẽ/ã precompose consistently.

**Validation (like Madurese/Luo): a 7-word referee-eval TRIPWIRE + the exact-match gold test.** No wikipron kea
exists and kaikki carries IPA on only 7 words, so the 7 kaikki anchors are committed as a tiny referee
(`tools/referee-eval/referees/kea.kaikki-anchors.tsv`, floor 0.7 — a LOOSE tripwire like Luo, folds reconciling the
kaikki's onset-ˈ / loose-⟨r⟩ notation: **7/7 = 100%**), and the exact-match gold in test/kabuverdianu.test.ts
(the 7 anchors + ALUPEC feature words) is the falsifiable anchor.

**Status: 🔷 (thin single-source, authored).** The g2p is authored from the standardized ALUPEC phonemic orthography
+ standard Cape Verdean phonology, anchored on 7 independent human-IPA words (all reproduced). This is one of the
fleet's THINNEST anchors (7 words vs Luo 17 / Madurese 35) — but ALUPEC is designed one-letter-≈-one-sound, so the
g2p is largely deterministic. **Deferred:** the Barlavento (São Vicente) variety (different vowel reduction);
numbers; a larger referee (none exists). The FIRST creole with a bespoke engine in the fleet.

## Run 2 — 2026-07-25 22:40 — review (2 agents) → the OXYTONE stress bug (unanchored word-class) fixed

Wiring + honesty passed (🔷 is the right call — not the ⛔ circular-clone case; the 7 anchors are INDEPENDENT
human-IPA, proven non-circular by the notation differences). The correctness review caught real bugs in word classes
the 7 vowel-final anchors do NOT exercise:
- **Oxytone stress (HIGH):** the first cut was penult-only, but Kabuverdianu (Ibero-lexified) is OXYTONE (final
  stress) when a word ends in a consonant — mudjer→muˈd͡ʒeɾ, amor→ɐˈmoɾ, algen→ɐlˈɡẽ (a large, common class). Fixed:
  penult when the word ends in an oral vowel or ⟨s⟩ (plural), else oxytone (the Spanish/Galician rule).
- **Falling-diphthong offglide (MEDIUM):** oi/ou/ai… counted the ⟨i/u⟩ offglide as a nucleus (oitu→oˈitu). Fixed:
  an unaccented ⟨i/u⟩ after a vowel is a non-nucleus offglide (oitu→ˈoitu).
- **Clitic ⟨' -⟩ (MEDIUM):** the tokenizer split d'algen / odja-l; added ' ’ - to TOKEN (dropped by the scan) so the
  clitic cluster stays one token (d'algen→dɐlˈɡẽ).
- Also: committed the 7 kaikki anchors as a referee-eval tripwire + floor (making the "like Madurese/Luo" claim
  accurate — both have floors).

**NOT changed (documented decisions):** ⟨a⟩→[ɐ] everywhere (Quint's single central /ɐ/ analysis; a stressed [a]/[ɐ]
split is defensible but unanchored — no anchor has a stressed oral ⟨a⟩); the coda-nasal asymmetry (ŋ before velar,
absorbed else — rests on the 2 anchors tabanka/sénpri, thin but supported); the syllabic 1sg pronoun ⟨N⟩→[n̩]
(deferred — a specific morphological item).
