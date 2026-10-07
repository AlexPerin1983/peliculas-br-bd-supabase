/**
 * Nome livre para uma nova opção de proposta. A opção duplicada com outra
 * película leva o nome dela ("Window Premium"), para o cliente ver no link a
 * diferença entre as opções; se já existir, ganha um número ("Window Premium 2").
 */
export const getUniqueOptionName = (baseName: string, existingNames: string[]): string => {
    const base = baseName.trim() || 'Opção';
    const taken = new Set(existingNames.map(name => name.trim().toLocaleLowerCase('pt-BR')));
    if (!taken.has(base.toLocaleLowerCase('pt-BR'))) return base;

    let counter = 2;
    while (taken.has(`${base} ${counter}`.toLocaleLowerCase('pt-BR'))) counter += 1;
    return `${base} ${counter}`;
};
