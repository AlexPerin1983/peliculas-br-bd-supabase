import type {
    AutomotivePriceTable,
    AutomotiveSettings,
    AutomotiveVehicle,
    VehicleCategory,
    VehicleGlassPart,
    VehicleGlassShade,
} from '../../types';
import { formatGarantiaMaoDeObra } from './filmWarranty';

export interface VehicleCategoryInfo {
    id: VehicleCategory;
    label: string;
    // Nome curto para a fileira de ícones do cadastro do carro.
    shortLabel: string;
    examples: string;
    glassParts: VehicleGlassPart[];
    // Ônibus representa conjuntos de janelas; os outros mostram vidros individuais.
    glassUnit?: 'área';
    // Silhueta lateral (viewBox 0 0 48 24), rodas desenhadas à parte.
    silhouette: string;
}

export const VEHICLE_CATEGORIES: VehicleCategoryInfo[] = [
    { id: 'hatch', label: 'Hatch', shortLabel: 'Hatch', examples: 'Onix, HB20, Polo', glassParts: ['pb', 'ts', 'de', 'dd', 'te', 'td', 'vt'], silhouette: 'M4 18 L4 13 L12 12 L18 7 L32 7 L38 12 L44 13 L44 18 Z' },
    { id: 'sedan', label: 'Sedã', shortLabel: 'Sedã', examples: 'Onix Plus, Corolla, Virtus', glassParts: ['pb', 'ts', 'de', 'dd', 'te', 'td', 'vt'], silhouette: 'M2 18 L2 14 L10 12 L16 7 L30 7 L36 12 L46 13 L46 18 Z' },
    { id: 'suv', label: 'SUV', shortLabel: 'SUV', examples: 'Compass, Creta, T-Cross', glassParts: ['pb', 'ts', 'de', 'dd', 'te', 'td', 've', 'vd', 'vt'], silhouette: 'M3 18 L3 10 L10 9 L14 5 L38 5 L42 10 L45 11 L45 18 Z' },
    { id: 'picape_simples', label: 'Picape simples', shortLabel: 'Picape', examples: 'Strada, Saveiro', glassParts: ['pb', 'ts', 'de', 'dd', 'vt'], silhouette: 'M2 18 L2 12 L10 11 L13 6 L22 6 L24 11 L46 11 L46 18 Z' },
    { id: 'picape_dupla', label: 'Picape dupla', shortLabel: 'Cab. dupla', examples: 'Hilux, S10, Toro', glassParts: ['pb', 'ts', 'de', 'dd', 'te', 'td', 'vt'], silhouette: 'M2 18 L2 12 L8 11 L12 6 L28 6 L30 11 L46 11 L46 18 Z' },
    { id: 'van', label: 'Van / utilitário', shortLabel: 'Van', examples: 'Spin, Fiorino, Sprinter', glassParts: ['pb', 'ts', 'de', 'dd', 'te', 'td', 've', 'vd', 'vt'], silhouette: 'M3 18 L3 6 L8 4 L44 4 L45 18 Z' },
    { id: 'onibus', label: 'Ônibus', shortLabel: 'Ônibus', examples: 'Urbano, rodoviário, micro-ônibus', glassParts: ['pb', 'de', 'dd', 'te', 'td', 'vt'], glassUnit: 'área', silhouette: 'M3 18 V5 H44 V18 Z' },
    { id: 'caminhao', label: 'Caminhão', shortLabel: 'Caminhão', examples: 'Cabine simples, cavalo mecânico', glassParts: ['pb', 'ts', 'de', 'dd', 'vt'], silhouette: 'M2 18 V11 L8 5 H18 V12 H45 V18 Z' },
    { id: 'maquina', label: 'Máquina', shortLabel: 'Máquina', examples: 'Trator, retroescavadeira', glassParts: ['pb', 'ts', 'de', 'dd', 'te', 'td', 'vt'], silhouette: 'M3 18 V12 H16 V5 H30 V16 H44 V18 Z' },
];

