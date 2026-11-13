import { closable } from './dialog.js';
import { musicEnabled, setMusicEnabled } from './audio.js';
import { gameKeys } from './saveKeys.js';
import { account, cloudEnabled, signOut } from './cloud.js';

export function wipeGame() {
  try {
    for (const key of gameKeys()) localStorage.removeItem(key);
  } catch {}
}

const CODE_FILE = /\.(js|css|html)$/;

function codeFiles() {
  const urls = new Set([location.href.split('#')[0]]);
  for (const entry of performance.getEntriesByType('resource')) {
    const url = new URL(entry.name);
    if (url.origin === location.origin && CODE_FILE.test(url.pathname)) urls.add(entry.name);
  }
  return [...urls];
}

async function refreshFiles() {
  await Promise.allSettled(codeFiles().map((url) => fetch(url, { cache: 'reload' }).then((response) => response.arrayBuffer())));
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
  const refresh = document.getElementById('refreshBtn');
  const refreshLabel = refresh.querySelector('.refresh-label');

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
  refresh.addEventListener('click', () => {
    refresh.disabled = true;
    refreshLabel.textContent = 'Đang tải bản mới...';
    refreshFiles().finally(() => location.reload());
  });
  reset.addEventListener('click', () => showConfirm(true));
  cancel.addEventListener('click', () => showConfirm(false));
  confirm.addEventListener('click', () => {
    confirm.disabled = true;
    onReset();
  });
  closable(dialog);
}
