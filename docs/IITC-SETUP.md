# IITC Setup Guide

## Plugin file
```text
plugins/iitc/gpx-route-generator.user.js
```

## Website download URLs
```text
/downloads/iitc/gpx-route-generator.user.js
/downloads/iitc/rogueroute-exporter.user.js
```

## What the plugin gives you
- selected, view, polygon, and circle export
- route-name prompt on export
- route optimization helpers
- preflight checks before sending data to the website
- direct website handoff
- copy payload and copy coordinates helpers
- saved website URL and route settings

## Installation
1. Install Tampermonkey.
2. Open the `.user.js` file from GitHub raw or the website download URL.
3. Confirm installation in Tampermonkey.
4. Open IITC and use the `RogueRoute GPX` button.

## Automatic updates
The v8 plugin includes `@version`, `@updateURL`, and `@downloadURL`, so Tampermonkey can detect newer hosted versions when the userscript file changes.
