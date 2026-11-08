const OUT = '#3a2016';

const svg = (body) =>
  `<svg class="item-art" viewBox="0 0 64 64" aria-hidden="true"><g stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

const eye = (x, y, r = 2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + 0.5}" cy="${y}" r="${r * 0.55}" fill="${OUT}" stroke="none"/>`;

const ART = {
  waterSpinach: svg(`
    <path d="M22 58 L30 22 M28 58 L33 19 M34 58 L36 20 M40 58 L39 22" stroke="${OUT}" stroke-width="7" fill="none"/>
    <path d="M22 58 L30 22 M28 58 L33 19 M34 58 L36 20 M40 58 L39 22" stroke="#a8d46a" stroke-width="4.2" fill="none"/>
    <path d="M30 23 C20 20 13 12 15 4 C22 7 29 13 30 23 Z" fill="#4f9a34"/>
    <path d="M37 22 C46 19 53 12 55 5 C47 6 40 12 37 22 Z" fill="#4f9a34"/>
    <path d="M34 20 C33 11 37 4 43 1 C44 9 40 16 34 20 Z" fill="#62b347"/>
    <path d="M31 21 C27 13 25 7 27 1 C32 6 34 13 31 21 Z" fill="#6cbc52"/>
    <path d="M29 21 C24 16 19 11 17 6 M36 20 C42 15 48 11 52 7" stroke="#2f6e22" stroke-width="1.3" fill="none"/>
    <path d="M20 43 Q31 46 42 43 L42 49 Q31 52 20 49 Z" fill="#c9962f"/>
    <path d="M24 44 L23 50 M31 46 L31 51 M38 45 L38 50" stroke="#8a5a1e" stroke-width="1.2" fill="none"/>
  `),
  bokChoy: svg(`
    <path d="M32 42 C18 36 9 21 15 8 C24 10 30 24 32 42 Z" fill="#3f8a2e"/>
    <path d="M32 42 C46 36 55 21 49 8 C40 10 34 24 32 42 Z" fill="#3f8a2e"/>
    <path d="M32 40 C25 27 25 11 32 3 C39 11 39 27 32 40 Z" fill="#55a83e"/>
    <path d="M32 38 V9 M30 40 C24 31 20 21 18 13 M34 40 C40 31 44 21 46 13" stroke="#cfe6b4" stroke-width="1.8" fill="none"/>
    <path d="M24 61 C21 51 24 43 30 37 L34 37 C40 43 43 51 40 61 Z" fill="#eef6df"/>
    <path d="M29 60 C28 51 29 43 32 38 M35 60 C36 51 35 43 32 38" stroke="#b9d39a" stroke-width="1.6" fill="none"/>
  `),
  tomato: svg(`
    <ellipse cx="32" cy="37" rx="24" ry="21" fill="#e2442f"/>
    <path d="M19 26 Q25 37 21 52 M45 26 Q39 37 43 52" stroke="#bf3322" stroke-width="1.6" fill="none"/>
    <ellipse cx="22" cy="31" rx="6.5" ry="3.6" fill="#fff" opacity="0.45" stroke="none" transform="rotate(-35 22 31)"/>
    <path d="M32 19 L27 11 L32 15 L36 9 L35 16 L44 14 L37 20 L43 24 L34 22 L32 27 L30 22 L21 24 L27 20 L20 14 L29 16 Z" fill="#4f9a34"/>
    <path d="M32 14 L33 5" stroke="#3d6e26" stroke-width="3.2" fill="none"/>
  `),
  corn: svg(`
    <path d="M32 61 C17 53 12 36 17 21 C22 32 27 45 32 61 Z" fill="#7cbf4a"/>
    <path d="M32 61 C47 53 52 36 47 21 C42 32 37 45 32 61 Z" fill="#6aad3e"/>
    <path d="M32 3 C40 3 44 16 44 30 C44 44 39 54 32 57 C25 54 20 44 20 30 C20 16 24 3 32 3 Z" fill="#f5c842"/>
    <path d="M23 13 H41 M21.5 19 H42.5 M20.5 25 H43.5 M20.5 31 H43.5 M21 37 H43 M22 43 H42 M24 49 H40" stroke="#d29a22" stroke-width="1.3" fill="none"/>
    <path d="M27 5 C24 19 24 41 27 55 M32 3 V57 M37 5 C40 19 40 41 37 55" stroke="#d29a22" stroke-width="1.3" fill="none"/>
    <path d="M32 61 C25 52 21 43 22 34 C27 41 31 49 32 61 Z" fill="#94d461"/>
  `),
  watermelon: svg(`
    <path d="M4 24 A28 28 0 0 0 60 24 Z" fill="#3f8a2e"/>
    <path d="M11 38 L15 35 M19 47 L22 43 M45 47 L42 43 M53 38 L49 35" stroke="#2c6620" stroke-width="2" fill="none"/>
    <path d="M8 24 A24 24 0 0 0 56 24 Z" fill="#e3f1c9" stroke="none"/>
    <path d="M11 24 A21 21 0 0 0 53 24 Z" fill="#ec4b52" stroke="none"/>
    <path d="M4 24 H60" fill="none"/>
    <ellipse cx="22" cy="31" rx="1.5" ry="2.6" fill="${OUT}" stroke="none" transform="rotate(-20 22 31)"/>
    <ellipse cx="32" cy="35" rx="1.5" ry="2.6" fill="${OUT}" stroke="none"/>
    <ellipse cx="42" cy="31" rx="1.5" ry="2.6" fill="${OUT}" stroke="none" transform="rotate(20 42 31)"/>
    <ellipse cx="27" cy="41" rx="1.5" ry="2.6" fill="${OUT}" stroke="none" transform="rotate(-12 27 41)"/>
    <ellipse cx="37" cy="41" rx="1.5" ry="2.6" fill="${OUT}" stroke="none" transform="rotate(12 37 41)"/>
  `),
  sweetPotato: svg(`
    <path d="M57 32 Q61 29 63 24 M7 41 Q3 45 1 50" fill="none" stroke-width="1.8"/>
    <path d="M6 41 C8 29 22 20 36 20 C50 20 60 26 58 34 C56 42 44 47 30 47 C18 47 6 49 6 41 Z" fill="#b8475c"/>
    <path d="M16 31 C24 25 38 24 48 27" stroke="#dc7a8e" stroke-width="3" fill="none"/>
    <path d="M22 39 l3 1 M34 41 l3 0 M45 37 l3 -1 M28 31 l2 -1" stroke="#7a2a3a" stroke-width="1.6" fill="none"/>
    <path d="M30 47 l-1 5 M41 45 l1 5" stroke-width="1.2" fill="none"/>
  `),
  carp: svg(`
    <path d="M49 32 L61 21 Q58 32 61 43 Z" fill="#94a08e"/>
    <path d="M21 21 Q29 9 40 19" fill="#94a08e"/>
    <path d="M7 32 C11 17 30 13 44 21 C49 24 51 28 51 32 C51 36 49 40 44 43 C30 51 11 47 7 32 Z" fill="#b9c3ae"/>
    <ellipse cx="29" cy="38" rx="15" ry="5.5" fill="#e3e9da" stroke="none"/>
    <path d="M24 27 q3 3 0 6 M30 25 q3 3 0 6 M36 25 q3 3 0 6 M42 27 q3 3 0 6 M30 32 q3 3 0 6 M36 32 q3 3 0 6" stroke="#8a967f" stroke-width="1.3" fill="none"/>
    <path d="M17 24 Q21 32 17 40" fill="none" stroke-width="1.8"/>
    <path d="M23 39 q4 7 11 5 q-6 -2 -11 -5 Z" fill="#94a08e"/>
    ${eye(13, 29)}
  `),
  perch: svg(`
    <path d="M49 32 L61 24 Q58 32 61 40 Z" fill="#5f6b33"/>
    <path d="M17 24 L19 15 L22 22 L25 14 L28 21 L31 14 L34 21 L37 15 L40 22 L43 17 L46 26 Z" fill="#5f6b33"/>
    <path d="M30 40 L45 38 L43 46 Z" fill="#5f6b33"/>
    <path d="M6 32 C9 22 26 19 42 23 C48 25 51 29 51 32 C51 35 48 39 42 41 C26 45 9 42 6 32 Z" fill="#8c9c4c"/>
    <path d="M10 28 C17 22 31 20 45 24 C40 26.5 24 26.5 10 28 Z" fill="#6c7a37" stroke="none"/>
    <ellipse cx="27" cy="37" rx="14" ry="3.6" fill="#cfd494" stroke="none"/>
    <path d="M26 24 V39 M33 24 V40 M40 25 V39" stroke="#6c7a37" stroke-width="1.4" fill="none" opacity="0.8"/>
    <circle cx="20" cy="29" r="2.4" fill="#3b4120" stroke="none"/>
    <circle cx="46" cy="32" r="2.2" fill="#3b4120" stroke="none"/>
    <path d="M16 25 Q20 32 16 39" fill="none" stroke-width="1.8"/>
    ${eye(11, 30)}
  `),
  shrimp: svg(`
    <path d="M44 26 L55 14 M45 32 L59 27" stroke="${OUT}" stroke-width="6.5" fill="none"/>
    <path d="M44 26 L55 14 M45 32 L59 27" stroke="#3f72ad" stroke-width="4" fill="none"/>
    <path d="M53 16 L60 9 L62 15 Z M57 28 L63 24 L62 31 Z" fill="#3f72ad"/>
    <path d="M47 23 Q57 9 63 3 M47 25 Q59 18 63 13" fill="none" stroke-width="1.1"/>
    <path d="M12 43 L4 49 L12 51 L15 46 Z" fill="#6f96bd"/>
    <path d="M12 43 C9 33 17 24 29 24 L43 24 C48 25 50 29 48 33 L44 36 C36 36 30 38 26 42 C22 47 15 49 12 43 Z" fill="#91b6d4"/>
    <path d="M20 29 q3 6 0 11 M26 26 q3 6 0 11 M32 25 q2 6 0 10" stroke="#5f87ab" stroke-width="1.5" fill="none"/>
    <path d="M36 24 C44 20 52 23 52 29 C52 34 46 37 38 36 Z" fill="#7fa3c4"/>
    <path d="M50 25 L62 21 L52 28 Z" fill="#7fa3c4"/>
    <path d="M30 37 l-1 6 M34 36 l0 6 M38 36 l1 6" fill="none" stroke-width="1.4"/>
    <circle cx="47" cy="25.5" r="2" fill="${OUT}" stroke="none"/>
  `),
  catfish: svg(`<g transform="matrix(1 0 0 1.35 0 -11.2)">
    <path d="M20 25 C28 19 40 19 50 24 L50 28 L20 28 Z" fill="#6e5f52"/>
    <path d="M28 40 L50 38 L50 42 C40 45 32 45 28 40 Z" fill="#6e5f52"/>
    <path d="M49 26 C57 24 62 30 62 32 C62 34 57 40 49 38 Z" fill="#6e5f52"/>
    <path d="M5 33 C6 26 14 24 24 25 L48 26 C52 28 52 36 48 38 L24 40 C14 41 6 40 5 33 Z" fill="#8f7d6b"/>
    <path d="M10 37 C20 39 36 39 48 36 C40 40 22 41 10 37 Z" fill="#d8ccb6" stroke="none"/>
    <path d="M8 30 Q4 24 2 19 M10 29 Q10 23 8 18 M7 35 Q2 39 1 44 M10 36 Q8 42 6 47" fill="none" stroke-width="1.5"/>
    <path d="M16 36 q2 6 8 6 q-3 -3 -8 -6 Z" fill="#6e5f52"/>
    <path d="M5 33 h4" fill="none" stroke-width="1.5"/>
    ${eye(13, 30, 2.2)}
  </g>`),
  snakehead: svg(`<g transform="matrix(1 0 0 1.35 0 -11.2)">
    <path d="M16 24 C26 18 42 18 52 23 L52 27 L16 27 Z" fill="#4f5c3a"/>
    <path d="M26 40 L52 38 L52 41 C42 44 32 44 26 40 Z" fill="#4f5c3a"/>
    <path d="M51 25 C58 23 63 29 63 32 C63 35 58 41 51 39 Z" fill="#4f5c3a"/>
    <path d="M3 32 C4 26 12 24 22 24 L50 25 C54 27 54 37 50 39 L22 40 C12 40 4 38 3 32 Z" fill="#7a8f62"/>
    <path d="M8 35 C20 38 38 38 50 36 C40 40 20 40 8 35 Z" fill="#e0e2c0" stroke="none"/>
    <path d="M22 26 L27 26 L25 31 L27 36 L22 36 L24 31 Z M31 26 L36 26 L34 31 L36 36 L31 36 L33 31 Z M40 26 L45 26 L43 31 L45 36 L40 36 L42 31 Z" fill="#3f4a2e" stroke="none"/>
    <path d="M3 32 q4 2 8 1" fill="none" stroke-width="1.5"/>
    ${eye(10, 29, 2.3)}
  </g>`),
};

const images = new Map();

export function loadItemImages() {
  return Promise.all(
    Object.entries(ART).map(([key, markup]) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" '))}`;
      return image.decode().then(
        () => images.set(key, image),
        () => {},
      );
    }),
  );
}

export const itemImage = (key) => images.get(key) ?? null;

export const iconTag = ({ icon = '', art = null }) => (art && images.has(art) ? `[[${art}]]` : icon);

export function paintIcon(element, { icon = '', art = null } = {}) {
  const markup = art && ART[art];
  if (markup) element.innerHTML = markup;
  else element.textContent = icon;
}
