const openers = new WeakMap();
const initialized = new WeakSet();

function restoreFocus(dialog) {
  const opener = openers.get(dialog);
  openers.delete(dialog);
  const target = opener?.isConnected && !opener.disabled && opener.getClientRects().length
    ? opener : document.querySelector('[data-mode="daily"]');
  target?.focus();
}

/** Open a native modal dialog, remembering the control to return to. */
export function openDialog(dialog, opener = document.activeElement) {
  if (dialog.open) return;
  if (!initialized.has(dialog)) {
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
    dialog.addEventListener('close', () => restoreFocus(dialog));
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
        .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    initialized.add(dialog);
  }
  openers.set(dialog, opener);
  dialog.showModal();
}

/** Close a dialog; its close handler restores a usable focus target. */
export function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}
