const DEFAULT_THEME = {
  primaryColor: '#78d64b',
  accentColor: '#f97316',
  backgroundColor: '#141414',
  surfaceColor: '#1c1c1c',
  textColor: '#f3f4f6',
  headingColor: '#ffffff',
  mutedColor: '#a1a1aa',
  fontBody: 'Inter',
  fontHeading: 'Playfair Display',
  buttonStyle: 'rounded',
  panelStyle: 'soft',
  formStyle: 'filled',
  navStyle: 'glass'
};

const DEFAULT_THEMES_BY_SCOPE = {
  storefront: DEFAULT_THEME,
  admin: {
    primaryColor: '#0f766e',
    accentColor: '#2563eb',
    backgroundColor: '#eef2f7',
    surfaceColor: '#ffffff',
    textColor: '#0f172a',
    headingColor: '#0f172a',
    mutedColor: '#64748b',
    fontBody: 'Inter',
    fontHeading: 'Inter',
    buttonStyle: 'rounded',
    panelStyle: 'solid',
    formStyle: 'outline',
    navStyle: 'solid'
  },
  superadmin: {
    primaryColor: '#7c3aed',
    accentColor: '#f97316',
    backgroundColor: '#f4f1ff',
    surfaceColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    mutedColor: '#6b7280',
    fontBody: 'Inter',
    fontHeading: 'Playfair Display',
    buttonStyle: 'pill',
    panelStyle: 'soft',
    formStyle: 'outline',
    navStyle: 'solid'
  }
};

const clamp = value => Math.max(0, Math.min(255, Math.round(value)));

const normalizeHex = value => {
  const input = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(input)) return input;
  if (/^#[0-9a-f]{3}$/i.test(input)) {
    return `#${input.slice(1).split('').map(char => `${char}${char}`).join('')}`;
  }
  return '#000000';
};

const hexToRgb = value => {
  const hex = normalizeHex(value).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

const rgbToString = ({ r, g, b }) => `${clamp(r)} ${clamp(g)} ${clamp(b)}`;

const mixColors = (baseHex, mixHex, ratio) => {
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHex);
  return rgbToString({
    r: base.r + (mix.r - base.r) * ratio,
    g: base.g + (mix.g - base.g) * ratio,
    b: base.b + (mix.b - base.b) * ratio
  });
};

export const applyThemeToDocument = (inputTheme, surface = 'storefront') => {
  if (typeof document === 'undefined') return;

  const theme = {
    ...DEFAULT_THEMES_BY_SCOPE[surface],
    ...(inputTheme || {})
  };

  const root = document.documentElement;
  const body = document.body;

  root.style.setProperty('--primary-color', theme.primaryColor);
  root.style.setProperty('--background-color', theme.backgroundColor);
  root.style.setProperty('--surface-color', theme.surfaceColor);
  root.style.setProperty('--text-color', theme.textColor);
  root.style.setProperty('--heading-color', theme.headingColor);
  root.style.setProperty('--muted-color', theme.mutedColor);
  root.style.setProperty('--font-body', `"${theme.fontBody}"`);
  root.style.setProperty('--font-heading', `"${theme.fontHeading}"`);
  root.style.setProperty('--color-brand', rgbToString(hexToRgb(theme.primaryColor)));
  root.style.setProperty('--color-brand-dark', mixColors(theme.primaryColor, '#000000', 0.28));
  root.style.setProperty('--color-brand-light', mixColors(theme.primaryColor, '#ffffff', 0.22));
  root.style.setProperty('--color-brand-muted', mixColors(theme.primaryColor, '#ffffff', 0.42));
  root.style.setProperty('--color-accent', rgbToString(hexToRgb(theme.accentColor)));
  root.style.setProperty('--color-accent-soft', mixColors(theme.accentColor, '#ffffff', 0.35));

  const overlay =
    surface === 'storefront'
      ? `radial-gradient(900px circle at 50% -10%, rgb(${rgbToString(hexToRgb(theme.primaryColor))} / 0.08), transparent 45%), linear-gradient(180deg, rgb(${rgbToString(hexToRgb(theme.backgroundColor))} / 0.98), rgb(${rgbToString(hexToRgb(theme.backgroundColor))} / 0.98))`
      : `linear-gradient(180deg, rgb(${rgbToString(hexToRgb(theme.backgroundColor))} / 1), rgb(${rgbToString(hexToRgb(theme.backgroundColor))} / 1))`;

  root.style.setProperty('--theme-app-overlay', overlay);

  body.dataset.surface = surface;
  body.dataset.themeButtonStyle = theme.buttonStyle || DEFAULT_THEME.buttonStyle;
  body.dataset.themePanelStyle = theme.panelStyle || DEFAULT_THEME.panelStyle;
  body.dataset.themeFormStyle = theme.formStyle || DEFAULT_THEME.formStyle;
  body.dataset.themeNavStyle = theme.navStyle || DEFAULT_THEME.navStyle;
};

export const getThemeByScope = (themes, scope) => {
  const list = Array.isArray(themes) ? themes : [];
  return list.find(item => item.scope === scope) || DEFAULT_THEMES_BY_SCOPE[scope] || DEFAULT_THEME;
};

export const THEME_SCOPE_OPTIONS = [
  { value: 'storefront', label: 'Cliente / Tienda' },
  { value: 'admin', label: 'Admin operativo' },
  { value: 'superadmin', label: 'Super Admin' }
];

export const FONT_OPTIONS = [
  'Inter',
  'Playfair Display'
];

export const BUTTON_STYLE_OPTIONS = ['rounded', 'pill', 'sharp'];
export const PANEL_STYLE_OPTIONS = ['soft', 'solid', 'outline'];
export const FORM_STYLE_OPTIONS = ['filled', 'outline', 'minimal'];
export const NAV_STYLE_OPTIONS = ['solid', 'glass'];
