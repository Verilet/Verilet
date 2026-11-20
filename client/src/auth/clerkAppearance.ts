/**
 * Theme for Clerk's sign-in, sign-up and account components, matching the warm palette in
 * `styles/layout.css`. Clerk renders these in its own markup, so the colours are repeated here
 * rather than read from the CSS variables.
 */
export const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: '#b84a29',
    colorPrimaryForeground: '#ffffff',
    colorBackground: '#fffcf7',
    colorForeground: '#2b1d12',
    colorMutedForeground: '#6b5a4a',
    colorInput: '#faf3e8',
    colorInputForeground: '#2b1d12',
    colorBorder: '#e6d8c3',
    colorDanger: '#a8322a',
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    borderRadius: '10px',
  },
};
