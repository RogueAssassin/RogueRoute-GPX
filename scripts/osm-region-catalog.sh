#!/usr/bin/env bash
# RogueRoute-GPX regional OSM catalog.
# Format: key|label|geofabrik_url|recommended_graph_base|rough_download|rough_expanded|priority
OSM_REGION_CATALOG=$(cat <<'CATALOG'
australia|Australia|https://download.geofabrik.de/australia-oceania/australia-latest.osm.pbf|australia|2-4GB|6-15GB|core
new-zealand|New Zealand|https://download.geofabrik.de/australia-oceania/new-zealand-latest.osm.pbf|new-zealand|300-900MB|1-4GB|core
japan|Japan|https://download.geofabrik.de/asia/japan-latest.osm.pbf|japan|2-4GB|6-18GB|core
china|China|https://download.geofabrik.de/asia/china-latest.osm.pbf|china|3-8GB|10-30GB|core
south-korea|South Korea|https://download.geofabrik.de/asia/south-korea-latest.osm.pbf|south-korea|300-900MB|1-4GB|popular
taiwan|Taiwan|https://download.geofabrik.de/asia/taiwan-latest.osm.pbf|taiwan|200-700MB|1-3GB|popular
singapore-malaysia-brunei|Singapore/Malaysia/Brunei|https://download.geofabrik.de/asia/malaysia-singapore-brunei-latest.osm.pbf|malaysia-singapore-brunei|400MB-1.5GB|2-6GB|popular
indonesia|Indonesia|https://download.geofabrik.de/asia/indonesia-latest.osm.pbf|indonesia|1-3GB|4-12GB|popular
india|India|https://download.geofabrik.de/asia/india-latest.osm.pbf|india|1-4GB|4-16GB|popular
us|United States mainland|https://download.geofabrik.de/north-america/us-latest.osm.pbf|us|9-14GB|30-80GB|core
hawaii|Hawaii|https://download.geofabrik.de/north-america/us/hawaii-latest.osm.pbf|hawaii|50-300MB|300MB-2GB|core
canada|Canada|https://download.geofabrik.de/north-america/canada-latest.osm.pbf|canada|3-8GB|10-30GB|popular
mexico|Mexico|https://download.geofabrik.de/north-america/mexico-latest.osm.pbf|mexico|1-3GB|4-12GB|popular
central-america|Central America|https://download.geofabrik.de/central-america-latest.osm.pbf|central-america|500MB-2GB|2-8GB|popular
south-america|South America|https://download.geofabrik.de/south-america-latest.osm.pbf|south-america|4-10GB|15-45GB|popular
europe|Europe|https://download.geofabrik.de/europe-latest.osm.pbf|europe|30-45GB|120-250GB|core
uk-ireland|UK and Ireland|https://download.geofabrik.de/europe/britain-and-ireland-latest.osm.pbf|britain-and-ireland|2-5GB|8-20GB|popular
germany|Germany|https://download.geofabrik.de/europe/germany-latest.osm.pbf|germany|4-8GB|15-35GB|popular
france|France|https://download.geofabrik.de/europe/france-latest.osm.pbf|france|4-8GB|15-35GB|popular
spain|Spain|https://download.geofabrik.de/europe/spain-latest.osm.pbf|spain|2-5GB|8-20GB|popular
italy|Italy|https://download.geofabrik.de/europe/italy-latest.osm.pbf|italy|2-5GB|8-20GB|popular
netherlands|Netherlands|https://download.geofabrik.de/europe/netherlands-latest.osm.pbf|netherlands|800MB-2GB|3-8GB|popular
CATALOG
)

region_env_name() {
  local key="$1"
  echo "OSRM_REGION_${key^^}" | tr '-' '_'
}

region_from_catalog() {
  local wanted="$1"
  echo "$OSM_REGION_CATALOG" | awk -F'|' -v k="$wanted" '$1==k {print; exit}'
}
