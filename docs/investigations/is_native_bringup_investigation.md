# Icelandic (íslenska, is) bring-up — North Germanic (Insular), Latin, ~330k

Icelandic — the most archaic living North Germanic language, Latin script + ⟨þ ð æ ö⟩, famous for one of the
DEEPEST orthography-to-phonology systems in the fleet. Referee: **wikipron `isl_latn_broad`** (human, CUNY-CL, 10,719
headwords raw / 10,093 after variant-merge — LARGE). No voicing contrast in stops — the contrast is ASPIRATION, and the orthographic ⟨b d g⟩/⟨p t k⟩
split neutralizes to [p t k] with aspiration positional.

## Run 1 — 2026-07-26 — segmental core (fold aspiration/length/devoicing), the epenthetic-stop clusters

**Vowels (verified from the referee):** ⟨a⟩→a, **⟨á⟩→[au]** (á→auː), ⟨e⟩→ɛ, **⟨é⟩→[jɛ]** (tré→tʰrjɛː), ⟨i y⟩→ɪ,
**⟨í ý⟩→[i]** (ís→iːs, ný→niː), ⟨o⟩→ɔ, **⟨ó⟩→[ou]** (sól→souːl), **⟨u⟩→[ʏ]** (dagur→taːɣʏr), **⟨ú⟩→[u]** (hús→huːs),
⟨ö⟩→œ (höfn→hœpn), **⟨æ⟩→[ai]** (læra→laiːra). Diphthongs **⟨au⟩→[øy]** (austur→øystʏr), **⟨ei ey⟩→[ei]** (eyja→eiːja).

**Stops — the fortis/lenis + aspiration system:** NO voicing contrast. ⟨b d g⟩ → UNASPIRATED [p t k] (bók→pouːk,
dagur→taːɣʏr, gata→kaːta); ⟨p t k⟩ → ASPIRATED [pʰ tʰ kʰ] word-initial (taka→tʰaːka, kaka→kʰaːka), unaspirated medial.
Before a front vowel ⟨k g⟩ → PALATAL [cʰ c] (kýr→cʰiːr, Alþingi→…ŋcɪ). PREASPIRATION: ⟨pp tt kk⟩ + ⟨p t k⟩ before
⟨l n⟩ → [ʰp ʰt ʰk] (ekki→ɛʰcɪ, nótt→nouʰt, vatn→vaʰtn̥). **Aspiration ʰ is FOLDED in run 1** (it is a modifier letter,
not auto-stripped) → segments first; the neutralized stops become b/p→p, d/t→t, g/k→k.

**The signature EPENTHETIC-STOP clusters:** **⟨ll⟩→[tl]** (fjall→fjatl), **⟨nn⟩→[tn]** after a long vowel/diphthong
(Steinn→steitn) but [nː] after a short vowel (Anna→anːa), **⟨rl⟩→[rtl]** (karl→kʰartl), **⟨rn⟩→[rtn]** (Arnar→artnar).

**Fricatives:** ⟨þ⟩→[θ], ⟨ð⟩→[ð], ⟨f⟩→[f] but [v] before a voiced sound (Afganistan→avka…) / [p] before ⟨n⟩
(höfn→hœpn), ⟨g⟩ intervocalic→[ɣ] (dagur→taːɣʏr), ⟨hv⟩→[kv], ⟨h⟩→h.

**FOLDED (run 1):** vowel LENGTH (ː, syllable-quantity — the Germanic call), ASPIRATION (ʰ, pre- and post-),
DEVOICED SONORANTS (r̥ l̥ n̥ — combining ring U+0325 auto-strips in the backbone). Emit the segment skeleton, iterate.

## Run 2 — 2026-07-26 — iterating the g2p against the referee → 79.8% folded / 96.7% symbol

Built the greedy scan + rules and iterated against wikipron `isl_latn_broad` (10,093 headwords, variants merged).
Progression (folded backbone): baseline 58.6% → **79.8%**. The wins, each measured:

