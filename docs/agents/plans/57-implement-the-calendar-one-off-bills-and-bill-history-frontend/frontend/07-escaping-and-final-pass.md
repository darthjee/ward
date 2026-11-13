# Escaped rendering specs and final pass

- Make sure every place rendering user input — bill description and notes, provider and paying
  account names in the selects, Bill history rows, detail schedule values — has an escaped
  rendering spec (`<script>` text appears as `&lt;script&gt;` via `renderedOutput(...)`),
  following the existing spec convention. No `dangerouslySetInnerHTML` anywhere.
- Make sure the issue's decisions are covered: Undo hidden on archived accounts, the sent-charge
  warning, and the derived vs one-off Undo routes.
- Run `docker-compose run --rm ward_fe yarn test` and `docker-compose run --rm ward_fe yarn lint`
  (use `lint_fix` first); resolve complexity / max-lines warnings by extracting helpers rather
  than disabling rules.

## Files to Change
- `frontend/specs/assets/js/components/resources/bank/...` — any missing escaped-rendering or decision specs
