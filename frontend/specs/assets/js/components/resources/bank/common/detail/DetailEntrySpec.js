import React from 'react';
import DetailEntry from '../../../../../../../../assets/js/components/resources/bank/common/detail/DetailEntry.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

function output(props) {
  return renderedOutput(React.createElement('dl', null, React.createElement(DetailEntry, props)));
}

describe('DetailEntry', () => {
  it('renders the term and its value', () => {
    const page = output({ label: 'Creditor', value: 'Bank A' });

    expect(page.containsElement('dt', 'Creditor')).toBeTrue();
    expect(page.containsElement('dd', 'Bank A')).toBeTrue();
  });

  it('shows a dash for a blank value', () => {
    expect(output({ label: 'Notes', value: null }).containsElement('dd', '—')).toBeTrue();
    expect(output({ label: 'Notes', value: '' }).containsElement('dd', '—')).toBeTrue();
  });

  it('escapes the value', () => {
    expect(output({ label: 'Notes', value: '<script>x</script>' }).containsTag('script')).toBeFalse();
  });
});
