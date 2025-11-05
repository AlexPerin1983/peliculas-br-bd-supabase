import { UserInfo, Client } from '../types';
// File contents excluded from context
export const mockLogo = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9IiMzNjQ1NjIiLz4KICA8dGV4dCB4PScyNTYiIHk9IjI4NiIgbGFiZWwtcmVzZXJ2ZT0idHJ1ZSIgZm9udC1mYW1pbHk9Ik1vbnRzZXJyYXQiIGZvbnQtc2l6ZT0iMTUwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYWxpZ249ImNlbnRlciIgdGV4dC1iYXNlbGluZT0ibWVkaWFuIiBzdHJva2U9IiM5MzdlNDQiIHN0cm9rZS13aWR0aD0iNSI+UEI8L3RleHQ+CiAgPHRleHQgeD0iMjU2IiB5PSIzODUiIGxhYmVsLXJlc2VydGU9InRydWUiIGZvbnQtZmFtaWx5PSJSb2JvdG8iIGZvbnQtc2l6ZT0iMzUiIGZpbGw9IiNmZmYiIHRleHQtYWxpZ249ImNlbnRlciIgdGV4dC1iYXNlbGluZT0ibWVkaWFuIj5QZWxpY3VsYXM8L3RleHQ+CiAgPHRleHQgeD0iMjU2IiB5PSI0MjUiIGxhYmVsLXJlc2VydGU9InRydWUiIGZvbnQtZmFtaWx5PSJSb2JvdG8iIGZvbnQtc2l6ZT0iMzUiIGZpbGw9IiNmZmYiIHRleHQtYWxpZ249ImNlbnRlciIgdGV4dC1iYXNlbGluZT0ibWVkaWFuIj5CcmlzaWwgPC90ZXh0Pgo8L3N2Zz4=';
export const mockUserInfo: UserInfo = {
    id: 'info',
    nome: 'Alex Renato Lacerda Perin',
    empresa: 'Películas Brasil',
    telefone: '(83) 99301-5765',
    email: 'alexlacerdaperin@gmail.com',
    site: 'www.peliculasbrasil.com.br',
    endereco: 'Wind Palace - Intermares',
    cpfCnpj: '00.000.000/0000-00', // CNPJ genérico de 14 zeros, já mascarado
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
    aiConfig: {
        provider: 'gemini',
        apiKey: '', // User needs to fill this in
    },
    lastSelectedClientId: null,
    activeTab: 'client', // Definindo aba padrão
};

export const mockClients: Omit<Client, 'id'>[] = [];