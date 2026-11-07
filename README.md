# SECOND GRAIN

A static research presentation connecting reclaimed timber evidence, stock-first design, saved allocations and preliminary structural analysis.

[Open the research website](https://yixumochi.github.io/second-grain-timber/showcase/)

The main presentation lives in `showcase/`. Its seven hash routes are Overview, Materials, Method, Cases and the three individual cases. Existing detailed viewers remain at the root, `case2/explore/` and `case3/`; their links return to the research overview.

There is no build step. GitHub Pages publishes `main` from the repository root. Asset URLs use the `/second-grain-timber/` base path, so a local server must mount this folder at that path.

## Presentation refinement

The November 2026 Impeccable pass adds a research overview, a shared reading hierarchy, self-hosted Newsreader and Public Sans, readable evidence captions, canonical navigation, lazy viewer loading and static fallbacks for response animations. Original research JSON, drawings, photographs and films are unchanged.

Run the navigation regression checks with `node --test tests/navigation.test.cjs`. Syntax checks and source validation covered local resource paths, seven chapter headings, 26 saved results and the main text-color pairs. Late animation initialization and reduced-motion timing were also checked in isolated JavaScript simulations.

Desktop/mobile screenshots and real-browser interaction checks were not completed: the browser tool timed out, and Windows UI automation subsequently stopped because it could not determine the current browser URL. Impeccable's CLI detector could not be downloaded successfully; this was a manual skill-guided review, not a clean detector result.

## Research boundaries

This site presents saved research records. Representative material appearance, atmosphere studies, preliminary calculations and unresolved physical verification remain distinguished in the source content. It does not run a new allocation or certify fabrication.

Font licenses are included in `assets/fonts/`. Font sources: [Newsreader](https://github.com/google/fonts/tree/main/ofl/newsreader) and [Public Sans](https://github.com/google/fonts/tree/main/ofl/publicsans).
