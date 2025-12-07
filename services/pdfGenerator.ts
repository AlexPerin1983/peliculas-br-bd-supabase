import { Client, UserInfo, Measurement, Film, SavedPDF, ProposalOption } from '../types';

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
    priceAfterItemDiscounts: number;
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

// Função auxiliar para calcular totais de um único PDF salvo
const calculateTotalsFromSavedPDF = (pdf: SavedPDF): Totals => {
    // Acessando as propriedades diretamente do objeto SavedPDF
    const totalM2 = pdf.totalM2 || 0;
    const subtotal = pdf.subtotal || 0;
    // Corrigindo o acesso à propriedade totalItemDiscount
    const totalItemDiscount = (pdf as any).totalItemDiscount || 0;
    const generalDiscountAmount = pdf.generalDiscountAmount || 0;
    const finalTotal = pdf.totalPreco;

    // Se subtotal não estiver disponível, calcula a partir do finalTotal e descontos
    const calculatedSubtotal = subtotal || (finalTotal + generalDiscountAmount + totalItemDiscount);

    // Recalcula priceAfterItemDiscounts para garantir consistência
    const priceAfterItemDiscounts = calculatedSubtotal - totalItemDiscount;

    return {
        totalM2,
        subtotal: calculatedSubtotal,
        totalItemDiscount,
        priceAfterItemDiscounts,
        generalDiscountAmount,
        finalTotal,
    };
};

// Função principal para gerar PDF de uma única opção (mantida)
export const generatePDF = async (client: Client, userInfo: UserInfo, measurements: Measurement[], allFilms: Film[], generalDiscount: GeneralDiscount, totals: Totals, proposalOptionName: string): Promise<Blob> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    await renderPdfContent(doc, client, userInfo, [{ measurements, generalDiscount, totals, proposalOptionName }], allFilms, true);

    return doc.output('blob');
};

// Nova função para gerar PDF combinado
export const generateCombinedPDF = async (client: Client, userInfo: UserInfo, savedPdfs: SavedPDF[], allFilms: Film[]): Promise<Blob> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const optionsData = savedPdfs.map(pdf => ({
        measurements: pdf.measurements || [],
        generalDiscount: {
            value: pdf.generalDiscount?.value || '',
            type: pdf.generalDiscount?.type || 'none',
        } as GeneralDiscount,
        totals: calculateTotalsFromSavedPDF(pdf),
        proposalOptionName: pdf.proposalOptionName || 'Opção',
    }));

    await renderPdfContent(doc, client, userInfo, optionsData, allFilms, true, true);

    return doc.output('blob');
};


