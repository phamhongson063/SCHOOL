import { uploadSound, uploadVault } from './cloud.js';

const SOUND_TYPES = { m4a: 'audio/mp4', mp3: 'audio/mpeg' };

const extensionOf = (name) => name.split('.').pop().toLowerCase();

function pickFolder() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.addEventListener('change', () => resolve([...input.files]));
    input.click();
  });
}

async function uploadFiles(files) {
  const vault = files.find((file) => file.name === 'vault.json');
  if (vault) await uploadVault(await vault.text());
  const sounds = files.filter((file) => SOUND_TYPES[extensionOf(file.name)]);
  for (const file of sounds) {
    await uploadSound(file.name.replace(/\.[^.]+$/, ''), new Uint8Array(await file.arrayBuffer()), SOUND_TYPES[extensionOf(file.name)]);
  }
  return { vault: Boolean(vault), sounds: sounds.length };
}

export async function uploadPrivate(source) {
  const result = source === undefined ? await uploadFiles(await pickFolder()) : await uploadVault(source);
  location.reload();
  return result;
}
