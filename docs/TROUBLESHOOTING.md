# Troubleshooting

## fatal: not a git repository
You are probably running from a release ZIP instead of a Git clone.

Newer deploy scripts skip Git pull automatically for release ZIP installs. If you are using an older script version, switch to the updated release or use a Git clone.

## network media-net not found
The updated deploy scripts create `media-net` automatically. If you still need to create it manually:

```bash
docker network create media-net
```

## HOST_PORT changed but the app still uses 9080
Use a release that maps Docker like this:

```yaml
${HOST_PORT:-9080}:9080
```

Older releases hardcode `9080:9080`.

## Valhalla says Nothing to do
Your `VALHALLA_DATA_PATH` does not contain any valid source data.

Add one of these:
- one or more `.osm.pbf` files
- `valhalla_tiles.tar`
- a `valhalla_tiles` directory
