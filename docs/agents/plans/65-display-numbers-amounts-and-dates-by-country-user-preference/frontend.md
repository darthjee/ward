# Frontend Plan: Display numbers, amounts and dates by country / user preference

Main plan: [plan.md](plan.md)

## Shared contracts

What the frontend can rely on (full detail in [plan.md](plan.md#shared-contracts)):

- Allowlist and labels (mirror in `utils/locale/locales.js`, same order): `null` → "Browser
  default", `en-US`, `en-GB`, `pt-BR`, `pt-PT`, `es-ES`, `fr-FR`, `de-DE`.
- `GET /auth/account.json` → `{ username, email, locale }`, `locale: string | null`; JWT
  required.
- `PATCH /auth/account.json` body `{ currentPassword?, username?, email?, newPassword?, locale? }`;
  locale-only needs no `currentPassword`; any username/email/newPassword change still does;
  bad locale → `422 INVALID_LOCALE`; response `{ username, email, locale }`.

## Steps

- [01 — Display locale store and loading](frontend/01-display-locale-store.md)
- [02 — Locale-aware amounts, rates, month and currency names](frontend/02-locale-aware-helpers.md)
- [03 — `formatDate` and its use on every displayed ISO date](frontend/03-format-date.md)
- [04 — My account: pre-fill and Display locale select](frontend/04-my-account-locale.md)

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Formatting only: UI text stays English and `<html lang="en">` stays.
- Do not change `parseAmount`, rate parsing, native `type="date"` inputs, values sent to the
  API, stored descriptions, the accountant CSV (`providers/common/accountantCsv.js`) or its
  filename. Add regression specs that amount input accepts `.` and `,` with a `pt-BR` and an
  `en-US` locale set, and that the CSV output is unchanged with a locale set.
- `currencyDigits` reads only `maximumFractionDigits`, which is locale-independent; leave it on
  `undefined`.
- Specs that assert literal output (`R$ 1.234,56`, `14/03/2026`, `3/14/2026`) rely on full ICU
  in Node (default in `darthjee/circleci_node`). Compare non-breaking spaces carefully
  (`pt-BR` currency uses U+00A0) — normalise or build the expected string with the same `Intl`
  call where a literal is brittle, but keep at least one literal date assertion per locale.
- Every spec that sets the store must reset it (`DisplayLocale.set(null)`) in `afterEach`.
