# GPT Navigator Helper — Chrome Web Store images

Artwork for the 0.6.1 visual style. Uses the supplied SVG icon, Geist typography, and neutral white/charcoal surfaces.

| Upload field | File | Size |
| --- | --- | --- |
| Small promotional tile (required) | 01-small-promo-440x280.png | 440 × 280 |
| Marquee promotional tile (optional) | 02-marquee-1400x560.png | 1400 × 560 |
| Screenshot 1 — automatic preparation | 03-screenshot-automatic-1280x800.png | 1280 × 800 |
| Screenshot 2 — light and dark themes | 04-screenshot-themes-1280x800.png | 1280 × 800 |
| Screenshot 3 — short-conversation status | 05-screenshot-status-1280x800.png | 1280 × 800 |

Upload the PNG files individually to their matching fields. All exports are opaque 24-bit RGB PNGs, with square full-bleed canvases at the required dimensions. Only the final PNGs and their checksum manifest are kept in Git.

Screenshot artwork contains actual production-extension popup captures with synthetic 30-prompt and four-prompt conversation data. These are promotional compositions of the popup, not screenshots of a live ChatGPT conversation. No private conversations are included. The generator recreates source captures and self-contained HTML layouts in the ignored `sources/` folder.

The icon source is `icons/chatgpt-conversation-navigator.svg`; its shape is preserved. Geist is from @fontsource-variable/geist 5.3.0, licensed under SIL OFL 1.1, included at `../public/licenses/Geist-OFL.txt` and copied to generated `sources/Geist-OFL.txt`.

To regenerate from the repository root:

```sh
npm run build
node scripts/generate-store-assets.mjs
```

Official size requirements checked 2026-09-10: https://developer.chrome.com/docs/webstore/images
