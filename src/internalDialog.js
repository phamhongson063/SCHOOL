import { CERTIFY } from './config.js';
import { DECKS } from './studyDecks.js';
import { closable } from './dialog.js';
import { coins } from './format.js';
import { setRich } from './goldArt.js';

export function createInternalDialog() {
  const dialog = document.getElementById('internalDialog');
  const text = document.getElementById('internalText');
  const yes = document.getElementById('internalYes');
  const no = document.getElementById('internalNo');
  let accept = null;
  let cancel = null;
  closable(dialog);
  no.addEventListener('click', () => dialog.close());
  yes.addEventListener('click', () => {
    const run = accept;
    accept = null;
    cancel = null;
    dialog.close();
    run?.();
  });
  dialog.addEventListener('close', () => {
    const back = cancel;
    accept = null;
    cancel = null;
    back?.();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    ask(deck, { onAccept, onCancel }) {
      accept = onAccept;
      cancel = onCancel;
      setRich(text, `Lớp ${DECKS[deck].label} · Lệ phí ${coins(CERTIFY.internalFee)}`);
      dialog.showModal();
      yes.focus({ preventScroll: true });
    },
  };
}
