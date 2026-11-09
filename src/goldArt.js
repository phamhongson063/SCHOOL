import { MONEY } from './config.js';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="68 48 284 180">
<defs>
<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2A6"/><stop offset=".35" stop-color="#FFD94F"/><stop offset=".7" stop-color="#E9A900"/><stop offset="1" stop-color="#FFF0A0"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A96700"/><stop offset=".45" stop-color="#F5B800"/><stop offset="1" stop-color="#B87800"/></linearGradient>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE477"/><stop offset=".5" stop-color="#EBA900"/><stop offset="1" stop-color="#A96800"/></linearGradient>
</defs>
<path d="M95 115 L145 65 Q155 56 170 56 L285 72 Q299 74 307 87 L345 137 L294 208 Q287 219 273 221 L130 204 Q117 202 110 190 L75 145 Z" fill="url(#s)" stroke="#A76B00" stroke-width="5"/>
<path d="M95 115 L145 65 Q155 56 170 56 L285 72 Q299 74 307 87 L265 137 Q258 146 245 144 L75 145 Z" fill="url(#t)" stroke="#D69A00" stroke-width="4"/>
<path d="M75 145 L245 144 Q258 146 265 137 L307 87 L345 137 L294 208 Q287 219 273 221 L130 204 Q117 202 110 190 Z" fill="url(#f)" stroke="#B67B00" stroke-width="3"/>
<path d="M75 145 L245 144 L265 137 L307 87" fill="none" stroke="#FFF1A5" stroke-width="4" opacity=".85"/>
<path d="M145 65 L183 111 L265 137" fill="none" stroke="#FFF7C5" stroke-width="3" opacity=".7"/>
<text x="193" y="182" font-family="Arial,sans-serif" font-size="32" font-weight="900" text-anchor="middle" fill="#8A5100" transform="rotate(5 193 182)">GOLD</text>
</svg>`;

export const GOLD_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;
export const GOLD_MARK = MONEY.icon;

export const GOLD_IMAGE = typeof Image === 'undefined' ? null : Object.assign(new Image(), { src: GOLD_URL });

export function goldIcon(className = 'gold-icon') {
  const img = document.createElement('img');
  img.className = className;
  img.src = GOLD_URL;
  img.alt = '';
  img.draggable = false;
  img.setAttribute('aria-hidden', 'true');
  return img;
}

export function goldNodes(text) {
  const parts = String(text).split(GOLD_MARK);
  return parts.flatMap((part, i) => [...(i ? [goldIcon()] : []), ...(part ? [document.createTextNode(part)] : [])]);
}

export function setRich(node, text) {
  node.replaceChildren(...goldNodes(text));
}

export const GOLD_HTML = `<img class="gold-img" src="${GOLD_URL}" alt="" draggable="false">`;
