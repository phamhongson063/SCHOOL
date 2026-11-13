const SCROLL_MS = 2200;
const FLASH_IN_MS = 260;
const FLASH_OUT_MS = 700;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

export function createArenaSummon({ sounds = null }) {
  const veil = document.getElementById('summonVeil');
  const scroll = veil.querySelector('.summon-scroll');
  const text = veil.querySelector('.summon-text');
  const flash = veil.querySelector('.summon-flash');
  let busy = false;

  async function run({ lines = [], ceremony = true }, swap) {
    if (busy) return;
    busy = true;
    try {
      veil.hidden = false;
      veil.classList.toggle('ceremony', ceremony);
      if (ceremony) {
        text.replaceChildren(
          ...lines.map((line) => {
            const node = document.createElement('p');
            node.textContent = line;
            return node;
          }),
        );
        replay(scroll, 'open');
        sounds?.gong();
        await wait(SCROLL_MS);
      }
      replay(flash, 'in');
      await wait(FLASH_IN_MS);
      swap();
      flash.classList.remove('in');
      replay(flash, 'out');
      scroll.classList.remove('open');
      await wait(FLASH_OUT_MS);
    } finally {
      flash.classList.remove('out');
      veil.hidden = true;
      busy = false;
    }
  }

  return {
    get busy() {
      return busy;
    },
    run,
  };
}
