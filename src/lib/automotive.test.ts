import type { AutomotiveSettings, AutomotiveVehicle } from '../../types';
import {
    AUTOMOTIVE_FILM_TYPES,
    DEFAULT_AUTOMOTIVE_PRICES,
    VEHICLE_CATEGORIES,
    cloneDefaultAutomotivePrices,
    describeVehicleGlass,
    describeVehicleNotes,
    getDefaultRemovalPrice,
    getVehicleTotal,
    getAutomotiveTablePrice,
    describeVehiclePartPrices,
    getPackageParts,
    getVehicleAppliedParts,
    getVehicleGlassParts,
    matchPackage,
    splitAutomotivePrice,
    sumPartPrices,
    normalizeVehicleGlass,
    getVehicleLawWarnings,
    parseMoneyInput,
    suggestVehicleCategory,
    sumAutomotiveVehicles,
} from './automotive';

const vehicle = (patch: Partial<AutomotiveVehicle> = {}): AutomotiveVehicle => ({
    id: 1,
    modelo: 'Jeep Compass 2022',
    categoria: 'suv',
    pelicula: 'Nano Cerâmica',
    comParabrisa: false,
    preco: 450,
    ...patch,
});

describe('suggestVehicleCategory', () => {
    it('reconhece modelos comuns mesmo com ano e marca', () => {
        expect(suggestVehicleCategory('Jeep Compass 2022')).toBe('suv');
        expect(suggestVehicleCategory('toyota hilux srv')).toBe('picape_dupla');
        expect(suggestVehicleCategory('Fiat Strada')).toBe('picape_simples');
        expect(suggestVehicleCategory('VW Saveiro Cross')).toBe('picape_simples');
    });

    it('prefere o nome mais longo (Onix Plus é sedã, Onix é hatch)', () => {
        expect(suggestVehicleCategory('Chevrolet Onix Plus')).toBe('sedan');
        expect(suggestVehicleCategory('Chevrolet Onix LT')).toBe('hatch');
        expect(suggestVehicleCategory('Corolla Cross XRE')).toBe('suv');
        expect(suggestVehicleCategory('Corolla Altis')).toBe('sedan');
    });

    it('não confunde HR-V com o utilitário HR', () => {
        expect(suggestVehicleCategory('Honda HR-V')).toBe('suv');
        expect(suggestVehicleCategory('Hyundai HR')).toBe('van');
    });

    it('não sugere nada para modelo desconhecido ou vazio', () => {
        expect(suggestVehicleCategory('')).toBeUndefined();
        expect(suggestVehicleCategory('Carro do vizinho')).toBeUndefined();
    });
});

describe('getAutomotiveTablePrice', () => {
    const settings: AutomotiveSettings = {
        ativo: true,
        precos: { 'Nano Cerâmica': { suv: { semParabrisa: 450, comParabrisa: 650 } } },
    };

    it('pega o preço do pacote certo', () => {
        expect(getAutomotiveTablePrice(settings, 'Nano Cerâmica', 'suv', false)).toBe(450);
        expect(getAutomotiveTablePrice(settings, 'Nano Cerâmica', 'suv', true)).toBe(650);
    });

    it('sem preço cadastrado devolve undefined', () => {
        expect(getAutomotiveTablePrice(settings, 'Nano Cerâmica', 'hatch', false)).toBeUndefined();
        expect(getAutomotiveTablePrice(settings, 'Carbono', 'suv', false)).toBeUndefined();
    });

    it('sem tabela salva usa a sugerida, que cobre todas as películas e categorias', () => {
        expect(getAutomotiveTablePrice(undefined, 'Nano Cerâmica', 'suv', false)).toBe(650);
        expect(getAutomotiveTablePrice({ ativo: true }, 'Fumê comum', 'hatch', true)).toBe(300);
        AUTOMOTIVE_FILM_TYPES.forEach(film => {
            VEHICLE_CATEGORIES.forEach(category => {
                const sem = getAutomotiveTablePrice(undefined, film, category.id, false)!;
                const com = getAutomotiveTablePrice(undefined, film, category.id, true)!;
                expect(sem).toBeGreaterThan(0);
                expect(com).toBeGreaterThan(sem);
            });
        });
    });

    it('a cópia da tabela sugerida não altera a original', () => {
        const copy = cloneDefaultAutomotivePrices();
        copy['Nano Carbono']!.suv!.semParabrisa = 1;
        expect(DEFAULT_AUTOMOTIVE_PRICES['Nano Carbono']!.suv!.semParabrisa).toBe(400);
    });
});

