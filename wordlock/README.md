# Wordlock

Memorable passphrases, not gibberish. Wordlock builds passwords out of real words you can
actually hold in your head — lock the ones you like, reroll the rest, and watch an honest
strength meter the whole way.

It's a single static page. No build step, no dependencies, no network required. Open
`index.html` in any browser and go.

## Why word-based passwords

The hard-to-remember string `xK9#mP2$vL` maximizes entropy per character but is useless to a
human. A passphrase like `velvet-otter-canyon-glow` reaches comparable strength while staying
memorable, because the security comes from picking several words at random out of a large pool.

Wordlock leans into that:

- **Lock & reroll** — tap a word to reroll it, tap its lock to keep it. Compose a phrase that
  sticks for *you*, then lock the keepers and reroll the rest.
- **Themed flavors** — Space, Nature, Mythos, Food, Animals, Music, plus a larger Common pool.
- **Honest strength meter** — shows real entropy in bits, computed from the actual pool size,
  plus an offline crack-time estimate.
- **Extras** — capitalize, append a number, append a *random* symbol (real entropy), or do a
  light leet swap (cosmetic only — and the meter says so).
- **Length cap** — for sites that reject long passwords; rerolls to fit instead of truncating.
- **Say-it-aloud check** — flags when extras start hurting memorability.
- **Saved phrases** — a local shortlist via `localStorage`.

## On security and "scrapable" word lists

A common worry: if the word list is public, are the passwords weak? **No** — and that's by
design (Kerckhoffs's principle). The strength lives in the random *selection*, never in hiding
the words. The strength meter already assumes an attacker has the entire list. Diceware, the
technique this is based on, ships a fully public list and is still strong.

So the lever for more strength isn't a secret list — it's a **bigger** list and **more words**.
Every word is chosen with `crypto.getRandomValues`, never `Math.random()`.

## Maximum strength: use the EFF flavor

The friendly themed pool is ~500 words (~9 bits/word). For maximum strength, choose the built-in
[EFF Diceware long wordlist](https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt)
(7,776 words, ~12.9 bits/word) from *Word flavor*.

A 4-word EFF phrase lands around 52 bits (Strong); 6 words around 78 bits (Excellent).
You can still click **Load custom wordlist (.txt)** to use your own plain-text word pool.
Custom lists are read entirely in your browser (no upload, no network) and parsed on the spot.
The EFF list is licensed CC-BY — credit the EFF if you redistribute it.

## Files

| File         | Purpose                                            |
|--------------|----------------------------------------------------|
| `index.html` | Markup; loads the stylesheet and scripts           |
| `styles.css` | All styling                                        |
| `app.js`     | App logic (generation, entropy, saving, importing) |
| `words.js`   | The word banks — edit or extend these freely       |

To add or change words, edit `words.js` only. The meter recomputes entropy from whatever pool
it finds, so a bigger list automatically shows as stronger.

## Run it

Just open `index.html`. Optionally serve it locally:

```sh
python3 -m http.server
# then visit http://localhost:8000
```

## Status

A prototype. It generates strong passphrases, but it is **not** a password manager — saved
phrases are stored as plaintext in your browser. Move your final pick into a real manager.

## License

MIT — see `LICENSE`.
