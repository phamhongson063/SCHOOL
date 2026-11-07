const LESSONS = [
  {
    phrase: '一応{いちおう}',
    romaji: 'ichiō',
    meaning:
      'Tạm gọi là, cũng đã (làm ở mức cơ bản, chưa dám chắc là hoàn hảo); hoặc làm cho chắc, phòng khi cần. Cũng dùng khi nói khiêm tốn kiểu "dù sao thì cũng…", "về danh nghĩa thì…".',
    examples: [
      {
        title: 'With a colleague',
        lines: [
          ['A', '文章{ぶんしょう}のチェック、[一応{いちおう}]済{す}んだけど、もう一度{いちど}自分{じぶん}でも見直{みなお}してね。'],
          ['B', 'うん。ありがとう。'],
        ],
      },
      {
        title: 'About the departure day',
        lines: [
          ['A', 'いつ出発{しゅっぱつ}するか、決{き}めた？'],
          ['B', 'はい、[一応{いちおう}]。'],
        ],
      },
      {
        title: 'How to use',
        lines: [
          ['A', 'ちゃんとマニュアル読{よ}んだ？'],
          ['B', '[一応{いちおう}]。ま、大丈夫{だいじょうぶ}だよ。'],
        ],
      },
      {
        title: 'Different than usual',
        lines: [
          ['A', '今日{きょう}はスーツなんだ。'],
          ['B', '[一応{いちおう}]ね。初{はじ}めて会{あ}う人{ひと}だから。'],
        ],
      },
      {
        title: 'Confirmation',
        lines: [
          ['A', '彼女{かのじょ}にはメールした？'],
          ['B', 'うん。でも、返事{へんじ}がないから[一応{いちおう}]電話{でんわ}もかけてみる。'],
        ],
      },
      {
        title: 'Age',
        lines: [
          ['A', 'マイケルはまだ未成年{みせいねん}でしょ？'],
          ['B', 'こう見{み}えても、[一応{いちおう}]25歳{さい}なんですが。'],
        ],
      },
    ],
  },
  {
    phrase: '一{いち}か八{ばち}か',
    romaji: 'ichika bachika',
    meaning:
      'Liều một phen, "được ăn cả, ngã về không". Dùng khi quyết định thử làm một việc dù không chắc thành công, chấp nhận phó mặc cho may rủi.',
    examples: [
      {
        title: 'Confession',
        lines: [
          ['A', '卒業{そつぎょう}したら会{あ}えなくなるし、[一{いち}か八{ばち}か]告白{こくはく}してみる。'],
          ['B', '付{つ}き合{あ}ってくれたらいいね。'],
        ],
      },
      {
        title: 'Seeing a help wanted ad',
        lines: [
          ['A', 'どうしよう。応募{おうぼ}してみようかなあ。'],
          ['B', '[一{いち}か八{ばち}か]受{う}けてみたら？'],
        ],
      },
      {
        title: 'Starting a business',
        lines: [
          ['A', '今{いま}の仕事{しごと}をやめて、[一{いち}か八{ばち}か]会社{かいしゃ}を作{つく}ろうかと考{かんが}えてます。'],
          ['B', 'え？ そうなんですか。'],
        ],
      },
      {
        title: 'Conveying your determination',
        lines: [
          ['A', '自信{じしん}は全然{ぜんぜん}ないけど、[一{いち}か八{ばち}か]、やってみます。'],
          ['B', 'うん。後{あと}で後悔{こうかい}しないほうがいいよ。'],
        ],
      },
      {
        title: 'A request',
        lines: [
          ['A', '一応{いちおう}、頼{たの}むだけ頼{たの}んでみようと思{おも}うんです。'],
          ['B', 'うん。[一{いち}か八{ばち}か]、やってみないとわからないからね。'],
        ],
      },
    ],
  },
];

const RUBY = /([\u3400-\u9fff\u3005\u3006]+)\{([^}]+)\}/g;

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendRuby(target, text) {
  let last = 0;
  for (const match of text.matchAll(RUBY)) {
    if (match.index > last) target.append(document.createTextNode(text.slice(last, match.index)));
    const ruby = el('ruby');
    ruby.append(document.createTextNode(match[1]), el('rt', null, match[2]));
    target.append(ruby);
    last = match.index + match[0].length;
  }
  if (last < text.length) target.append(document.createTextNode(text.slice(last)));
}

