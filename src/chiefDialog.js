import { PLAYER } from './inventory.js';
import { amount } from './format.js';
import { closable } from './dialog.js';
import { stallCard, paintStallArt } from './stallCard.js';

export function createChiefUI({ estate, purse, nameOf }) {
  const dialog = document.getElementById('chiefDialog');
  const list = document.getElementById('chiefList');
  const money = document.getElementById('chiefMoney');
  const note = document.getElementById('chiefNote');
  paintStallArt(dialog);

  function render() {
    money.textContent = amount(purse.money);
    const mine = estate.houseOf(PLAYER);
    list.replaceChildren(
      ...estate.houses.map((house) => {
        const actions = [];
        if (!house.owner) {
          actions.push({
            label: 'Mua',
            disabled: !!mine || purse.money < house.price,
            run: () => {
              const bought = estate.buy(house.id, PLAYER, purse);
              note.textContent = bought ? `🎉 Chúc mừng! Nhà số ${house.id} giờ là của bạn.` : 'Chưa đủ tiền mua căn này.';
              render();
            },
          });
        }
        if (house.owner === PLAYER) {
          actions.push({
            label: `Bán lại ${amount(estate.buybackOf(house))}`,
            run: () => {
              const sold = estate.sellBack(PLAYER, purse);
              note.textContent = sold ? `Youngsoo: "Làng đã mua lại nhà số ${sold.id}."` : 'Youngsoo: "Quỹ làng chưa đủ tiền mua lại, con chờ ít bữa nhé."';
              render();
            },
          });
        }
        return stallCard({
          icon: house.owner === PLAYER ? '🏡' : '🏠',
          title: `Nhà số ${house.id} · ${estate.sizeName(house)}`,
          price: house.price,
          tag: house.owner ? null : 'đang bán',
          detail: house.owner ? `Chủ nhà: ${house.owner === PLAYER ? 'Bạn' : nameOf(house.owner)}` : null,
          actions,
          muted: !!house.owner && house.owner !== PLAYER,
        });
      }),
    );
  }

  closable(dialog);
  estate.onChange(() => {
    if (dialog.open) render();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open() {
      const mine = estate.houseOf(PLAYER);
      note.textContent = mine ? `Youngsoo: "Con đã có nhà số ${mine.id} rồi đó."` : 'Youngsoo: "Muốn mua nhà thì chọn căn nào ưng ý nhé."';
      render();
      dialog.showModal();
    },
  };
}
