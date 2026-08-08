// Palette derived from the Default Zero logo: black horse, gold linework, deep navy-black backdrop.
// Keep the app to these — don't introduce new accent colors without a reason.

export const colors = {
  background: '#0B0F17',      // near-black navy, matches logo backdrop
  surface: '#141A24',         // card / elevated surface
  surfaceAlt: '#1C2430',       // secondary surface, e.g. input fields
  border: '#2A3341',

  gold: '#D4A94F',             // primary accent, pulled from logo linework
  goldDim: '#8A6F30',          // muted gold, for secondary text on dark
  goldBright: '#F0C868',       // highlights, active states

  textPrimary: '#F5F1E8',      // warm off-white, not pure white
  textSecondary: '#9AA3B2',
  textMuted: '#5C6577',

  success: '#4F9D6E',
  danger: '#B5453F',
  warning: '#C98A3A',

  overlay: 'rgba(11,15,23,0.85)',
};

export const typography = {
  display: { fontFamily: 'System', fontWeight: '700' }, // swap for a custom display font once you have one
  body: { fontFamily: 'System', fontWeight: '400', fontSize: 16, lineHeight: 23 },
  label: { fontFamily: 'System', fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const radius = {
  sm: 8, md: 14, lg: 22, pill: 999,
};
