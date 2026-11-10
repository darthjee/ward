import Download, { downloadText } from '../../../../../../../assets/js/components/resources/bank/common/download.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

class FakeBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
  }
}

function fakeWindow() {
  const anchor = {
    click: jasmine.createSpy('click'),
    remove: jasmine.createSpy('remove'),
  };
  const win = {
    Blob: FakeBlob,
    URL: {
      createObjectURL: jasmine.createSpy('createObjectURL').and.returnValue('blob:1'),
      revokeObjectURL: jasmine.createSpy('revokeObjectURL'),
    },
    document: {
      createElement: jasmine.createSpy('createElement').and.returnValue(anchor),
      body: { appendChild: jasmine.createSpy('appendChild') },
    },
  };

  return { win, anchor };
}

describe('download', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('clicks a temporary anchor on an object URL, then revokes it', () => {
    const { win, anchor } = fakeWindow();

    downloadText('file.csv', 'a,b', { win });

    const blob = win.URL.createObjectURL.calls.mostRecent().args[0];

    expect(blob.parts).toEqual(['a,b']);
    expect(blob.options).toEqual({ type: 'text/csv;charset=utf-8' });
    expect(win.document.createElement).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('blob:1');
    expect(anchor.download).toBe('file.csv');
    expect(win.document.body.appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
    expect(win.URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  });

  it('accepts a MIME type and defaults to the global window', () => {
    const { win } = fakeWindow();

    installFakeWindow(win);
    Download.text('file.txt', 'x', { mimeType: 'text/plain' });
    downloadText('file.csv', 'y');

    expect(win.URL.createObjectURL.calls.argsFor(0)[0].options).toEqual({ type: 'text/plain' });
    expect(win.URL.createObjectURL.calls.argsFor(1)[0].options).toEqual({ type: 'text/csv;charset=utf-8' });
  });
});
