const OUT = '#3a2016';
const GOLD = '#f2c14e';
const GOLD_DARK = '#d18f22';
const GOLD_LIGHT = '#fbe08a';

const svg = (body) =>
  `<svg class="bank-art" viewBox="0 0 64 64" aria-hidden="true"><g stroke="${OUT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

const dollar = (x, y, size, color = '#9a5a12') => {
  const k = size / 10;
  return `<g transform="translate(${x} ${y}) scale(${k})" fill="none" stroke="${color}" stroke-width="${2.2 / k}">
    <path d="M3.2 -3 C2.2 -4.4 -3.2 -4.6 -3.2 -1.8 C-3.2 1 3.2 -0.2 3.2 2.6 C3.2 5 -2.2 5 -3.4 3.4"/>
    <path d="M0 -6 V6"/>
  </g>`;
};

const goldCoin = (cx, cy, r) => `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${GOLD}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.74}" fill="${GOLD_LIGHT}" stroke="${GOLD_DARK}" stroke-width="1.4"/>
  ${dollar(cx, cy, r * 1.15)}
  <path d="M${cx - r * 0.55} ${cy - r * 0.35} A${r * 0.62} ${r * 0.62} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.62}" stroke="#fff" stroke-width="1.6" fill="none" opacity="0.8"/>
`;

const coinLayer = (x, y, rx = 10, ry = 3.8) => `
  <path d="M${x - rx} ${y} V${y + 3.4} A${rx} ${ry} 0 0 0 ${x + rx} ${y + 3.4} V${y} Z" fill="${GOLD_DARK}"/>
  <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${GOLD}"/>
