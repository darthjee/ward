# Update the banking README

Update `docs/agents/specs/banking/README.md` so it reflects the finished bills / Calendar specs.

1. **Index**: expand the rows.
   - `bills.md`: hybrid model (derived occurrences from debt / provider-expense accounts plus the
     one-off `Bill` in `bank_bills`), schedule fields (`billsFrom`, `showInCalendar`, default
     `payingAccountId`) on the details tables, recurrence (clamp, weekend shift, nominal vs
     effective date), paying / skipping / undoing (`bank_bill_payments`, atomic ledger writes,
     optional charge), bill and calendar routes, edge cases.
   - `ui/calendar.md`: list view (Overdue plus a 60-day Upcoming), month view (up to 12 months
     ahead), entry links and the Pay / Skip / Undo actions, Add / edit bill pages, new
     Debts / Providers inputs and Bill history.
2. **Sub-issue map, #33 row**: list `bills.md` and `ui/calendar.md` with their concerns, the
   pointer edits in `accounts/debt.md` (the *Instalments and bills* and `dueDay` clamp
   pointers), `accounts/provider-expense.md` (the *Charges and bills* pointer and the resolved
   charge-vs-payment question) and `accounts/regular.md` (the event vs direct call bullet), and
   this `README.md` (index entries, sub-issue map row, "includes bills" notes, `## Future
   epics`). Edit only this row.
3. **Ownership contract**: the "later bill records" mention in the *Child records* bullet can name
   `bank_bills` and `bank_bill_payments` (they inherit the owner through their account). This is
   optional but keeps the contract precise.
4. **Existing Future epics**: add a one-line "includes bills" note where the epic doesn't
   already say so. Do not add new entries for these concerns:
   - *Credit card accounts* (#11): it already mentions bills; reword to say it includes card
     statements as bills;
   - *Categories* (#9): it says "likely shared with bills"; make it "includes bills";
   - *Receipts / attachments* (#16): includes receipts on paid bills;
   - *Linked transfers* (#6): includes paying a bill as one linked operation;
   - *Currency conversion* (#8): includes bill totals across currencies;
   - *Organization permission system* (#1): includes who may create / pay / delete bills.
5. **New Future epics**: append them as 18–24, each with "(from bills.md#… / ui/calendar.md#…)"
   and the decisions it must respect.
   1. **Cross-module calendar**: a global agenda across modules. It reads bank occurrences
      through an exported service / DI token, never events (lazy listeners can miss events, see
      `architecture/modular-pattern.md`).
   2. **Bill reminders / notifications**: e.g. email through `mail` before a bill is due. The
      epic decides the trigger (scheduled job vs event) and the opt-in. Kept separate from the
      cross-module calendar.
   3. **Business-day calendar for bills**: national / regional holidays and a per-account rule
      (`keep` / `next` / `previous`). The epic decides the holiday data source and which country
      / region applies to an owner.
   4. **Combined calendar across owners**: Personal plus every organization of the user. Must
      keep per-owner access checks and never expose owner fields.
   5. **Calendar feed (iCal / `.ics`)**: needs a secret-token feed URL, a new auth path outside
      the JWT session. Covers token issuance / revocation and what the feed may expose.
   6. **Automatic bill import**: Open Finance, boleto barcode / PDF reading. External
      integrations and memory cost on the 512 MB tier; low priority.
   7. **Projected balance**: current vs projected balance from upcoming bills. Ties to the
      future-dated transactions note in `accounts/transactions.md`.
6. **Reference**: no new sub-issue URLs are needed (#33 is already listed). Add nothing unless
   another issue is linked.

## Files to Change
- `docs/agents/specs/banking/README.md` — index rows, #33 sub-issue map row, optional
  child-records wording, "includes bills" notes on the existing epics, and new Future epics
  18–24.
