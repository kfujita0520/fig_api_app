# README

## Overview

This repository demonstrates how to package and consume reusable UI components for Figment applications. It contains a reusable UI library, a host that consumes the package, and a standalone app with the UI source inlined.

## Repository Structure

### `widget/`

Reusable UI library (`packages/stake-widget`). Package this as a **tarball** (`.tgz`) when integrating into other applications as `@fig/stake-widget`.

### `widgetDemo/`

Vite host that **imports** `@fig/stake-widget` and talks to a same-origin BFF (`FIGMENT_API_KEY`, optional `SOLANA_RPC_URL`). Preferred demo for the packaged-widget workflow.

### `standAppDemo/`

Self-contained sample: the stake UI lives under `src/stake-widget/` (no `@fig/stake-widget` dependency), plus the same BFF pattern. Use this when you do **not** want the widget package — copy the folder and run it as a normal app.

## Recommended Workflow

- Use **`widgetDemo`** when consuming `@fig/stake-widget` as a library.
- Build and pack **`widget/packages/stake-widget`** when distributing the package.
- Use **`standAppDemo`** as a copy-paste app that includes the UI source.

## Purpose

This repository serves as both:

- A development environment for reusable UI components.
- A reference implementation showing how those components are packaged and how they can be inlined instead.
