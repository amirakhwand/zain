# Zainle: get to ZAIN

A daily word ladder game. Everyone gets the same 4-letter start word each day
and must reach **ZAIN** by changing **one letter at a time**, where every step
is a real English word. The fewest possible steps is **par**.

```
HALL → HAIL → MAIL → MAIN → ZAIN      (par 4)
```

## How the game works

| Rule | Detail |
|---|---|
| One change per step | Exactly one letter changes. No adding, removing or rearranging. |
| Real words only | Every step must be in the dictionary (3,189 four-letter words). |
| Par | The true shortest route to ZAIN, computed over the *whole* dictionary, so nobody can beat it. |
| Daily word | A new puzzle at the player's local midnight. Puzzle #1 is 6 Nov 2026. |
| Difficulty curve | Monday is par 3, then it climbs to par 6 at the weekend. |
| Wordle-style play | Type the next word into the empty row and press Enter. Letters already in ZAIN's position turn green. |
| Stuck? | "Show the answer" (in stats) reveals the shortest route but counts as a loss. |
| Yesterday's answer | Shows the previous day's shortest route. |
| Practice | Endless random puzzles from the same pool. |
| Stats | Played, solved %, at-par count, streaks, steps-over-par chart (stored in the browser). |
| Share | Spoiler-free emoji grid: 🟩 = letter in ZAIN's spot, ⬛ = not yet. |

### Example share
```
Zainle #4 3/3 ⭐
BAIL → ZAIN

⬛🟩🟩⬛
⬛🟩🟩⬛
⬛🟩🟩🟩
🟩🟩🟩🟩
```

## The puzzle database

`scripts/generate.mjs` builds it all from the open SCOWL word list:

1. **Dictionary:** every 4-letter word up to SCOWL size 70 is accepted as a guess.
   Words at size 35 or below are the "common" set.
2. **Search:** a breadth-first search outward from ZAIN finds the distance of every word.
3. **Start words:** common words 3–7 steps away whose shortest route uses only
   common words, so the intended answer never needs an obscure word. Words in
   `scripts/blocklist.txt` are never used as start words or in solutions.
   This gives **630 start words**.
4. **Schedule:** a seeded shuffle assigns one word per day for **4 years (1,460 days)**,
   matched to the weekday difficulty. No word repeats until all 630 are used.

Outputs:
- `public/words.js`: the dictionary
- `public/puzzles.js`: the daily schedule and the Unlimited pool
- `data/schedule.csv`: a readable calendar with every day's answer (keep private!)

To change the launch date, schedule length or shuffle, edit the constants at the
top of `scripts/generate.mjs` and run:

```bash
npm install
npm run generate
npm test          # checks every puzzle is solvable at its par
```

## Running it

It's a static site with no build step and no backend.

```bash
npm start         # http://localhost:8080
```

### Hosting

Live at **https://zainle.amirakhwand.workers.dev** on Cloudflare Workers.
`wrangler.jsonc` tells Cloudflare to serve the `public/` folder, and every
push to `main` redeploys it automatically.

The old GitHub Pages address (amirakhwand.github.io/zain) now just redirects
to the new link (`redirect/` and `.github/workflows/pages.yml`).
