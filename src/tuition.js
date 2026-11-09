import { SCHOOL } from './config.js';
import { coins, notEnough } from './format.js';
import { closable } from './dialog.js';

export function createTuition({ purse, onStudy, onCredit }) {
  const popup = document.getElementById('payPopup');
  const popupText = document.getElementById('payText');
  const popupBtn = document.getElementById('payBtn');
  const popupNote = document.getElementById('payNote');

  const dialog = document.getElementById('teacherDialog');
  const countInput = document.getElementById('prepayCount');
  const total = document.getElementById('prepayTotal');
  const current = document.getElementById('prepayCurrent');
  const note = document.getElementById('prepayNote');
  const form = document.getElementById('prepayForm');

  let periodKey = null;
  let studying = false;
  let resolved = false;
  let period = 0;

  function hidePopup() {
    popup.hidden = true;
  }

  function pay() {
    if (resolved) return;
    if (!purse.spend(SCHOOL.tuition)) {
      popupNote.textContent = notEnough(SCHOOL.tuition);
      return;
    }
    studying = true;
    resolved = true;
    hidePopup();
    onStudy?.();
  }

  popupBtn.addEventListener('click', pay);

  const clampCount = (value) => Math.max(1, Math.min(SCHOOL.maxPrepaid, Math.floor(Number(value) || 1)));

  function renderDialog() {
    const count = clampCount(countInput.value);
    countInput.value = count;
    total.textContent = coins(count * SCHOOL.tuition);
    current.textContent = purse.credits ? `Đã đóng trước: còn ${purse.credits} tiết` : 'Chưa đóng trước tiết nào';
  }

  for (const step of dialog.querySelectorAll('.step')) {
    step.addEventListener('click', () => {
      countInput.value = clampCount(Number(countInput.value) + Number(step.dataset.dir));
      renderDialog();
    });
  }
  countInput.addEventListener('input', () => {
    total.textContent = coins(clampCount(countInput.value) * SCHOOL.tuition);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const count = clampCount(countInput.value);
    if (!purse.spend(count * SCHOOL.tuition)) {
      note.textContent = `Không đủ tiền! Cần ${coins(count * SCHOOL.tuition)}, con đang có ${coins(purse.money)}.`;
      return;
    }
    purse.addCredits(count);
    note.textContent = `Thầy đã ghi sổ ${count} tiết. Ngồi vào lớp là tự trừ, khỏi đóng từng tiết.`;
    renderDialog();
  });
  closable(dialog);
  dialog.querySelector('.sched-ghost').addEventListener('click', () => dialog.close());

  return {
    get studying() {
      return studying;
    },
    openTeacher() {
      countInput.value = 5;
      note.textContent = `Thầy đồ: "Mỗi tiết ${coins(SCHOOL.tuition)}. Đóng trước bao nhiêu tiết thì đóng."`;
      renderDialog();
      dialog.showModal();
    },
    update(ctx, seated) {
      const phase = ctx.phase;
      if (phase.kind !== 'period') {
        periodKey = null;
        studying = false;
        resolved = false;
        hidePopup();
        return;
      }
      if (phase.key !== periodKey) {
        periodKey = phase.key;
        period = phase.period;
        studying = false;
        resolved = false;
        hidePopup();
      }
      if (!seated || resolved) {
        hidePopup();
        return;
      }
      if (purse.useCredit()) {
        studying = true;
        resolved = true;
        hidePopup();
        onCredit?.(purse.credits);
        onStudy?.();
        return;
      }
      const short = purse.money < SCHOOL.tuition;
      const text = `📖 Tiết ${period} đang học — đóng ${coins(SCHOOL.tuition)} để vào học?`;
      if (popupText.textContent !== text) popupText.textContent = text;
      if (popup.hidden || popupBtn.disabled !== short) {
        popupNote.textContent = short ? 'Bạn chưa đủ tiền. Ra ruộng thu hoạch rồi bán ở tiệm nhé!' : '';
        popupBtn.disabled = short;
        popup.hidden = false;
      }
    },
  };
}
