import { durationText } from './clock.js';
import { amount, coins } from './format.js';
import { PLAYER } from './inventory.js';
import { BANK_ART } from './bankArt.js';
import { closable } from './dialog.js';
import { setRich } from './goldArt.js';
import { percent } from './bank.js';

const TREND = { 1: '▲', 0: '', '-1': '▼' };

export function createBankUI({ bank, purse, owner = PLAYER }) {
  const dialog = document.getElementById('bankDialog');
  const header = document.getElementById('bankMoney');
  const ratesBox = document.getElementById('bankRates');
  const tabs = [...dialog.querySelectorAll('[data-tab]')];
  const form = document.getElementById('bankForm');
  const amountInput = document.getElementById('bankAmount');
  const termSelect = document.getElementById('bankTerm');
  const submit = document.getElementById('bankSubmit');
  const note = document.getElementById('bankNote');
  const roomBox = document.getElementById('bankRoom');
  const holdings = document.getElementById('bankHoldings');
  const list = document.getElementById('bankList');
  let tab = 'save';
  const choice = { save: 0, loan: 1 };
  for (const node of dialog.querySelectorAll('[data-art]')) {
    node.innerHTML = BANK_ART[node.dataset.art];
    node.setAttribute('aria-hidden', 'true');
  }

  const typed = () => Math.floor(Number(amountInput.value) || 0);

  function report(result) {
    setRich(note, result.text);
    if (result.ok) amountInput.value = '';
    render();
  }

  function amountField(key) {
    const input = el('input', 'bank-mini');
    input.dataset.key = key;
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '1';
    input.step = '1';
    input.placeholder = 'Số tiền';
    input.setAttribute('aria-label', 'Số tiền');
    return input;
  }

  const withField = (field, act) => () => {
    const value = Math.floor(Number(field.value) || 0);
    if (value <= 0) {
      note.textContent = 'Nhập số tiền trước nhé.';
      return;
    }
    const result = act(value);
    if (result.ok) field.value = '';
    report(result);
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function art(className, name) {
    const node = el('span', className);
    node.innerHTML = BANK_ART[name];
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function button(label, onClick, { disabled = false, primary = false } = {}) {
    const node = el('button', primary ? 'bank-btn primary' : 'bank-btn', label);
    node.type = 'button';
    node.disabled = disabled;
    node.addEventListener('click', onClick);
    return node;
  }

  function card({ icon, title, value, rate, detail, actions, late = false }) {
    const node = el('div', late ? 'bank-card late' : 'bank-card');
    const badge = art('bank-card-icon', icon);
    const text = el('div', 'bank-card-text');
    const chip = el('span', 'bank-chip');
    chip.append(art('bank-coin', 'silver'), el('strong', 'bank-chip-value', amount(value)), el('span', 'bank-chip-bar'), el('span', 'bank-chip-rate', `${percent(rate)}/ngày`));
    text.append(el('strong', 'bank-card-title', title), chip);
    if (detail) {
      const small = el('small', 'bank-card-detail');
      setRich(small, detail);
      text.append(small);
    }
    const box = el('div', 'bank-card-actions');
    box.append(...actions);
    node.append(badge, text, box);
    return node;
  }

  function rateCard(icon, label, rate, trend) {
    const node = el('div', 'bank-rate');
    const badge = art('bank-rate-icon', icon);
    const text = el('div', 'bank-rate-text');
    const value = el('div', 'bank-rate-value');
    value.append(el('strong', '', percent(rate)), el('span', '', ' / ngày'));
    if (TREND[trend]) value.append(el('span', trend > 0 ? 'bank-trend up' : 'bank-trend down', ` ${TREND[trend]}`));
    text.append(el('span', 'bank-rate-label', label), value);
    node.append(badge, text);
    return node;
  }

  function renderTerms(rates) {
    const options = tab === 'save' ? rates.saving : rates.lending;
    termSelect.replaceChildren(
      ...options.map((option, index) => {
        const node = document.createElement('option');
        node.value = String(index);
        node.textContent = option.days ? `${option.days} ngày · ${percent(option.rate)}` : `Không kỳ hạn · ${percent(option.rate)}`;
        return node;
      }),
    );
    termSelect.value = String(Math.min(choice[tab], options.length - 1));
  }

  function renderSave(info, rates) {
    const cards = [];
    if (info.savings >= 1) {
      const field = amountField('save');
      cards.push(
        card({
          icon: 'bag',
          title: 'Không kỳ hạn',
          value: info.savings,
          rate: rates.deposit,
          actions: [field, button('Rút', withField(field, (value) => bank.withdraw(owner, purse, value))), button('Rút hết', () => report(bank.withdraw(owner, purse, info.savings)), { primary: true })],
        }),
      );
    }
    for (const term of info.terms) {
      cards.push(
        card({
          icon: 'scroll',
          title: `Kỳ hạn ${term.days} ngày`,
          value: term.value,
          rate: term.rate,
          detail: `Gốc ${coins(term.principal)} · đáo hạn sau ${durationText(term.left)}`,
          actions: [button('Tất toán', () => report(bank.closeTerm(owner, purse, term.id)), { primary: true })],
        }),
      );
    }
    return cards;
  }

  function renderLoan(info) {
    return info.loans.map((loan) => {
      const field = amountField(`loan:${loan.id}`);
      return card({
        icon: 'receipt',
        title: 'Khoản vay',
        value: loan.debt,
        rate: loan.rate,
        detail: loan.overdue ? `Quá hạn ${durationText(-loan.left)}` : `Hạn trả sau ${durationText(loan.left)}`,
        late: loan.overdue,
        actions: [
          field,
          button('Trả', withField(field, (value) => bank.repay(owner, purse, loan.id, value)), { disabled: purse.money < 1 }),
          button('Trả hết', () => report(bank.repay(owner, purse, loan.id, loan.debt)), { disabled: purse.money < 1, primary: true }),
        ],
      });
    });
  }

  function renderBook(info, rates) {
    const saves = renderSave(info, rates);
    const loans = renderLoan(info);
    const rows = [];
    if (saves.length) rows.push(el('h3', 'bank-ribbon', 'Tiền đang gửi'), ...saves);
    if (loans.length) rows.push(el('h3', 'bank-ribbon', 'Khoản đang vay'), ...loans);
    if (!rows.length) rows.push(el('p', 'bank-empty', 'Chưa có khoản nào.'));
    return rows;
  }

  function render() {
    header.textContent = amount(purse.money);
    const rates = bank.rates();
    ratesBox.replaceChildren(rateCard('coins', 'Lãi gửi', rates.deposit, rates.depositTrend), rateCard('chart', 'Lãi vay', rates.loan, rates.loanTrend));
    for (const node of tabs) node.setAttribute('aria-selected', String(node.dataset.tab === tab));
    const book = tab === 'book';
    form.hidden = book;
    if (!book) {
      renderTerms(rates);
      submit.textContent = tab === 'save' ? 'Gửi' : 'Vay';
    }
    const info = bank.summary(owner);
    roomBox.hidden = tab !== 'loan';
    if (tab === 'loan') setRich(roomBox, `Hạn mức ${coins(info.limit)} · còn vay được ${coins(info.room)}`);
    holdings.hidden = !book;
    const typing = new Map([...list.querySelectorAll('.bank-mini')].map((input) => [input.dataset.key, input.value]));
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    list.replaceChildren(...(book ? renderBook(info, rates) : []));
    for (const input of list.querySelectorAll('.bank-mini')) {
      input.value = typing.get(input.dataset.key) ?? '';
      if (input.dataset.key === focused) input.focus({ preventScroll: true });
    }
  }

  for (const node of tabs) {
    node.addEventListener('click', () => {
      tab = node.dataset.tab;
      note.textContent = '';
      render();
    });
  }
  termSelect.addEventListener('change', () => {
    choice[tab] = Number(termSelect.value) || 0;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const index = Number(termSelect.value) || 0;
    report(tab === 'save' ? bank.deposit(owner, purse, typed(), index) : bank.borrow(owner, purse, typed(), index));
  });
  closable(dialog);
  purse.onChange(() => {
    if (dialog.open) header.textContent = amount(purse.money);
  });
  bank.onChange(() => {
    if (dialog.open) render();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open() {
      note.textContent = 'Cô thủ quỹ: "Kính chào quý khách!"';
      render();
      dialog.showModal();
    },
    close() {
      dialog.close();
    },
  };
}
