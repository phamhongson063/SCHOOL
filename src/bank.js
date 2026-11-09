import { BANK, VILLAGER } from './config.js';
import { DAY_MINUTES, dayOf, durationText, isOpenAt, hoursText } from './clock.js';
import { amount, coins, notEnough } from './format.js';
import { PLAYER } from './inventory.js';
import { BANK_ART } from './bankArt.js';
import { closable } from './dialog.js';
import { createStore } from './persist.js';
import { setRich } from './goldArt.js';

const KEY = 'truong-lang-xua.bank';

export const bankOpen = (minutes) => isOpenAt(BANK, minutes);
export const bankHours = () => hoursText(BANK);

export const percent = (rate) => `${(rate * 100).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const dueOf = (item) => item.start + item.days * DAY_MINUTES;
const debtOf = (loan) => loan.owed + loan.interest;
const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);

const blankAccount = () => ({ savings: 0, savingsAt: null, terms: [], loans: [], repaid: 0 });

function cleanAccount(raw) {
  const account = blankAccount();
  if (!raw || typeof raw !== 'object') return account;
  account.savings = Math.max(0, number(raw.savings));
  account.savingsAt = Number.isFinite(raw.savingsAt) ? raw.savingsAt : null;
  account.repaid = Math.max(0, Math.floor(number(raw.repaid)));
  for (const term of Array.isArray(raw.terms) ? raw.terms : []) {
    if (!term || ![term.id, term.principal, term.rate, term.start, term.days].every(Number.isFinite) || term.principal <= 0) continue;
    account.terms.push({ id: term.id, principal: term.principal, rate: term.rate, start: term.start, days: term.days });
  }
  for (const loan of Array.isArray(raw.loans) ? raw.loans : []) {
    if (!loan || ![loan.id, loan.owed, loan.interest, loan.rate, loan.start, loan.at, loan.days].every(Number.isFinite) || loan.owed + loan.interest <= 0) continue;
    account.loans.push({ id: loan.id, owed: loan.owed, interest: Math.max(0, loan.interest), rate: loan.rate, start: loan.start, at: loan.at, days: loan.days });
  }
  return account;
}

function load(minutes) {
  const deposit = BANK.deposit.base;
  const loan = BANK.deposit.base + BANK.loan.spread;
  const state = { day: dayOf(minutes), deposit, loan, prevDeposit: deposit, prevLoan: loan, vault: BANK.capital, seq: 1, accounts: {} };
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {}
  if (!raw || typeof raw !== 'object') return state;
  for (const field of ['day', 'deposit', 'loan', 'prevDeposit', 'prevLoan', 'vault', 'seq']) {
    if (Number.isFinite(raw[field])) state[field] = raw[field];
  }
  for (const [owner, account] of Object.entries(raw.accounts ?? {})) state.accounts[owner] = cleanAccount(account);
  for (const account of Object.values(state.accounts)) {
    for (const item of [...account.terms, ...account.loans]) state.seq = Math.max(state.seq, item.id + 1);
  }
  return state;
}

export function createBank({ ledger, estate, now }) {
  const state = load(now());
  const listeners = [];
  const collectors = [];
  const store = createStore(KEY, () => state);

  function changed() {
    store.save();
    for (const listener of listeners) listener();
  }

  const accountOf = (owner) => (state.accounts[owner] ??= blankAccount());

  function settleSavings(account, t) {
    if (account.savingsAt !== null && account.savings > 0 && t > account.savingsAt) {
      account.savings += (account.savings * state.deposit * (t - account.savingsAt)) / DAY_MINUTES;
    }
    if (account.savingsAt === null || t > account.savingsAt) account.savingsAt = t;
  }

  function termValue(term, t) {
    const elapsed = clamp(t - term.start, 0, term.days * DAY_MINUTES);
    return term.principal * (1 + (term.rate * elapsed) / DAY_MINUTES);
  }

  function accrued(loan, t) {
    if (t <= loan.at) return 0;
    const due = dueOf(loan);
    const normal = Math.max(0, Math.min(t, due) - loan.at);
    const late = Math.max(0, t - Math.max(loan.at, due));
    return (loan.owed * loan.rate * (normal + late * BANK.overdue)) / DAY_MINUTES;
  }

  function settleLoan(loan, t) {
    if (t <= loan.at) return;
    loan.interest += accrued(loan, t);
    loan.at = t;
  }

  function deposited(owner) {
    const account = state.accounts[owner];
    if (!account) return 0;
    const t = now();
    const since = account.savingsAt === null ? 0 : Math.max(0, t - account.savingsAt);
    const savings = account.savings * (1 + (state.deposit * since) / DAY_MINUTES);
    return Math.floor(savings + sum(account.terms, (term) => termValue(term, t)));
  }

  function overdue(owner) {
    const t = now();
    return (state.accounts[owner]?.loans ?? []).some((loan) => dueOf(loan) <= t);
  }

  function debt(owner) {
    const loans = state.accounts[owner]?.loans ?? [];
    const t = now();
    return sum(loans, (loan) => Math.ceil(debtOf(loan) + accrued(loan, t)));
  }

  function settle(account, t) {
    settleSavings(account, t);
    account.terms = account.terms.filter((term) => {
      const due = dueOf(term);
      if (due > t) return true;
      account.savings += termValue(term, due) * (1 + (state.deposit * (t - due)) / DAY_MINUTES);
      return false;
    });
    for (const loan of account.loans) settleLoan(loan, t);
  }

  const deposits = () => sum(Object.values(state.accounts), (account) => account.savings + sum(account.terms, (term) => term.principal));
  const lent = () => sum(Object.values(state.accounts), (account) => sum(account.loans, (loan) => loan.owed));
  const lendable = () => Math.max(0, Math.floor(state.vault - BANK.reserve * deposits()));

  function utilization() {
    const out = lent();
    const pool = out + Math.max(0, state.vault);
    return pool > 0 ? out / pool : 0;
  }

  function retune() {
    const pressure = (utilization() - BANK.utilization) / BANK.utilization;
    const wobble = () => 1 + (Math.random() * 2 - 1) * BANK.noise;
    const deposit = clamp(BANK.deposit.base * (1 + BANK.deposit.swing * pressure) * wobble(), BANK.deposit.min, BANK.deposit.max);
    const loan = clamp(deposit + BANK.loan.spread * (1 + BANK.loan.swing * Math.max(pressure, -0.5)) * wobble(), BANK.loan.min, BANK.loan.max);
    state.prevDeposit = state.deposit;
    state.prevLoan = state.loan;
    state.deposit += (deposit - state.deposit) * BANK.smoothing;
    state.loan += (loan - state.loan) * BANK.smoothing;
  }

  function pay(account, loan, cash, t) {
    const toInterest = Math.min(cash, loan.interest);
    loan.interest -= toInterest;
    loan.owed = Math.max(0, loan.owed - (cash - toInterest));
    state.vault += cash;
    if (debtOf(loan) >= 0.5) return false;
    account.loans = account.loans.filter((item) => item !== loan);
    if (t <= dueOf(loan)) account.repaid += 1;
    return true;
  }

  function collect(owner, account, t) {
    let taken = 0;
    for (const loan of [...account.loans]) {
      if (dueOf(loan) > t) continue;
      const fromSavings = Math.min(Math.floor(account.savings), Math.ceil(debtOf(loan)));
      if (fromSavings > 0) {
        account.savings -= fromSavings;
        state.vault -= fromSavings;
        taken += fromSavings;
        if (pay(account, loan, fromSavings, t)) continue;
      }
      if (!ledger.accounts[owner]) continue;
      const purse = ledger.purse(owner);
      const fromPurse = Math.min(purse.money, Math.ceil(debtOf(loan)));
      if (fromPurse > 0 && purse.spend(fromPurse)) {
        taken += fromPurse;
        pay(account, loan, fromPurse, t);
      }
    }
    if (taken > 0) for (const collector of collectors) collector(owner, taken);
  }

  function tick(t = now()) {
    const today = dayOf(t);
    if (today <= state.day) return;
    for (let day = Math.max(state.day + 1, today - BANK.catchUpDays + 1); day <= today; day++) {
      const edge = day * DAY_MINUTES;
      for (const [owner, account] of Object.entries(state.accounts)) {
        settle(account, edge);
        collect(owner, account, edge);
      }
      retune();
    }
    state.day = today;
    changed();
  }

  function begin(owner) {
    const t = now();
    tick(t);
    const account = accountOf(owner);
    settle(account, t);
    return { t, account };
  }

  function limitFor(owner, account) {
    const base = Math.min(BANK.credit.cap, BANK.credit.base + BANK.credit.perRepaid * account.repaid);
    const house = estate.houseOf(owner);
    return Math.floor(base + (house ? house.price * BANK.credit.house : 0));
  }

  function roomFor(owner, account, t) {
    if (account.loans.some((loan) => dueOf(loan) <= t)) return 0;
    const owed = sum(account.loans, (loan) => Math.ceil(debtOf(loan)));
    return Math.max(0, Math.min(limitFor(owner, account) - owed, lendable()));
  }

  const savingRate = (index) => state.deposit + BANK.savingTerms[index].bonus;
  const loanRate = (index) => state.loan + BANK.loanTerms[index].bonus;
  const fail = (text) => ({ ok: false, text });
  const done = (text) => {
    changed();
    return { ok: true, text };
  };

  function deposit(owner, purse, value, termIndex = 0) {
    const { t, account } = begin(owner);
    const cash = Math.floor(value);
    const term = BANK.savingTerms[termIndex] ?? BANK.savingTerms[0];
    if (!(cash >= BANK.minDeposit)) return fail(`Gửi tối thiểu ${coins(BANK.minDeposit)}.`);
    if (term.days && account.terms.length >= BANK.maxTerms) return fail(`Tối đa ${BANK.maxTerms} sổ có kỳ hạn.`);
    if (!purse.spend(cash)) return fail(notEnough(cash));
    state.vault += cash;
    if (!term.days) {
      account.savings += cash;
      return done(`Đã gửi ${coins(cash)} không kỳ hạn.`);
    }
    const rate = savingRate(BANK.savingTerms.indexOf(term));
    account.terms.push({ id: state.seq++, principal: cash, rate, start: t, days: term.days });
    return done(`Đã gửi ${coins(cash)} kỳ hạn ${term.days} ngày · ${percent(rate)}/ngày.`);
  }

  function withdraw(owner, purse, value) {
    const { account } = begin(owner);
    const cash = Math.min(Math.floor(value), Math.floor(account.savings));
    if (!(cash > 0)) return fail('Không có tiền gửi để rút.');
    if (state.vault < cash) return fail('Ngân hàng tạm hết tiền mặt.');
    account.savings -= cash;
    state.vault -= cash;
    purse.earn(cash);
    return done(`Đã rút ${coins(cash)}.`);
  }

  function closeTerm(owner, purse, id) {
    const { t, account } = begin(owner);
    const term = account.terms.find((item) => item.id === id);
    if (!term) return fail('Sổ này đã tất toán rồi.');
    const elapsed = clamp(t - term.start, 0, term.days * DAY_MINUTES);
    const cash = Math.floor(term.principal * (1 + (state.deposit * elapsed) / DAY_MINUTES));
    if (state.vault < cash) return fail('Ngân hàng tạm hết tiền mặt.');
    account.terms = account.terms.filter((item) => item !== term);
    state.vault -= cash;
    purse.earn(cash);
    return done(`Tất toán trước hạn · nhận ${coins(cash)}.`);
  }

  function borrow(owner, purse, value, termIndex = 1) {
    const { t, account } = begin(owner);
    const cash = Math.floor(value);
    const term = BANK.loanTerms[termIndex] ?? BANK.loanTerms[0];
    if (!(cash >= BANK.minLoan)) return fail(`Vay tối thiểu ${coins(BANK.minLoan)}.`);
    if (account.loans.some((loan) => dueOf(loan) <= t)) return fail('Còn nợ quá hạn, trả trước đã!');
    if (account.loans.length >= BANK.maxLoans) return fail(`Tối đa ${BANK.maxLoans} khoản vay.`);
    const room = roomFor(owner, account, t);
    if (cash > room) return fail(`Hạn mức còn ${coins(room)}.`);
    const rate = loanRate(BANK.loanTerms.indexOf(term));
    account.loans.push({ id: state.seq++, owed: cash, interest: 0, rate, start: t, at: t, days: term.days });
    state.vault -= cash;
    purse.earn(cash);
    return done(`Đã vay ${coins(cash)} · ${term.days} ngày · ${percent(rate)}/ngày.`);
  }

  function repay(owner, purse, id, value) {
    const { t, account } = begin(owner);
    const loan = account.loans.find((item) => item.id === id);
    if (!loan) return fail('Khoản này đã trả xong.');
    const debt = Math.ceil(debtOf(loan));
    const cash = Math.min(Math.floor(value), debt, purse.money);
    if (!(cash > 0)) return fail('Không đủ tiền!');
    if (!purse.spend(cash)) return fail('Không đủ tiền!');
    const cleared = pay(account, loan, cash, t);
    return done(cleared ? 'Đã trả hết nợ!' : `Đã trả ${coins(cash)} · còn nợ ${coins(debt - cash)}.`);
  }

  function summary(owner) {
    const { t, account } = begin(owner);
    return {
      savings: Math.floor(account.savings),
      terms: account.terms.map((term) => ({ id: term.id, principal: term.principal, rate: term.rate, days: term.days, left: dueOf(term) - t, value: Math.floor(termValue(term, t)) })),
      loans: account.loans.map((loan) => ({ id: loan.id, debt: Math.ceil(debtOf(loan)), rate: loan.rate, days: loan.days, left: dueOf(loan) - t, overdue: dueOf(loan) <= t })),
      limit: limitFor(owner, account),
      room: roomFor(owner, account, t),
    };
  }

  function rates() {
    tick();
    return {
      deposit: state.deposit,
      loan: state.loan,
      depositTrend: Math.sign(state.deposit - state.prevDeposit),
      loanTrend: Math.sign(state.loan - state.prevLoan),
      saving: BANK.savingTerms.map((term, index) => ({ days: term.days, rate: savingRate(index) })),
      lending: BANK.loanTerms.map((term, index) => ({ days: term.days, rate: loanRate(index) })),
    };
  }

  function npcPlan({ id, purse, thrift, roll }) {
    const t = now();
    tick(t);
    const account = state.accounts[id] ?? null;
    if (account) settle(account, t);
    const money = purse.money;
    const keep = BANK.npc.keepBase + BANK.npc.keepSpread * (1 - thrift);
    const liquid = account ? Math.floor(account.savings) : 0;
    const loans = account?.loans ?? [];
    const urgent = loans.find((loan) => dueOf(loan) - t <= BANK.npc.dueSoon * DAY_MINUTES);
    if (urgent && money > BANK.npc.broke) return { kind: 'repay', id: urgent.id, amount: money - BANK.npc.broke, urgent: true };
    if (loans.length && money > keep * 1.5) return { kind: 'repay', id: loans[0].id, amount: Math.floor(money - keep) };
    if (liquid > 0 && estate.affordableFor(id, money + liquid - VILLAGER.houseReserve) && !estate.affordableFor(id, money - VILLAGER.houseReserve)) {
      return { kind: 'withdraw', amount: liquid, urgent: true };
    }
    if (money < keep * 0.4 && liquid > 0) return { kind: 'withdraw', amount: Math.min(liquid, Math.ceil(keep - money)), urgent: true };
    if (money < BANK.npc.broke && !loans.some((loan) => dueOf(loan) <= t)) {
      const room = roomFor(id, account ?? blankAccount(), t);
      const want = Math.min(room, Math.round(BANK.npc.borrowBase + keep * 0.5));
      const appetite = ((1 - thrift) * (BANK.deposit.base + BANK.loan.spread)) / state.loan;
      if (want >= BANK.minLoan && loans.length < BANK.maxLoans && roll < appetite) return { kind: 'borrow', amount: want, term: thrift < 0.3 ? 0 : 1, urgent: true };
      return null;
    }
    const surplus = Math.floor(money - keep);
    if (surplus < Math.max(BANK.minDeposit, keep)) return null;
    const appeal = ((0.3 + 0.6 * thrift) * state.deposit) / BANK.deposit.base;
    if (roll >= appeal) return null;
    const term = thrift > 0.7 ? 3 : thrift > 0.45 ? 2 : thrift > 0.25 ? 1 : 0;
    return { kind: 'deposit', amount: surplus, term };
  }

  function npcServe(client) {
    const plan = npcPlan(client);
    if (!plan) return '🏦 Xem lãi suất thôi, mai tính.';
    const { id, purse } = client;
    if (plan.kind === 'deposit') {
      const result = deposit(id, purse, plan.amount, plan.term);
      return result.ok ? `🏦 Gửi ${coins(plan.amount)} lấy lãi!` : result.text;
    }
    if (plan.kind === 'withdraw') {
      const result = withdraw(id, purse, plan.amount);
      return result.ok ? `🏦 Rút ${coins(plan.amount)} tiêu dần.` : result.text;
    }
    if (plan.kind === 'borrow') {
      const result = borrow(id, purse, plan.amount, plan.term);
      return result.ok ? `🏦 Vay tạm ${coins(plan.amount)}...` : result.text;
    }
    const result = repay(id, purse, plan.id, plan.amount);
    return result.ok ? `🏦 ${result.text}` : result.text;
  }

  return {
    tick,
    debt,
    deposited,
    overdue,
    rates,
    summary,
    deposit,
    withdraw,
    closeTerm,
    borrow,
    repay,
    npcPlan,
    npcServe,
    onChange(listener) {
      listeners.push(listener);
    },
    onCollect(listener) {
      collectors.push(listener);
    },
  };
}

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