export const getVehicleCategoryInfo = (category: VehicleCategory): VehicleCategoryInfo => (
    VEHICLE_CATEGORIES.find(item => item.id === category) || VEHICLE_CATEGORIES[0]
);

export interface VehicleGlassPartInfo {
    id: VehicleGlassPart;
    label: string;
    // Transparência mínima (vidro + película) da Resolução Contran 960/2022.
    lawMinimum: number;
}

export const VEHICLE_GLASS_PARTS: VehicleGlassPartInfo[] = [
    { id: 'pb', label: 'Para-brisa', lawMinimum: 70 },
    { id: 'ts', label: 'Teto solar', lawMinimum: 28 },
    { id: 'de', label: 'Dianteira esq.', lawMinimum: 70 },
    { id: 'dd', label: 'Dianteira dir.', lawMinimum: 70 },
    { id: 'te', label: 'Traseira esq.', lawMinimum: 28 },
    { id: 'td', label: 'Traseira dir.', lawMinimum: 28 },
    { id: 've', label: 'Vigia esq.', lawMinimum: 28 },
    { id: 'vd', label: 'Vigia dir.', lawMinimum: 28 },
    { id: 'vt', label: 'Vidro traseiro', lawMinimum: 28 },
];

export const getVehicleGlassPartInfo = (part: VehicleGlassPart, category?: VehicleCategory): VehicleGlassPartInfo => {
    const info = VEHICLE_GLASS_PARTS.find(item => item.id === part) || VEHICLE_GLASS_PARTS[0];
    if (category === 'onibus' && (part === 'te' || part === 'td')) {
        return { ...info, label: part === 'te' ? 'Lateral esq.' : 'Lateral dir.' };
    }
    return info;
};

// Opções de %: o para-brisa tem as suas (faixa e películas claras).
export const WINDSHIELD_SHADES: VehicleGlassShade[] = ['faixa', '70', '75', '80'];
export const SIDE_SHADES: VehicleGlassShade[] = ['5', '20', '35', '50', '70'];

export const getShadeOptions = (part: VehicleGlassPart): VehicleGlassShade[] => (part === 'pb' ? WINDSHIELD_SHADES : SIDE_SHADES);

// Todos os vidros que o desenho da categoria mostra.
export const getVehicleGlassParts = (vehicle: Pick<AutomotiveVehicle, 'categoria'>): VehicleGlassPart[] => (
    getVehicleCategoryInfo(vehicle.categoria).glassParts
);

// Vidros do pacote "carro completo": laterais e traseiro; o para-brisa só no "com para-brisa".
// Teto solar fica fora do pacote (entra como parte extra).
export const getPackageParts = (categoria: VehicleCategory, comParabrisa: boolean): VehicleGlassPart[] => (
    getVehicleCategoryInfo(categoria).glassParts.filter(part => part !== 'ts' && (part !== 'pb' || comParabrisa))
);

// Vidros que levam película neste carro.
export const getVehicleAppliedParts = (vehicle: Pick<AutomotiveVehicle, 'categoria' | 'comParabrisa' | 'aplicacao' | 'partes'>): VehicleGlassPart[] => {
    const categoryParts = getVehicleGlassParts(vehicle);
    return vehicle.aplicacao === 'partes'
        ? categoryParts.filter(part => vehicle.partes?.includes(part))
        : getPackageParts(vehicle.categoria, vehicle.comParabrisa);
};

const sameParts = (a: VehicleGlassPart[], b: VehicleGlassPart[]) => a.length === b.length && a.every(part => b.includes(part));

// Os vidros marcados batem com um pacote? Então é pacote (preço da tabela), não por partes.
export const matchPackage = (categoria: VehicleCategory, parts: VehicleGlassPart[]): boolean | undefined => {
    if (sameParts(parts, getPackageParts(categoria, false))) return false;
    if (sameParts(parts, getPackageParts(categoria, true))) return true;
    return undefined;
};

