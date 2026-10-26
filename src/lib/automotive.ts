import type {
    AutomotiveSettings,
    AutomotiveVehicle,
    Film,
    VehicleCategory,
    VehicleGlassGroup,
    VehicleGlassShade,
} from '../../types';

export interface VehicleCategoryInfo {
    id: VehicleCategory;
    label: string;
    examples: string;
    glassGroups: VehicleGlassGroup[];
    // Silhueta lateral (viewBox 0 0 48 24), rodas desenhadas à parte.
    silhouette: string;
}

export const VEHICLE_CATEGORIES: VehicleCategoryInfo[] = [
    { id: 'hatch', label: 'Hatch', examples: 'Onix, HB20, Polo', glassGroups: ['parabrisa', 'dianteiras', 'traseiras', 'traseiro'], silhouette: 'M4 18 L4 13 L12 12 L18 7 L32 7 L38 12 L44 13 L44 18 Z' },
    { id: 'sedan', label: 'Sedã', examples: 'Onix Plus, Corolla, Virtus', glassGroups: ['parabrisa', 'dianteiras', 'traseiras', 'traseiro'], silhouette: 'M2 18 L2 14 L10 12 L16 7 L30 7 L36 12 L46 13 L46 18 Z' },
    { id: 'suv', label: 'SUV', examples: 'Compass, Creta, T-Cross', glassGroups: ['parabrisa', 'dianteiras', 'traseiras', 'vigias', 'traseiro'], silhouette: 'M3 18 L3 10 L10 9 L14 5 L38 5 L42 10 L45 11 L45 18 Z' },
    { id: 'picape_simples', label: 'Picape simples', examples: 'Strada, Saveiro', glassGroups: ['parabrisa', 'dianteiras', 'traseiro'], silhouette: 'M2 18 L2 12 L10 11 L13 6 L22 6 L24 11 L46 11 L46 18 Z' },
    { id: 'picape_dupla', label: 'Picape dupla', examples: 'Hilux, S10, Toro', glassGroups: ['parabrisa', 'dianteiras', 'traseiras', 'traseiro'], silhouette: 'M2 18 L2 12 L8 11 L12 6 L28 6 L30 11 L46 11 L46 18 Z' },
    { id: 'van', label: 'Van / utilitário', examples: 'Spin, Fiorino, Sprinter', glassGroups: ['parabrisa', 'dianteiras', 'traseiras', 'vigias', 'traseiro'], silhouette: 'M3 18 L3 6 L8 4 L44 4 L45 18 Z' },
];

export const getVehicleCategoryInfo = (category: VehicleCategory): VehicleCategoryInfo => (
    VEHICLE_CATEGORIES.find(item => item.id === category) || VEHICLE_CATEGORIES[0]
);

export interface VehicleGlassGroupInfo {
    id: VehicleGlassGroup;
    label: string;
    // Transparência mínima (vidro + película) da Resolução Contran 960/2022.
    lawMinimum: number;
    shades: VehicleGlassShade[];
}

const SIDE_SHADES: VehicleGlassShade[] = ['sem', '5', '20', '35', '50', '70'];

export const VEHICLE_GLASS_GROUPS: VehicleGlassGroupInfo[] = [
    { id: 'parabrisa', label: 'Para-brisa', lawMinimum: 70, shades: ['sem', 'faixa', '70', '75', '80'] },
    { id: 'dianteiras', label: 'Dianteiras', lawMinimum: 70, shades: SIDE_SHADES },
    { id: 'traseiras', label: 'Traseiras', lawMinimum: 28, shades: SIDE_SHADES },
    { id: 'vigias', label: 'Vigias', lawMinimum: 28, shades: SIDE_SHADES },
    { id: 'traseiro', label: 'Vidro traseiro', lawMinimum: 28, shades: SIDE_SHADES },
];

export const getVehicleGlassGroupInfo = (group: VehicleGlassGroup): VehicleGlassGroupInfo => (
    VEHICLE_GLASS_GROUPS.find(item => item.id === group) || VEHICLE_GLASS_GROUPS[0]
);

