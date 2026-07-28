# Crimean Tatar (crh) native bring-up investigation

Target: **Crimean Tatar** (qırımtatar tili) — KIPCHAK Turkic with strong OGHUZ influence, ~540k
speakers (Crimea + a large diaspora, Turkey/Central Asia). The standard Latin alphabet is Turkish-
based and highly phonemic. Canonical IPA, espeak-independent. Joins the Turkic family (a sibling of
Karakalpak/Tatar/Kazakh; the espeak-ng-portable memory flagged crh + nog as the remaining Turkic).

## Run 1 — referee landscape (2026-07-27)

- **wikipron**: NO crh (crh_latn / crh_cyrl both 404).
- **kaikki**: NO Crimean Tatar dictionary (404).
- **epitran**: NO crh datafile.
- **English Wiktionary category** "Crimean Tatar terms with IPA pronunciation": **18 members**, all
  usable Latin IPA pairs (the K'iche'/Chuvash/Karakalpak MediaWiki-API avenue; literal `{{IPA|crh|…}}`).

🔷 **THIN single-source** (the Karakalpak situation) — the % is on a tiny sample, NOT a strong quality
signal. BUT the Latin orthography is highly phonemic, so the g2p is well-defined; the 18 pairs calibrate
every vowel + the uvular/velar series.

## Run 2 — the phonology (from the 18 pairs + the Latin alphabet)

The standard Latin alphabet (no digraphs — ⟨ç ş ñ ğ⟩ are single letters), with harmony SPELLED:
- **Vowels**: back ⟨a o u ı⟩→[ɑ o u ɯ] (Qırım→qɯˈrɯm, azaq→ɑˈzɑq) vs front ⟨e ö ü i⟩→[e ø y i]
  (köy→køj, süt→syt, Canköy→d͡ʒɑnˈkøj). ⟨â⟩ is the palatalisation vowel → [a].
- **Consonants**: uvular ⟨q⟩→[q] (qara→qɑˈrɑ, qış→qɯʃ) vs velar ⟨k⟩→[k]; the voiced dorsal ⟨ğ⟩→[ɣ]
  (ağa→ɑˈɣɑ) vs ⟨g⟩→[ɡ]; ⟨c⟩→[d͡ʒ] (Canköy, cañı, salıncaq), ⟨ç⟩→[t͡ʃ], ⟨ş⟩→[ʃ] (qış→qɯʃ), ⟨j⟩→[ʒ],
  ⟨ñ⟩→[ŋ] (añlamaq→aŋˈlamaq), ⟨y⟩→[j], ⟨v⟩→[v], ⟨h⟩→[h].
- **Gemination**: a doubled letter → [Cː]/[Vː] (yollamaq→[jolːɑmɑq], şeer→[ʃeːr]).
- **Stress**: word-final (oxytone), backing up over one onset consonant (Qırım→qɯˈrɯm, salıncaq→sɑlɯnˈd͡ʒɑq).
- ★ **Turkish-I casing** (the Karakalpak lesson): the dotless capital ⟨I⟩→[ɯ] must lowercase to ⟨ı⟩,
  and the dotted ⟨İ⟩→[i]; both capitals in the TOKEN class (Qırım→qɯˈrɯm).

## Run 3 — build + validate

Self-contained grapheme scan (crimeantatar.ts). First pass **83.3% folded**; the residuals were the
referee's OWN low-vowel inconsistency (it writes ⟨a⟩ as both [ɑ] and [a] — qara→qɑrɑ but añlamaq→aŋlamaq)
→ added an ɑ~a backness fold → **94.4% folded / 98.9% symbol (17/18)**. The one remaining residual is
cañı→[d͡ʒanɯ], where the referee wrote ⟨ñ⟩ as [n] (standard ⟨ñ⟩=[ŋ], so OUR [ŋ] is correct — a referee
quirk). Other folds: the lax [ɛ ɪ]→[e i], dark ⟨l⟩ [ɫ]~[l], the ⟨k⟩→[c] fronting (-lik→lic), ⟨ğ⟩ [ʁ]~[ɣ],
syllable dots. Verified on goldens (qırımtatar→qɯrɯmtɑˈtɑr, çay→ˈt͡ʃɑj, dört→ˈdørt).

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — CLEAN, no bugs.** Notably the Karakalpak İ-token bug is NOT present here
(İ U+0130 is in the class). Turkish-I casing, gemination (incl. the Vː-nucleus stress detection —
an improvement over Karakalpak's exact-match `IPA_VOWEL.has(s)`), NFC, and all wiring verified. Two
cosmetic redundancies noted (a dead gemination sub-guard, a redundant lowercase `i` in TOKEN) — the
sub-guard was cleaned up.

**Phonology reviewer — engine sound, TWO real findings + confirmations.**
- ★ **⟨v⟩→[w] in a post-vocalic coda** (the strongest finding): Crimean Tatar realises coda ⟨v⟩ as
  the Kipchak offglide (av→[ɑw], suv→[suw]), but intervocalic/onset ⟨v⟩ stays [v] (the referee's
  Arabic-loan quvetsiz→quvɛtsɪz confirms). IMPLEMENTED as coda-only (post-vowel, not pre-vowel) so it
  fixes av/suv/tav WITHOUT breaking the referee's quvet. Native INTERVOCALIC ⟨v⟩→[w] (yavaş→jɑwɑʃ)
  needs a native-vs-loan lexicon (quvet keeps [v]) → left as [v] (documented residual).
- ★ **⟨x⟩ removed** — not a Crimean Tatar letter (etymological [x] is spelled ⟨h⟩); dead weight, like
  Karakalpak's ⟨c⟩. (⟨w⟩ also removed.)
- CONFIRMED correct: **h→[h]** (standard, not [x]), **ñ→[ŋ]** (cañı→[n] is a referee error), gemination
  incl. **Vː** (şeer→[ʃeːr] is a real long vowel from *şehir*), **e→[e]** with NO initial glide
  (crh doesn't iotate initial ⟨e⟩), no false final-devoicing.
- Noted-not-fixed (deferred): **⟨â⟩ consonant palatalisation** (kâr→[cɑr] — low-frequency loanword
  feature); the ⟨ğ⟩ back-uvular [ʁ] allophone (folded, matches the broad referee's [ɣ]); dark-l and
  k/g-fronting (folded); lexical non-final stress (particles/enclitics — needs a lexicon).

**Final: 94.4% folded / 98.9% symbol (17/18)** on the thin 18-word referee. Floor 0.88. Goldens (4
tests incl. the v→w coda + Turkish-I casing), the 152-test referee floor, and typecheck all green.
