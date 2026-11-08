import LedgerFormHelper from '../../../../../../../../../assets/js/components/resources/bank/common/detail/helpers/LedgerFormHelper.jsx';
import { initialLedgerForm } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useLedgerForm.js';
import { classifyError } from '../../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

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

describe('LedgerFormHelper', () => {
  let handlers;

  beforeEach(() => {
    handlers = jasmine.createSpyObj('handlers', ['onSubmit', 'onFieldChange', 'onDirectionChange', 'onToggleNotes', 'onCancelEdit']);
  });

  function state(form = {}) {
    return { form: { ...initialLedgerForm('2026-05-10'), ...form }, today: '2026-05-10', idPrefix: 'ledger-' };
  }

  function output(form) {
    return renderedOutput(LedgerFormHelper.render(state(form), handlers));
  }

  it('renders date, Out / In, amount and description, defaulting to today and Out', () => {
    const page = output();

    expect(page.containsInOrder('New transaction', 'type="date"', 'Out', 'In', 'Amount', 'Description')).toBeTrue();
    expect(page.containsAttribute('max', '2026-05-10')).toBeTrue();
    expect(page.containsAttribute('value', '2026-05-10')).toBeTrue();
    expect(page.containsInOrder('aria-pressed="true"', 'Out')).toBeTrue();
    expect(page.contains('>Add<')).toBeTrue();
  });

  it('hides the notes field until toggled', () => {
    expect(output().contains('ledger-notes')).toBeFalse();
    expect(output({ notesOpen: true }).contains('id="ledger-notes"')).toBeTrue();
  });

  it('renders the editing title with Save and Cancel', () => {
    const page = output({ editing: { id: 3, description: 'Coffee' } });

    expect(page.contains('Editing “Coffee”')).toBeTrue();
    expect(page.contains('>Save<')).toBeTrue();
    expect(page.contains('>Cancel<')).toBeTrue();
  });

  it('shows field errors on the row, keeping the values', () => {
    const page = output({
      values: { ...initialLedgerForm('2026-05-10').values, amount: '1.234' },
      fieldErrors: { amount: 'Use at most 2 decimal places.' },
    });

    expect(page.containsAttribute('value', '1.234')).toBeTrue();
    expect(page.containsInOrder('is-invalid', 'Use at most 2 decimal places.')).toBeTrue();
  });

  it('shows a backend 400 on the row', () => {
    expect(output({ error: classifyError(new ApiError(400, 'Bad amount', 'BAD_REQUEST')) }).contains('Bad amount')).toBeTrue();
  });

  it('disables Save while pending', () => {
    expect(output({ pending: true }).containsInOrder('type="submit"', 'disabled=""')).toBeTrue();
  });

  it('wires the toggle buttons', () => {
    const element = LedgerFormHelper.render(state({ editing: { id: 3, description: 'x' } }), handlers);
    const buttons = findAll(element, (node) => typeof node.props?.onClick === 'function');

    buttons.forEach((button) => button.props.onClick());

    expect(handlers.onDirectionChange).toHaveBeenCalledWith('out');
    expect(handlers.onDirectionChange).toHaveBeenCalledWith('in');
    expect(handlers.onCancelEdit).toHaveBeenCalled();
    expect(handlers.onToggleNotes).toHaveBeenCalled();
  });
});
