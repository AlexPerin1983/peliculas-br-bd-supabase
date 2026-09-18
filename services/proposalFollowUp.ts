import type { Client, SavedPDF } from '../types';
import { supabase } from './supabaseClient';
import { getAllCustomFilms, getUserInfo, mapRowToPDF, uploadPdfToStorage } from './supabaseDb';
import { offlineDb } from './offlineDb';
import { resolvePersistedProposalPdfIds } from '../src/lib/proposalPortal';
import { previewProposalFollowUp } from '../src/lib/proposalFollowUp';
import type { FollowUpDiscountType } from '../src/lib/proposalMessages';

export const applyProposalFollowUp = async (
    pdf: SavedPDF, client: Client, raw: string, type: FollowUpDiscountType
): Promise<SavedPDF> => {
    if (pdf.id == null) throw new Error('Salve a proposta antes de aplicar o desconto.');
    const [id] = await resolvePersistedProposalPdfIds([pdf.id]);
    const { data: snapshot, error } = await supabase.from('saved_pdfs').select('*').eq('id', id).single();
    if (error) throw error;
    const current = await mapRowToPDF(snapshot);
    if (current.totalPreco !== pdf.totalPreco || current.followUpRevision !== (pdf.followUpRevision || 0)) {
        throw new Error('A proposta mudou em outro aparelho. Reabra a proposta e confira o novo valor.');
    }
    const next = previewProposalFollowUp(current, raw, type);
    const [{ regeneratePDFFromSaved }, userInfo, films] = await Promise.all([
        import('./pdfGenerator'), getUserInfo(), getAllCustomFilms(),
    ]);
    const blob = await regeneratePDFFromSaved(client, userInfo, next, films);
    const path = await uploadPdfToStorage(blob);
    // Do not remove this upload on an ambiguous network failure: the transaction
    // may already have committed and made it the proposal's current PDF.
    const { data, error: applyError } = await supabase.rpc('apply_proposal_follow_up', {
        p_pdf_id: id,
        p_discount: type === 'fixed' ? next.followUpDiscountAmount : next.followUpDiscountPercent,
        p_type: type,
        p_expected_snapshot: snapshot,
        p_pdf_path: path,
    });
    if (applyError) throw applyError;
    const saved = { ...await mapRowToPDF(data), pdfBlob: blob };
    try {
        const local = await offlineDb.savedPdfs.filter(row => row.id === pdf.id || row._remoteId === id).first();
        if (local?._syncStatus !== 'pending' && local?._syncStatus !== 'error') {
            await offlineDb.savedPdfs.put({ ...saved, _localId: local?._localId || `remote_pdf_${id}`,
                _remoteId: id, _syncStatus: 'synced', _lastModified: Date.now(), _syncedAt: Date.now() });
        }
    } catch (cacheError) {
        console.warn('[Follow-up] Desconto salvo; cache local indisponível.', cacheError);
    }
    window.dispatchEvent(new CustomEvent('proposal-price-updated', { detail: { pdf: saved, previousId: pdf.id } }));
    return saved;
};
