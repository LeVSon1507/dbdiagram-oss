---
version: alpha
name: Vintage Tactile Studio (Light & Dark)
description: A refined, architectural design system built on warm, tactile surfaces. The light mode evokes the feel of raw linen and vintage drafting paper, while the dark mode inverts into a deep, focused dark-roast environment. The system relies on earthy accents and strict structural boundaries, prioritizing clean readable code and diagramming.

colors-light:
  bg: "#f8f3ea"
  panel: "#fffaf2"
  panel-raised: "#fffdf8"
  panel-muted: "#f2e7d7"
  border: "#deceb6"
  border-strong: "#c8ae88"
  text: "#322619"
  text-muted: "#6c5944"
  text-faint: "#9a856c"
  accent: "#eaddc0"
  accent-hover: "#dcc9a8"
  accent-soft: "#f7f0e2"
  accent-ink: "#8e6a3f"
  on-accent: "#3a2d20"
  success: "#648a5d"
  danger: "#b84f4f"

colors-dark:
  bg: "#1e1915"
  panel: "#27211c"
  panel-raised: "#322a24"
  panel-muted: "#171310"
  border: "#42382f"
  border-strong: "#665749"
  text: "#eee6d8"
  text-muted: "#b0a394"
  text-faint: "#7a6f64"
  accent: "#8e6a3f"
  accent-hover: "#755631"
  accent-soft: "#3a2d20"
  accent-ink: "#eaddc0"
  on-accent: "#f8f3ea"
  success: "#739c6b"
  danger: "#c95d5d"

typography:
  display-1:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1.5px
  heading-1:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.5px
  heading-2:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.25px
  title:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  body-md:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  code:
    fontFamily: "JetBrains Mono", "Fira Code", monospace
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0.2px

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px

components:
  nav-bar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    borderBottom: "1px solid {colors.border}"
    padding: 12px 16px
  
  canvas-area:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
  
  sidebar:
    backgroundColor: "{colors.panel-muted}"
    borderRight: "1px solid {colors.border}"
    textColor: "{colors.text-muted}"

  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    border: "1px solid {colors.border-strong}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 16px
    
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    
  node-card:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text}"
    border: "1px solid {colors.border-strong}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 12px
    shadow: "0 4px 12px rgba(50, 38, 25, 0.08)"
---

## Overview

This system transforms the default bright, clinical IDE feel into a highly focused, tactile workspace. Drawing inspiration from vintage drafting tables, retro UI palettes, and the organic texture of linen, the environment is designed for extended architectural thinking and deep database modeling without eye strain.

The color palette is meticulously structured. Rather than relying on heavy shadows for depth, this system uses subtle warmth and strict border delineations to separate code editors from visual canvases.

### The Two Modes

1- **Light Mode (The Drafting Paper):** Uses warm off-whites (`#f8f3ea` and `#fffaf2`) as the base. The contrast is kept soft but deliberate. Buttons and accents use an earthy beige (`#eaddc0`) with a dark, rich ink text (`#3a2d20`) that reads like printed type on classic stationary.
2- **Dark Mode (The Night Studio):** Flips the paradigm into a deep, espresso-toned dark space (`#1e1915`). Borders become muted charcoal (`#42382f`), and text shifts to a soft, warm parchment white (`#eee6d8`). The accent color transforms into a golden-bronze (`#8e6a3f`) to provide clear visual hierarchy without the jarring neon typical of modern dark themes.

## Color Usage & Principles

### Backgrounds & Surfaces

1- **`--bg`**: The lowest layer. Used for the infinite diagramming canvas and the deepest background behind modals.
2- **`--panel`**: The primary working surface. Used for the DBML text editor background, sidebars, and main structural blocks.
3- **`--panel-raised`**: Elevated surfaces. Used for the floating database table nodes inside the diagram canvas, dropdown menus, and tooltips.
4- **`--panel-muted`**: Secondary containment. Great for active line highlights in the code editor, or inactive tabs.

### Borders

1- **`--border`**: The standard structural divider. Used to separate the sidebar from the editor, and the editor from the canvas.
2- **`--border-strong`**: High-contrast edges. Used for wrapping database table nodes, primary buttons, or form inputs to ensure they pop against the soft backgrounds.

### Typography & Ink

1- **`--text`**: Primary content. Variables, table names, and standard UI text.
2- **`--text-muted`**: Secondary information. Data types in the diagram, line numbers in the editor, and placeholder text.
3- **`--text-faint`**: Unobtrusive metadata. Grid coordinates, timestamps, or disabled states.

### Actions & Accents

1- **`--accent`**: The primary fill for CTAs, active states, and selected nodes.
2- **`--accent-ink`**: Used for text-based emphasis. Perfect for syntax highlighting keywords (like `Table`, `Project`) or active tab underlines.
3- **`--on-accent`**: Guaranteed high-contrast text to sit inside the `--accent` fill.

## Do's and Don'ts

1- **DO** use `--bg` for the infinite diagram canvas. The warmth reduces eye strain during long modeling sessions.
2- **DO** rely on `--border` and `--border-strong` to define architecture. Clean, rigid boundaries look more professional than excessive drop shadows.
3- **DO** invert the roles of `--accent` and `--accent-ink` intelligently in Dark Mode to maintain legibility.
4- **DON'T** mix in unrelated bright colors (neons, sharp cyans). If you need status indicators, stick strictly to the desaturated `--success` and `--danger` provided.
5- **DON'T** use heavy font weights for the code blocks. Keep the DBML editor crisp with a weight of 400.
