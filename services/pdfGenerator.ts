import { Client, UserInfo, Measurement, Film, ProposalPaymentConfig, ProposalPricingMode, SavedPDF, Totals } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculatePricingAreaM2 } from '../src/lib/pricingArea';
import { buildPdfAdjustmentDisplay, type PdfDisplayLineItem } from '../src/lib/pdfAdjustmentDisplay';
import { calculateProposalAdjustmentAmounts } from '../src/lib/proposalAdjustments';
import { createDefaultLogo } from './defaultLogo';
import { clampValidityDays } from '../src/lib/proposalValidity';

// Define GeneralDiscount locally since it's not exported from types.ts
interface GeneralDiscount {
    value: string | number;
    type: 'percentage' | 'fixed' | 'none';
    operation?: 'discount' | 'increase';
    discountValue?: string | number;
    discountType?: 'percentage' | 'fixed' | 'none';
    increaseValue?: string | number;
    increaseType?: 'percentage' | 'fixed' | 'none';
    pricingMode?: ProposalPricingMode;
}

const formatNumberBR = (number: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

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
    const hasExplicitAdjustment = pdf.generalDiscount?.discountValue !== undefined
        || pdf.generalDiscount?.discountType !== undefined
        || pdf.generalDiscount?.increaseValue !== undefined
        || pdf.generalDiscount?.increaseType !== undefined;
    const adjustmentBase = Math.max(0, subtotal - totalItemDiscount);
    const calculatedAdjustments = hasExplicitAdjustment && adjustmentBase > 0
        ? calculateProposalAdjustmentAmounts({
            value: String(pdf.generalDiscount?.value ?? ''),
            type: pdf.generalDiscount?.type === 'fixed' ? 'fixed' : 'percentage',
            operation: pdf.generalDiscount?.operation === 'increase' ? 'increase' : 'discount',
            discountValue: pdf.generalDiscount?.discountValue !== undefined ? String(pdf.generalDiscount.discountValue) : undefined,
            discountType: pdf.generalDiscount?.discountType === 'fixed' ? 'fixed' : pdf.generalDiscount?.discountType === 'percentage' ? 'percentage' : undefined,
            increaseValue: pdf.generalDiscount?.increaseValue !== undefined ? String(pdf.generalDiscount.increaseValue) : undefined,
            increaseType: pdf.generalDiscount?.increaseType === 'percentage' ? 'percentage' : pdf.generalDiscount?.increaseType === 'fixed' ? 'fixed' : undefined,
            pricingMode: pdf.generalDiscount?.pricingMode === 'labor_only' ? 'labor_only' : 'complete',
        }, adjustmentBase)
        : null;
    const generalIncreaseAmount = calculatedAdjustments?.generalIncreaseAmount ?? (
        pdf.generalDiscount?.operation === 'increase' ? generalDiscountAmount : 0
    );
    const generalFinalDiscountAmount = calculatedAdjustments?.generalFinalDiscountAmount ?? (
        pdf.generalDiscount?.operation === 'discount' ? generalDiscountAmount : 0
    );

    // Se subtotal não estiver disponível, calcula a partir do finalTotal e ajustes
    const calculatedSubtotal = subtotal || (finalTotal - generalIncreaseAmount + generalFinalDiscountAmount + totalItemDiscount);

    // Recalcula priceAfterItemDiscounts para garantir consistência
    const priceAfterItemDiscounts = calculatedSubtotal - totalItemDiscount;

    return {
        totalM2,
        subtotal: calculatedSubtotal,
        totalItemDiscount,
        priceAfterItemDiscounts,
        generalDiscountAmount: generalFinalDiscountAmount > 0 ? generalFinalDiscountAmount : generalIncreaseAmount,
        generalIncreaseAmount,
        generalFinalDiscountAmount,
        finalTotal,
        totalQuantity: 0,
        totalLinearMeters: pdf.totalLinearMeters || 0,
        linearMeterCost: pdf.linearMeterCost || 0,
        totalMaterial: 0,
        totalLabor: 0,
        operationalExpenses: 0,
        expensesByCategory: [],
        estimatedMaterialCost: 0,
        estimatedTotalCost: 0,
        estimatedProfit: finalTotal,
        estimatedMarginPercentage: finalTotal > 0 ? 100 : 0,
        pricingMode: pdf.generalDiscount?.pricingMode === 'labor_only' ? 'labor_only' : 'complete'
    };
};

