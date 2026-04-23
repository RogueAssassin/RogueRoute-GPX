# Dependencies

## Supported software standard
Use this stack for a supported RogueRoute GPX install:

- **Node.js:** 24.15.0
- **Package manager:** pnpm 10.33.1
- **Activation:** Corepack 0.34.7
- **Containers:** Docker with `docker compose`
- **Git:** required for clone-based installs and Git-based updates only

## Important notes
- `npm install` is not the supported workspace install method for this project.
- If Corepack is available, the helper scripts will try to activate the pinned pnpm version automatically.
- If Corepack is not available, install pnpm `10.33.1` manually.


## Repo guardrails
The repo ships with these helper files to keep installs consistent:

- `.nvmrc`
- `.node-version`
- `.npmrc`

These help contributors stay on the supported Node.js and pnpm versions and discourage unsupported npm-based workspace installs.