// Peso de cada vidro ao dividir o "carro completo sem para-brisa" (vigia vale meia lateral).
const PART_WEIGHTS: Partial<Record<VehicleGlassPart, number>> = { de: 1, dd: 1, te: 1, td: 1, ve: 0.5, vd: 0.5, vt: 1.5, ts: 1 };

// Valor sugerido de cada vidro, tirado da tabela: o para-brisa é a diferença entre
// "com" e "sem para-brisa"; o "sem" se divide pelos vidros do pacote (a soma bate com ele).
export const splitAutomotivePrice = (
    settings: AutomotiveSettings | undefined,
    filmName: string,
    categoria: VehicleCategory,
): Partial<Record<VehicleGlassPart, number>> => {
    const sem = getAutomotiveTablePrice(settings, filmName, categoria, false);
    const com = getAutomotiveTablePrice(settings, filmName, categoria, true);
    const result: Partial<Record<VehicleGlassPart, number>> = {};
    if (sem === undefined) return result;

    const packageParts = getPackageParts(categoria, false);
    const unit = sem / packageParts.reduce((sum, part) => sum + (PART_WEIGHTS[part] ?? 1), 0);
    let assigned = 0;
    packageParts.forEach((part, index) => {
        const value = index === packageParts.length - 1
            ? roundCurrency(sem - assigned)
            : Math.round(unit * (PART_WEIGHTS[part] ?? 1));
        result[part] = value;
        assigned += value;
    });
    if (getVehicleCategoryInfo(categoria).glassParts.includes('ts')) {
        result.ts = Math.round(unit * (PART_WEIGHTS.ts ?? 1));
    }
    if (com !== undefined && com > sem) result.pb = roundCurrency(com - sem);
    return result;
};

export const sumPartPrices = (parts: VehicleGlassPart[], prices: Partial<Record<VehicleGlassPart, number>> | undefined): number => (
    roundCurrency(parts.reduce((sum, part) => sum + (prices?.[part] ?? 0), 0))
);

// Carros salvos antes de separar esquerdo e direito guardavam os vidros por grupo.
const LEGACY_GLASS_GROUPS: Record<string, VehicleGlassPart[]> = {
    parabrisa: ['pb'],
    dianteiras: ['de', 'dd'],
    traseiras: ['te', 'td'],
    vigias: ['ve', 'vd'],
    traseiro: ['vt'],
};

export const normalizeVehicleGlass = (vidros: Record<string, VehicleGlassShade | undefined> | undefined): AutomotiveVehicle['vidros'] => {
    if (!vidros) return undefined;
    const result: Partial<Record<VehicleGlassPart, VehicleGlassShade>> = {};
    Object.entries(vidros).forEach(([key, shade]) => {
        if (!shade) return;
        const parts = LEGACY_GLASS_GROUPS[key] ?? (VEHICLE_GLASS_PARTS.some(item => item.id === key) ? [key as VehicleGlassPart] : []);
        parts.forEach(part => { result[part] = result[part] ?? shade; });
    });
    return Object.keys(result).length > 0 ? result : undefined;
};

export const formatGlassShade = (shade: VehicleGlassShade | undefined): string => {
    if (!shade) return '—';
    if (shade === 'sem') return 'sem película';
    if (shade === 'faixa') return 'só a faixa';
    return `${shade}%`;
};

export const isShadeBelowLaw = (part: VehicleGlassPart, shade: VehicleGlassShade | undefined): boolean => {
    if (!shade || shade === 'sem' || shade === 'faixa') return false;
    return Number(shade) < getVehicleGlassPartInfo(part).lawMinimum;
};

