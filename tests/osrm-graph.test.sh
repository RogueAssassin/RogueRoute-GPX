#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

export OSRM_DATA_DIR="$TEST_ROOT"
# shellcheck source=../infra/scripts/_common.sh
source "$REPO_ROOT/infra/scripts/_common.sh"

graph="test-region"
prefix="$OSRM_DATA_DIR/$graph"
required_suffixes=(
  .osrm.datasource_names
  .osrm.ebg_nodes
  .osrm.edges
  .osrm.fileIndex
  .osrm.geometry
  .osrm.icd
  .osrm.maneuver_overrides
  .osrm.names
  .osrm.nbg_nodes
  .osrm.properties
  .osrm.ramIndex
  .osrm.timestamp
  .osrm.tld
  .osrm.tls
  .osrm.turn_duration_penalties
  .osrm.turn_weight_penalties
  .osrm.cells
  .osrm.cell_metrics
  .osrm.mldgr
  .osrm.partition
)

for suffix in "${required_suffixes[@]}"; do
  touch "${prefix}${suffix}"
done

osrm_graph_is_ready "$graph"

rm "${prefix}.osrm.mldgr"
if osrm_graph_is_ready "$graph"; then
  echo "graph without its MLD graph file must not be reported ready" >&2
  exit 1
fi
osrm_graph_missing_files "$graph" | grep -Fxq "${prefix}.osrm.mldgr"
touch "${prefix}.osrm.mldgr"

# Older OSRM builds used .osrm.nodes; accept it as the node-data alternative.
rm "${prefix}.osrm.nbg_nodes"
touch "${prefix}.osrm.nodes"
osrm_graph_is_ready "$graph"

echo "OSRM graph readiness tests passed"
