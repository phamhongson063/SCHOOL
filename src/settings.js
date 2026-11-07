const PREFIX = 'truong-lang-xua.';
const KEEP = new Set(['lessonMode', 'lessonChoice', 'furigana', 'translate', 'bagTab'].map((key) => PREFIX + key));

export function wipeGame() {
  const doomed = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) && !KEEP.has(key)) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {}
}

export function createSettings({ onReset }) {
  const button = document.getElementById('settingsBtn');
  const dialog = document.getElementById('settingsDialog');
  const reset = document.getElementById('resetBtn');
  const confirmBox = document.getElementById('resetConfirm');
  const confirm = document.getElementById('resetConfirmBtn');
  const cancel = document.getElementById('resetCancel');

  const showConfirm = (shown) => {
    confirmBox.hidden = !shown;
    reset.hidden = shown;
  };

  button.addEventListener('click', () => {
    showConfirm(false);
    dialog.showModal();
  });
  button.addEventListener('pointerup', () => button.blur());
  reset.addEventListener('click', () => showConfirm(true));
  cancel.addEventListener('click', () => showConfirm(false));
  confirm.addEventListener('click', () => {
    confirm.disabled = true;
    onReset();
  });
  dialog.querySelector('.sched-x').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