- **the ⟨g⟩-spirantization bug** (spirantizeG matched [k] from BOTH ⟨g⟩ and ⟨k⟩ since they neutralize — Gaukur→køyɣʏr
  wrong; flagged ⟨g⟩-origin) + ⟨hr hl hn⟩→[r l n] / ⟨hj⟩→[ç] devoiced onsets + ⟨gj kj⟩→[c] + geminate-stop collapse
  + the í/i-glide (Biblía→pɪplija): 58.6→66.4%.
- **PREASPIRATION as a full [h]** (Frakki→frahcɪ, Hekla→hɛhkla, vatn→vahtn) — the fortis geminates ⟨pp tt kk⟩ + a
  fortis stop before ⟨l m n⟩; + palatalization before ⟨e é⟩ (gelda→cɛlta) + non-stop geminate collapse (Sviss→svɪs):
  →73.5%.
- **the pre-velar-nasal change** ⟨ng nk⟩→[ŋk] with the vowel diphthongizing (bang→pauŋk, gengur→ceiŋkʏr, a→au e→ei):
  →77.4%.
- **palatalization detail**: consume the trigger ⟨j⟩ (drekkja→trɛhca), intervocalic ⟨g⟩+front→[j] (deigja→teija,
  Logi→lɔjɪ), re-add ⟨ei ey⟩ palatalization (geipa→ceipa; Geir is the minority), word-final ⟨f⟩→[v] (hlíf→l̥iːv):
  →79.6%. + the referee's optional-preaspiration superscript-paren fold, ⟨n⟩→[ŋ] before palatal [c] (Alþingi→alθiŋcɪ),
  ⟨g⟩→[x] before a voiceless stop (lugt→lʏxt): →**79.8%**.

**MEASURED (kept):** the epenthetic ⟨rl⟩→[rtl] ⟨rn⟩→[rtn] clusters scored 79.6% vs 78.8% (rl→rl) / 78.1% (rl→tl) —
the epenthesis is net-positive despite the prefixed-word misses (Erlendur→ɛrlɛntʏr, er+lendur, no epenthesis).

**Residual (98% of the 2039 misses are 1–2 phones off, only 33 words are 3+):** the FRENCH/loan ⟨f⟩~[v] and vowel
inconsistency (Safír→safir vs our savir; Afganistan/Angóla), the ⟨ei ey⟩-palatalization minority (Geir→keir), and
single short-vowel-quality edges. No cheap systematic win remains.

**FOLDED:** vowel LENGTH (ː, syllable-quantity), ASPIRATION (ʰ pre/post — the phonemic-but-positional contrast, the
main deferred subsystem), DEVOICED SONORANTS (r̥ l̥ n̥, the ring auto-strips), the short mid/high vowels ɛ→e ɔ→o ʏ→y,
the rhotic devoicing, the optional-preaspiration parens. Run-2 plateau: **79.8% folded / 96.7% symbol** — the high
symbol accuracy shows the segments are essentially right. 🔷 single-source but LARGE (10,093 human headwords).

## Run 3 — 2026-07-26 — 2-agent review fixes → 80.1% folded / 96.8% symbol

A correctness review caught three real phonological bugs, all verified against the referee:

- **⟨g⟩→[ɣ] fired only strictly intervocalic** (V_V), missing word-final and pre-voiced-consonant position (lag→lak,
  ég→jɛk, Sigmar→sɪkmar). Broadened: post-vocalic ⟨g⟩ → [ɣ] before any voiced sound or word-finally. (187 referee words.)
- **⟨k⟩→[x] before ⟨t s⟩ was gated on `gVar`** — so plain ⟨k⟩ (Benedikt, lukt) was left as [k]. Since ⟨k g⟩
  neutralize, the rule now keys off the [k] phone regardless of origin (lukt→lʏxt). (35 words.)
- **fortis geminates preaspirated TWICE** before a sonorant: scan emits the geminate's [h], then `preaspirate` saw
  the lingering `fortis` flag and inserted a second (drukkna→trʏhhkna). Guarded `preaspirate` to skip when the
  preceding token is already [h] (drukkna→trʏhkna). (55 words.)

Net **+0.3pp → 80.1%** (the g→ɣ broadening trades a few loans where the referee keeps [k], but all three rules are
phonologically correct; symbol accuracy rose 96.7→96.8). Also fixed a stale ⟨e é⟩-palatalization code comment.
