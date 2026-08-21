/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF2442',
        primaryDark: '#E01E3A',
        ink: '#1A1A1A',
        muted: '#6B7280',
        line: '#E5E7EB',
        surface: '#FFFFFF',
        canvas: '#F7F7F8'
      }
    }
  },
  plugins: []
}
