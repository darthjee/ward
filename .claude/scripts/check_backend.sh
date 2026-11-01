#!/usr/bin/env bash
set -euo pipefail
set -x

docker-compose run --rm ward_tests yarn coverage
docker-compose run --rm ward_tests yarn lint
