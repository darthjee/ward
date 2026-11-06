# Verify links, grep for leftovers, consult product-owner

No docs CI exists, so verify manually.

1. **Leftover grep** over `docs/agents/specs/banking/` — each hit must be either gone or
   intentionally organization-context only:
   - `grep -rn "OrgScoped\|createdBy\|created_by\|orgsorgid" docs/agents/specs/banking` → no hits
     (except the README Future epic 15 / #40 row mentioning history, if worded so);
   - `grep -rn "/api/orgs/:orgId/bank\|/orgs/:orgId/bank" docs/agents/specs/banking` → only the
     README contract, `regular.md`'s `<base>` / `<ui>` definition, `ui/menu.md` and test lines
     that name both contexts;
   - `grep -rn -i "belongs\? to an organization\|within the organization\|every member" docs/agents/specs/banking`
     → none unqualified.
2. **Anchors** — every `regular.md#…`, `debt.md#…`, `investment.md#…` link resolves to a heading
   (GitHub slug rules: `#list`, `#detail`, `#create--edit`, `#routes-and-permissions`,
   `#data-sensitivity--ownership`, `#required-tests`, …). Also check links from
   `auth/organizations.md` and `auth/README.md` into `banking/README.md` still resolve.
3. **product-owner** — dispatch the read-only `product-owner` agent with the list of changed
   files to confirm the ownership concepts are applied consistently with `auth/organizations.md`
   and `product.md`; apply any corrections it reports.
4. No `docs/agents/` hub changes needed (no new file, no architecture change).

## Files to Change
- None beyond fixes found during verification in the files of steps 01–06.