// Função de renderização unificada
const renderPdfContent = async (
    doc: any,
    client: Client,
    userInfo: UserInfo,
    optionsData: { measurements: Measurement[], generalDiscount: GeneralDiscount, totals: Totals, proposalOptionName: string }[],
    allFilms: Film[],
    includeCover: boolean,
    isCombined: boolean = false
) => {
    try {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;

        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
        };

        const bodyText = [33, 37, 41];

        const safeText = (text: any, x: number, y: number, options = {}) => {
            if (typeof text !== 'string') text = String(text || '');
            doc.text(text, x, y, options);
        };

        const addLogo = async (x: number, y: number, maxWidth: number, maxHeight: number) => {
            if (userInfo.logo) {
                try {
                    const img = new Image();
                    img.src = userInfo.logo;
                    await new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve; // Continue even if logo fails
                    });

                    let imgWidth = img.width;
                    let imgHeight = img.height;
                    let ratio = imgWidth / imgHeight;

                    if (imgWidth > maxWidth) {
                        imgWidth = maxWidth;
                        imgHeight = imgWidth / ratio;
                    }
                    if (imgHeight > maxHeight) {
                        imgHeight = maxHeight;
                        imgWidth = imgHeight * ratio;
                    }

                    doc.addImage(userInfo.logo, 'PNG', x, y, imgWidth, imgHeight);
                } catch (error) {
                    console.error("Erro ao adicionar logo:", error);
                }
            }
        };

        let pageCounter = 1;
        const addFooter = () => {
            const footerY = pageHeight - 15;
            doc.setDrawColor(...hexToRgb('#dddddd'));
            doc.setLineWidth(0.2);
            doc.line(margin, footerY, pageWidth - margin, footerY);

            doc.setTextColor(...bodyText);
            doc.setFontSize(8);

            safeText(userInfo.empresa || '', margin, footerY + 7);
            safeText(`Página ${pageCounter}`, pageWidth - margin, footerY + 7, { align: 'right' });
        };

        const addPageHeader = async () => {
            const headerStartY = 12;
            const userPrimaryColor = hexToRgb(userInfo.cores?.primaria || '#333333');

            // Logo and Name
            let logoBottomY = 0;
            if (userInfo.logo) {
                try {
                    const img = new Image();
                    img.src = userInfo.logo;
                    await new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                    const logoHeight = 8;
                    const ratio = img.width / img.height;
                    const logoWidth = logoHeight * ratio;
                    doc.addImage(userInfo.logo, 'PNG', margin, headerStartY, logoWidth, logoHeight);
                    doc.setFont("helvetica", 'bold');
                    doc.setFontSize(10);
                    doc.setTextColor(...bodyText);
                    safeText(userInfo.nome, margin + logoWidth + 4, headerStartY + logoHeight / 2 + 2);
                    logoBottomY = headerStartY + logoHeight;
                } catch (e) {
                    logoBottomY = headerStartY + 8;
                }
            } else {
                doc.setFont("helvetica", 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...bodyText);
                safeText(userInfo.nome, margin, headerStartY + 4);
                logoBottomY = headerStartY + 8;
            }

            // Right-aligned contact info
            doc.setFont("helvetica", 'normal');
            doc.setFontSize(8);
            const rightAlignX = pageWidth - margin;
            safeText(`Tel: ${userInfo.telefone || 'N/A'}`, rightAlignX, headerStartY + 1, { align: 'right' });
            safeText(`Email: ${userInfo.email || 'N/A'}`, rightAlignX, headerStartY + 5, { align: 'right' });
            safeText(`Site: ${userInfo.site || 'N/A'}`, rightAlignX, headerStartY + 9, { align: 'right' });

            const lineY = Math.max(logoBottomY, headerStartY + 12) + 2;
            doc.setDrawColor(...userPrimaryColor);
            doc.setLineWidth(0.5);
            doc.line(margin, lineY, pageWidth - margin, lineY);
        };

        let yPos = 0;
        const addNewPage = async () => {
            doc.addPage();
            pageCounter++;
            await addPageHeader();
            yPos = 35; // Start content below the header
            addFooter();
        };

        const addSectionTitle = async (title: string) => {
            if (yPos > pageHeight - 40) await addNewPage();
            const userSecondaryColor = hexToRgb(userInfo.cores?.secundaria || '#937e44');
            doc.setDrawColor(...userSecondaryColor);
            doc.setLineWidth(0.5);
            doc.line(margin, yPos, pageWidth - margin, yPos);
            yPos += 10;
            doc.setTextColor(...userSecondaryColor);
            doc.setFont("helvetica", 'bold');
            doc.setFontSize(14);
            safeText(title, margin, yPos);
            yPos += 15;
            doc.setTextColor(...bodyText);
            doc.setFont("helvetica", 'normal');
            doc.setFontSize(10);
        };

        // --- COVER PAGE ---
        if (includeCover) {
            const primaryColor = hexToRgb(userInfo.cores?.primaria || '#0052FF');
            const secondaryColor = hexToRgb(userInfo.cores?.secundaria || '#2D3748');
            const textWhite = [255, 255, 255];
            const textDark = [50, 50, 50];

            // Background shapes
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
            await addLogo(margin, margin, 68, 25.5);
            doc.setTextColor(...textWhite);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            safeText(userInfo.empresa, margin, margin + 30);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            safeText(userInfo.telefone, margin, margin + 35);
            safeText(userInfo.email, margin, margin + 39);


            // Date & Proposal Number (top-right)
            const proposalId = `ORC-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${client.id || '00'}`;
            doc.setFontSize(9);
            doc.setTextColor(...textDark);
            doc.setFont("helvetica", 'normal');
            safeText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, margin + 5, { align: 'right' });
            safeText(`Orçamento Nº: ${proposalId}`, pageWidth - margin, margin + 10, { align: 'right' });

            // Main Title (bottom right on white area)
            yPos = pageHeight / 2 + 30;
            doc.setFontSize(14);
            doc.setFont("helvetica", 'normal');
            doc.setTextColor(...textDark);
            safeText("PROPOSTA DE ORÇAMENTO", pageWidth - margin, yPos, { align: 'right' });

            yPos += 20;
            doc.setFontSize(48);
            doc.setFont("helvetica", 'bold');
            doc.setTextColor(...primaryColor);
            safeText("ORÇAMENTO", pageWidth - margin, yPos, { align: 'right' });

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

            // --- CORREÇÃO DE QUEBRA DE LINHA DO ENDEREÇO DO CLIENTE ---
            const clientAddress = formatAddressForPdf(client);
            const maxClientAddressWidth = (pageWidth / 2) - margin - 10; // Largura máxima para o endereço do cliente

            const clientAddressLines = doc.splitTextToSize(clientAddress, maxClientAddressWidth);

            let currentClientY = yPos;
            for (const line of clientAddressLines) {
                safeText(line, margin, currentClientY);
                currentClientY += 5; // Incrementa a posição Y para cada linha
            }

            // Garante que o endereço da empresa comece na mesma linha vertical do nome da empresa
            safeText(userInfo.endereco, pageWidth / 2 + 10, yPos + 5);
            // --- FIM DA CORREÇÃO ---

            // Add first content page
            await addNewPage();
        } else {
            // If no cover, start on page 1 with header/footer
            await addPageHeader();
            yPos = 35;
            addFooter();
        }
        // --- END OF COVER PAGE ---


        // --- CONTENT PAGES ---
        await addSectionTitle(isCombined ? "Opções de Proposta" : "Orçamento Detalhado");

        const colors = {
            primary: hexToRgb(userInfo.cores?.primaria || '#0056b3'),
            secondary: hexToRgb(userInfo.cores?.secundaria || '#17a2b8'),
            text: bodyText,
            white: [255, 255, 255]
        };

        let grandTotalCombined = 0;
        let totalM2Combined = 0;
        let totalItemDiscountCombined = 0;
        let totalGeneralDiscountCombined = 0;
        let subtotalCombined = 0;

        for (const optionData of optionsData) {
            const { measurements, generalDiscount: optionGeneralDiscount, totals: optionTotals, proposalOptionName } = optionData;

            // 1. Group measurements by film for this option
            const measurementsByFilm: { [key: string]: Measurement[] } = {};
            measurements.forEach(m => {
                if (!measurementsByFilm[m.pelicula]) {
                    measurementsByFilm[m.pelicula] = [];
                }
                measurementsByFilm[m.pelicula].push(m);
            });

            // 2. Render details for this option
            for (const filmName of Object.keys(measurementsByFilm)) {
                const film = allFilms.find(f => f.nome === filmName);
                const filmMeasurements = measurementsByFilm[filmName];

                if (yPos > pageHeight - 60) await addNewPage();

                doc.setTextColor(...colors.secondary);
                doc.setFont("helvetica", 'bold');
                doc.setFontSize(12);
                safeText(`${proposalOptionName} - ${filmName}`, margin, yPos);
                yPos += 8;

                const head = [['Item', 'Ambiente', 'Dimensões', 'Qtd', 'M²', 'Preço Unit.', 'Desconto', 'Preço Final']];
                const body = filmMeasurements.map((m, i) => {
                    const largura = parseFloat(String(m.largura).replace(',', '.')) || 0;
                    const altura = parseFloat(String(m.altura).replace(',', '.')) || 0;
                    const quantidade = parseInt(String(m.quantidade), 10) || 0;
                    const m2 = largura * altura * quantidade;

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

                    if (m.discount) {
                        const discountValue = parseFloat(String(m.discount.value).replace(',', '.')) || 0;
                        const discountType = m.discount.type;

                        if (discountType === 'percentage' && discountValue > 0) {
                            itemDiscountAmount = basePrice * (discountValue / 100);
                            discountDisplay = `${formatNumberBR(discountValue).replace(',', '.')}%`;
                        } else if (discountType === 'fixed' && discountValue > 0) {
                            itemDiscountAmount = discountValue;
                            discountDisplay = `R$ ${formatNumberBR(discountValue)}`;
                        }
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

            // 3. Render Totals for this specific option
            if (yPos > pageHeight - 60) await addNewPage();

            doc.setFont("helvetica", 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...colors.primary);
            safeText(`Total da Opção: ${proposalOptionName}`, margin, yPos);

            doc.setFont("helvetica", 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...bodyText);

            const summaryYStart = yPos + 7;
            const summaryXAlign = pageWidth - margin;

            safeText(`Subtotal:`, margin, summaryYStart);
            safeText(`R$ ${formatNumberBR(optionTotals.subtotal)}`, summaryXAlign, summaryYStart, { align: 'right' });

            safeText(`Descontos nos Itens:`, margin, summaryYStart + 7);
            safeText(`- R$ ${formatNumberBR(optionTotals.totalItemDiscount)}`, summaryXAlign, summaryYStart + 7, { align: 'right' });

            safeText(`Desconto Geral:`, margin, summaryYStart + 14);
            safeText(`- R$ ${formatNumberBR(optionTotals.generalDiscountAmount)}`, summaryXAlign, summaryYStart + 14, { align: 'right' });

            doc.setDrawColor(...colors.primary);
            doc.setLineWidth(0.2);
            doc.line(margin, summaryYStart + 18, pageWidth - margin, summaryYStart + 18);

            doc.setFont("helvetica", 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...colors.primary);
            safeText(`Valor Final da Opção:`, margin, summaryYStart + 25);
            safeText(`R$ ${formatNumberBR(optionTotals.finalTotal)}`, summaryXAlign, summaryYStart + 25, { align: 'right' });

            yPos = summaryYStart + 35;
            doc.setTextColor(...bodyText);

            // 4. Acumular totais combinados (Ainda precisamos disso para o cálculo de pagamento, mas não para o display)
            grandTotalCombined += optionTotals.finalTotal;
            totalM2Combined += optionTotals.totalM2;
            totalItemDiscountCombined += optionTotals.totalItemDiscount;
            totalGeneralDiscountCombined += optionTotals.generalDiscountAmount;
            subtotalCombined += optionTotals.subtotal;

            if (isCombined && optionsData.indexOf(optionData) < optionsData.length - 1) {
                // Adicionar uma quebra de página entre opções se for combinado
                await addNewPage();
                doc.setFont("helvetica", 'bold');
                doc.setFontSize(14);
                doc.setTextColor(...colors.secondary);
                safeText("Continuação das Opções de Proposta", margin, yPos);
                yPos += 15;
            }
        }

        // --- Total Geral Combinado (MODIFICADO) ---
        if (isCombined) {
            // Substituindo o bloco de soma por uma nota de esclarecimento
            if (yPos > pageHeight - 60) await addNewPage();

            doc.setFont("helvetica", 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...colors.primary);
            safeText("Opções de Proposta para Avaliação", margin, yPos);
            yPos += 6;

            doc.setFont("helvetica", 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...bodyText);
            safeText("Os valores acima representam opções separadas para sua escolha, e não um total somado.", margin, yPos);
            yPos += 15;
        }

        // --- Garantias e Especificações (Baseado em todas as opções) ---

        const allFilmsUsed = optionsData.flatMap(opt => opt.measurements.map(m => m.pelicula));
        const uniqueFilmNames = Array.from(new Set(allFilmsUsed));

        await addSectionTitle("Garantias");
        for (const filmName of uniqueFilmNames) {
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

        const filmsWithTechData = uniqueFilmNames
            .map(filmName => allFilms.find(f => f.nome === filmName))
            .filter((film): film is Film => !!film && (
                (typeof film.uv === 'number' && film.uv > 0) ||
                (typeof film.ir === 'number' && film.ir > 0) ||
                (typeof film.vtl === 'number' && film.vtl > 0) ||
                (typeof film.tser === 'number' && film.tser > 0) ||
                (typeof film.espessura === 'number' && film.espessura > 0) ||
                (!!film.customFields && Object.keys(film.customFields).length > 0)
            ));

        if (filmsWithTechData.length > 0) {
            await addSectionTitle("Especificações Técnicas");

            for (const film of filmsWithTechData) {
                const techData: { label: string; value: string | number | undefined; unit: string }[] = [
                    { label: 'Proteção UV', value: film.uv, unit: '%' },
                    { label: 'Rejeição de Infravermelho (IR)', value: film.ir, unit: '%' },
                    { label: 'Transmissão de Luz Visível (VTL)', value: film.vtl, unit: '%' },
                    { label: 'Rejeição Total de Energia Solar (TSER)', value: film.tser, unit: '%' },
                    { label: 'Espessura', value: film.espessura, unit: 'mc' },
                ].filter(item => typeof item.value === 'number' && item.value > 0);

                if (film.customFields) {
                    Object.entries(film.customFields).forEach(([key, value]) => {
                        techData.push({ label: key, value: value, unit: '' });
                    });
                }

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
        const LINE_HEIGHT = 7;
        const SECTION_TITLE_HEIGHT = 25;
        const SPACING_AFTER_PAYMENTS = 7;
        const SIGNATURE_HEIGHT = 35;
        const PAGE_BOTTOM_MARGIN = 25;

        const calculateParceladoSemJuros = (total: number, parcelas_max?: number | null) => {
            if (!parcelas_max || parcelas_max === 0) return 0;
            return total / parcelas_max;
        };
        const calculateParceladoComJuros = (total: number, parcelas_max?: number | null, juros?: number | null) => {
            if (!parcelas_max || parcelas_max === 0 || !juros) return 0;
            const i = juros / 100;
            if (i === 0) return total / parcelas_max;
            const parcela = total * (i * Math.pow(1 + i, parcelas_max)) / (Math.pow(1 + i, parcelas_max) - 1);
            return parcela;
        };
        const calculateAdiantamento = (total: number, porcentagem?: number | null) => {
            if (!porcentagem) return 0;
            return (total * porcentagem) / 100;
        };

        // Se for combinado, usamos o total da primeira opção para calcular as parcelas,
        // pois o cliente deve escolher apenas uma opção. Se for uma única proposta, usa o total dela.
        const finalTotalForPayment = isCombined ? optionsData[0].totals.finalTotal : optionsData[0].totals.finalTotal;

        const paymentLines: string[] = [];
        userInfo.payment_methods?.filter(m => m.ativo).forEach(method => {
            switch (method.tipo) {
                case 'pix':
                    paymentLines.push(`• Pix: R$ ${formatNumberBR(finalTotalForPayment)}`);
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
                    paymentLines.push(`• Boleto Bancário: R$ ${formatNumberBR(finalTotalForPayment)}`);
                    break;
                case 'parcelado_sem_juros':
                    const valorParcelaSemJuros = calculateParceladoSemJuros(finalTotalForPayment, method.parcelas_max);
                    paymentLines.push(`• Parcelado s/ Juros: ${method.parcelas_max || 0}x de R$ ${formatNumberBR(valorParcelaSemJuros)}`);
                    break;
                case 'parcelado_com_juros':
                    const valorParcelaComJuros = calculateParceladoComJuros(finalTotalForPayment, method.parcelas_max, method.juros);
                    paymentLines.push(`• Parcelado c/ Juros: ${method.parcelas_max || 0}x de R$ ${formatNumberBR(valorParcelaComJuros)} (Taxa de ${method.juros || 0}%)`);
                    break;
                case 'adiantamento':
                    const valorAdiantamento = calculateAdiantamento(finalTotalForPayment, method.porcentagem);
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

        const estimatedHeight = SECTION_TITLE_HEIGHT + (paymentLines.length * LINE_HEIGHT) + SPACING_AFTER_PAYMENTS + (conditions.length * LINE_HEIGHT) + SIGNATURE_HEIGHT;

        if (yPos + estimatedHeight > pageHeight - PAGE_BOTTOM_MARGIN) {
            await addNewPage();
        }

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
            const signatureImageHeight = 15;
            const PAGE_BOTTOM_MARGIN_WITH_FOOTER = 25;

            if (yPos + SIGNATURE_HEIGHT > pageHeight - PAGE_BOTTOM_MARGIN_WITH_FOOTER) {
                await addNewPage();
                yPos = pageHeight - 80;
            } else {
                yPos = Math.max(yPos + 20, pageHeight - 100);
            }

            try {
                const img = new Image();
                img.src = userInfo.assinatura;
                await new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });

                const ratio = img.width / img.height;
                const signatureImageWidth = signatureImageHeight * ratio;
                const signatureX = (pageWidth / 2) - (signatureImageWidth / 2);

                doc.addImage(userInfo.assinatura, 'PNG', signatureX, yPos, signatureImageWidth, signatureImageHeight);

                const lineY = yPos + signatureImageHeight + 2;
                const lineXStart = (pageWidth / 2) - 40;
                doc.setDrawColor(...bodyText);
                doc.setLineWidth(0.2);
                doc.line(lineXStart, lineY, lineXStart + 80, lineY);

                const nameY = lineY + 5;
                doc.setFont("helvetica", 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...bodyText);
                safeText(userInfo.nome, pageWidth / 2, nameY, { align: 'center' });

                const cpfCnpjY = nameY + 5;
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                safeText(userInfo.cpfCnpj, pageWidth / 2, cpfCnpjY, { align: 'center' });

            } catch (error) {
                console.error("Erro ao adicionar assinatura:", error);
            }
        }
    } catch (error) {
        console.error("Erro ao renderizar PDF:", error);
        alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
        throw error;
    }
};