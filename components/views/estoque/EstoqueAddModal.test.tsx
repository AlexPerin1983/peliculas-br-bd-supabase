import { fireEvent, render, screen } from '@testing-library/react';
import EstoqueAddModal from './EstoqueAddModal';

const baseProps = {
    isOpen: true,
    activeTab: 'retalhos' as const,
    onClose: vi.fn(),
    onOpenFilmSelection: vi.fn(),
    onSubmit: vi.fn(),
    bobinas: [],
    formFilmId: '',
    setFormFilmId: vi.fn(),
    formLargura: '',
    setFormLargura: vi.fn(),
    formComprimento: '',
    setFormComprimento: vi.fn(),
    formFornecedor: '',
    setFormFornecedor: vi.fn(),
    formLote: '',
    setFormLote: vi.fn(),
    formCusto: '',
    setFormCusto: vi.fn(),
    formLocalizacao: '',
    setFormLocalizacao: vi.fn(),
    formObservacao: '',
    setFormObservacao: vi.fn(),
    formBobinaId: '' as const,
    setFormBobinaId: vi.fn(),
    formDeduzirDaBobina: false,
    setFormDeduzirDaBobina: vi.fn(),
    formQuantidade: '1',
    setFormQuantidade: vi.fn(),
};

describe('EstoqueAddModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const bobinas = [
        {
            id: 10,
            filmId: 'Window Premium Clear',
            codigoQr: 'qr-premium',
            larguraCm: 152,
            comprimentoTotalM: 30,
            comprimentoRestanteM: 12.5,
            status: 'ativa' as const,
            localizacao: 'Prateleira A',
        },
        {
            id: 11,
            filmId: 'Window Blue',
            codigoQr: 'qr-blue',
            larguraCm: 122,
            comprimentoTotalM: 30,
            comprimentoRestanteM: 8,
            status: 'ativa' as const,
            lote: 'B2',
        },
    ];

    it('mostra quantidade no cadastro de retalho e mantem apenas numeros', () => {
        const setFormQuantidade = vi.fn();

        render(
            <EstoqueAddModal
                {...baseProps}
                setFormQuantidade={setFormQuantidade}
            />
        );

        const quantityInput = screen.getByLabelText('Quantidade de retalhos iguais');

        expect(screen.getByText('Quantidade')).toBeInTheDocument();
        expect(quantityInput).toHaveValue('1');

        fireEvent.change(quantityInput, { target: { value: '12abc' } });

        expect(setFormQuantidade).toHaveBeenCalledWith('12');
    });

    it('nao mostra quantidade no cadastro de bobina', () => {
        render(
            <EstoqueAddModal
                {...baseProps}
                activeTab="bobinas"
            />
        );

        expect(screen.queryByLabelText('Quantidade de retalhos iguais')).not.toBeInTheDocument();
    });

    it('busca a origem do retalho por bobinas ativas e preenche pelicula e largura', () => {
        const setFormBobinaId = vi.fn();
        const setFormFilmId = vi.fn();
        const setFormLargura = vi.fn();

        render(
            <EstoqueAddModal
                {...baseProps}
                bobinas={bobinas}
                setFormBobinaId={setFormBobinaId}
                setFormFilmId={setFormFilmId}
                setFormLargura={setFormLargura}
            />
        );

        fireEvent.click(screen.getByLabelText('Escolher origem do retalho'));

        const searchInput = screen.getByLabelText('Buscar origem do retalho');
        fireEvent.change(searchInput, { target: { value: 'blue' } });

        expect(screen.getByText('Window Blue')).toBeInTheDocument();
        expect(screen.queryByText('Window Premium Clear')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Window Blue'));

        expect(setFormBobinaId).toHaveBeenCalledWith(11);
        expect(setFormFilmId).toHaveBeenCalledWith('Window Blue');
        expect(setFormLargura).toHaveBeenCalledWith('1,22');
    });
});
