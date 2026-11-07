import { SCHOOL, MONEY } from './config.js';
import { realSeconds } from './clock.js';
import { payWindow } from './timetable.js';
import { coins } from './format.js';

export function createTuition({ purse, onStudy, onMissed, onCredit }) {
  const popup = document.getElementById('payPopup');
  const popupText = document.getElementById('payText');
  const popupBtn = document.getElementById('payBtn');
  const popupBar = document.getElementById('payBar');
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
      popupNote.textContent = `Không đủ tiền! Cần ${SCHOOL.tuition} ${MONEY.icon}.`;
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
    total.textContent = `${count * SCHOOL.tuition} ${MONEY.icon}`;
    current.textContent = purse.credits ? `Đã đóng trước: còn ${purse.credits} tiết` : 'Chưa đóng trước tiết nào';
  }

  for (const step of dialog.querySelectorAll('.step')) {
    step.addEventListener('click', () => {
      countInput.value = clampCount(Number(countInput.value) + Number(step.dataset.dir));
      renderDialog();
    });
  }
  countInput.addEventListener('input', () => {
    total.textContent = `${clampCount(countInput.value) * SCHOOL.tuition} ${MONEY.icon}`;
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
  dialog.querySelector('.sched-x').addEventListener('click', () => dialog.close());
  dialog.querySelector('.sched-ghost').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    get studying() {
      return studying;
    },
    openTeacher() {
      countInput.value = 5;
      note.textContent = `Thầy đồ: "Mỗi tiết ${SCHOOL.tuition} ${MONEY.icon}. Đóng trước bao nhiêu tiết thì đóng."`;
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
      }
      if (!seated || resolved) {
        hidePopup();
        return;
      }
      if (!phase.paying) {
        resolved = true;
        hidePopup();
        if (!studying) onMissed?.();
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
      const left = Math.max(0, realSeconds(payWindow() - (ctx.minutes - phase.startAt)));
      if (popup.hidden) {
        popupText.textContent = `📖 Tiết ${period} sắp bắt đầu — đóng ${SCHOOL.tuition} ${MONEY.icon} để học?`;
        popupNote.textContent = purse.money < SCHOOL.tuition ? 'Bạn chưa đủ tiền. Ra ruộng thu hoạch rồi bán ở tiệm nhé!' : '';
        popupBtn.disabled = purse.money < SCHOOL.tuition;
        popup.hidden = false;
      }
      popupBar.style.transform = `scaleX(${Math.min(1, left / Math.max(0.1, realSeconds(payWindow())))})`;
    },
  };
}
