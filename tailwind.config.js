/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './assets/js/*.js'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F4ED',
        paper2: '#FCFAF5',
        paper3: '#F1EDE2',
        ink: '#191813',
        inksoft: '#3C3A32',
        muted: '#6B6659',
        faint: '#746E60',
        line: '#DDD7C8',
        linesoft: '#E8E3D6',
        linestrong: '#C9C1AF',
        accent: '#EE7D16',
        accentink: '#A64A05',
        up: '#C2410C',
        down: '#2F4F8F',
        dark: '#1B1914'
      },
      fontFamily: {
        ui: ['"IBM Plex Sans"', '"Helvetica Neue"', 'sans-serif'],
        title: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        serif: ['"IBM Plex Serif"', 'Georgia', 'serif']
      },
      borderRadius: { DEFAULT: '3px', sm: '2px', md: '4px', lg: '6px' },
      maxWidth: { shell: '1240px', prose: '68ch' }
    }
  },
  plugins: []
};
