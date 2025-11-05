import { Client, UserInfo, Measurement, Film } from '../types';

declare const jspdf: any;

const formatNumberBR = (number: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

interface Totals {
    totalM2: number;
    subtotal: number;
    totalItemDiscount: number;
    generalDiscountAmount: number;
    finalTotal: number;
}
type GeneralDiscount = { value: string | number; type: 'percentage' | 'fixed' };

const formatAddressForPdf = (client: Client): string => {
    const parts = [
        client.logradouro && client.numero ? `${client.logradouro}, ${client.numero}` : client.logradouro,
        client.bairro,
        client.cidade && client.uf ? `${client.cidade} - ${client.uf}` : client.cidade,
        client.cep
    ];
    return parts.filter(Boolean).join(', ');
};

export const generatePDF = async (client: Client, userInfo: UserInfo, measurements: Measurement[], allFilms: Film[], generalDiscount: GeneralDiscount, totals: Totals): Promise<Blob> => {
    try {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;

        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result
                ? [
                      parseInt(result[1], 16),
                      parseInt(result[2], 16),
                      parseInt(result[3], 16)
                  ]
                : [0, 0, 0];
        };
        
        const bodyText = [33, 37, 41];

        const safeText = (text: any, x: number, y: number, options: { align?: 'left' | 'center' | 'right' } = {}) => {
            doc.text(String(text), x, y, { ...options, maxWidth: (options.align === 'right' ? pageWidth - margin - x : undefined) });
        };

        const addLogo = async (x: number, y: number, maxWidth: number, maxHeight: number) => {
            if (!userInfo.logo) return;
            
            const img = new Image();
            img.src = userInfo.logo;
            
            await new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const ratio = img.width / img.height;
            let finalWidth = maxWidth;
            let finalHeight = maxHeight;

            if (finalWidth > finalHeight * ratio) {
                finalWidth = finalHeight * ratio;
            } else {
                finalHeight = finalWidth / ratio;
            }

            canvas.width = finalWidth;
            canvas.height = finalHeight;
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

            doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, finalWidth, finalHeight);
        };

        const addFooter = () => {
            doc.setFont("helvetica", 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            safeText(`Página ${pageCounter}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };

        // This header will be used for content pages (page 2 onwards)
        const addPageHeader = async () => {
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.1);
            doc.line(margin, 25, pageWidth - margin, 25);
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            safeText(userInfo.empresa, margin, 20);
            safeText(`Orçamento: ${client.nome}`, pageWidth - margin, 20, { align: 'right' });
        };
        
        let pageCounter = 1;
        let yPos = 35; // Variável de posição Y global para o conteúdo
        
        const addNewPage = async () => {
            doc.addPage();
            pageCounter++;
            await addPageHeader();
            yPos = 35; // Start content below the header
            addFooter();
        };

        const addSectionTitle = async (title: string) => {
            if (yPos > pageHeight - 40) await addNewPage();
            
            doc.setFont("helvetica", 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...bodyText);
            doc.setDrawColor(bodyText[0], bodyText[1], bodyText[2]);
            doc.setLineWidth(0.5);
            
            const titleWidth = doc.getTextWidth(title);
            const xStart = margin;
            
            safeText(title, xStart, yPos);
            doc.line(xStart + titleWidth + 5, yPos + 3, pageWidth - margin, yPos + 3);
            
            yPos += 10;
        };

        // --- COVER PAGE ---
        const primaryColor = hexToRgb(userInfo.cores?.primaria || '#0056b3');
        const secondaryColor = hexToRgb(userInfo.cores?.secundaria || '#2D3748');
        const textWhite = [255, 255, 255];
        const textDark = [50, 50, 50];

        // Background shapes
        // Background shape using secondary color
        doc.setFillColor(...secondaryColor);
        doc.path([
            { op: 'm', c: [0, 0] },
            { op: 'l', c: [pageWidth, 0] },
            { op: 'l', c: [pageWidth, 60] },
            { op: 'l', c: [0, 100] },
            { op: 'h' }
        ]).fill();

        // Accent color shape overlay
        doc.setFillColor(...primaryColor);
        doc.path([
            { op: 'm', c: [0, 0] },
            { op: 'l', c: [pageWidth - 60, 0] },
            { op: 'l', c: [0, 90] },
            { op: 'h' }
        ]).fill();

        // Logo and company info (top-left, on shapes)
        await addLogo(margin, margin, 68, 25.5); // Increased size by 70%
        doc.setTextColor(...textWhite);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        safeText(userInfo.empresa, margin, margin + 30); // Moved down
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        safeText(userInfo.telefone, margin, margin + 35); // Moved down
        safeText(userInfo.email, margin, margin + 39); // Moved down


        // Date & Proposal Number (top-right)
        const proposalId = `ORC-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${client.id || '00'}`;
        doc.setFontSize(9);
        doc.setFont("helvetica", 'normal');
        doc.setTextColor(...textDark);
        safeText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, margin + 5, { align: 'right' });
        safeText(`Orçamento Nº: ${proposalId}`, pageWidth - margin, margin + 10, { align: 'right' });

        // Main Title (bottom right on white area)
        yPos = pageHeight / 2 + 30;
        doc.setFontSize(14);
        doc.setFont("helvetica", 'normal');
        doc.setTextColor(...textDark);
        safeText("PROPOSTA DE ORÇAMENTO", pageWidth - margin, yPos, { align: 'right'});
        
        yPos += 20;
        doc.setFontSize(48);
        doc.setFont("helvetica", 'bold');
        doc.setTextColor(...primaryColor);
        safeText("ORÇAMENTO", pageWidth - margin, yPos, { align: 'right'});

        // Divider Line
        const lineY = pageHeight - 80;
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(1);
        doc.line(margin, lineY, pageWidth - margin, lineY);


        // Client and User Info (bottom of page)
        yPos = lineY + 10;
        doc.setFontSize(10);
        doc.setTextColor(...textDark);
        doc.setFont("helvetica", 'bold');
        safeText("Preparado para:", margin, yPos);
        safeText("Preparado por:", pageWidth / 2 + 10, yPos);

        yPos += 7;
        doc.setFont("helvetica", 'normal');
        safeText(client.nome, margin, yPos);
        safeText(userInfo.nome, pageWidth / 2 + 10, yPos);
        yPos += 5;
        safeText(client.telefone || '', margin, yPos);
        safeText(userInfo.empresa, pageWidth / 2 + 10, yPos);
        yPos += 5;
        safeText(formatAddressForPdf(client), margin, yPos);
        safeText(userInfo.endereco, pageWidth / 2 + 10, yPos);

        // --- END OF COVER PAGE ---


        // --- CONTENT PAGES ---
        await addNewPage();
        await addSectionTitle("Orçamento Detalhado");

        const colors = {
            primary: hexToRgb(userInfo.cores?.primaria || '#0056b3'),
            secondary: hexToRgb(userInfo.cores?.secundaria || '#17a2b8'),
            text: bodyText,
            white: [255, 255, 255]
        };

        const measurementsByFilm: { [key: string]: Measurement[] } = {};
        measurements.forEach(m => {
            if (!measurementsByFilm[m.pelicula]) {
                measurementsByFilm[m.pelicula] = [];
            }
            measurementsByFilm[m.pelicula].push(m);
        });

        for (const filmName of Object.keys(measurementsByFilm)) {
            const film = allFilms.find(f => f.nome === filmName);
            const filmMeasurements = measurementsByFilm[filmName];
            
            if (yPos > pageHeight - 60) await addNewPage();

            doc.setTextColor(...colors.secondary);
            doc.setFont("helvetica", 'bold');
            doc.setFontSize(12);
            safeText(filmName, margin, yPos);
            yPos += 8;

            const head = [['Item', 'Ambiente', 'Dimensões', 'Qtd', 'M²', 'Preço Unit.', 'Desconto', 'Preço Final']];
            const body = filmMeasurements.map((m, i) => {
                const largura = parseFloat(String(m.largura).replace(',', '.')) || 0;
                const altura = parseFloat(String(m.altura).replace(',', '.')) || 0;
                const m2 = largura * altura * m.quantidade;
                
                let pricePerM2 = 0;
                if (film) {
                    if (film.preco > 0) {
                        pricePerM2 = film.preco;
                    } else if (film.maoDeObra && film.maoDeObra > 0) {
                        pricePerM2 = film.maoDeObra;
                    }
                }
                
                const basePrice = pricePerM2 * m2;
                
                let itemDiscountAmount = 0;
                let discountDisplay = '-';
                const discountValue = m.discount || 0;
                if (m.discountType === 'percentage' && discountValue > 0) {
                    itemDiscountAmount = basePrice * (discountValue / 100);
                    discountDisplay = `${formatNumberBR(discountValue).replace('R$', '').trim()}%`;
                } else if (m.discountType === 'fixed' && discountValue > 0) {
                    itemDiscountAmount = discountValue;
                    discountDisplay = `R$ ${formatNumberBR(discountValue)}`;
                }
                const finalItemPrice = Math.max(0, basePrice - itemDiscountAmount);

                return [
                    i + 1,
                    m.ambiente,
                    `${m.largura}x${m.altura}`,
                    m.quantidade,
                    formatNumberBR(m2).replace('R$', '').trim(),
                    `R$ ${formatNumberBR(basePrice)}`,
                    discountDisplay,
                    `R$ ${formatNumberBR(finalItemPrice)}`
                ];
            });

            (doc as any).autoTable({
                head,
                body,
                startY: yPos,
                theme: 'grid',
                headStyles: { fillColor: colors.primary, textColor: colors.white },
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 10 },
                    3: { cellWidth: 10 },
                    5: { halign: 'right' },
                    6: { halign: 'right' },
                    7: { halign: 'right' },
                }
            });

            yPos = (doc as any).lastAutoTable.finalY + 10;
        }

        await addSectionTitle("Total Geral do Orçamento");
        
        const summaryYStart = yPos;
        const summaryXAlign = pageWidth - margin;
        
        doc.setFont("helvetica", 'normal');
        doc.setFontSize(10);
        safeText(`Subtotal:`, margin, summaryYStart);
        safeText(`R$ ${formatNumberBR(totals.subtotal)}`, summaryXAlign, summaryYStart, { align: 'right' });
        
        safeText(`Descontos nos Itens:`, margin, summaryYStart + 7);
        safeText(`- R$ ${formatNumberBR(totals.totalItemDiscount)}`, summaryXAlign, summaryYStart + 7, { align: 'right' });

        safeText(`Desconto Geral:`, margin, summaryYStart + 14);
        safeText(`- R$ ${formatNumberBR(totals.generalDiscountAmount)}`, summaryXAlign, summaryYStart + 14, { align: 'right' });

        doc.setDrawColor(...colors.primary);
        doc.setLineWidth(0.2);
        doc.line(margin, summaryYStart + 18, pageWidth - margin, summaryYStart + 18);
        
        doc.setFont("helvetica", 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...colors.primary);
        safeText(`Valor Total:`, margin, summaryYStart + 25);
        safeText(`R$ ${formatNumberBR(totals.finalTotal)}`, summaryXAlign, summaryYStart + 25, { align: 'right' });
        
        yPos = summaryYStart + 40;
        doc.setTextColor(...bodyText);

        await addSectionTitle("Garantias");
        for (const filmName of Object.keys(measurementsByFilm)) {
            const film = allFilms.find(f => f.nome === filmName);
            if (film && (film.garantiaFabricante || film.garantiaMaoDeObra)) {
                if (yPos > pageHeight - 30) await addNewPage();
                doc.setFont("helvetica", 'bold');
                safeText(filmName, margin, yPos);
                yPos += 6;
                doc.setFont("helvetica", 'normal');
                safeText(`  - Garantia Fabricante: ${film.garantiaFabricante || 'N/A'} anos`, margin, yPos);
                yPos += 6;
                safeText(`  - Garantia Mão de Obra: ${film.garantiaMaoDeObra || 'N/A'} dias`, margin, yPos);
                yPos += 8;
            }
        }
        
        const filmsWithTechData = Object.keys(measurementsByFilm)
            .map(filmName => allFilms.find(f => f.nome === filmName))
            .filter((film): film is Film => !!film && (
                (typeof film.uv === 'number' && film.uv > 0) ||
                (typeof film.ir === 'number' && film.ir > 0) ||
                (typeof film.vtl === 'number' && film.vtl > 0) ||
                (typeof film.tser === 'number' && film.tser > 0) ||
                (typeof film.espessura === 'number' && film.espessura > 0)
            ));

        if (filmsWithTechData.length > 0) {
            await addSectionTitle("Especificações Técnicas");
            
            for (const film of filmsWithTechData) {
                const techData = [
                    { label: 'Proteção UV', value: film.uv, unit: '%' },
                    { label: 'Rejeição de Infravermelho (IR)', value: film.ir, unit: '%' },
                    { label: 'Transmissão de Luz Visível (VTL)', value: film.vtl, unit: '%' },
                    { label: 'Rejeição Total de Energia Solar (TSER)', value: film.tser, unit: '%' },
                    { label: 'Espessura', value: film.espessura, unit: 'mc' },
                ].filter(item => typeof item.value === 'number' && item.value > 0);

                if (techData.length > 0) {
                    if (yPos > pageHeight - 30 - (techData.length * 5)) await addNewPage();

                    doc.setFont("helvetica", 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(...colors.secondary);
                    safeText(film.nome, margin, yPos);
                    yPos += 6;

                    doc.setFont("helvetica", 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(...bodyText);

                    techData.forEach(item => {
                        safeText(`  • ${item.label}: ${item.value}${item.unit}`, margin, yPos);
                        yPos += 5;
                    });
                    yPos += 5;
                }
            }
        }

        // --- Payment and Conditions Section ---
        // 1. Prepare all content for this section first to calculate its total height.
        const grandTotal = totals.finalTotal;
        const calculateParceladoSemJuros = (total: number, parcelas_max?: number | null) => {
            if (!parcelas_max || parcelas_max <= 0) return total;
            return total / parcelas_max;
        };
        const calculateParceladoComJuros = (total: number, parcelas_max?: number | null, juros?: number | null) => {
            if (!parcelas_max || parcelas_max <= 0 || !juros || juros <= 0) return total;
            const taxaMensal = juros / 100;
            const valorParcela = total * (taxaMensal * Math.pow(1 + taxaMensal, parcelas_max)) / (Math.pow(1 + taxaMensal, parcelas_max) - 1);
            return valorParcela;
        };
        const calculateAdiantamento = (total: number, porcentagem?: number | null) => {
            if (!porcentagem || porcentagem <= 0) return 0;
            return total * (porcentagem / 100);
        };

        const paymentLines: string[] = [];
        userInfo.payment_methods?.filter(m => m.ativo).forEach(method => {
            switch (method.tipo) {
                case 'pix':
                    paymentLines.push(`• Pix: R$ ${formatNumberBR(grandTotal)}`);
                    if (method.chave_pix) {
                        let tipoChaveDisplay = '';
                        switch (method.tipo_chave_pix) {
                            case 'cpf': tipoChaveDisplay = 'CPF'; break;
                            case 'cnpj': tipoChaveDisplay = 'CNPJ'; break;
                            case 'telefone': tipoChaveDisplay = 'Telefone'; break;
                            case 'email': tipoChaveDisplay = 'Email'; break;
                            case 'aleatoria': tipoChaveDisplay = 'Chave Aleatória'; break;
                            default: break;
                        }
                        paymentLines.push(`  Chave: ${method.chave_pix}${tipoChaveDisplay ? ` (${tipoChaveDisplay})` : ''}`);
                    }
                    if (method.nome_responsavel_pix) {
                        paymentLines.push(`  Nome: ${method.nome_responsavel_pix}`);
                    }
                    break;
                case 'boleto':
                    paymentLines.push(`• Boleto Bancário: R$ ${formatNumberBR(grandTotal)}`);
                    break;
                case 'parcelado_sem_juros':
                    const valorParcelaSemJuros = calculateParceladoSemJuros(grandTotal, method.parcelas_max);
                    paymentLines.push(`• Parcelado s/ Juros: ${method.parcelas_max || 0}x de R$ ${formatNumberBR(valorParcelaSemJuros)}`);
                    break;
                case 'parcelado_com_juros':
                    const valorParcelaComJuros = calculateParceladoComJuros(grandTotal, method.parcelas_max, method.juros);
                    paymentLines.push(`• Parcelado c/ Juros: ${method.parcelas_max || 0}x de R$ ${formatNumberBR(valorParcelaComJuros)} (Taxa de ${method.juros || 0}%)`);
                    break;
                case 'adiantamento':
                    const valorAdiantamento = calculateAdiantamento(grandTotal, method.porcentagem);
                    paymentLines.push(`• Adiantamento (${method.porcentagem}%): R$ ${formatNumberBR(valorAdiantamento)}`);
                    break;
                case 'observacao':
                    if (method.texto) {
                        paymentLines.push(`• Observação: ${method.texto}`);
                    }
                    break;
            }
        });

        const validityDays = userInfo.proposalValidityDays || 60;
        const conditions: string[] = [];
        if (userInfo.prazoPagamento) {
            conditions.push(`Prazo de Pagamento: ${userInfo.prazoPagamento}`);
        }
        conditions.push(
            "Prazo de Instalação: A ser definido em comum acordo.",
            `Validade da Proposta: ${validityDays} dias a partir da data de emissão.`,
            "Observações: Quaisquer alterações no projeto podem resultar em ajustes no orçamento."
        );

        // 2. Calculate the estimated height of the entire section.
        const LINE_HEIGHT = 7;
        const SECTION_TITLE_HEIGHT = 25; // Combined height for line, title, and spacing
        const SPACING_AFTER_PAYMENTS = 7;
        const estimatedHeight = SECTION_TITLE_HEIGHT + (paymentLines.length * LINE_HEIGHT) + SPACING_AFTER_PAYMENTS + (conditions.length * LINE_HEIGHT);
        const PAGE_BOTTOM_MARGIN = 25; // Space for footer + buffer

        // 3. Check if a new page is needed before rendering anything from this section.
        if (yPos + estimatedHeight > pageHeight - PAGE_BOTTOM_MARGIN) {
            await addNewPage();
        }

        // 4. Now, render the entire section without intermittent page break checks.
        await addSectionTitle("Condições de Pagamento e Informações");

        for (const line of paymentLines) {
            safeText(line, margin, yPos);
            yPos += LINE_HEIGHT;
        }

        yPos += SPACING_AFTER_PAYMENTS;

        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        for (const line of conditions) {
            safeText(line, margin, yPos);
            yPos += LINE_HEIGHT;
        }
        
        // --- Signature Section ---
        if (userInfo.assinatura) {
            const signatureHeight = 35; // total height for the section
            const signatureImageHeight = 15;
            const PAGE_BOTTOM_MARGIN_WITH_FOOTER = 25;
            
            if (yPos + signatureHeight > pageHeight - PAGE_BOTTOM_MARGIN_WITH_FOOTER) {
                await addNewPage();
                yPos = pageHeight - 80; // Position it lower on a new page
            } else {
                // If there's space, push it towards the bottom of the current content
                yPos = Math.max(yPos + 20, pageHeight - 100);
            }

            try {
                const img = new Image();
                img.src = userInfo.assinatura;
                await new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve; // Continue even if signature fails to load
                });

                const ratio = img.width / img.height;
                const signatureImageWidth = signatureImageHeight * ratio;
                const signatureX = (pageWidth / 2) - (signatureImageWidth / 2);

                // Add signature image
                doc.addImage(userInfo.assinatura, 'PNG', signatureX, yPos, signatureImageWidth, signatureImageHeight);

                // Add line below signature image (for name to sit on)
                const lineY = yPos + signatureImageHeight + 2;
                const lineXStart = (pageWidth / 2) - 40;
                doc.setDrawColor(...bodyText);
                doc.setLineWidth(0.2);
                doc.line(lineXStart, lineY, lineXStart + 80, lineY);
                
                // Add name below line
                const nameY = lineY + 5;
                doc.setFont("helvetica", 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...bodyText);
                safeText(userInfo.nome, pageWidth / 2, nameY, { align: 'center' });
                
                // Add CPF/CNPJ below name
                const cpfCnpjY = nameY + 5;
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                safeText(userInfo.cpfCnpj, pageWidth / 2, cpfCnpjY, { align: 'center' });

            } catch (error) {
                console.error("Erro ao adicionar assinatura:", error);
            }
        }


        return doc.output('blob');
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
        throw error;
    }
};