# Plan: Implement the Investments submenu — frontend

Issue: [53-implement-the-investments-submenu-frontend.md](../../issues/53-implement-the-investments-submenu-frontend.md)

## Overview
Add the **Investments** submenu (list, detail with the investment info block and the
**Add application** / **Add withdrawal** / **Update value** shortcuts, create / edit) to the
frontend, in both the Personal and organization contexts. It is built on the `bank/common`
parts extracted by #51; the debt-only pieces it also needs are extracted and parameterised
first, so nothing is copied. Frontend-only: the backend routes already exist (#52).

See [frontend.md](frontend.md) for the full plan.
