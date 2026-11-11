# Brand assets

Drop the incoming branding and layout files here:

- Logo files (SVG preferred, plus PNG exports)
- Fonts (WOFF2 preferred) and their licence files
- Colour palette (hex values, or a swatch file)
- Layout mockups and design files (PDF, Figma exports, images)

The design phase reads from this folder and moves the values into
`src/styles/tokens.css`. Files here are treated as content: automated agents never
change them, and agent PRs that touch this folder are never auto-merged.
