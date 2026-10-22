// The movie as a graph of scenes. Each scene plays a clip, then optionally
// asks the phones for an interaction before moving on.
//
// interaction.type picks the phone UI (see interactions/index.js).
// interaction.threshold is the share of connected players who must respond.
// interaction.timeoutMs moves on anyway if the room stalls.

export const START = 'meteor';

// Rendered clips live on the Higgsfield CDN. A local path under public/clips/
// works too; missing clips fall back to a title card.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38QdbUHk0Ivb2gyinnJUmo3sJtJ/';

export const scenes = {
  meteor: {
    // Meteor over the planet; camera pushes in to reveal it's a ship.
    clip: CDN + 'hf_20261022_172545_6b41378a-eb05-4ff5-a192-fb29f8609dad.mp4',
    next: 'descent',
  },
  descent: {
    clip: CDN + 'hf_20261022_172545_b646cbb6-352f-426c-988a-f12052c88e88.mp4',
    next: 'crash',
  },
  crash: {
    clip: CDN + 'hf_20261022_172545_9786f10a-0fed-49b7-a9cd-9667031033b1.mp4',
    next: 'wake',
  },
  wake: {
    clip: CDN + 'hf_20261022_173353_ac16d2cb-0a7b-41dd-bb10-7a68448563bf.mp4',
    // Plays on loop while the phones work the belt.
    loopClip: CDN + 'hf_20261022_173405_51afb539-3a8a-4ecd-a580-48b573dcaf32.mp4',
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
    clip: CDN + 'hf_20261022_173405_0e1b4ae5-63fd-4d68-a0ed-1fc54fb52f85.mp4',
    next: null,
  },
};
