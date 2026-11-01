#!/usr/bin/env bash
set -euo pipefail
set -x

docker-compose run --rm ward_fe yarn coverage
docker-compose run --rm ward_fe yarn lint
