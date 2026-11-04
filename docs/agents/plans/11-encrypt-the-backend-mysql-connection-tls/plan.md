# Plan: Encrypt the backend ↔ MySQL connection (TLS)

Issue: [11-encrypt-the-backend-mysql-connection-tls.md](../../issues/11-encrypt-the-backend-mysql-connection-tls.md)

## Overview

Add an env-driven, certificate-verifying TLS option to the backend's MySQL connection, built
by one pure function shared by the TypeORM CLI data source and `AppModule`, with a boot-time
guard that refuses to start in production without TLS. The code work belongs to `backend`;
the architect updates `docs/agents/environment-variables.md`, `docs/agents/deployment.md` and
`.env.dev.sample` afterwards (root/docs scope).

See [backend.md](backend.md) for the full plan.
