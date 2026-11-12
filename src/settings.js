import { closable } from './dialog.js';
import { musicEnabled, setMusicEnabled } from './audio.js';
import { gameKeys } from './saveKeys.js';
import { account, cloudEnabled, signOut } from './cloud.js';

export function wipeGame() {
  try {
    for (const key of gameKeys()) localStorage.removeItem(key);
  } catch {}
}

export function createSettings({ onReset }) {
  const button = document.getElementById('settingsBtn');
  const dialog = document.getElementById('settingsDialog');
  const reset = document.getElementById('resetBtn');
  const confirmBox = document.getElementById('resetConfirm');
  const confirm = document.getElementById('resetConfirmBtn');
  const cancel = document.getElementById('resetCancel');
  const music = document.getElementById('musicBtn');
  const accountGroup = document.getElementById('accountGroup');
  const accountInfo = document.getElementById('accountInfo');
  const accountName = accountInfo.querySelector('.account-name');
  const accountEmail = accountInfo.querySelector('.account-email');
  const signOutBtn = document.getElementById('signOutBtn');

  accountGroup.hidden = !cloudEnabled;
  const paintAccount = () => {
    const user = account();
    accountName.textContent = user?.name ?? '';
    accountEmail.textContent = user?.email ?? '';
  };
  signOutBtn.addEventListener('click', () => {
    signOutBtn.disabled = true;
    signOut()
      .catch(() => {})
      .finally(() => location.reload());
  });

  const paintMusic = () => music.setAttribute('aria-checked', String(musicEnabled()));
  paintMusic();
  music.addEventListener('click', () => {
    setMusicEnabled(!musicEnabled());
    paintMusic();
  });

  const showConfirm = (shown) => {
    confirmBox.hidden = !shown;
    reset.hidden = shown;
  };

  button.addEventListener('click', () => {
    showConfirm(false);
    paintAccount();
    dialog.showModal();
  });
  button.addEventListener('pointerup', () => button.blur());
  reset.addEventListener('click', () => showConfirm(true));
  cancel.addEventListener('click', () => showConfirm(false));
  confirm.addEventListener('click', () => {
    confirm.disabled = true;
    onReset();
  });
  closable(dialog);
}