`;

const coinStack = (x, base, count, rx = 10) => {
  let out = '';
  for (let i = 0; i < count; i++) out += coinLayer(x, base - i * 4.6, rx);
  const top = base - (count - 1) * 4.6;
  return `${out}<ellipse cx="${x}" cy="${top}" rx="${rx * 0.62}" ry="${3.8 * 0.6}" fill="${GOLD_LIGHT}" stroke="${GOLD_DARK}" stroke-width="1.2"/>`;
};

const leaf = (d) => `<path d="${d}" fill="#5aa83e"/>`;

export const BANK_ART = {
  bank: svg(`
    ${leaf('M7 50 C1 42 2 32 9 28 C12 37 11 45 7 50 Z')}
    ${leaf('M57 50 C63 42 62 32 55 28 C52 37 53 45 57 50 Z')}
    <path d="M8 55 H56 V61 H8 Z" fill="#c9b48a"/>
    <path d="M12 50 H52 V55 H12 Z" fill="#e4d3ab"/>
    <path d="M7 23 L32 5 L57 23 Z" fill="#f1e2bd"/>
    <path d="M7 23 H57 V28 H7 Z" fill="#d6bf8c"/>
    ${[14, 24.5, 35, 45.5]
      .map(
        (x) => `<path d="M${x} 28 H${x + 5} V50 H${x} Z" fill="#f8f0de"/><path d="M${x + 2.5} 31 V47" stroke="#c9b48a" stroke-width="1.2"/>`,
      )
      .join('')}
    ${goldCoin(32, 16.5, 5.6)}
  `),
  coins: svg(`
    ${coinStack(18, 46, 4)}
    ${coinStack(44, 44, 5)}
    ${coinStack(31, 56, 3, 11)}
    ${dollar(31, 46.8, 5.5)}
  `),
  chart: svg(`
    <path d="M12 40 H20 V56 H12 Z" fill="#e2603a"/>
    <path d="M26 32 H34 V56 H26 Z" fill="#d84a2e"/>
    <path d="M40 22 H48 V56 H40 Z" fill="#c93a24"/>
    <path d="M14 42 V54 M28 34 V54 M42 24 V54" stroke="#f6a27a" stroke-width="1.6"/>
    <path d="M6 57 H58" stroke-width="3"/>
    <path d="M8 34 L22 24 L31 28 L49 11" fill="none" stroke-width="7"/>
    <path d="M8 34 L22 24 L31 28 L49 11" fill="none" stroke="#e8442e" stroke-width="3.6"/>
    <path d="M41 8 L55 5 L52 19 Z" fill="#e8442e"/>
  `),
  piggy: svg(`
    ${goldCoin(34, 11, 7.5)}
    <path d="M14 46 V55 H20 V49 M40 49 V55 H46 V46" fill="#e6a868"/>
    <path d="M10 31 C5 29 4 24 8 22" fill="none"/>
    <ellipse cx="31" cy="38" rx="22" ry="15" fill="#f0c08a"/>
    <path d="M38 25 L44 16 L48 27 Z" fill="#e6a868"/>
    <ellipse cx="53" cy="39" rx="5" ry="6.2" fill="#e8a070"/>
    <ellipse cx="51.6" cy="37.4" rx="0.9" ry="1.4" fill="${OUT}" stroke="none"/>
    <ellipse cx="54.6" cy="37.4" rx="0.9" ry="1.4" fill="${OUT}" stroke="none"/>
    <circle cx="45" cy="33" r="2" fill="${OUT}" stroke="none"/>
    <path d="M26 24.5 H38" stroke-width="2.6"/>
    <path d="M17 33 C19 28 24 26 28 27" stroke="#fff" stroke-width="2" fill="none" opacity="0.7"/>
  `),
  hand: svg(`
    ${goldCoin(36, 20, 12)}
    <path d="M2 41 L11 38 L14 57 L5 60 Z" fill="#c9962f"/>
    <path d="M11 40 C18 37 25 37 31 40 L45 37 C51 35 55 39 51 43 L37 51 C29 56 20 56 13 55 Z" fill="#f2c49a"/>
    <path d="M30 40 C33 43 37 44 43 42" fill="none" stroke-width="1.6"/>
    <path d="M22 54 C27 52 31 51 34 52 M18 50 C24 48 30 47 36 48" fill="none" stroke="#d99c6a" stroke-width="1.4"/>
  `),
  calendar: svg(`
    <rect x="9" y="13" width="46" height="44" rx="6" fill="#fffaf0"/>
    <path d="M9 19 C9 15.7 11.7 13 15 13 H49 C52.3 13 55 15.7 55 19 V26 H9 Z" fill="#d84a2e"/>
    <rect x="18" y="7" width="5" height="12" rx="2.5" fill="#9aa0a8"/>
    <rect x="41" y="7" width="5" height="12" rx="2.5" fill="#9aa0a8"/>
    ${[17, 28.5, 40]
      .flatMap((x) => [32, 40, 48].map((y) => `<rect x="${x}" y="${y}" width="7" height="5" rx="1.2" fill="${OUT}" stroke="none"/>`))
      .join('')}
  `),
  bag: svg(`
    ${leaf('M5 58 C1 50 4 42 11 41 C12 49 10 55 5 58 Z')}
    <path d="M20 27 C9 35 7 53 17 59 H47 C57 53 55 35 44 27 Z" fill="#d8a050"/>
    <path d="M24 20 C19 12 25 7 32 11 C39 7 45 12 40 20 Z" fill="#d8a050"/>
    <path d="M22 20 H42 V27 H22 Z" fill="#8a5a2a"/>
    <path d="M17 43 C17 36 21 31 26 29" stroke="#f2c88a" stroke-width="2" fill="none"/>
    ${dollar(32, 44, 13, '#7a3a10')}
    ${coinLayer(52, 56, 8, 3)}
    ${coinLayer(52, 51.5, 8, 3)}
    ${coinLayer(54, 47, 7, 2.6)}
  `),
  silver: svg(`
    <circle cx="32" cy="32" r="27" fill="#b9bec5"/>
    <circle cx="32" cy="32" r="21" fill="#dfe2e6" stroke="#8a9098" stroke-width="1.6"/>
    <ellipse cx="32" cy="32" rx="21" ry="8" fill="none" stroke="#8a9098" stroke-width="1.4"/>
    <ellipse cx="32" cy="32" rx="8" ry="21" fill="none" stroke="#8a9098" stroke-width="1.4"/>
    <path d="M23 21 C26 25 30 24 33 27 C36 30 33 34 37 36 M40 22 C38 26 42 28 44 30" fill="none" stroke="#8a9098" stroke-width="1.6"/>
    <path d="M12 26 A21 21 0 0 1 26 11" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.85"/>
  `),
  ledger: svg(`
    <path d="M9 12 C17 9 26 10 32 14 C38 10 47 9 55 12 V55 C47 52 38 53 32 57 C26 53 17 52 9 55 Z" fill="#c93a24"/>
    <path d="M13 14 C20 12 27 13 32 17 V53 C27 50 20 49 13 51 Z" fill="#fffaf0"/>
    <path d="M51 14 C44 12 37 13 32 17 V53 C37 50 44 49 51 51 Z" fill="#fffaf0"/>
    <path d="M17 24 H28 M17 30 H28 M17 36 H25 M17 42 H27" stroke="#b08850" stroke-width="1.6"/>
    ${goldCoin(42, 32, 7)}
  `),
  scroll: svg(`
    <path d="M14 14 H50 V50 H14 Z" fill="#f6e7c0"/>
    <path d="M10 9 H54 C57 9 57 17 54 17 H10 C7 17 7 9 10 9 Z" fill="#e2c68a"/>
    <path d="M10 47 H54 C57 47 57 55 54 55 H10 C7 55 7 47 10 47 Z" fill="#e2c68a"/>
    <path d="M20 25 H44 M20 31 H44 M20 37 H36" stroke="#b08850" stroke-width="2"/>
    <circle cx="43" cy="40" r="5.5" fill="#c93a24"/>
    <path d="M40 44 L38 50 L43 47 L48 50 L46 44" fill="#c93a24"/>
  `),
  receipt: svg(`
    <path d="M13 5 H51 V55 L46 59 L41 55 L36 59 L32 55 L28 59 L23 55 L18 59 L13 55 Z" fill="#fffaf0"/>
    <path d="M20 15 H44 M20 22 H44 M20 29 H36" stroke="#b08850" stroke-width="2"/>
    <path d="M20 38 H32" stroke-width="2.4"/>
    <circle cx="41" cy="43" r="7.5" fill="none" stroke="#c93a24" stroke-width="2.6"/>
    <path d="M37.5 43 L40 45.5 L45 40.5" fill="none" stroke="#c93a24" stroke-width="2.4"/>
  `),
};