function japanese(text) {
  const fragment = document.createDocumentFragment();
  for (const part of text.split(/(\[[^\]]+\])/)) {
    if (!part) continue;
    if (part.startsWith('[')) {
      const mark = el('mark');
      appendRuby(mark, part.slice(1, -1));
      fragment.append(mark);
    } else {
      appendRuby(fragment, part);
    }
  }
  return fragment;
}

const MODE_KEY = 'truong-lang-xua.lessonMode';

function loadMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'choose' ? 'choose' : 'random';
  } catch {
    return 'random';
  }
}

export function createLesson() {
  const panel = document.getElementById('lesson');
  const reopen = document.getElementById('lessonOpen');
  const phrase = panel.querySelector('.lesson-phrase');
  const romaji = panel.querySelector('.lesson-romaji');
  const meaning = document.getElementById('lessonMeaning');
  const situation = panel.querySelector('.lesson-situation');
  const lines = panel.querySelector('.lesson-lines');
  const cards = panel.querySelector('.lesson-cards');
  const progress = panel.querySelector('.lesson-progress');
  const close = document.getElementById('lessonClose');

  const deck = () => shuffle(LESSONS.flatMap((lesson, li) => lesson.examples.map((_, ei) => [li, ei])));
  let order = deck();
  let shown = 0;
  const perLesson = LESSONS.map((lesson) => ({ order: shuffle(lesson.examples.map((_, i) => i)), shown: 0 }));
  let mode = loadMode();
  let current = null;
  let seated = false;

  function render() {
    const [li, ei] = current;
    const lesson = LESSONS[li];
    const example = lesson.examples[ei];
    panel.classList.remove('picking');
    phrase.replaceChildren(japanese(lesson.phrase));
    romaji.textContent = lesson.romaji;
    meaning.textContent = lesson.meaning;
    situation.textContent = example.title;
    lines.replaceChildren(
      ...example.lines.map(([speaker, text]) => {
        const row = el('p', 'lesson-line');
        row.append(el('span', 'lesson-speaker', speaker), el('span', 'lesson-text'));
        row.lastChild.append(japanese(text));
        return row;
      }),
    );
    progress.textContent =
      mode === 'choose'
        ? `Bài ${li + 1}/${LESSONS.length} · Ví dụ ${perLesson[li].shown}/${lesson.examples.length}`
        : `Bài ${li + 1}/${LESSONS.length} · Đã học ${shown}/${order.length} ví dụ`;
  }

  function pickRandom() {
    if (shown >= order.length) {
      order = deck();
      shown = 0;
    }
    current = order[shown];
    shown += 1;
    render();
  }

  function pickFrom(li) {
    const state = perLesson[li];
    if (state.shown >= state.order.length) {
      state.order = shuffle(state.order);
      state.shown = 0;
    }
    current = [li, state.order[state.shown]];
    state.shown += 1;
    render();
  }

  function showPicker() {
    panel.classList.add('picking');
    progress.textContent = 'Chế độ chọn bài';
    cards.replaceChildren(
      ...LESSONS.map((lesson, li) => {
        const card = el('button', 'lesson-card');
        card.type = 'button';
        card.style.animationDelay = `${li * 0.06}s`;
        const title = el('span', 'lesson-card-phrase');
        title.lang = 'ja';
        title.append(japanese(lesson.phrase));
        card.append(
          title,
          el('span', 'lesson-card-meta', `Bài ${li + 1} · ${lesson.romaji}`),
          el('span', 'lesson-card-meta', `Đã học ${perLesson[li].shown}/${lesson.examples.length} ví dụ`),
        );
        card.addEventListener('click', () => pickFrom(li));
        return card;
      }),
    );
  }

  function ensure() {
    if (current) render();
    else if (mode === 'choose') showPicker();
    else pickRandom();
  }

  function setVisible(visible) {
    panel.classList.toggle('show', visible);
    panel.setAttribute('aria-hidden', String(!visible));
    reopen.hidden = visible || !seated;
  }

  close.addEventListener('click', () => setVisible(false));
  reopen.addEventListener('click', () => setVisible(true));

  return {
    get mode() {
      return mode;
    },
    setMode(next) {
      mode = next === 'choose' ? 'choose' : 'random';
      try {
        localStorage.setItem(MODE_KEY, mode);
      } catch {}
      if (!current && panel.classList.contains('show')) ensure();
    },
    nextPeriod() {
      current = null;
      if (mode === 'random') pickRandom();
    },
    open() {
      seated = true;
      ensure();
      setVisible(true);
    },
    close() {
      seated = false;
      setVisible(false);
    },
  };
}