export const generatePDF = async (client: Client, userInfo: UserInfo, measurements: Measurement[], allFilms: Film[], generalDiscount: GeneralDiscount, totals: Totals, proposalOptionName: string, paymentConfig?: ProposalPaymentConfig): Promise<Blob> => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    await renderPdfContent(doc, client, userInfo, [{ measurements, generalDiscount, totals, proposalOptionName, paymentConfig }], allFilms, true);

    return doc.output('blob');
};

// Regenera o PDF de um orçamento salvo a partir dos dados persistidos no banco.
// Usado quando o arquivo original já foi removido do Storage pela limpeza de
// orçamentos vencidos: os valores e medidas são reconstruídos de forma fiel; o
// cabeçalho usa os dados atuais da empresa (logo/contato).
export const regeneratePDFFromSaved = async (client: Client, userInfo: UserInfo, pdf: SavedPDF, allFilms: Film[]): Promise<Blob> => {
    const generalDiscount: GeneralDiscount = {
        value: pdf.generalDiscount?.value ?? '',
        type: pdf.generalDiscount?.type || 'none',
        operation: pdf.generalDiscount?.operation === 'increase' ? 'increase' : 'discount',
        discountValue: pdf.generalDiscount?.discountValue,
        discountType: pdf.generalDiscount?.discountType,
        increaseValue: pdf.generalDiscount?.increaseValue,
        increaseType: pdf.generalDiscount?.increaseType,
        pricingMode: pdf.generalDiscount?.pricingMode === 'labor_only' ? 'labor_only' : 'complete',
    };

    const totals = calculateTotalsFromSavedPDF(pdf);

    return generatePDF(
        client,
        userInfo,
        pdf.measurements || [],
        allFilms,
        generalDiscount,
        totals,
        pdf.proposalOptionName || 'Opção',
        undefined
    );
};

