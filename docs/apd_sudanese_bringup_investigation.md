# Sudanese Arabic (apd) bring-up investigation

3rd Arabic VARIETY. Same architecture as arz/apc (shared engine + `sudanese.jsonc` shifts + ISO code `apd`), BUT
with a crucial difference: **no independent referee exists.** wikipron has no apd (broad + narrow both 404; the
scraped Arabic varieties are acm/afb/ajp/apc/ary/arz/ayl), and there is no free Sudanese pronunciation corpus.

## Run 1 — 2026-07-17 — authored consonants, gold-anchored (🔷)

AUTHORED from published Sudanese phonology (Dickins, *Sudanese Arabic Phonematics*). Sudanese is the OPPOSITE of
Egyptian/Levantine on two axes and CONSERVATIVE on a third:
- **ق → [ɡ]** (voiced velar — the Bedouin reflex, NOT urban [ʔ])
- **ج → [ɟ]** (voiced PALATAL plosive — the Sudanese signature; Egyptian [ɡ], Levantine [ʒ])
- **interdentals KEPT**: ث→[θ], ذ→[ð], ظ→[ðˤ] (Egyptian/Levantine merge them to stops) — so NO θ/ð shift here
- historical diphthongs monophthongized: ay→[eː], aw→[oː] (Khartoum)

So `sudanese.jsonc` has just two consonant shifts (ق→ɡ, ج→ɟ) + the diphthongs; it does NOT strip the interdentals.

Verified against published forms (the gold in test/arabic.test.ts IS the anchor — no referee to measure):
قال→ɡaːl, جمل→ɟamal, جديد→ɟadiːd, ثلاثة→**θalaːθa** (θ kept), ذهب→**ðahab** (ð kept), بيت→beːt, قلب→ɡalb. MSA untouched.

**Status 🔷 single-source verified** (the Wu/Igbo pattern): the distinctive consonant fingerprint is corroborated
against the phonology literature but NOT measured (no referee). The shared MSA vowels are the same data-limited tail
as arz/apc. `referees: []` + `secondaryGap` recorded; not in the floor set (nothing to measure).
