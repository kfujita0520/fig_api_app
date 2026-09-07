# README

## Overview

This repository demonstrates how to package and consume reusable UI components for Figment applications. It contains a reusable UI library, example applications, and a standalone web application for API testing and development.

## Repository Structure

### `widget/`

Contains the reusable UI components (e.g. `packages/stake-widget`).

The components in this folder can be packaged as a **tarball** (`.tgz`) and distributed for use in other applications. This is the package that should be published or shared when integrating the UI into another project.

### `demoWidget/`

Vite host that embeds `@fig/stake-widget` with a same-origin BFF under `api/` (`FIGMENT_API_KEY`, optional `SOLANA_RPC_URL`). Preferred demo for key-hiding mode.


### `figapp-react/`

A simple standalone web application for interacting with the API.

This project is useful for testing API endpoints independently of the UI component package and for quickly validating backend functionality during development.

## Recommended Workflow

- Use **`demoWidget`** during development for the BFF-backed widget host.
- Build and package **`widget/packages/stake-widget`** as a tarball when validating the distribution package.
- Use **`demo`** to verify that the packaged tarball installs and behaves correctly in a consumer application.
- Use **`figapp-react`** for standalone API testing and development.

## Purpose

This repository serves as both:

- A development environment for reusable UI components.
- A reference implementation showing how those components are packaged and consumed by downstream applications.
