# CHARGE_KINDS and pay amount spec

`CHARGE_KINDS` accepts `provider_bill` alongside the existing `provider` and `bill`. This way
#125's rename of `provider` to `provider_bill` doesn't break `record_charge` or the "Also record
the charge" checkbox. Don't remove the legacy values, because that belongs to #125. Keep the
two definitions in sync, or have `PayForm` import the one from `CalendarClient`.

`payFields.js` needs no behaviour change. Add a spec that pins it: for a provider-bill
occurrence with `expected_amount: null`, the amount starts empty and is required.

## Files to Change
- `frontend/assets/js/client/CalendarClient.js`: add `provider_bill` to `CHARGE_KINDS`.
- `frontend/assets/js/components/resources/bank/calendar/common/PayForm.jsx`: add
  `provider_bill` to `CHARGE_KINDS`.
- Specs: `CalendarClientSpec.js` and `PayFormSpec.js` (both `provider` and `provider_bill`
  keep `record_charge` and show the checkbox), plus `payFieldsSpec.js` (the null
  `expected_amount` case).
