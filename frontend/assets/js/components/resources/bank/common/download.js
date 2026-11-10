/**
 * Download a text as a file, client-side.
 *
 * @description Creates a `Blob` and an object URL, clicks a temporary `<a download>` and
 * revokes the URL. The window is injectable, so specs (which run without a DOM) pass a fake.
 * @param {string} filename - The file name offered to the user.
 * @param {string} text - The file content.
 * @param {{mimeType: string, win: object}} [options] - The MIME type (default CSV, UTF-8) and
 *   the window (default `globalThis.window`).
 * @returns {void} Nothing.
 */
export function downloadText(filename, text, { mimeType = 'text/csv;charset=utf-8', win = globalThis.window } = {}) {
  const blob = new win.Blob([text], { type: mimeType });
  const url = win.URL.createObjectURL(blob);
  const anchor = win.document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  win.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  win.URL.revokeObjectURL(url);
}

/**
 * Download helpers, as a writable object so page specs can `spyOn(Download, 'text')`.
 */
const Download = {
  text: downloadText,
};

export default Download;
