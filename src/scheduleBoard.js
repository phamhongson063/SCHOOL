import { CERTIFY } from './config.js';
import { clockText, dateText, hoursText } from './clock.js';
import { closable } from './dialog.js';
import { DECKS, DECK_IDS } from './studyDecks.js';
import { certify } from './certify.js';
import { PLAYER } from './inventory.js';
import { EXAM_HOURS } from './examHall.js';

const MOONS = [
  [0.03, '🌑 Trăng non'],
  [0.22, '🌒 Trăng lưỡi liềm'],
  [0.28, '🌓 Trăng thượng huyền'],
  [0.47, '🌔 Trăng gần rằm'],
  [0.53, '🌕 Trăng rằm'],
  [0.72, '🌖 Trăng khuyết dần'],
  [0.78, '🌗 Trăng hạ huyền'],
  [0.97, '🌘 Trăng lưỡi liềm cuối'],
  [1.01, '🌑 Trăng non'],
];
const moonName = (phase) => MOONS.find(([max]) => phase <= max)[1];

function deckStatus(deck) {
  const batch = certify.batch(PLAYER, deck);
  if (certify.finished(PLAYER, deck)) return 'Đã học hết';
  if (certify.examTaken(PLAYER, deck)) return 'Đã khảo thí hôm nay';
  const learning = batch.filter((item) => !item.ready);
  const done = learning.filter((item) => item.count >= CERTIFY.remember).length;
  if (done < learning.length) return `Đang học ${done}/${learning.length}`;
  if (certify.needsInternal(PLAYER, deck)) return 'Chờ thi nội bộ';
  return 'Đủ điều kiện khảo thí';
}

export function createScheduleBoard({ sky, context }) {
  const ui = {
    pill: document.getElementById('phasePill'),
    clock: document.getElementById('phaseClock'),
    dialog: document.getElementById('scheduleDialog'),
    dayClock: document.getElementById('scheduleClock'),
    list: document.getElementById('scheduleList'),
    hint: document.getElementById('scheduleHint'),
  };

  let shownKey = '';
  function refresh(force = false) {
    const ctx = context();
    const clockLabel = clockText(ctx.minutes);
    if (!force && clockLabel === shownKey) return;
    shownKey = clockLabel;
    ui.clock.textContent = clockLabel;
    const label = `Ngày ${dateText(ctx.minutes)}, ${clockLabel}`;
    ui.pill.title = label;
    ui.pill.setAttribute('aria-label', `${label}. Mở bảng học tập`);
    if (ui.dialog.open) render();
  }

  function render() {
    const ctx = context();
    ui.dayClock.textContent = `Ngày ${dateText(ctx.minutes)} · ${clockText(ctx.minutes)} · ${moonName(sky.phase)}`;
    ui.list.replaceChildren(
      ...DECK_IDS.map((deck) => {
        const li = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = `🎓 ${DECKS[deck].label} · ${certify.certifiedCount(PLAYER, deck)}`;
        const state = document.createElement('span');
        state.textContent = deckStatus(deck);
        li.append(label, state);
        return li;
      }),
    );
    ui.hint.textContent = `Trường khảo thí mở ${hoursText(EXAM_HOURS)}`;
  }

  function open() {
    render();
    ui.dialog.showModal();
  }

  ui.pill.addEventListener('click', open);
  ui.pill.addEventListener('pointerup', () => ui.pill.blur());
  closable(ui.dialog);

  return { open, refresh };
}
