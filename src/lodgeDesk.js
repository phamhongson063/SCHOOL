import { LODGE_ROOMS, ECONOMY } from './config.js';
import { PLAYER } from './inventory.js';
import { book, heldTonight, isFree, roomTier } from './lodging.js';
import { amount, notEnough } from './format.js';
import { closable } from './dialog.js';
import { economy } from './economy.js';
import { stallCard, paintStallArt } from './stallCard.js';
import { setRich } from './goldArt.js';

export function createLodgeDesk({ purse, context, onRent }) {
  const dialog = document.getElementById('lodgeDialog');
  const title = document.getElementById('lodgeTitle');
  const money = document.getElementById('lodgeMoney');
  const list = document.getElementById('lodgeList');
  const note = document.getElementById('lodgeNote');
  paintStallArt(dialog);
  let offer = null;

  const paidFor = (id) => purse.heldRoom?.room === id && heldTonight(purse.heldRoom, context());

  function problemWith(id, paid = false) {
    const tier = roomTier(id);
    if (!isFree(id, PLAYER)) return 'Hết phòng rồi, tìm chỗ khác nhé!';
    if (purse.full) return 'Còn khoẻ lắm, chưa cần nghỉ!';
    if (!paid && purse.money < tier.price) return notEnough(tier.price);
    return null;
  }

  function checkIn(id) {
    purse.dropHeldRoom();
    book(id, PLAYER);
    onRent(id);
  }

  function rent(id) {
    const paid = paidFor(id);
    const problem = problemWith(id, paid);
    if (problem) return problem;
    if (paid) {
      checkIn(id);
      return null;
    }
    const tier = roomTier(id);
    offer = id;
    title.textContent = LODGE_ROOMS[id].name;
    money.textContent = amount(purse.money);
    note.textContent = '';
    list.replaceChildren(
      stallCard({
        icon: '🛏️',
        title: LODGE_ROOMS[id].name,
        price: tier.price,
        unit: 'đêm',
        tag: `+${tier.perHour}⚡/giờ`,
        actions: [
          { label: 'Huỷ', run: () => dialog.close() },
          { label: 'Thuê phòng', run: confirm },
        ],
      }),
    );
    dialog.showModal();
    return null;
  }

  function confirm() {
    const id = offer;
    if (!id) return;
    const problem = problemWith(id);
    if (problem) {
      setRich(note, problem);
      return;
    }
    purse.spend(roomTier(id).price);
    economy.collect(roomTier(id).price * ECONOMY.vat);
    offer = null;
    dialog.close();
    checkIn(id);
  }

  closable(dialog);
  dialog.addEventListener('close', () => {
    offer = null;
  });

  return { rent };
}
