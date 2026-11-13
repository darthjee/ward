import BankBillFormHelper, {
  DELETE_BILL_BODY,
} from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/helpers/BankBillFormHelper.jsx';
import ConfirmModal from '../../../../../../../../../assets/js/components/resources/bank/common/ConfirmModal.jsx';
import { emptyBillFields } from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/controllers/billFormFields.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PROVIDERS = [{ id: 3, name: 'Plumber', currency: 'BRL' }, { id: 4, name: 'Host', currency: 'USD' }];
const ACCOUNTS = [
  { id: 1, name: 'Main BRL', currency: 'BRL', type: 'regular' },
  { id: 2, name: 'Main USD', currency: 'USD', type: 'regular' },
];
const noop = () => undefined;
const HANDLERS = new Proxy({}, { get: () => noop });
const OPTIONS = { heading: 'New bill', submitLabel: 'Create', cancelHref: '#/bank/providers/3' };

function state(overrides = {}, fields = {}) {
  return {
    fields: { ...emptyBillFields('3', '2026-05-10'), ...fields },
    fieldErrors: {},
    submitError: null,
    loadError: null,
    pending: false,
    providers: PROVIDERS,
    accounts: ACCOUNTS,
    currency: 'BRL',
    confirming: false,
    canDelete: false,
    idPrefix: 'bill-',
    ...overrides,
  };
}

function output(overrides, fields, options = OPTIONS) {
  return renderedOutput(BankBillFormHelper.render(state(overrides, fields), HANDLERS, options));
}

function findAll(node, predicate, acc = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, acc));
    return acc;
  }

  if (!node || typeof node !== 'object') {
    return acc;
  }

  if (predicate(node)) {
    acc.push(node);
  }

  return findAll(node.props?.children, predicate, acc);
}

describe('BankBillFormHelper', () => {
  it('renders the fields in order', () => {
    expect(output().containsInOrder(
      'New bill', 'Provider', 'Paying account', 'Due date', 'Amount', 'Description', 'Notes', 'Create', 'Cancel',
    )).toBeTrue();
  });

  it('pre-selects the provider', () => {
    expect(output().contains('<option value="3" selected="">Plumber</option>')).toBeTrue();
  });

  it('lists the paying accounts in the provider currency only', () => {
    const page = output();

    expect(page.containsElement('option', 'Main BRL')).toBeTrue();
    expect(page.containsElement('option', 'Main USD')).toBeFalse();
    expect(output({ currency: 'USD' }, { provider_account_id: '4' }).containsElement('option', 'Main USD')).toBeTrue();
  });

  it('allows any due date and bounds the texts', () => {
    const page = output();

    expect(page.containsInOrder('id="bill-due_date"', 'type="date"')).toBeTrue();
    expect(page.contains('max="')).toBeFalse();
    expect(page.containsInOrder('id="bill-description"', 'maxLength="255"')).toBeTrue();
    expect(page.containsInOrder('id="bill-notes"', 'maxLength="2000"')).toBeTrue();
  });

  it('links Cancel to the given hash', () => {
    expect(output().containsAttribute('href', '#/bank/providers/3')).toBeTrue();
  });

  it('shows the field errors', () => {
    expect(output({ fieldErrors: { amount: 'Amount is required' } }).contains('Amount is required')).toBeTrue();
  });

  it('shows a 422 on the form', () => {
    expect(output({ submitError: { kind: 'validation', messages: ['currency mismatch'] } }).contains('currency mismatch'))
      .toBeTrue();
  });

  it('shows the loading notice, or only the load alert on failure', () => {
    expect(output({ fields: null }).contains('Loading')).toBeTrue();

    const failed = output({ fields: null, loadError: { kind: 'transient', message: 'Down', messages: [] } });

    expect(failed.contains('Loading')).toBeFalse();
    expect(failed.contains('Down')).toBeTrue();
  });

  it('has no Delete on the new page', () => {
    expect(output().contains('>Delete<')).toBeFalse();
  });

  describe('on the edit page', () => {
    it('shows Delete, disabled while pending', () => {
      expect(output({ canDelete: true }).contains('>Delete<')).toBeTrue();
      expect(output({ canDelete: true, pending: true }).containsInOrder('disabled=""', 'Delete')).toBeTrue();
    });

    it('confirms the delete', () => {
      const element = BankBillFormHelper.render(state({ canDelete: true, confirming: true }), HANDLERS, OPTIONS);
      const [modal] = findAll(element, (node) => node.type === ConfirmModal);

      expect(modal.props.show).toBeTrue();
      expect(modal.props.children).toBe(DELETE_BILL_BODY);
      expect(modal.props.onConfirm).toBe(noop);
    });
  });

  it('escapes the names, the description and the notes', () => {
    const page = output({
      providers: [{ id: 3, name: '<script>p</script>', currency: 'BRL' }],
      accounts: [{ id: 1, name: '<img src=x>', currency: 'BRL' }],
    }, { description: '"><script>d</script>', notes: '<b>n</b>' });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.containsTag('img')).toBeFalse();
    expect(page.contains('<b>')).toBeFalse();
    expect(page.contains('&lt;b&gt;n&lt;/b&gt;')).toBeTrue();
    expect(page.contains('&lt;script&gt;p&lt;/script&gt;')).toBeTrue();
    expect(page.contains('&lt;img src=x&gt;')).toBeTrue();
    expect(page.contains('&quot;&gt;&lt;script&gt;d&lt;/script&gt;')).toBeTrue();
  });
});
