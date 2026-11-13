import { VERSION } from './version.js';
import { refreshFiles } from './settings.js';

const CHECK_EVERY = 5 * 60 * 1000;
const VERSION_PATTERN = /VERSION\s*=\s*'([^']+)'/;
const VERSION_URL = new URL('./version.js', import.meta.url);

let offered = false;

export const updateOffered = () => offered;

async function latestVersion() {
  const url = new URL(VERSION_URL);
  url.searchParams.set('t', Date.now());
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return VERSION;
  return (await response.text()).match(VERSION_PATTERN)?.[1] ?? VERSION;
}

export function watchUpdates() {
  const dialog = document.getElementById('updateDialog');
  const confirm = document.getElementById('updateBtn');

  const check = async () => {
    if (offered || document.visibilityState !== 'visible') return;
    const latest = await latestVersion().catch(() => VERSION);
    if (offered || latest === VERSION) return;
    offered = true;
    dialog.showModal();
  };

  confirm.addEventListener('click', () => {
    confirm.disabled = true;
    confirm.textContent = 'Đang tải bản mới...';
    refreshFiles().finally(() => location.reload());
  });
  dialog.addEventListener('cancel', (event) => event.preventDefault());

  check();
  setInterval(check, CHECK_EVERY);
  document.addEventListener('visibilitychange', check);
}