export const generateCombinedPDF = async (client: Client, userInfo: UserInfo, savedPdfs: SavedPDF[], allFilms: Film[]): Promise<Blob> => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const optionsData = savedPdfs.map(pdf => ({
        measurements: pdf.measurements || [],
        generalDiscount: {
            value: pdf.generalDiscount?.value || '',
            type: pdf.generalDiscount?.type || 'none',
            operation: pdf.generalDiscount?.operation === 'increase' ? 'increase' : 'discount',
            discountValue: pdf.generalDiscount?.discountValue,
            discountType: pdf.generalDiscount?.discountType,
            increaseValue: pdf.generalDiscount?.increaseValue,
            increaseType: pdf.generalDiscount?.increaseType,
            pricingMode: pdf.generalDiscount?.pricingMode === 'labor_only' ? 'labor_only' : 'complete',
        } as GeneralDiscount,
        totals: calculateTotalsFromSavedPDF(pdf),
        paymentConfig: undefined as ProposalPaymentConfig | undefined,
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
    optionsData: { measurements: Measurement[], generalDiscount: GeneralDiscount, totals: Totals, proposalOptionName: string, paymentConfig?: ProposalPaymentConfig }[],
    allFilms: Film[],
    includeCover: boolean,
    isCombined: boolean = false
) => {
    try {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;

        // Usa a logo da empresa ou, enquanto não houver uma, um selo padrão
        // gerado com as iniciais da empresa nas cores da marca.
        const logoSource = userInfo.logo
            || createDefaultLogo(userInfo.empresa || userInfo.nome || 'P', userInfo.cores?.primaria || '#155eef')
            || '';

        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
        };

        // Retorna preto ou branco, o que tiver melhor contraste sobre o fundo informado.
        // Usa luminância relativa (WCAG) para garantir legibilidade independente da cor da marca.
        const getContrastingTextColor = (bg: number[]): number[] => {
            const toLinear = (v: number) => {
                const s = v / 255;
                return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
            };
            const luminance = 0.2126 * toLinear(bg[0]) + 0.7152 * toLinear(bg[1]) + 0.0722 * toLinear(bg[2]);
            return luminance > 0.4 ? [33, 37, 41] : [255, 255, 255];
        };

        const bodyText = [33, 37, 41];

        const safeText = (text: any, x: number, y: number, options = {}) => {
            if (typeof text !== 'string') text = String(text || '');
            doc.text(text, x, y, options);
        };

        const addLogo = async (x: number, y: number, maxWidth: number, maxHeight: number) => {
            if (logoSource) {
                try {
                    const img = new Image();
                    img.src = logoSource;
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

                    doc.addImage(logoSource, 'PNG', x, y, imgWidth, imgHeight);
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
            if (logoSource) {
                try {
                    const img = new Image();
                    img.src = logoSource;
                    await new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                    const logoHeight = 8;
                    const ratio = img.width / img.height;
                    const logoWidth = logoHeight * ratio;
                    doc.addImage(logoSource, 'PNG', margin, headerStartY, logoWidth, logoHeight);
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
            // Este texto fica sobre a forma da cor primária; escolhe preto/branco conforme o contraste.
            const companyTextColor = getContrastingTextColor(primaryColor);
            await addLogo(margin, margin, 68, 25.5);
            doc.setTextColor(...companyTextColor);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            safeText(userInfo.empresa, margin, margin + 30);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            safeText(userInfo.telefone, margin, margin + 35);
            safeText(userInfo.email, margin, margin + 39);


            // Date & Proposal Number (top-right)
            // Este texto fica sobre a forma da cor secundária; escolhe preto/branco conforme o contraste.
            const headerTextColor = getContrastingTextColor(secondaryColor);
            const proposalId = `ORC-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${client.id || '00'}`;
            doc.setFontSize(9);
            doc.setTextColor(...headerTextColor);
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
            doc.setFontSize(9);

            // --- SE??O DO CLIENTE REESTRUTURADA ---
            let clientYPos = yPos;
            const clientInfoLineHeight = 4.5;
            const maxClientInfoWidth = (pageWidth / 2) - margin - 10;

            // Nome do cliente (sempre exibido)
            safeText(client.nome, margin, clientYPos);
            clientYPos += clientInfoLineHeight;

            // CPF/CNPJ (se existir)
            if (client.cpfCnpj) {
                doc.setFontSize(8);
                doc.setTextColor(80, 80, 80);
                safeText(`CNPJ/CPF: ${client.cpfCnpj}`, margin, clientYPos);
                clientYPos += clientInfoLineHeight;
            }

            // Telefone (se existir)
            if (client.telefone) {
                doc.setFontSize(8);
                doc.setTextColor(80, 80, 80);
                safeText(`Tel: ${client.telefone}`, margin, clientYPos);
                clientYPos += clientInfoLineHeight;
            }

            // Email (se existir)
            if (client.email) {
                doc.setFontSize(8);
                doc.setTextColor(80, 80, 80);
                safeText(`Email: ${client.email}`, margin, clientYPos);
                clientYPos += clientInfoLineHeight;
            }

            // Endereço (formatado, com quebra de linha se necessário)
            const clientAddress = formatAddressForPdf(client);
            if (clientAddress) {
                doc.setFontSize(8);
                doc.setTextColor(80, 80, 80);
                const clientAddressLines = doc.splitTextToSize(clientAddress, maxClientInfoWidth);
                for (const line of clientAddressLines) {
                    safeText(line, margin, clientYPos);
                    clientYPos += clientInfoLineHeight;
                }
            }
            // --- FIM DA SE??O DO CLIENTE ---

            // Informações do usuário/empresa (lado direito)
            doc.setFontSize(9);
            doc.setTextColor(...textDark);
            safeText(userInfo.nome, pageWidth / 2 + 10, yPos);
            safeText(userInfo.empresa, pageWidth / 2 + 10, yPos + clientInfoLineHeight);

            // Endereço da empresa
            if (userInfo.endereco) {
                doc.setFontSize(8);
                doc.setTextColor(80, 80, 80);
                safeText(userInfo.endereco, pageWidth / 2 + 10, yPos + (clientInfoLineHeight * 2));
            }

            // --- REDES SOCIAIS - ÍCONES SIMPLES NO RODAPÉ ---
            const socialLinks = userInfo.socialLinks;
            const activeSocialLinks: { type: string; url: string; symbol: string }[] = [];

            if (socialLinks) {
                if (socialLinks.instagram) activeSocialLinks.push({ type: 'instagram', url: socialLinks.instagram, symbol: 'in' });
                if (socialLinks.facebook) activeSocialLinks.push({ type: 'facebook', url: socialLinks.facebook, symbol: 'fb' });
                if (socialLinks.youtube) activeSocialLinks.push({ type: 'youtube', url: socialLinks.youtube, symbol: 'yt' });
                if (socialLinks.tiktok) activeSocialLinks.push({ type: 'tiktok', url: socialLinks.tiktok, symbol: 'tk' });
                if (socialLinks.googleReviews) activeSocialLinks.push({ type: 'google', url: socialLinks.googleReviews, symbol: 'g' });
            }

            if (activeSocialLinks.length > 0) {
                // Posição: rodapé da capa, alinhado à direita
                const socialY = pageHeight - 10;

                // Renderizar símbolos em linha separados por |
                doc.setTextColor(...primaryColor);
                doc.setFontSize(7);
                doc.setFont("helvetica", 'normal');

                let currentX = pageWidth - margin;

                // Desenhar da direita para esquerda
                for (let i = activeSocialLinks.length - 1; i >= 0; i--) {
                    const social = activeSocialLinks[i];
                    const symbolWidth = doc.getTextWidth(social.symbol);

                    currentX -= symbolWidth;
                    doc.text(social.symbol, currentX, socialY);

                    // Criar área clicável maior para facilitar toque no celular
                    doc.link(currentX - 2, socialY - 5, symbolWidth + 4, 10, { url: social.url });

                    // Adicionar separador | (exceto antes do primeiro)
                    if (i > 0) {
                        currentX -= 3;
                        doc.setTextColor(180, 180, 180);
                        doc.text('|', currentX, socialY);
                        doc.setTextColor(...primaryColor);
                        currentX -= 3;
                    }
                }
            }
            // --- FIM REDES SOCIAIS ---

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
            const optionPricingMode = optionTotals.pricingMode === 'labor_only' ? 'labor_only' : 'complete';
            const pdfDisplay = buildPdfAdjustmentDisplay({
                measurements,
                films: allFilms,
                pricingMode: optionPricingMode,
                generalAdjustment: optionGeneralDiscount,
                totals: optionTotals
            });
            const displayLineItemsByMeasurement = new Map<Measurement, PdfDisplayLineItem>();
            pdfDisplay.lineItems.forEach(item => {
                displayLineItemsByMeasurement.set(item.measurement, item);
            });

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
                const filmMeasurements = measurementsByFilm[filmName];

                if (yPos > pageHeight - 60) await addNewPage();

                doc.setTextColor(...colors.secondary);
                doc.setFont("helvetica", 'bold');
                doc.setFontSize(12);
                safeText(`${proposalOptionName} - ${filmName}`, margin, yPos);
                yPos += 8;

                doc.setFont("helvetica", 'normal');
                doc.setFontSize(8);
                doc.setTextColor(...bodyText);
                safeText(
                    optionPricingMode === 'labor_only' ? 'Modalidade: Somente mão de obra' : 'Modalidade: Serviço completo',
                    margin,
                    yPos
                );
                yPos += 6;

                const filmGroupTotals = optionTotals.groupedTotals?.[filmName];
                const isLinearFilm = optionPricingMode !== 'labor_only'
                    && optionGeneralDiscount?.filmPricingModes?.[filmName] === 'linear';
                if (isLinearFilm && filmGroupTotals) {
                    safeText(
                        `Cobrança por metro linear: ${formatNumberBR(filmGroupTotals.totalLinearMeters)} m x R$ ${formatNumberBR(filmGroupTotals.unitSalePriceLinearMeter)}/m = R$ ${formatNumberBR(filmGroupTotals.linearSaleSubtotal)}`,
                        margin,
                        yPos
                    );
                    yPos += 6;
                }

                const head = isLinearFilm
                    ? [['Item', 'Ambiente', 'Dimensões', 'Qtd', 'M²']]
                    : [['Item', 'Ambiente', 'Dimensões', 'Qtd', 'M²', 'Preço Unit.', 'Desconto', 'Preço Final']];
                const body = filmMeasurements.map((m, i) => {
                    const displayLineItem = displayLineItemsByMeasurement.get(m);
                    const m2 = displayLineItem?.m2 ?? calculatePricingAreaM2(
                        parseFloat(String(m.largura).replace(',', '.')) || 0,
                        parseFloat(String(m.altura).replace(',', '.')) || 0,
                        parseInt(String(m.quantidade), 10) || 0
                    );
                    const basePrice = displayLineItem?.displayBasePrice ?? 0;

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
                    const finalItemPrice = displayLineItem?.displayFinalItemPrice ?? Math.max(0, basePrice - itemDiscountAmount);

                    const row = [
                        i + 1,
                        m.ambiente,
                        `${m.largura}x${m.altura}`,
                        m.quantidade,
                        formatNumberBR(m2).replace('R$', '').trim()
                    ];

                    if (!isLinearFilm) {
                        row.push(
                            `R$ ${formatNumberBR(basePrice)}`,
                            discountDisplay,
                            `R$ ${formatNumberBR(finalItemPrice)}`
                        );
                    }

                    return row;
                });

                autoTable(doc, {
                    head,
                    body,
                    startY: yPos,
                    theme: 'grid',
                    headStyles: { fillColor: colors.primary, textColor: colors.white },
                    styles: { fontSize: 8 },
                    columnStyles: isLinearFilm
                        ? {
                            0: { cellWidth: 10 },
                            3: { cellWidth: 10 },
                        }
                        : {
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
            const finalDiscountAmount = optionTotals.generalFinalDiscountAmount ?? (
                optionGeneralDiscount?.operation === 'discount' ? optionTotals.generalDiscountAmount : 0
            );
            const shouldShowGeneralAdjustment = finalDiscountAmount > 0;
            let summaryLineY = summaryYStart;

            safeText(`Subtotal:`, margin, summaryLineY);
            safeText(`R$ ${formatNumberBR(pdfDisplay.summarySubtotal)}`, summaryXAlign, summaryLineY, { align: 'right' });

            summaryLineY += 7;
            safeText(`Descontos nos Itens:`, margin, summaryLineY);
            safeText(`- R$ ${formatNumberBR(pdfDisplay.summaryItemDiscount)}`, summaryXAlign, summaryLineY, { align: 'right' });

            if (shouldShowGeneralAdjustment) {
                summaryLineY += 7;
                const isGeneralIncrease = false;
                safeText(`${isGeneralIncrease ? 'Acréscimo Geral' : 'Desconto Geral'}:`, margin, summaryLineY);
                safeText(`${isGeneralIncrease ? '+' : '-'} R$ ${formatNumberBR(optionTotals.generalDiscountAmount)}`, summaryXAlign, summaryLineY, { align: 'right' });
            }

            doc.setDrawColor(...colors.primary);
            doc.setLineWidth(0.2);
            const dividerY = summaryLineY + 4;
            doc.line(margin, dividerY, pageWidth - margin, dividerY);

            doc.setFont("helvetica", 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...colors.primary);
            const finalTotalY = dividerY + 8;
            safeText(`Valor Final da Opção:`, margin, finalTotalY);
            safeText(`R$ ${formatNumberBR(pdfDisplay.summaryFinalTotal)}`, summaryXAlign, finalTotalY, { align: 'right' });

            yPos = finalTotalY + 10;
            doc.setTextColor(...bodyText);

            // 4. Acumular totais combinados (Ainda precisamos disso para o cálculo de pagamento, mas não para o display)
            grandTotalCombined += optionTotals.finalTotal;
            totalM2Combined += optionTotals.totalM2;
            totalItemDiscountCombined += optionTotals.totalItemDiscount;
            totalGeneralDiscountCombined += finalDiscountAmount;
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
        const hasCompletePricingOption = optionsData.some(opt => opt.totals.pricingMode !== 'labor_only');
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
                if (hasCompletePricingOption) {
                    safeText(`  - Garantia Fabricante: ${film.garantiaFabricante || 'N/A'} anos`, margin, yPos);
                    yPos += 6;
                }
                safeText(`  - Garantia Mão de Obra: ${film.garantiaMaoDeObra || 'N/A'} dias`, margin, yPos);
                yPos += 8;
            }
        }

        const filmsWithTechData = hasCompletePricingOption
            ? uniqueFilmNames
                .map(filmName => allFilms.find(f => f.nome === filmName))
                .filter((film): film is Film => !!film && (
                    (typeof film.uv === 'number' && film.uv > 0) ||
                    (typeof film.ir === 'number' && film.ir > 0) ||
                    (typeof film.vtl === 'number' && film.vtl > 0) ||
                    (typeof film.tser === 'number' && film.tser > 0) ||
                    (typeof film.espessura === 'number' && film.espessura > 0) ||
                    (!!film.customFields && Object.keys(film.customFields).length > 0)
                ))
            : [];

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
                    Object.entries(film.customFields)
                        .filter(([key]) => !key.startsWith('__'))
                        .forEach(([key, value]) => {
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
        const basePaymentConfig: ProposalPaymentConfig = {
            paymentMethods: userInfo.payment_methods || [],
            prazoPagamento: userInfo.prazoPagamento || ''
        };

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

        // Função para gerar linhas de pagamento para um valor
        const generatePaymentForTotal = (total: number, paymentMethods: ProposalPaymentConfig['paymentMethods']): string[] => {
            const lines: string[] = [];
            paymentMethods?.filter(m => m.ativo).forEach(method => {
                switch (method.tipo) {
                    case 'pix':
                        lines.push(`  • Pix: R$ ${formatNumberBR(total)}`);
                        break;
                    case 'boleto':
                        lines.push(`  • Boleto Bancário: R$ ${formatNumberBR(total)}`);
                        break;
                    case 'parcelado_sem_juros':
                        const vps = calculateParceladoSemJuros(total, method.parcelas_max);
                        lines.push(`  • Parcelado s/ Juros: ${method.parcelas_max || 0}x de R$ ${formatNumberBR(vps)}`);
                        break;
                    case 'parcelado_com_juros':
                        const vpc = calculateParceladoComJuros(total, method.parcelas_max, method.juros);
                        lines.push(`  • Parcelado c/ Juros: ${method.parcelas_max || 0}x de R$ ${formatNumberBR(vpc)} (Taxa de ${method.juros || 0}%)`);
                        break;
                    case 'adiantamento':
                        const va = calculateAdiantamento(total, method.porcentagem);
                        lines.push(`  • Adiantamento (${method.porcentagem}%): R$ ${formatNumberBR(va)}`);
                        break;
                }
            });
            return lines;
        };

        const paymentLines: string[] = [];

        if (isCombined && optionsData.length > 1) {
            // PDF Combinado: mostrar formas de pagamento para cada opção
            optionsData.forEach((opt, idx) => {
                const optionPaymentConfig = opt.paymentConfig || basePaymentConfig;
                if (idx > 0) paymentLines.push('');
                paymentLines.push(`Opção: ${opt.proposalOptionName}`);
                paymentLines.push(`Valor Total: R$ ${formatNumberBR(opt.totals.finalTotal)}`);
                paymentLines.push(...generatePaymentForTotal(opt.totals.finalTotal, optionPaymentConfig.paymentMethods));
            });
            // Chave Pix uma vez no final
            const combinedPaymentConfig = optionsData[0]?.paymentConfig || basePaymentConfig;
            const pix = combinedPaymentConfig.paymentMethods?.find(m => m.ativo && m.tipo === 'pix');
            if (pix) {
                paymentLines.push('');
                if (pix.chave_pix) {
                    let tipo = '';
                    if (pix.tipo_chave_pix === 'cpf') tipo = 'CPF';
                    else if (pix.tipo_chave_pix === 'cnpj') tipo = 'CNPJ';
                    else if (pix.tipo_chave_pix === 'telefone') tipo = 'Telefone';
                    else if (pix.tipo_chave_pix === 'email') tipo = 'Email';
                    else if (pix.tipo_chave_pix === 'aleatoria') tipo = 'Chave Aleatória';
                    paymentLines.push(`Chave Pix: ${pix.chave_pix}${tipo ? ` (${tipo})` : ''}`);
                }
                if (pix.nome_responsavel_pix) paymentLines.push(`Nome: ${pix.nome_responsavel_pix}`);
            }
            const obs = combinedPaymentConfig.paymentMethods?.find(m => m.ativo && m.tipo === 'observacao');
            if (obs?.texto) paymentLines.push(`• Observação: ${obs.texto}`);
        } else {
            // PDF único
            const finalTotalForPayment = optionsData[0].totals.finalTotal;
            const singlePaymentConfig = optionsData[0].paymentConfig || basePaymentConfig;
            singlePaymentConfig.paymentMethods?.filter(m => m.ativo).forEach(method => {
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
                        if (method.nome_responsavel_pix) paymentLines.push(`  Nome: ${method.nome_responsavel_pix}`);
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
                        if (method.texto) paymentLines.push(`• Observação: ${method.texto}`);
                        break;
                }
            });
        }

        const validityDays = clampValidityDays(userInfo.proposalValidityDays);
        const conditions: string[] = [];
        const resolvedPrazoPagamento = (optionsData[0]?.paymentConfig || basePaymentConfig).prazoPagamento;
        if (resolvedPrazoPagamento) {
            conditions.push(`Prazo de Pagamento: ${resolvedPrazoPagamento}`);
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
