import { SCHOOL } from './config.js';
import { LESSONS } from './lessons.js';
import { clockText } from './clock.js';
import { sessionLabel } from './timetable.js';
import { coins } from './format.js';
import { closable } from './dialog.js';

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
const minutesLeft = (m) => `${Math.max(1, Math.ceil(m))}'`;

function phaseStatus(ctx) {
  const phase = ctx.phase;
  if (phase.kind === 'period') return { icon: '📖', text: `Tiết ${phase.period} · còn ${minutesLeft(phase.remaining)}`, tone: '' };
  if (phase.kind === 'rest') return { icon: '☕', text: `Nghỉ tại chỗ · ${minutesLeft(phase.remaining)}`, tone: 'break' };
  if (phase.kind === 'recess') return { icon: '🪁', text: `Ra chơi · ${minutesLeft(phase.remaining)}`, tone: 'break' };
  if (ctx.night) return { icon: '🌙', text: 'Ban đêm', tone: 'night' };
  if (phase.next) {
    const soon = phase.remaining <= SCHOOL.alertBefore;
    return {
      icon: soon ? '🔔' : '⏳',
      text: soon ? `Tiết ${phase.next.period} sau ${minutesLeft(phase.remaining)}` : `Tiết ${phase.next.period} lúc ${clockText(phase.next.start)}`,
      tone: '',
      alert: soon,
    };
  }
  return { icon: '🏡', text: 'Tan học', tone: '' };
}

export function createScheduleBoard({ lesson, purse, sky, context }) {
  const ui = {
    pill: document.getElementById('phasePill'),
    clock: document.getElementById('phaseClock'),
    dialog: document.getElementById('scheduleDialog'),
    form: document.getElementById('scheduleForm'),
    dayClock: document.getElementById('scheduleClock'),
    list: document.getElementById('scheduleList'),
    hint: document.getElementById('scheduleHint'),
    cancel: document.getElementById('cancelBtn'),
    modes: [...document.querySelectorAll('.mode-option')],
  };

  const lessonChoice = document.getElementById('lessonChoice');
  const lessonSelect = document.getElementById('lessonSelect');
  lessonSelect.replaceChildren(
    ...LESSONS.map((item) => {
      const phrase = item.phrase.replace(/\{[^}]*\}/g, '').replace(/[[\]]/g, '');
      return new Option(`Bài ${item.no} · ${phrase} (${item.romaji})`, String(item.no));
    }),
  );

  let pendingMode = lesson.mode;
  function showMode(next) {
    pendingMode = next;
    for (const option of ui.modes) option.setAttribute('aria-checked', String(option.dataset.mode === next));
    lessonChoice.hidden = next !== 'choose';
  }
  for (const option of ui.modes) option.addEventListener('click', () => showMode(option.dataset.mode));

  let shownKey = '';
  function refresh(force = false) {
    const ctx = context();
    const clockLabel = clockText(ctx.minutes);
    if (!force && clockLabel === shownKey) return;
    shownKey = clockLabel;
    ui.clock.textContent = clockLabel;
    const label = `Ngày ${ctx.day}, ${clockLabel}`;
    ui.pill.title = label;
    ui.pill.setAttribute('aria-label', `${label}. Mở thời khoá biểu`);
    if (ui.dialog.open) render();
  }

  function render() {
    const ctx = context();
    const { phase, minute, day } = ctx;
    const schedule = phase.schedule;
    ui.dayClock.textContent = `Ngày ${day} · ${clockText(ctx.minutes)} · ${moonName(sky.phase)} · ${sessionLabel(schedule.plan)}`;
    const items = [];
    let lastEnd = 0;
    for (const seg of schedule.segments) {
      if (lastEnd && seg.start - lastEnd > 60) {
        const li = document.createElement('li');
        li.className = 'lunch';
        li.textContent = `${seg.start >= 18 * 60 ? 'Nghỉ tối' : 'Nghỉ trưa'} · ${clockText(lastEnd)} – ${clockText(seg.start)}`;
        items.push(li);
      }
      lastEnd = seg.end;
      const li = document.createElement('li');
      const name = seg.kind === 'period' ? `📖 Tiết ${seg.period}` : seg.kind === 'rest' ? '☕ Nghỉ tại chỗ' : '🪁 Ra chơi';
      const label = document.createElement('span');
      label.textContent = name;
      const time = document.createElement('span');
      time.textContent = `${clockText(seg.start)} – ${clockText(seg.end)}`;
      li.append(label, time);
      li.classList.toggle('break', seg.kind !== 'period');
      li.classList.toggle('now', minute >= seg.start && minute < seg.end);
      li.classList.toggle('past', minute >= seg.end);
      items.push(li);
    }
    ui.list.replaceChildren(...items);
    const status = phaseStatus(ctx);
    const credits = purse.credits ? ` · đã đóng trước ${purse.credits} tiết` : '';
    ui.hint.textContent = `${status.icon} ${status.text} · học phí ${coins(SCHOOL.tuition)}/tiết${credits}`;
    ui.hint.classList.toggle('break', status.tone === 'break');
  }

  function open() {
    lessonSelect.value = String(lesson.choice);
    showMode(lesson.mode);
    render();
    ui.dialog.showModal();
  }

  ui.pill.addEventListener('click', open);
  ui.pill.addEventListener('pointerup', () => ui.pill.blur());
  ui.cancel.addEventListener('click', () => ui.dialog.close());
  closable(ui.dialog);
  ui.form.addEventListener('submit', (e) => {
    e.preventDefault();
    lesson.setMode(pendingMode, Number(lessonSelect.value));
    ui.dialog.close();
  });

  return { open, refresh };
}
