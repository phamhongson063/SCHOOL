import { CERTIFY } from './config.js';
import { DECKS } from './studyDecks.js';
import { closable } from './dialog.js';
import { coins } from './format.js';
import { setRich } from './goldArt.js';
import { paintIcon } from './itemArt.js';

const topics = () => [
  { icon: '🪑', art: 'scroll', name: 'Đặt chỗ', text: `Chờ ghế để ngồi học · ${coins(CERTIFY.learnFee)}/lần` },
  { icon: '📝', art: 'scroll', name: 'Kiểm tra nội bộ', text: `Thi để được khảo thí · ${coins(CERTIFY.internalFee)}` },
];

export function createHallIntro() {
  const dialog = document.getElementById('hallIntroDialog');
  const title = document.getElementById('hallIntroTitle');
  const list = document.getElementById('hallIntroList');
  closable(dialog);

  paintIcon(dialog.querySelector('.sched-badge'), { icon: '❓', art: 'question' });

  function row({ icon, art, name, text }) {
    const item = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = 'hall-intro-icon';
    badge.setAttribute('aria-hidden', 'true');
    paintIcon(badge, { icon, art });
    const body = document.createElement('div');
    const head = document.createElement('strong');
    head.textContent = name;
    const note = document.createElement('p');
    setRich(note, text);
    body.append(head, note);
    item.append(badge, body);
    return item;
  }

  return {
    open(deck) {
      title.textContent = `Lớp ${DECKS[deck].label}`;
      list.replaceChildren(...topics().map(row));
      dialog.showModal();
    },
  };
}
