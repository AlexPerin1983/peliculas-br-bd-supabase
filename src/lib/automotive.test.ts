import type { AutomotiveSettings, AutomotiveVehicle } from '../../types';
import {
    describeVehicleGlass,
    getAutomotiveTablePrice,
    getVehicleGlassGroups,
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
        expect(getAutomotiveTablePrice(undefined, 'Nano Cerâmica', 'suv', false)).toBeUndefined();
    });
});

describe('vidros do carro', () => {
    it('só inclui o para-brisa no pacote com para-brisa', () => {
        expect(getVehicleGlassGroups(vehicle())).not.toContain('parabrisa');
        expect(getVehicleGlassGroups(vehicle({ comParabrisa: true }))).toContain('parabrisa');
        expect(getVehicleGlassGroups(vehicle({ categoria: 'picape_simples' }))).toEqual(['dianteiras', 'traseiro']);
    });

    it('descreve só os vidros informados e que existem no pacote', () => {
        const description = describeVehicleGlass(vehicle({
            vidros: { parabrisa: 'faixa', dianteiras: '35', traseiro: '20' },
        }));
        expect(description).toBe('Dianteiras: 35% · Vidro traseiro: 20%');
        expect(describeVehicleGlass(vehicle({ comParabrisa: true, vidros: { parabrisa: 'faixa' } }))).toBe('Para-brisa: só a faixa');
        expect(describeVehicleGlass(vehicle())).toBe('');
    });

    it('avisa vidros abaixo do mínimo da lei (70% na frente, 28% atrás)', () => {
        const warnings = getVehicleLawWarnings(vehicle({
            comParabrisa: true,
            vidros: { parabrisa: 'faixa', dianteiras: '35', traseiras: '20', vigias: '50', traseiro: '5' },
        }));
        expect(warnings.map(item => item.id)).toEqual(['dianteiras', 'traseiras', 'traseiro']);
        expect(getVehicleLawWarnings(vehicle({ vidros: { dianteiras: '70', traseiras: 'sem' } }))).toEqual([]);
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
