import { jsPDF } from 'jspdf';
import { formatReceiptCurrency, formatReceiptDate, ReceiptDetails, receiptFileName } from '../src/lib/receipt';

const isHexColor = (value?: string): value is string => Boolean(value && /^#[0-9a-f]{6}$/i.test(value));

const imageFormat = (source: string): 'PNG' | 'JPEG' =>
    /^data:image\/jpe?g/i.test(source) ? 'JPEG' : 'PNG';

const addOptionalImage = (doc: jsPDF, source: string | undefined, x: number, y: number, width: number, height: number): boolean => {
    if (!source) return false;
    try {
        doc.addImage(source, imageFormat(source), x, y, width, height, undefined, 'FAST');
        return true;
    } catch {
        return false;
    }
};

const addWrappedText = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight = 6,
): number => {
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
};

export const generateReceiptPdf = async (details: ReceiptDetails): Promise<Blob> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    const brandColor = isHexColor(details.company.primaryColor) ? details.company.primaryColor : '#2563eb';

    doc.setFillColor(brandColor);
    doc.rect(0, 0, pageWidth, 8, 'F');

    const hasLogo = addOptionalImage(doc, details.company.logo, margin, 17, 24, 24);
    const companyX = hasLogo ? margin + 30 : margin;
    doc.setTextColor('#0f172a');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(details.company.name, companyX, 23);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor('#475569');
    const companyLines = [
        details.company.document ? `CPF/CNPJ: ${details.company.document}` : '',
        details.company.address || '',
        [details.company.phone, details.company.email].filter(Boolean).join(' • '),
    ].filter(Boolean);
    doc.text(companyLines, companyX, 29, { lineHeightFactor: 1.35 });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#0f172a');
    doc.setFontSize(23);
    doc.text('RECIBO', pageWidth - margin, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor('#64748b');
    doc.text(details.receiptNumber, pageWidth - margin, 28, { align: 'right' });

    doc.setDrawColor('#dbe4f0');
    doc.line(margin, 48, pageWidth - margin, 48);

    doc.setFillColor('#eff6ff');
    doc.roundedRect(margin, 57, contentWidth, 30, 4, 4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#475569');
    doc.setFontSize(9);
    doc.text('VALOR RECEBIDO', margin + 8, 67);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandColor);
    doc.setFontSize(23);
    doc.text(formatReceiptCurrency(details.amount), margin + 8, 80);

    let y = 103;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor('#1e293b');
    const statement = `Recebemos de ${details.client.name}${details.client.document ? `, CPF/CNPJ ${details.client.document}` : ''}, a importância de ${details.amountInWords}, referente a ${details.description}.`;
    y = addWrappedText(doc, statement, margin, y, contentWidth, 7) + 5;

    const addInfoRow = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor('#64748b');
        doc.text(label.toUpperCase(), margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor('#0f172a');
        y = addWrappedText(doc, value, margin, y + 5, contentWidth, 6) + 5;
    };

    addInfoRow('Data do serviço', formatReceiptDate(details.serviceDate));
    if (details.paymentMethod) addInfoRow('Forma de pagamento', details.paymentMethod);
    if (details.client.address) addInfoRow('Endereço do cliente', details.client.address);

    const signatureTop = Math.max(y + 10, 190);
    const signatureAdded = addOptionalImage(doc, details.company.signature, margin, signatureTop, 45, 20);
    const lineY = signatureAdded ? signatureTop + 22 : signatureTop + 12;
    doc.setDrawColor('#94a3b8');
    doc.line(margin, lineY, margin + 78, lineY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor('#0f172a');
    doc.text(details.company.responsible || details.company.name, margin, lineY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor('#64748b');
    doc.text(details.company.name, margin, lineY + 11);

    const issueDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(details.issuedAt));
    doc.setFontSize(9);
    doc.text(`Emitido em ${issueDate}`, pageWidth - margin, lineY + 6, { align: 'right' });

    doc.setFillColor('#f8fafc');
    doc.roundedRect(margin, 258, contentWidth, 18, 3, 3, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor('#64748b');
    const note = 'Este recibo comprova o pagamento do serviço descrito. Não substitui nota fiscal quando sua emissão for exigida pela legislação aplicável.';
    doc.text(doc.splitTextToSize(note, contentWidth - 12), margin + 6, 266, { lineHeightFactor: 1.35 });

    return doc.output('blob');
};

export const downloadReceiptPdf = async (details: ReceiptDetails): Promise<void> => {
    const blob = await generateReceiptPdf(details);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = receiptFileName(details);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const shareReceiptPdf = async (details: ReceiptDetails): Promise<'shared' | 'downloaded'> => {
    const blob = await generateReceiptPdf(details);
    const file = new File([blob], receiptFileName(details), { type: 'application/pdf' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
            title: `Recibo ${details.company.name}`,
            text: `Olá, ${details.client.name}. Segue o recibo do serviço realizado.`,
            files: [file],
        });
        return 'shared';
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = receiptFileName(details);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return 'downloaded';
};
