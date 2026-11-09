import { LODGE_ROOMS, ECONOMY } from './config.js';
import { PLAYER } from './inventory.js';
import { book, isFree, roomTier } from './lodging.js';
import { coins, notEnough } from './format.js';
import { closable } from './dialog.js';
import { economy } from './economy.js';

export function createLodgeDesk({ purse, onRent }) {
  const dialog = document.getElementById('lodgeDialog');
  const title = document.getElementById('lodgeTitle');
  const text = document.getElementById('lodgeText');
  const note = document.getElementById('lodgeNote');
  let offer = null;

  function problemWith(id) {
    const tier = roomTier(id);
    if (!isFree(id, PLAYER)) return 'Phòng có người ở rồi, tìm chỗ khác nhé!';
    if (purse.full) return 'Còn khoẻ lắm, chưa cần nghỉ!';
    if (purse.money < tier.price) return notEnough(tier.price);
    return null;
  }

  function rent(id) {
    const problem = problemWith(id);
    if (problem) return problem;
    const tier = roomTier(id);
    offer = id;
    title.textContent = LODGE_ROOMS[id].name;
    text.textContent = `${coins(tier.price)} · +${tier.perHour}⚡/giờ`;
    note.textContent = '';
    note.hidden = true;
    dialog.showModal();
    return null;
  }

  function confirm() {
    const id = offer;
    if (!id) return;
    const problem = problemWith(id);
    if (problem) {
      note.textContent = problem;
      note.hidden = false;
      return;
    }
    purse.spend(roomTier(id).price);
    economy.collect(roomTier(id).price * ECONOMY.vat);
    offer = null;
    dialog.close();
    book(id, PLAYER);
    onRent(id);
  }

  document.getElementById('lodgeOk').addEventListener('click', confirm);
  document.getElementById('lodgeCancel').addEventListener('click', () => dialog.close());
  closable(dialog);
  dialog.addEventListener('close', () => {
    offer = null;
  });

  return { rent };
}
