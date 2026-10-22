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

Use `?room=name` on both pages to run separate rooms.

## Clips

Each scene's clip is set in `src/story.js`: either a URL (the rendered clips
live on the Higgsfield CDN) or a file in `public/clips/`. Missing clips show a
title card so the flow can be tested without footage.

| Scene | Shot | Status |
| --- | --- | --- |
| meteor | Meteor over the alien desert; camera pushes in to reveal a burning ship | rendered |
| descent | Ship tumbles through the atmosphere toward the ground | rendered |
| crash | Ship slams into the desert and skids to a stop | rendered |
| wake | Close-up: the astronaut's eyes open in the wrecked cockpit, strapped in (+ idle loop while phones unlock) | to do |
| exit | Belt releases, astronaut climbs out onto the planet | to do |

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/pages.yml` (Settings > Pages > Source must be "GitHub Actions").
The Realtime Database needs the rules in `database.rules.json`.
