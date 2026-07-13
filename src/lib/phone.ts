const BRAZIL_COUNTRY_CODE = '55';

function normalizeBrazilianPhoneDigits(value: string): string {
    let digits = value.replace(/\D/g, '');

    // Permite colar também no formato internacional (+55).
    if (digits.length > 11 && digits.startsWith(BRAZIL_COUNTRY_CODE)) {
        digits = digits.slice(BRAZIL_COUNTRY_CODE.length);
    }

    return digits;
}

export function getBrazilianPhoneDigits(value: string): string {
    return normalizeBrazilianPhoneDigits(value).slice(0, 11);
}

export function formatBrazilianPhone(value: string): string {
    const digits = getBrazilianPhoneDigits(value);

    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;

    const areaCode = digits.slice(0, 2);
    const number = digits.slice(2);

    if (number.length <= 4) return `(${areaCode}) ${number}`;

    const prefixLength = number.length <= 8 ? 4 : 5;
    return `(${areaCode}) ${number.slice(0, prefixLength)}-${number.slice(prefixLength)}`;
}

export function isValidBrazilianPhone(value: string): boolean {
    const digits = normalizeBrazilianPhoneDigits(value);

    // Telefone brasileiro: DDD (sem zero inicial) + 8 ou 9 dígitos.
    return /^[1-9]{2}\d{8,9}$/.test(digits);
}
