const openOrder = [];

new MutationObserver((changes) => {
  for (const { target } of changes) {
    if (target.tagName !== 'DIALOG') continue;
    const at = openOrder.indexOf(target);
    if (at >= 0) openOrder.splice(at, 1);
    if (target.open) openOrder.push(target);
  }
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

const stackRank = (dialog) => {
  const at = openOrder.indexOf(dialog);
  return at < 0 ? Infinity : at;
};

export const isStashed = (menu) => menu.classList.contains('stashed');
export const unstash = (menu) => menu.classList.remove('stashed');

export function stashPopups() {
  const dialogs = [...document.querySelectorAll('dialog[open]')]
    .sort((a, b) => stackRank(a) - stackRank(b))
    .map((dialog) => ({ dialog, modal: dialog.matches(':modal') }));
  const menus = [...document.querySelectorAll('.picker:not([hidden]):not(.stashed)')];
  for (const { dialog } of [...dialogs].reverse()) dialog.close();
  for (const menu of menus) menu.classList.add('stashed');
  return () => {
    for (const menu of menus) unstash(menu);
    for (const { dialog, modal } of dialogs) {
      if (dialog.open) continue;
      if (modal) dialog.showModal();
      else dialog.show();
    }
  };
}