// Vidros que entram no carro: o para-brisa só quando o pacote é "com para-brisa".
export const getVehicleGlassGroups = (vehicle: Pick<AutomotiveVehicle, 'categoria' | 'comParabrisa'>): VehicleGlassGroup[] => (
    getVehicleCategoryInfo(vehicle.categoria).glassGroups.filter(group => group !== 'parabrisa' || vehicle.comParabrisa)
);

export const formatGlassShade = (shade: VehicleGlassShade | undefined): string => {
    if (!shade) return '—';
    if (shade === 'sem') return 'sem película';
    if (shade === 'faixa') return 'só a faixa';
    return `${shade}%`;
};

export const isShadeBelowLaw = (group: VehicleGlassGroup, shade: VehicleGlassShade | undefined): boolean => {
    if (!shade || shade === 'sem' || shade === 'faixa') return false;
    return Number(shade) < getVehicleGlassGroupInfo(group).lawMinimum;
};

// Vidros escolhidos abaixo do mínimo da lei. A película sozinha já abaixo do limite
// garante que o conjunto com o vidro também fica; acima dele, ainda depende do vidro.
export const getVehicleLawWarnings = (vehicle: AutomotiveVehicle): VehicleGlassGroupInfo[] => (
    getVehicleGlassGroups(vehicle)
        .filter(group => isShadeBelowLaw(group, vehicle.vidros?.[group]))
        .map(getVehicleGlassGroupInfo)
);

// "Para-brisa: só a faixa · Dianteiras: 35% · Traseiras: 20%" (só os vidros informados).
export const describeVehicleGlass = (vehicle: AutomotiveVehicle): string => (
    getVehicleGlassGroups(vehicle)
        .filter(group => vehicle.vidros?.[group])
        .map(group => `${getVehicleGlassGroupInfo(group).label}: ${formatGlassShade(vehicle.vidros?.[group])}`)
        .join(' · ')
);

export const describeVehiclePackage = (vehicle: Pick<AutomotiveVehicle, 'comParabrisa'>): string => (
    vehicle.comParabrisa ? 'Completo com para-brisa' : 'Completo sem para-brisa'
);

// Película que já vem marcada (na tabela e no carro novo): a fixada, senão a primeira.
export const pickDefaultAutomotiveFilm = (films: Pick<Film, 'nome' | 'pinned'>[]): string => (
    films.find(film => film.pinned)?.nome || films[0]?.nome || ''
);

export const isAutomotiveEnabled =(settings: AutomotiveSettings | undefined): boolean => Boolean(settings?.ativo);

export const getAutomotiveTablePrice = (
    settings: AutomotiveSettings | undefined,
    filmName: string,
    category: VehicleCategory,
    comParabrisa: boolean,
): number | undefined => {
    const price = settings?.precos?.[filmName]?.[category];
    const value = comParabrisa ? price?.comParabrisa : price?.semParabrisa;
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
};

const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

// Campo de dinheiro digitado: "1.250,50", "450" ou "450.5". Vazio ou inválido = undefined.
export const parseMoneyInput = (value: string): number | undefined => {
    const trimmed = value.trim().replace(/^R\$\s*/i, '');
    if (!trimmed) return undefined;
    const normalized = trimmed.includes(',')
        ? trimmed.replace(/\./g, '').replace(',', '.')
        : trimmed;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? roundCurrency(parsed) : undefined;
};

export const formatMoneyInput = (value: number | undefined): string => (
    typeof value === 'number' && Number.isFinite(value)
        ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''
);

export const sumAutomotiveVehicles = (vehicles: AutomotiveVehicle[] | undefined): number => roundCurrency(
    (vehicles || []).reduce((sum, vehicle) => (
        sum + (Number.isFinite(vehicle.preco) && vehicle.preco > 0 ? vehicle.preco : 0)
    ), 0)
);