describe('vidros do carro', () => {
    it('o pacote tem laterais e traseiro; para-brisa só no "com", teto solar fica fora', () => {
        expect(getPackageParts('suv', false)).toEqual(['de', 'dd', 'te', 'td', 've', 'vd', 'vt']);
        expect(getPackageParts('suv', true)).toEqual(['pb', 'de', 'dd', 'te', 'td', 've', 'vd', 'vt']);
        expect(getPackageParts('picape_simples', false)).toEqual(['de', 'dd', 'vt']);
        expect(getVehicleGlassParts(vehicle())).toEqual(['pb', 'ts', 'de', 'dd', 'te', 'td', 've', 'vd', 'vt']);
    });

    it('por partes usa só os vidros marcados', () => {
        expect(getVehicleAppliedParts(vehicle({ aplicacao: 'partes', partes: ['vt', 'pb'] }))).toEqual(['pb', 'vt']);
        expect(getVehicleAppliedParts(vehicle({ comParabrisa: true }))).toContain('pb');
    });

    it('reconhece quando os vidros marcados formam um pacote', () => {
        expect(matchPackage('suv', ['de', 'dd', 'te', 'td', 've', 'vd', 'vt'])).toBe(false);
        expect(matchPackage('suv', ['vt', 'pb', 'de', 'dd', 'te', 'td', 've', 'vd'])).toBe(true);
        expect(matchPackage('suv', ['de', 'dd'])).toBeUndefined();
    });

    it('divide o preço da tabela pelos vidros e a soma bate com o pacote', () => {
        const prices = splitAutomotivePrice(undefined, 'Nano Carbono', 'suv');
        expect(prices.pb).toBe(200);
        expect(sumPartPrices(getPackageParts('suv', false), prices)).toBe(400);
        expect(sumPartPrices(getPackageParts('suv', true), prices)).toBe(600);
        expect(prices.vt).toBeGreaterThan(prices.de!);
        expect(prices.ve).toBeLessThan(prices.de!);
        expect(prices.ts).toBeGreaterThan(0);
        expect(splitAutomotivePrice(undefined, 'Nano Carbono', 'picape_simples').ts).toBeUndefined();
        expect(splitAutomotivePrice({ ativo: true, precos: {} }, 'Nano Carbono', 'suv')).toEqual({});
    });

    it('converte carros salvos com vidros por grupo para esquerdo e direito', () => {
        expect(normalizeVehicleGlass({ dianteiras: '35', traseiro: '20', parabrisa: 'faixa' } as never)).toEqual({
            de: '35', dd: '35', vt: '20', pb: 'faixa',
        });
        expect(normalizeVehicleGlass({ de: '35' })).toEqual({ de: '35' });
        expect(normalizeVehicleGlass({})).toBeUndefined();
    });

    it('descreve juntando esquerdo e direito iguais, só dos vidros com película', () => {
        expect(describeVehicleGlass(vehicle({
            vidros: { pb: 'faixa', de: '35', dd: '35', te: '20', td: '35', vt: '20' },
        }))).toBe('Dianteiras: 35% · Traseira esq.: 20% · Traseira dir.: 35% · Vidro traseiro: 20%');
        expect(describeVehicleGlass(vehicle({ comParabrisa: true, vidros: { pb: 'faixa' } }))).toBe('Para-brisa: só a faixa');
        expect(describeVehicleGlass(vehicle({ aplicacao: 'partes', partes: ['pb'], vidros: { pb: '75', de: '35' } }))).toBe('Para-brisa: 75%');
        expect(describeVehicleGlass(vehicle())).toBe('');
    });

    it('mostra o valor de cada vidro quando é por partes', () => {
        expect(describeVehiclePartPrices(vehicle({ aplicacao: 'partes', partes: ['pb', 'de'], precoPartes: { pb: 200, de: 62 } })))
            .toBe('Para-brisa R$ 200,00 · Dianteira esq. R$ 62,00');
        expect(describeVehiclePartPrices(vehicle())).toBe('');
    });

    it('avisa vidros abaixo do mínimo da lei (70% na frente, 28% atrás)', () => {
        const warnings = getVehicleLawWarnings(vehicle({
            comParabrisa: true,
            vidros: { pb: 'faixa', de: '35', dd: '70', te: '20', ve: '50', vt: '5' },
        }));
        expect(warnings.map(item => item.id)).toEqual(['de', 'te', 'vt']);
        expect(getVehicleLawWarnings(vehicle({ vidros: { de: '70', te: 'sem' } }))).toEqual([]);
    });
});

describe('dinheiro', () => {
    it('lê valores digitados do jeito brasileiro', () => {
        expect(parseMoneyInput('1.250,50')).toBe(1250.5);
        expect(parseMoneyInput('450')).toBe(450);
        expect(parseMoneyInput('R$ 420,00')).toBe(420);
        expect(parseMoneyInput('')).toBeUndefined();
        expect(parseMoneyInput('abc')).toBeUndefined();
    });

    it('soma os carros ignorando preço inválido', () => {
        expect(sumAutomotiveVehicles([vehicle({ preco: 450 }), vehicle({ id: 2, preco: 199.9 }), vehicle({ id: 3, preco: Number.NaN })])).toBe(649.9);
        expect(sumAutomotiveVehicles(undefined)).toBe(0);
    });
});

describe('observações do carro', () => {
    it('a remoção da película antiga soma no valor do carro só quando marcada', () => {
        expect(getVehicleTotal(vehicle({ preco: 420, observacoes: { removerAntiga: true, valorRemocao: 80 } }))).toBe(500);
        expect(getVehicleTotal(vehicle({ preco: 420, observacoes: { removerAntiga: false, valorRemocao: 80 } }))).toBe(420);
        expect(sumAutomotiveVehicles([
            vehicle({ preco: 420, observacoes: { removerAntiga: true, valorRemocao: 80 } }),
            vehicle({ id: 2, preco: 206 }),
        ])).toBe(706);
    });

    it('valor sugerido da remoção vem das configurações (R$ 80 sem valor salvo)', () => {
        expect(getDefaultRemovalPrice(undefined)).toBe(80);
        expect(getDefaultRemovalPrice({ ativo: true, valorRemocao: 120 })).toBe(120);
    });

    it('descreve as observações para o PDF', () => {
        expect(describeVehicleNotes(vehicle({
            observacoes: { removerAntiga: true, valorRemocao: 80, riscoPrevio: true, texto: '  não mexer no adesivo  ' },
        }))).toBe('Remover película antiga (+ R$ 80,00) · Vidro com risco ou trinca antes do serviço · Obs.: não mexer no adesivo');
        expect(describeVehicleNotes(vehicle())).toBe('');
    });
});
