import React from 'react';
import BankPagination from '../../../../../../../assets/js/components/resources/bank/common/BankPagination.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

const hrefFor = (page) => `#/bank/accounts/12?page=${page}`;

function render(props) {
  return renderedOutput(React.createElement(BankPagination, { hrefFor, ...props }));
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

describe('BankPagination', () => {
  it('is hidden for a single page', () => {
    expect(render({ page: 1, totalPages: 1 }).isEmpty()).toBeTrue();
  });

  it('is hidden without pages', () => {
    expect(render({ page: 1, totalPages: 0 }).isEmpty()).toBeTrue();
  });

  it('renders First / Prev / the window / Next / Last as links', () => {
    const page = render({ page: 5, totalPages: 10 });

    expect(page.containsAttribute('href', hrefFor(1))).toBeTrue();
    expect(page.containsAttribute('href', hrefFor(4))).toBeTrue();
    expect(page.containsAttribute('href', hrefFor(7))).toBeTrue();
    expect(page.containsAttribute('href', hrefFor(10))).toBeTrue();
    expect(page.containsAttribute('href', hrefFor(8))).toBeFalse();
    expect(page.contains('active')).toBeTrue();
  });

  it('disables First / Prev on the first page', () => {
    const element = BankPagination({ page: 1, totalPages: 3, hrefFor });
    const disabled = findAll(element, (node) => node.props?.disabled === true);

    expect(disabled.length).toBe(2);
  });

  it('disables Next / Last on the last page', () => {
    const element = BankPagination({ page: 3, totalPages: 3, hrefFor });
    const disabled = findAll(element, (node) => node.props?.disabled === true);

    expect(disabled.length).toBe(2);
  });

  it('calls onNavigate with the target page and the event', () => {
    const onNavigate = jasmine.createSpy('onNavigate');
    const element = BankPagination({
      page: 2, totalPages: 5, hrefFor, onNavigate,
    });
    const event = { preventDefault: () => undefined };
    const next = findAll(element, (node) => node.props?.href === hrefFor(3))[0];

    next.props.onClick(event);

    expect(onNavigate).toHaveBeenCalledWith(3, event);
  });

  it('has no click handlers without onNavigate', () => {
    const element = BankPagination({ page: 2, totalPages: 5, hrefFor });

    expect(findAll(element, (node) => typeof node.props?.onClick === 'function')).toEqual([]);
  });
});
