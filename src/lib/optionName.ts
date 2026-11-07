// Nome da opção como o cliente e o aplicador leem. Opções antigas foram criadas
// como "Opcao 1" (sem acento) e o nome salvo não muda (ele liga a opção ao PDF
// e à forma de pagamento); só a exibição sai como "Opção 1".
export const DEFAULT_OPTION_WORD = 'Opção';

export const formatOptionName = <T extends string | null | undefined>(name: T): T => {
    if (!name) return name;
    return name.replace(/^(\s*)(opcao)(?=\s|\d|$)/i, (_match, space: string, word: string) => {
        const accented = word === word.toUpperCase() ? 'OPÇÃO' : word[0] === 'O' ? 'Opção' : 'opção';
        return `${space}${accented}`;
    }) as T;
};