// Vidros escolhidos abaixo do mínimo da lei. A película sozinha já abaixo do limite
// garante que o conjunto com o vidro também fica; acima dele, ainda depende do vidro.
export const getVehicleLawWarnings = (vehicle: AutomotiveVehicle): VehicleGlassPartInfo[] => {
    const vidros = normalizeVehicleGlass(vehicle.vidros);
    return getVehicleAppliedParts(vehicle)
        .filter(part => isShadeBelowLaw(part, vidros?.[part]))
        .map(part => getVehicleGlassPartInfo(part, vehicle.categoria));
};

// Esquerdo e direito com o mesmo % saem juntos ("Dianteiras: 35%").
const GLASS_PAIRS: { left: VehicleGlassPart; right: VehicleGlassPart; label: string }[] = [
    { left: 'de', right: 'dd', label: 'Dianteiras' },
    { left: 'te', right: 'td', label: 'Traseiras' },
    { left: 've', right: 'vd', label: 'Vigias' },
];

// "Para-brisa: só a faixa · Dianteiras: 35% · Vidro traseiro: 20%" (só os vidros informados).
export const describeVehicleGlass = (vehicle: AutomotiveVehicle): string => {
    const vidros = normalizeVehicleGlass(vehicle.vidros) || {};
    const parts = getVehicleAppliedParts(vehicle);
    const describe = (part: VehicleGlassPart) => (
        parts.includes(part) && vidros[part] ? [`${getVehicleGlassPartInfo(part, vehicle.categoria).label}: ${formatGlassShade(vidros[part])}`] : []
    );
    const pairs = GLASS_PAIRS.flatMap(pair => {
        const left = parts.includes(pair.left) ? vidros[pair.left] : undefined;
        const right = parts.includes(pair.right) ? vidros[pair.right] : undefined;
        if (left && left === right) return [`${vehicle.categoria === 'onibus' && pair.left === 'te' ? 'Laterais' : pair.label}: ${formatGlassShade(left)}`];
        return [...describe(pair.left), ...describe(pair.right)];
    });
    return [...describe('pb'), ...describe('ts'), ...pairs, ...describe('vt')].join(' · ');
};

export const describeVehiclePackage = (vehicle: Pick<AutomotiveVehicle, 'comParabrisa' | 'aplicacao'>): string => {
    if (vehicle.aplicacao === 'partes') return 'Por partes';
    return vehicle.comParabrisa ? 'Completo com para-brisa' : 'Completo sem para-brisa';
};

// Por partes, o PDF mostra o valor de cada vidro ("Para-brisa R$ 200,00 · Dianteira esq. R$ 62,00").
export const describeVehiclePartPrices = (vehicle: AutomotiveVehicle): string => {
    if (vehicle.aplicacao !== 'partes') return '';
    return getVehicleAppliedParts(vehicle)
        .map(part => `${getVehicleGlassPartInfo(part, vehicle.categoria).label} R$ ${formatMoneyInput(vehicle.precoPartes?.[part] ?? 0)}`)
        .join(' · ');
};

// Linhas de película do automotivo (no lugar do catálogo, que é de vidro de casa e empresa).
export const AUTOMOTIVE_FILM_TYPES = ['Fumê comum', 'Nano Carbono', 'Nano Cerâmica', 'Cerâmica Premium'];

// Nome curto no seletor do cadastro do carro (no PDF sai o nome inteiro).
const AUTOMOTIVE_FILM_SHORT: Record<string, string> = {
    'Fumê comum': 'Fumê',
    'Nano Carbono': 'Carbono',
    'Nano Cerâmica': 'Cerâmica',
    'Cerâmica Premium': 'Premium',
};

export const getAutomotiveFilmShortName = (film: string): string => AUTOMOTIVE_FILM_SHORT[film] ?? film;

const tablePrice = (semParabrisa: number, comParabrisa: number) => ({ semParabrisa, comParabrisa });

