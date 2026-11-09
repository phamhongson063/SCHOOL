const RUBY = /([㐀-鿿々〆Ａ-Ｚａ-ｚ]+)\{([^}]+)\}/g;

function appendRuby(target, text) {
  let last = 0;
  for (const match of text.matchAll(RUBY)) {
    if (match.index > last) target.append(document.createTextNode(text.slice(last, match.index)));
    const ruby = document.createElement('ruby');
    const rt = document.createElement('rt');
    rt.textContent = match[2];
    ruby.append(document.createTextNode(match[1]), rt);
    target.append(ruby);
    last = match.index + match[0].length;
  }
  if (last < text.length) target.append(document.createTextNode(text.slice(last)));
}

export function japanese(text) {
  const fragment = document.createDocumentFragment();
  for (const part of text.split(/(\[[^\]]+\])/)) {
    if (!part) continue;
    if (part.startsWith('[')) {
      const mark = document.createElement('mark');
      appendRuby(mark, part.slice(1, -1));
      fragment.append(mark);
    } else {
      appendRuby(fragment, part);
    }
  }
  return fragment;
}
