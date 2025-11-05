// ... (código omitido)
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Root element not found!");
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);