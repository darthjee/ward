#!/bin/sh
set -e

cd "$(dirname "$0")/.."

yarn migration:run:prod
exec node dist/main.js
