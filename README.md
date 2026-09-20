# Labophot Companion

A bench companion app for Charlie's Nikon Labophot 1. Keep it open next to the microscope: an interactive 3D model you can orbit and click, with operating guides, troubleshooting, session tools, history and provenance in a side panel.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## What is in it

- **3D model** (`src/scene/microscope.js`): a procedural Labophot built from primitives in Three.js. Twelve selectable parts (head, eyepieces, nosepiece, objectives, stage, condenser, polarizer, focus, arm, illuminator, base, side lights). Hover to label, click to frame and read about it. The turret rotates to whichever objective is selected (keys 1–5).
- **Ask** (`src/ui/ask.js`): local question answering over the bundled knowledge base. No network, no model: keyword and text scoring over parts, objectives, FAQ, troubleshooting and guides.
- **Guides**: quick start, Köhler illumination (stepper that frames the relevant part as you go), 100× oil immersion, viewing modes, care, things to look at, troubleshooting.
- **Session**: checklist, current objective, bench log. Stored in `localStorage`.
- **History**: Nikon and Labophot timeline, the finite 160 mm compatibility note.
- **Archive**: photos, the original operating notes and component sheet, sources.

All content lives in `src/data/knowledge.js`; edit that file to correct or extend anything.

## Keys

`R` reset view · `Space` auto-rotate · `P` toggle panel · `/` Ask · `1–5` objectives · `Esc` deselect

## Provenance

Built from the original field guide (Nikon Labophot manuals, Nikon MicroscopyU, and Charlie's own purchase notes). Values marked "typical" are for the magnification class, not read from the barrels; see the Archive tab for what is still worth verifying on the instrument.