// Valores de partida para a tabela já vir preenchida; cada empresa ajusta à sua região.
export const DEFAULT_AUTOMOTIVE_PRICES: AutomotivePriceTable = {
    'Fumê comum': {
        hatch: tablePrice(180, 300), sedan: tablePrice(200, 320), suv: tablePrice(250, 380),
        picape_simples: tablePrice(130, 250), picape_dupla: tablePrice(220, 350), van: tablePrice(300, 450),
        onibus: tablePrice(1200, 1600), caminhao: tablePrice(220, 380), maquina: tablePrice(300, 500),
    },
    'Nano Carbono': {
        hatch: tablePrice(300, 480), sedan: tablePrice(340, 520), suv: tablePrice(400, 600),
        picape_simples: tablePrice(220, 400), picape_dupla: tablePrice(380, 560), van: tablePrice(480, 680),
        onibus: tablePrice(1600, 2200), caminhao: tablePrice(350, 600), maquina: tablePrice(450, 700),
    },
    'Nano Cerâmica': {
        hatch: tablePrice(500, 800), sedan: tablePrice(550, 850), suv: tablePrice(650, 950),
        picape_simples: tablePrice(380, 680), picape_dupla: tablePrice(600, 900), van: tablePrice(750, 1100),
        onibus: tablePrice(2600, 3500), caminhao: tablePrice(600, 950), maquina: tablePrice(750, 1100),
    },
    'Cerâmica Premium': {
        hatch: tablePrice(800, 1200), sedan: tablePrice(900, 1300), suv: tablePrice(1000, 1450),
        picape_simples: tablePrice(600, 1000), picape_dupla: tablePrice(950, 1400), van: tablePrice(1200, 1700),
        onibus: tablePrice(3800, 5200), caminhao: tablePrice(900, 1400), maquina: tablePrice(1100, 1600),
    },
};

// Cópia da tabela sugerida, para gravar como ponto de partida da empresa.
export const cloneDefaultAutomotivePrices = (): AutomotivePriceTable => JSON.parse(JSON.stringify(DEFAULT_AUTOMOTIVE_PRICES));

// Sem tabela salva ainda, vale a sugerida.
export const getAutomotivePriceTable = (settings: AutomotiveSettings | undefined): AutomotivePriceTable => {
    if (!settings?.precos) return DEFAULT_AUTOMOTIVE_PRICES;
    const prices: AutomotivePriceTable = { ...settings.precos };
    // Tabelas anteriores às categorias novas recebem apenas os novos valores iniciais.
    // Categoria já cadastrada (inclusive com campo limpo) mantém o que o dono definiu.
    AUTOMOTIVE_FILM_TYPES.forEach(film => {
        const filmPrices = { ...prices[film] };
        (['onibus', 'caminhao', 'maquina'] as const).forEach(category => {
            if (!Object.prototype.hasOwnProperty.call(filmPrices, category)) {
                filmPrices[category] = DEFAULT_AUTOMOTIVE_PRICES[film]?.[category];
            }
        });
        prices[film] = filmPrices;
    });
    return prices;
};

// Beta: só estas contas (e-mail do login) veem o automotivo, nas Configurações e no orçamento.
const AUTOMOTIVE_BETA_EMAILS = ['windowfilm.br@gmail.com'];

export const canUseAutomotiveBeta = (email: string | null | undefined): boolean => (
    Boolean(email) && AUTOMOTIVE_BETA_EMAILS.includes(email!.trim().toLowerCase())
);

export const isAutomotiveEnabled =(settings: AutomotiveSettings | undefined): boolean => Boolean(settings?.ativo);

