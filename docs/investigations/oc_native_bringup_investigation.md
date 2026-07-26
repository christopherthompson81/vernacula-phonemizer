# Occitan (occitan / lenga d'òc, oc) bring-up — Occitano-Romance, Latin, southern France (~200k)

Occitan — a Gallo-Romance language of southern France + val d'Aran (Spain) + Piedmont. HEAVILY DIALECT-FRAGMENTED
(Languedocien, Provençal, Gascon/Béarnés, Auvergnat, Limousin, Vivaro-Alpin). We target **Languedocien** (the central
reference standard, the basis of the classical norm). Referee: **wikipron `oci_latn_broad`** (human, CUNY-CL, 748
raw rows / 675 headwords after variant-merge — SMALL + dialect-mixed) + kaikki 1136 IPA (but explicitly Béarn/Niçard
dialect-tagged → not used as a clean Languedocien referee). espeak ships NO Occitan (beyond-espeak).

## Run 1 — 2026-07-26 — the Languedocien Ibero/Gallo-Romance g2p

**The signature vowel rules (Languedocien, verified from the referee):**
- **final unstressed ⟨a⟩ → [ɔ]** (França→fɾansɔ, América→ameɾikɔ) — the referee writes it o ~ ɔ ~ o̞ ~ ɒ ~ a (dialect
  spread) → we emit [ɔ], fold the variants.
- **unstressed ⟨o⟩ → [u]** (Barcelona→baɾselunɔ, Japon→dʒapun, Conhac→kuɲak) — the big Occitan feature.
- **⟨ò⟩ → [ɔ]** (stressed open, Antòni→antɔni), **⟨ó⟩ → [u]**, **⟨u⟩ → [y]** (Frejús→fɾedʒys), ⟨u⟩ post-vocalic → [w]
  (Bordèu→buɾdɛw), ⟨è⟩→[ɛ], ⟨é⟩/⟨e⟩→[e]. Diphthongs ai→aj, au→aw, uè→[ɥɛ].

**Consonants:** ⟨lh⟩→[ʎ] (filha→fiʎɔ), ⟨nh⟩→[ɲ] (montanha→muntaɲɔ), ⟨ch⟩→[t͡ʃ] (Ardecha→aɾdet͡ʃɔ; referee t͡ʃ~t͡s),
⟨j⟩ + ⟨g⟩ before e/i → [d͡ʒ]~[ʒ] (Girona→dʒiɾunɔ), ⟨c⟩→[k] / [s] before e/i, ⟨ç⟩→[s], ⟨qu gu⟩→[k ɡ], ⟨h⟩ silent,
intervocalic ⟨s⟩→[z] (Lisbona→lizbunɔ), ⟨v⟩→[b] (betacism), single ⟨r⟩→[ɾ] tap / ⟨rr⟩/initial→[r]. Final ⟨n⟩ after a
vowel often DROPS (Japon→dʒapu ~ dʒapun — dialect). SPIRANTIZATION (intervocalic b/d/g→β/ð/ɣ) is allophonic +
dialect-variable → we emit the stops and FOLD β→b ð→d ɣ→ɡ.

**Stress:** the Ibero/Gallo pattern — penult if the word ends in a vowel, ⟨-s⟩, or ⟨-n⟩; oxytone (final) otherwise;
a written accent (á é í ó ú, à è ò) overrides. Folded vs the referee (which marks none consistently).

**FOLDED (dialect + notation):** the final-⟨a⟩ vowel spread (o o̞ ɒ a → ɔ), the rhotic ʁ~r~ɾ, spirantization
(β ð ɣ → b d ɡ), the ch t͡ʃ~t͡s variant, ⟨lh⟩ ʎ~j, stress ˈ. 🔷 thin + dialect-mixed single source.

## Run 2 — 2026-07-26 — Languedocien core → 68.7% folded / 93.0% symbol

Built the greedy scan + rules and iterated against wikipron `oci_latn_broad` (675 headwords, dialect-mixed).
Progression (folded backbone): 51.7% → **68.7%**. The wins, each measured:

