/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{jsx,tsx}",
        "./components/**/*.{jsx,tsx}",
        "./*.{jsx,tsx}"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Manrope', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
                display: ['"Space Grotesk"', 'Manrope', 'system-ui', 'sans-serif'],
            },
            colors: {
                slate: {
                    850: '#1e293b', // Custom dark slate
                    950: '#020617', // Custom darker slate
                }
            }
        },
    },
    plugins: [],
}