export const getAutomotiveTablePrice = (
    settings: AutomotiveSettings | undefined,
    filmName: string,
    category: VehicleCategory,
    comParabrisa: boolean,
): number | undefined => {
    const price = getAutomotivePriceTable(settings)[filmName]?.[category];
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

// Valor da remoção da película antiga quando marcada (soma no carro).
export const getVehicleRemovalPrice = (vehicle: Pick<AutomotiveVehicle, 'observacoes'>): number => {
    const value = vehicle.observacoes?.valorRemocao;
    return vehicle.observacoes?.removerAntiga && typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
};

// O que se cobra pelo carro: vidros (preco) + remoção da película antiga.
export const getVehicleTotal = (vehicle: Pick<AutomotiveVehicle, 'preco' | 'observacoes'>): number => roundCurrency(
    (Number.isFinite(vehicle.preco) && vehicle.preco > 0 ? vehicle.preco : 0) + getVehicleRemovalPrice(vehicle)
);

export const sumAutomotiveVehicles = (vehicles: AutomotiveVehicle[] | undefined): number => roundCurrency(
    (vehicles || []).reduce((sum, vehicle) => sum + getVehicleTotal(vehicle), 0)
);

// Sugestão da tabela para a remoção; sem valor salvo, R$ 80,00.
export const DEFAULT_REMOVAL_PRICE = 80;
export const getDefaultRemovalPrice = (settings: AutomotiveSettings | undefined): number => (
    typeof settings?.valorRemocao === 'number' && settings.valorRemocao >= 0 ? settings.valorRemocao : DEFAULT_REMOVAL_PRICE
);

// Tamanho do orçamento salvo para listas: "12,50 m²", "2 carros" ou "12,50 m² · 1 carro".
export const describeSavedQuoteSize = (
    totalM2: number | undefined,
    vehicles: AutomotiveVehicle[] | undefined,
    formatArea: (value: number) => string,
): string => {
    const count = vehicles?.length ?? 0;
    const area = Number.isFinite(totalM2) ? totalM2! : 0;
    if (count === 0) return formatArea(area);
    const cars = `${count} ${count === 1 ? 'carro' : 'carros'}`;
    return area > 0 ? `${formatArea(area)} · ${cars}` : cars;
};

// Seção "Garantias" do PDF para as películas dos carros, no mesmo formato das do catálogo.
// Linha sem garantia preenchida nas Configurações fica de fora.
export const buildAutomotiveWarrantyEntries = (
    filmNames: string[],
    settings: AutomotiveSettings | undefined,
): { title: string; lines: string[] }[] => (
    Array.from(new Set(filmNames)).flatMap(filmName => {
        const warranty = settings?.garantias?.[filmName];
        const fabricante = warranty?.fabricanteAnos;
        const hasFabricante = typeof fabricante === 'number' && fabricante > 0;
        const hasMaoDeObra = typeof warranty?.maoDeObra === 'number' && warranty.maoDeObra > 0;
        if (!hasFabricante && !hasMaoDeObra) return [];
        return [{
            title: filmName,
            lines: [
                ...(hasFabricante ? [`  - Garantia Fabricante: ${fabricante} ${fabricante === 1 ? 'ano' : 'anos'}`] : []),
                ...(hasMaoDeObra ? [`  - Garantia Mão de Obra: ${formatGarantiaMaoDeObra(warranty!.maoDeObra, warranty!.maoDeObraUnidade)}`] : []),
            ],
        }];
    })
);

// "Remover película antiga (+ R$ 80,00) · Vidro com risco ou trinca antes do serviço · Obs.: ..."
export const describeVehicleNotes = (vehicle: Pick<AutomotiveVehicle, 'observacoes'>): string => {
    const notes = vehicle.observacoes;
    if (!notes) return '';
    const removal = getVehicleRemovalPrice(vehicle);
    return [
        notes.removerAntiga ? `Remover película antiga${removal > 0 ? ` (+ R$ ${formatMoneyInput(removal)})` : ''}` : '',
        notes.riscoPrevio ? 'Vidro com risco ou trinca antes do serviço' : '',
        notes.texto?.trim() ? `Obs.: ${notes.texto.trim()}` : '',
    ].filter(Boolean).join(' · ');
};

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