- ⟨i⟩ prevocalic → [j] (Califòrnia→kalifɔɾnjɔ) + a fold fix (the ʒ→d͡ʒ fold CORRUPTED an existing d͡ʒ into dd͡ʒ — fold
  d͡ʒ→ʒ on both sides instead) + final obstruent DEVOICING (Nòrd→nɔɾt) + ⟨s⟩→[z] before a voiced consonant
  (Lisbona→lizbunɔ) + ⟨n⟩→[ŋ] before a velar: →54.1%.
- **the Languedocien FINAL-CONSONANT DELETION** — a word-final ⟨n⟩ after a vowel drops (Japon→dʒapu,
  Perpinhan→peɾpiɲa): +3.7pp → 57.8%; and **the final-⟨r⟩ drop** (infinitives/polysyllables: cantar→kanta,
  abandonar→abanduna, aborrir→abuɾi): **+11pp** — the single biggest lever, a hallmark of Languedocien.

**Residual (all 1× — the referee is only 675 words):** DIALECT noise the fold can't fully reconcile (Charanta t͡s vs
our t͡ʃ, Marselha ʁ, Lengadòc pretonic a→o), STRESS-conditioned glides (Argeria→aɾd͡ʒeɾiɔ: the -ía is TONIC so ⟨i⟩
stays [i], but we glide it → needs a stress model), and irregular place names (Montpelhièr, Navarrencs).

### The dialect decision (user steer — option (b): ship the Languedocien core)

Occitan's classical orthography is **pan-dialectal (a diasystem)**: the same spelling is read differently per dialect,
so the g2p target is a DIALECT CHOICE, not a text property. We target **Languedocien** (the de-facto koine + the most
likely FLEURS reader dialect + the wikipron referee's core features). Caveats, held honestly:

- **FLEURS `oc` audio dialect is UNVERIFIED** — FLEURS is built on FLoRes classical-orthography text (dialect-neutral),
  and per-speaker dialect isn't published. Languedocien is the best inference; confirm against an audio sample if
  pronunciation fidelity becomes critical.
- **The referee is dialect-MIXED** (wikipron 675: ʁ/ɾ, t͡ʃ/t͡s, final-a o~ɔ~ɒ~a in one file; kaikki 1136 is Béarn/
  Niçard-tagged, unusable as a Languedocien gold) → the 68.7% is a folded/noisy proxy, not a clean per-dialect score.
- **Dialect OVERRIDES (Gascon/Provençal/Niçard) are DEFERRED, not attempted** — there is no clean per-dialect data to
  build or validate them, and guessing them would be the `bho` circular-clone trap. The engine is a single Languedocien
  core; a `dialect` param (the pt-BR [[accent_variant_architecture]] pattern) is the natural future extension.

**FOLDED:** the final-⟨a⟩ dialect spread (o o̞ ɒ → ɔ), the rhotic (ʁ r → ɾ), spirantization (β ð ɣ → b d ɡ), ⟨ch⟩
(t͡s → t͡ʃ), ⟨lh⟩ (ʎ → j), the affricate (d͡ʒ → ʒ), stress. Run-2 plateau: **68.7% folded / 93.0% symbol.** 🔷 thin +
dialect-mixed single source.

## Run 3 — 2026-07-26 — 2-agent review fixes → 70.4% folded / 93.3% symbol

A correctness review caught two glide bugs, both verified against the referee:

- **⟨iu⟩ lost its nucleus → [jw]** (arriu→arjw): the i-glide fired before ⟨u⟩, then ⟨u⟩→[w] — a glide-glide with no
  vowel. Fixed: ⟨i⟩ does NOT glide before ⟨u⟩ (the falling diphthong [iw]: arriu→ariw, estiu→estiw). The productive
  ⟨-iu⟩ noun/adjective ending.
- **the u-glide over-fired in post-consonant hiatus** (afluent→aflwent): a plain ⟨u⟩ before a vowel after a consonant
  is the nucleus [y], not the offglide [w] (the rising [w] after ⟨q g⟩ is consumed earlier). Fixed: ⟨u⟩→[w] only
  when PRECEDED by a vowel (the falling au/eu/èu offglide); afluent→aflyent, continua→kuntinyɔ, situacion→sityasju.

Net **+1.7pp → 70.4%.** Also reconciled the intro referee-count (748 raw rows / 675 merged headwords).
