# README

## Overview

This repository demonstrates how to package and consume reusable UI components for Figment applications. It contains a reusable UI library, example applications, and a standalone web application for API testing and development.

## Repository Structure

### `figapp/`

Contains the reusable UI components.

The components in this folder can be packaged as a **tarball** (`.tgz`) and distributed for use in other applications. This is the package that should be published or shared when integrating the UI into another project.

### `demo/`

Demonstrates how to consume the packaged UI components.

This application installs the **tarball package** generated from `figapp` and shows how it can be integrated into an external application, simulating the real-world consumption workflow.

### `demoapp/`

Provides the same functionality as `demo`, but imports the components **directly from `figapp`** instead of using the packaged tarball.

This setup is intended for development, making it much easier to verify changes without rebuilding and reinstalling the tarball after every modification.

### `figapp-ract/`

A simple standalone web application for interacting with the API.

This project is useful for testing API endpoints independently of the UI component package and for quickly validating backend functionality during development.

## Recommended Workflow

- Use **`demoapp`** during development for rapid iteration on UI components.
- Build and package **`figapp`** as a tarball when validating the distribution package.
- Use **`demo`** to verify that the packaged tarball installs and behaves correctly in a consumer application.
- Use **`figapp-react`** for standalone API testing and development.

## Purpose

This repository serves as both:

- A development environment for reusable UI components.
- A reference implementation showing how those components are packaged and consumed by downstream applications.
