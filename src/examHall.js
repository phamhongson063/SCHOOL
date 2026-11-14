import { CERTIFY } from './config.js';
import { DECKS, DECK_IDS, unitOf, plainText } from './studyDecks.js';
import { certify } from './certify.js';
import { closable } from './dialog.js';
import { coins } from './format.js';
import { setRich } from './goldArt.js';
import { economy } from './economy.js';
import { hoursText, isOpenAt } from './clock.js';
import { PLAYER } from './inventory.js';

export const EXAM_HOURS = { open: CERTIFY.open, close: CERTIFY.close };

export const examOpen = (minutes) => isOpenAt(EXAM_HOURS, minutes);

export function unitLabel(key) {
  const card = unitOf(key);
  if (!card) return key;
  const word = plainText(card.word).replace(/[[\]]/g, '');
  if (card.deck !== 'sugu1') return word;
  return `${word} (ví dụ ${key.split(':')[2]})`;
}

export const qualifyTag = (deck) => `qualify:${deck}`;

function examLines(deck, result) {
  const info = DECKS[deck];
  const pct = Math.round(result.score * 100);
  const lines = [`Kết quả khảo thí ${info.label}: ${result.right}/${result.total} câu đúng (${pct}%) — ${result.passed ? 'ĐẬU' : 'RỚT'}.`];
  const list = (keys) => keys.map(unitLabel).join(', ');
  if (result.certified.length) lines.push(`🎓 Cấp chứng chỉ ${result.certified.length} ${info.unit}: ${list(result.certified)}.`);
  if (result.failed.length) lines.push(`⛔ Dừng thi vì sai ${info.unit} bắt buộc. Cần học lại: ${list(result.failed)}.`);
  if (result.carried.length) lines.push(`↻ Giữ tư cách khảo thí ngày mai: ${list(result.carried)}.`);
  if (result.revoked.length) lines.push(`⚠ Bị thu hồi chứng chỉ: ${list(result.revoked)}.`);
  return lines;
}

export function createExamHall({ purse, exams, mailbox, minutes, say, onRegister }) {
  const dialog = document.getElementById('examDialog');
  const note = document.getElementById('examNote');
  const list = document.getElementById('examList');
  closable(dialog);

  function blocker(deck, now) {
    if (!examOpen(now)) return `Trường khảo thí chỉ mở cửa ${hoursText(EXAM_HOURS)}.`;
    if (certify.examTaken(PLAYER, deck)) return 'Hôm nay bạn đã khảo thí lớp này rồi.';
    if (certify.finished(PLAYER, deck)) return 'Bạn đã học hết bộ này.';
    if (!certify.qualified(PLAYER, deck)) return 'Bạn chưa đủ điều kiện: cần đậu thi nội bộ ở phòng học trước.';
    if (purse.intellect < CERTIFY.examIntellect) return `Bạn không đủ điều kiện: cần ${CERTIFY.examIntellect} 💡 trí lực (đang có ${purse.intellect}).`;
    if (purse.money < CERTIFY.examFee) return `Bạn không đủ tiền lệ phí ${coins(CERTIFY.examFee)}.`;
    return null;
  }

  function render() {
    const now = minutes();
    setRich(note, `Lệ phí mỗi lần: ${coins(CERTIFY.examFee)} + ${CERTIFY.examIntellect} 💡 trí lực. Bạn đang có ${purse.intellect} 💡.`);
    list.replaceChildren(
      ...DECK_IDS.map((deck) => {
        const row = document.createElement('div');
        row.className = 'exam-row';
        const name = document.createElement('strong');
        name.textContent = DECKS[deck].label;
        const info = document.createElement('span');
        info.className = 'exam-info';
        const reason = blocker(deck, now);
        info.textContent = reason ?? `${certify.batch(PLAYER, deck).length} ${DECKS[deck].unit} mới · 🎓 ${certify.certifiedCount(PLAYER, deck)}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sched-primary';
        button.textContent = 'Đăng ký thi';
        button.disabled = !!reason || exams.running;
        button.addEventListener('click', () => register(deck));
        row.append(name, info, button);
        return row;
      }),
    );
  }

  function register(deck) {
    if (blocker(deck, minutes()) || exams.running) {
      render();
      return;
    }
    dialog.close();
    onRegister?.(deck);
  }

  async function sit(deck) {
    if (exams.running) return;
    const reason = blocker(deck, minutes());
    if (reason) {
      say?.(reason);
      return;
    }
    if (!purse.take('intellect', CERTIFY.examIntellect)) return;
    if (!purse.spend(CERTIFY.examFee)) {
      purse.add('intellect', CERTIFY.examIntellect);
      return;
    }
    economy.income('teacher', CERTIFY.examFee);
    mailbox.removeTag(qualifyTag(deck));
    const results = await exams.run({
      title: `Khảo thí ${DECKS[deck].title}`,
      deck,
      keys: certify.examQuestions(PLAYER, deck),
      icon: '🎓',
      minSeconds: CERTIFY.examMinutes * 60,
      more: (last) => certify.examExtra(PLAYER, deck, last),
      stops: (result) => certify.examStops(PLAYER, deck, result),
    });
    const result = certify.gradeExam(PLAYER, deck, results);
    mailbox.notify({ icon: result.passed ? '🎓' : '📄', lines: examLines(deck, result), tab: 'cert', keep: true });
    say?.(result.passed ? '🎓 Đậu khảo thí! Xem kết quả trong hộp thư nhé.' : '📄 Đã có kết quả khảo thí, xem hộp thư nhé.');
  }

  return {
    get isOpen() {
      return dialog.open;
    },
    open() {
      render();
      dialog.showModal();
    },
    sit,
  };
}