// Modelos comuns no Brasil para já marcar a categoria; o instalador sempre pode trocar.
const MODEL_CATEGORY_HINTS: [string, VehicleCategory][] = [
    ['onix plus', 'sedan'], ['hb20s', 'sedan'], ['virtus', 'sedan'], ['corolla cross', 'suv'], ['corolla', 'sedan'],
    ['civic', 'sedan'], ['cruze', 'sedan'], ['jetta', 'sedan'], ['city', 'sedan'], ['cronos', 'sedan'], ['versa', 'sedan'],
    ['sentra', 'sedan'], ['voyage', 'sedan'], ['prisma', 'sedan'], ['logan', 'sedan'], ['yaris sedan', 'sedan'], ['grand siena', 'sedan'],
    ['onix', 'hatch'], ['hb20', 'hatch'], ['polo', 'hatch'], ['gol', 'hatch'], ['argo', 'hatch'], ['mobi', 'hatch'], ['kwid', 'hatch'],
    ['sandero', 'hatch'], ['fit', 'hatch'], ['yaris', 'hatch'], ['up', 'hatch'], ['c3', 'hatch'], ['208', 'hatch'], ['uno', 'hatch'],
    ['ka', 'hatch'], ['fox', 'hatch'], ['celta', 'hatch'], ['palio', 'hatch'], ['golf', 'hatch'], ['march', 'hatch'], ['etios', 'hatch'],
    ['compass', 'suv'], ['renegade', 'suv'], ['commander', 'suv'], ['creta', 'suv'], ['t-cross', 'suv'], ['tcross', 'suv'],
    ['nivus', 'suv'], ['taos', 'suv'], ['tiguan', 'suv'], ['tracker', 'suv'], ['equinox', 'suv'], ['trailblazer', 'suv'],
    ['hr-v', 'suv'], ['hrv', 'suv'], ['cr-v', 'suv'], ['crv', 'suv'], ['kicks', 'suv'], ['duster', 'suv'], ['captur', 'suv'],
    ['kardian', 'suv'], ['pulse', 'suv'], ['fastback', 'suv'], ['2008', 'suv'], ['3008', 'suv'], ['ecosport', 'suv'],
    ['territory', 'suv'], ['sw4', 'suv'], ['rav4', 'suv'], ['tucson', 'suv'], ['ix35', 'suv'], ['sportage', 'suv'],
    ['outlander', 'suv'], ['pajero', 'suv'], ['song', 'suv'], ['yuan', 'suv'], ['tiggo', 'suv'], ['haval', 'suv'], ['c4 cactus', 'suv'],
    ['strada', 'picape_simples'], ['saveiro', 'picape_simples'], ['montana', 'picape_dupla'], ['oroch', 'picape_dupla'],
    ['toro', 'picape_dupla'], ['hilux', 'picape_dupla'], ['s10', 'picape_dupla'], ['ranger', 'picape_dupla'],
    ['amarok', 'picape_dupla'], ['l200', 'picape_dupla'], ['triton', 'picape_dupla'], ['frontier', 'picape_dupla'],
    ['ram', 'picape_dupla'], ['maverick', 'picape_dupla'], ['rampage', 'picape_dupla'], ['titano', 'picape_dupla'],
    ['spin', 'van'], ['fiorino', 'van'], ['kangoo', 'van'], ['partner', 'van'], ['ducato', 'van'], ['master', 'van'],
    ['sprinter', 'van'], ['doblo', 'van'], ['expert', 'van'], ['jumpy', 'van'], ['h100', 'van'], ['hr', 'van'],
];

const normalizeModelText = (value: string): string => value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const suggestVehicleCategory = (modelo: string): VehicleCategory | undefined => {
    const text = ` ${normalizeModelText(modelo).replace(/[^a-z0-9-]+/g, ' ').trim()} `;
    if (text.trim().length === 0) return undefined;
    // A lista está em ordem: nomes mais longos ("onix plus") vêm antes dos curtos ("onix").
    const match = MODEL_CATEGORY_HINTS.find(([name]) => text.includes(` ${name} `));
    return match?.[1];
};
