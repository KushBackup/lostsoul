# LostSoul

Interactive movie for a room of ~20 people. The big screen plays the film; each
viewer's phone shows the interaction the current scene needs.

- `/screen.html` big screen: QR code to join, plays clips, shows group progress
- `/play.html` phone: joins the room, renders the interaction for the scene
- `src/story.js` the scene graph (clips, interactions, what comes next)
- `src/interactions/` phone UIs (`slideUnlock` for now; vote, group button and
  incoming call slot in here)
- `src/sync.js` shared room state via Firebase Realtime Database; with no
  Firebase config it falls back to same-browser tabs for local testing

## Run

    npm install
    cp .env.example .env.local   # fill in Firebase web config
    npm run dev

Use `?room=name` on both pages to run separate rooms. On the big screen, the
Reset button (top-right, appears on hover) or the R key returns to the lobby.
The screen downloads every clip up front (Begin unlocks when done) and plays
them through `src/player.js`, a Media Source player that appends each clip to
one continuous stream, so there is no cut between clips. Interaction scenes
repeat their loop clip until the audience responds, then the next scene is
spliced in half a second ahead of the playhead. Use Chrome or Edge on the
big screen.

## Clips

Rendered clip URLs live in `clips.json`. `npm run clips` (needs ffmpeg)
downloads them into `public/clips/`, trims black frames off each end, and
re-encodes them all to one format (1080p, 24fps, VP9 + Opus fragmented MP4)
so the player can chain them; the deploy workflow runs it on every push.
`src/story.js` points each scene at its trimmed file. Missing clips are skipped.

| Scene | Shot | Status |
| --- | --- | --- |
| meteor | Meteor over the alien desert; camera pushes in to reveal a burning ship | rendered |
| descent | Ship tumbles through the atmosphere toward the ground | rendered |
| crash | Ship slams into the desert and skids to a stop | rendered |
| wake | Close-up: the astronaut's eyes open in the wrecked cockpit, strapped in (+ idle loop while phones unlock) | rendered |
| exit | Belt releases, astronaut climbs out onto the planet | rendered |

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/pages.yml` (Settings > Pages > Source must be "GitHub Actions").
The Realtime Database needs the rules in `database.rules.json`.
