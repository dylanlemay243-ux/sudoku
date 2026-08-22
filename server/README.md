# Sudoku backend

One Cloudflare Worker and one D1 (SQLite) database. Free tier covers this
comfortably — D1 gives 5 GB and 5 million row reads a day, a Worker gives
100,000 requests a day. A solve is one small insert.

## Deploy

```bash
npm install -g wrangler
wrangler login

cd server
wrangler d1 create sudoku          # copy the printed database_id
# paste it into wrangler.toml, then:
wrangler d1 execute sudoku --remote --file=schema.sql
wrangler deploy
```

Wrangler prints a URL like `https://sudoku-api.yourname.workers.dev`. Put it in
`www/index.html`'s config line (see the app README) and rebuild.

## How it works

No accounts. Each install makes a random device id on first launch and stores it
locally. The nickname from Settings is sent alongside as a display label, so two
people can share a name and still be separate rows. Uninstalling loses the
history — that is the trade for having no sign-in.

The daily puzzle is never transmitted. `GET /api/daily` returns a seed string
(the date), and every device generates an identical grid from it. The solution
only ever exists on the phone.

## Endpoints

| Route | Returns |
| --- | --- |
| `GET /api/daily` | `{seed, clues}` — the day's puzzle seed |
| `POST /api/solve` | records `{device, name, mode, seconds}`; one daily result per device per day |
| `GET /api/board?type=daily\|fastest\|streaks\|rating&device=…` | up to 100 ranked rows |

`rating` is a rolling 30-day average of `3000 × difficulty weight ÷ seconds`,
mapped onto a 1200-ish scale. It is a reasonable ordering, not a real Elo.

## What this does not do

Times are self-reported by the client, so a determined person could fake one.
Fixing it properly means replaying the move log server-side. At your scale, if
someone posts a 4-second Fiendish, delete the row:

```bash
wrangler d1 execute sudoku --remote --command "DELETE FROM solves WHERE seconds < 60"
```
