# Provider form without schedule fields

The provider form stops editing schedule fields. Remove these from the provider fields,
validation, diff and render:

- `expected_amount`, `charge_frequency`, `due_day`, `due_month`;
- the schedule block, which covers `bills_from`, `show_in_calendar` and `paying_account_id`.

Keep `for_accountant` and `provider_tax_id`, plus the common account fields.

Drop `useScheduleForm` from the provider New / Edit pages. Debts still use it, so it stays.

`PROVIDER_HAS_MULTIPLE_BILLS` can't happen any more, so no mapping is needed.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/pages/controllers/providerFormFields.js`:
  trim `PROVIDER_FIELD_NAMES`, empty / from-account / validate / changed helpers.
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderFormHelper.jsx`:
  drop `renderDueMonth`, the schedule inputs and the `ScheduleFieldsHelper.render` call.
- `frontend/assets/js/components/resources/bank/providers/pages/BankProviderNew.jsx` and
  `BankProviderEdit.jsx`: drop `useScheduleForm`.
- Specs: `BankProviderFormPagesSpec.js` plus the specs under `providers/pages/controllers/` and
  `providers/pages/helpers/`. They assert that no schedule fields are rendered or sent.
