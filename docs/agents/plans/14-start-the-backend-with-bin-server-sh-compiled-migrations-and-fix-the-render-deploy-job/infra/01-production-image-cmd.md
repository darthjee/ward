# Production image runs bin/server.sh
Replace the `entrypoint.sh` ENTRYPOINT with `CMD ["bin/server.sh"]`. The current entrypoint runs the ts-node
`yarn migration:run` after `yarn install --production` has removed ts-node and typescript, so the container
cannot boot.

- In `dockerfiles/production_ward/Dockerfile`, remove the `COPY ./dockerfiles/production_ward/entrypoint.sh ...`
  line (L31) and replace `ENTRYPOINT ["/home/node/app/entrypoint.sh"]` (L33) with `CMD ["bin/server.sh"]`.
- Confirm the final stage's working directory is `/home/node/app`. It comes from
  `darthjee/production_ward-base`, so check `dockerfiles/base/Dockerfile` or the image. If it is not
  guaranteed, add `WORKDIR /home/node/app` to the final stage.
- Delete `dockerfiles/production_ward/entrypoint.sh` (`git rm`).
- Confirm `yarn` is available in the final image. The old entrypoint already relied on it.

## Files to Change
- `dockerfiles/production_ward/Dockerfile`: drop the entrypoint COPY and ENTRYPOINT, and add `CMD ["bin/server.sh"]`.
- `dockerfiles/production_ward/entrypoint.sh`: delete.
