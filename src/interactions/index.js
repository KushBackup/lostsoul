// Phone UIs, keyed by the interaction.type used in story.js.
// Each takes (config, done) and returns a DOM element; call done(value) once.
import { slideUnlock } from './slideUnlock.js';

export const interactions = {
  slideUnlock,
};
