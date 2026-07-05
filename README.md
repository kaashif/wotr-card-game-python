# wotr-card-game

Static browser implementation of *War of the Ring: The Card Game*.

The implementation is organized around a pure TypeScript game engine that runs
under Node. The browser is only a renderer and input surface over that engine.

## Current Source Material

- Rules: `references/text/WaroftheRingCardGame_v1.1.txt`
- Cards, paths, battlegrounds: `references/text/All_War_of_the_Ring_cards_with_their_characteristics_and_functions_version_0.2.txt`
- Generated TypeScript data: `src/referenceData.ts`

Regenerate sourced data after editing the card/location reference:

```sh
node scripts/generate-reference-data.mjs
```

## Development

```sh
npm install
npm test
npm run build
```

`npm test` exercises the game engine directly in Node. `npm run build` runs
TypeScript checking and emits the static Vite app in `dist/`.

## GitHub Pages

The Pages workflow in `.github/workflows/pages.yml` runs:

1. `npm ci`
2. `npm test`
3. `npm run build`
4. Deploy `dist/`

No backend is required.
