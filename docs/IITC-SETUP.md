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

## Features
- selected/view/polygon/circle export
- route-name prompt on export
- route optimization helpers
- preflight checks
- direct website handoff
- copy payload / copy coordinates helpers
- saved website URL and route settings

## Installation
1. Install Tampermonkey.
2. Open the `.user.js` file from GitHub raw or the website download URL.
3. Confirm installation in Tampermonkey.
4. Open IITC and use the `RogueRoute GPX` button.

## Automatic updates
The v6.4 plugin includes:
- `@version`
- `@updateURL`
- `@downloadURL`

That allows Tampermonkey to check for and install newer versions when the hosted script changes.
