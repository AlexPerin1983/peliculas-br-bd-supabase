import { Client, Measurement, UserInfo } from '../types';

// Logo padrão da empresa "Películas Brasil"
const mockLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const mockUserInfo: UserInfo = {
    id: 'info',
    nome: 'Alex Renato Lacerda Perin',
    empresa: 'Películas Brasil',
    telefone: '(83) 99301-5765',
    email: 'alexlacerdaperin@gmail.com',
    site: 'www.peliculasbrasil.com.br',
    endereco: 'Wind Palace - Intermares',
    cpfCnpj: '326.355.038-18',
    logo: mockLogo,
    assinatura: '',
    cores: { primaria: '#364562', secundaria: '#937e44' },
    payment_methods: [
        { tipo: 'pix', ativo: true, chave_pix: '32635503818', tipo_chave_pix: 'cpf', nome_responsavel_pix: 'Alex Renato Lacerda Perin' },
        { tipo: 'boleto', ativo: true },
        { tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 1 },
        { tipo: 'adiantamento', ativo: false, porcentagem: 30 },
        { tipo: 'observacao', ativo: false, texto: '' }
    ],
    prazoPagamento: 'Pagamento devido na conclusão do serviço.',
    workingHours: {
        start: '08:00',
        end: '18:00',
        days: [1, 2, 3, 4, 5], // Monday to Friday
    },
    employees: [
        { id: 1, nome: 'Alex Renato Lacerda Perin' }
    ],
};

export const mockClients: Omit<Client, 'id'>[] = [];

export const mockMeasurements: { [key: number]: Measurement[] } = {};