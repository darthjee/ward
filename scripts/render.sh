#!/bin/bash

# Let `request | jq | sed` pipelines (e.g. service_id) report the curl failure
# instead of the exit status of their last command.
set -o pipefail

RENDER_SERVICE_NAME="${RENDER_SERVICE_NAME:-ward}"

function request() {
  METHOD=$1
  URL=$2

  curl --fail-with-body \
    --request "$METHOD" \
    --url "$URL" \
    --header 'Accept: application/json' \
    --header "Authorization: Bearer $RENDER_API_KEY"
}

function services() {
  request GET 'https://api.render.com/v1/services'
}

function deploy() {
  SERVICE_ID=$1
  request \
    POST "https://api.render.com/v1/services/$SERVICE_ID/deploys"
}

function get_env_vars() {
  SERVICE_ID=$1
  request \
    GET "https://api.render.com/v1/services/$SERVICE_ID/env-vars" | \
    jq 'map(.envVar)'
}

function service_id() {
  services | jq \
    ".[] | select(.service.name == \"$RENDER_SERVICE_NAME\") | .service.id" \
    | sed -e 's/"//g'
}

function last_deployment() {
  SERVICE_ID=$1
  request \
    GET "https://api.render.com/v1/services/$SERVICE_ID/deploys?limit=1" | jq '.[0]'
}

function deployment() {
  SERVICE_ID=$1
  DEPLOYMENT_ID=$2
  request \
    GET "https://api.render.com/v1/services/$SERVICE_ID/deploys/$DEPLOYMENT_ID"
}

function deployment_status() {
  SERVICE_ID=$1
  DEPLOYMENT_ID=$2
  deployment "$SERVICE_ID" "$DEPLOYMENT_ID" | jq '.status' | sed -e 's/"//g'
}

function update_service_branch() {
  SERVICE_ID=$1
  BRANCH=$2
  curl --fail-with-body \
    --request PATCH \
    --url "https://api.render.com/v1/services/$SERVICE_ID" \
    --header 'Accept: application/json' \
    --header 'Content-Type: application/json' \
    --header "Authorization: Bearer $RENDER_API_KEY" \
    --data "{\"branch\": \"$BRANCH\"}"
}
