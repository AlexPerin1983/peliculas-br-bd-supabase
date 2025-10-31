// ... (código anterior)
// ... (código anterior)
            {aiErrorModal.isOpen && (
                <ErrorModal
                    isOpen={aiErrorModal.isOpen}
                    onClose={() => setAiErrorModal({ isOpen: false, title: '', message: '' })}
                    title={aiErrorModal.title}
                    message={aiErrorModal.message}
                />
            )}
        </div>
    );
};

export default App;