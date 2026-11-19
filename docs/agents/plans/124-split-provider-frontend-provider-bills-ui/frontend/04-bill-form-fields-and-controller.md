# Bill form: fields, loading and submit per kind

Move the bill form's data layer to `provider-bills`, for both kinds. The pages keep their
routes: `bank-bill-new` with `?provider=:id` and `bank-bill-edit` with `:billId`.

**Fields** (`billFormFields.js`):

- Add `kind`. It defaults to `one_off` on new, which keeps today's behaviour as the default.
- Add the recurring fields: `charge_frequency`, `due_day`, `due_month`, `bills_from`,
  `show_in_calendar` (default `true`) and `expected_amount`. Rename `amount` to
  `expected_amount` for one-offs too.
- Replace `billFieldsFromBill` with a mapper from the `provider-bills` response, which uses raw
  `provider_account_id` and `paying_account_id`.

**Validation, per kind:**

- `one_off`: today's rules. Paying account, due date and amount are required.
- `recurring`:
  - description is required;
  - `expected_amount` is optional;
  - `charge_frequency` is required;
  - `due_day` must be an integer from 1 to 31;
  - `due_month` is required only for yearly bills;
  - `bills_from` is optional;
  - the paying account is optional.
- Reuse `integerIn`, `FREQUENCY_OPTIONS`, `validateScheduleFields` and `withBillsFromAutofill`
  where they fit.

**Submit body:** only send the fields that belong to the selected kind.
`changedBillFields` still drives the PATCH body. Never send `kind` on edit. Never send
`provider_account_id` when editing a recurring bill.

**Loading** (`billFormLoad.js`): on edit, load the bill with `getProviderBill`. The providers
and accounts loading stays as it is.

**Controller** (`BillFormController.js`):

- `create` calls `createProviderBill(context, fields.provider_account_id, body)`.
- `update` calls `updateProviderBill`.
- `destroy` calls `deleteProviderBill`.
- The return hash uses `provider_account_id`.

`useBillForm` exposes `edit` and the current `kind` to the view.

## Files to Change
- `frontend/assets/js/components/resources/bank/bills/pages/controllers/billFormFields.js`:
  kind, recurring fields, validation per kind, mapper from the response.
- `frontend/assets/js/components/resources/bank/bills/pages/controllers/billFormLoad.js`:
  load the bill with `getProviderBill`.
- `frontend/assets/js/components/resources/bank/bills/pages/controllers/BillFormController.js`:
  move to the `ProviderBillsClient` calls and use `provider_account_id` for navigation.
- `frontend/assets/js/components/resources/bank/bills/pages/hooks/useBillForm.js`: expose
  `edit` and `kind`.
- Specs under `frontend/specs/assets/js/components/resources/bank/bills/pages/`: fields,
  validation per kind, load and the create / update / delete URLs.
