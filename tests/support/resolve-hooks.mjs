// Lets Node load the zone's TypeScript server modules directly in tests.
//
// Two gaps between Next's bundler and native ESM, both closed here and only here
// (the app itself is built by Next, which resolves them normally):
//  1. `next` publishes no "exports" map, so the bare subpath `next/server` is
//     mapped to its file.
//  2. The app imports sibling modules without an extension ('./access'), so a
//     relative specifier with no extension is tried as '.ts'.
import { registerHooks } from 'node:module';

const MAP = { 'next/server': 'next/server.js' };

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = MAP[specifier] ?? specifier;
    if (/^\.\.?\//.test(mapped) && !/\.[cm]?[jt]sx?$/.test(mapped)) {
      try {
        return nextResolve(`${mapped}.ts`, context);
      } catch {
        /* fall through to the default resolution */
      }
    }
    return nextResolve(mapped, context);
  },
});
