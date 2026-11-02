import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import parse, { domToReact, attributesToProps } from 'html-react-parser';
import { AppRoot, Button, Input, Tabbar } from '@telegram-apps/telegram-ui';
import '@telegram-apps/telegram-ui/dist/styles.css';
import './appearance.css';

const roots = new Map();
const media = matchMedia('(prefers-color-scheme: dark)');
const telegram = window.Telegram?.WebApp;
const previewTheme = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? new URLSearchParams(location.search).get('theme') : null;
const inTelegram = Boolean(telegram?.initData || (telegram?.platform && telegram.platform !== 'unknown'));
let appearance;
const palette = {
  light: { bg: '#f2f3f7', panel: '#ffffff', text: '#20242c', muted: '#667080', line: '#e1e4eb', accent: '#a52f51', soft: '#f7eaf0' },
  dark: { bg: '#101217', panel: '#1b1e26', text: '#f0f1f5', muted: '#a2a9b8', line: '#303540', accent: '#f28ba6', soft: '#38232f' },
};
function syncAppearance() {
  appearance = !inTelegram && ['light', 'dark'].includes(previewTheme) ? previewTheme : inTelegram && ['light', 'dark'].includes(telegram.colorScheme) ? telegram.colorScheme : media.matches ? 'dark' : 'light';
  const p = palette[appearance];
  const html = document.documentElement;
  html.dataset.theme = appearance;
  html.dataset.bsTheme = appearance;
  html.style.colorScheme = appearance;
  for (const [key, value] of Object.entries(p)) html.style.setProperty('--app-' + key, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg);
  if (inTelegram) {
    try { telegram.setHeaderColor(p.bg); telegram.setBackgroundColor(p.bg); } catch {}
    try { if (telegram.isVersionAtLeast?.('7.10')) telegram.setBottomBarColor(p.panel); } catch {}
  }
  syncSafeArea();
  for (const [element, entry] of roots) paint(element, entry);
}
function syncSafeArea() {
  for (const edge of ['top','bottom','left','right']) {
    const inset = inTelegram ? (telegram.safeAreaInset?.[edge] || 0) + (telegram.contentSafeAreaInset?.[edge] || 0) : 0;
    document.documentElement.style.setProperty('--app-safe-' + edge, `${inset}px`);
  }
}
// Existing escaped view templates become React trees. Game/socket state stays in app.js.
// Only standard controls are adapted; playing cards retain their custom semantic markup.
const options = { replace(node) {
  if (node.type !== 'tag') return;
  const attrs = node.attribs || {};
  if(node.name==='input' && attrs.id==='match-chat-input'){const props=attributesToProps(attrs);delete props.value;return React.createElement('input',{...props,defaultValue:attrs.value||''});}
  if (node.name === 'input' && !['checkbox','hidden','number'].includes(attrs.type)) return React.createElement(Input, { ...attributesToProps(attrs), className: 'telegram-input' });
  if (node.name === 'a' && attrs.class?.includes('nav-item')) {
    const label = node.children.find(child => child.name === 'span');
    return React.createElement(Tabbar.Item, { className: attrs.class, selected: attrs['aria-current'] === 'page', 'aria-current': attrs['aria-current'], text: label?.children?.[0]?.data || '', onClick: () => { location.hash = attrs.href; } }, domToReact(node.children.filter(child => child.name === 'svg'), options));
  }
  if (node.name === 'button' && /(^|\s)(primary|secondary|ghost|text-button)(\s|$)/.test(attrs.class || '')) {
    const props = attributesToProps(attrs);
    const primary = /(^|\s)primary(\s|$)/.test(attrs.class);
    return React.createElement(Button, { ...props, type: props.type || (attrs.class === 'ghost' && !attrs['data-action'] ? 'submit' : 'button'), mode: primary ? 'filled' : attrs.class.includes('secondary') ? 'bezeled' : 'plain', size: 'm', className: `${attrs.class} telegram-control` }, domToReact(node.children, options));
  }
} };
function paint(element, entry) {
  const colors = palette[appearance];
  flushSync(() => entry.root.render(React.createElement(AppRoot, {
    appearance, platform: telegram?.platform === 'ios' ? 'ios' : 'base', className: 'telegram-view',
    style: { '--tgui--bg_color': colors.panel, '--tgui--secondary_bg_color': colors.bg, '--tgui--text_color': colors.text, '--tgui--hint_color': colors.muted, '--tgui--button_color': colors.accent, '--tgui--button_text_color': appearance === 'dark' ? '#25121a' : '#ffffff' }
  }, parse(entry.markup, options))));
  updateCapsules(element);
}
export function renderMarkup(selector, markup) {
  const element = document.querySelector(selector);
  let entry = roots.get(element);
  if (!entry) { entry = { root: createRoot(element), markup }; roots.set(element, entry); }
  entry.markup = markup;
  paint(element, entry);
}
syncAppearance();
media.addEventListener('change', syncAppearance);
telegram?.onEvent?.('themeChanged', syncAppearance);
telegram?.onEvent?.('safeAreaChanged', syncSafeArea);
telegram?.onEvent?.('contentSafeAreaChanged', syncSafeArea);

// One shared indicator follows the selected segment; content is controlled by
// the existing route/filter handlers, including browser back/forward.
function updateCapsules(scope = document) {
  const groups = [...scope.querySelectorAll('.ranking-tabs, .periods, #mobile-nav .telegram-view')];
  if (scope.id === 'mobile-nav') groups.push(scope.querySelector('.telegram-view'));
  for (const group of new Set(groups.filter(Boolean))) {
    const selected = group.querySelector('.active');
    if (!selected || !group.getBoundingClientRect().width) continue;
    const bounds = group.getBoundingClientRect(), item = selected.getBoundingClientRect();
    group.style.setProperty('--pill-x', `${item.left - bounds.left - group.clientLeft}px`);
    group.style.setProperty('--pill-y', `${item.top - bounds.top - group.clientTop}px`);
    group.style.setProperty('--pill-width', `${item.width}px`);
    group.style.setProperty('--pill-height', `${item.height}px`);
    group.classList.add('capsule-ready');
    group.querySelectorAll('button').forEach(button => {
      if (group.matches('.ranking-tabs, .periods')) button.setAttribute('aria-pressed', String(button === selected));
    });
  }
}
window.addEventListener('resize', () => updateCapsules());
document.fonts?.ready.then(() => updateCapsules());
