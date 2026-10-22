// The movie as a graph of scenes. Each scene plays a clip, then optionally
// asks the phones for an interaction before moving on.
//
// interaction.type picks the phone UI (see interactions/index.js).
// interaction.threshold is the share of connected players who must respond.
// interaction.timeoutMs moves on anyway if the room stalls.

export const START = 'meteor';

// Clips are fetched from Higgsfield and trimmed of black frames into
// public/clips/ by scripts/prepare-clips.mjs (sources in clips.json).
// A missing clip is skipped.

export const scenes = {
  meteor: {
    // Meteor over the planet; camera pushes in to reveal it's a ship.
    clip: 'clips/meteor.mp4',
    next: 'descent',
  },
  descent: {
    clip: 'clips/descent.mp4',
    next: 'crash',
  },
  crash: {
    clip: 'clips/crash.mp4',
    next: 'wake',
  },
  wake: {
    clip: 'clips/wake.mp4',
    // Plays on loop while the phones work the belt.
    loopClip: 'clips/wake-loop.mp4',
    interaction: {
      type: 'slideUnlock',
      prompt: 'Unlock your seat belt',
      label: 'slide to unlock',
      threshold: 1,
      timeoutMs: 60000,
    },
    next: 'exit',
  },
  exit: {
    clip: 'clips/exit.mp4',
    next: null,
  },
};
