# Align CI image pins
Point every base-image pin in `.circleci/config.yml` at `0.2.0`:

- `circleci_ward-base:0.1.0` → `0.2.0` at L12 (`backend_tests` param), L26 (`backend_checks` param),
  L170 (`backend_integration` executor), L196 (`coverage-final` executor).
- `vite_ward-base:0.0.1` → `0.2.0` at L315 (`upload_fe_files`) and L339 (`release`). The `0.0.1` tag was never
  published.
- Grep afterwards for `_ward-base:` to confirm no other tag remains.

## Files to Change
- `.circleci/config.yml` — image pins.
