import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});

const cleanText = (value: unknown, max = 2000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Servico indisponivel.' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const url = new URL(request.url);
    const payload = request.method === 'POST' ? await request.json() : {};
    const token = cleanText(url.searchParams.get('token') || payload.token, 96);
    if (!token) return json({ error: 'Link de proposta invalido.' }, 400);

    const { data: portal, error: portalError } = await admin
      .from('proposal_portals')
      .select('id, token, organization_id, client_id, expires_at, status, decision_pdf_id, decision_at, view_count, created_at')
      .eq('token', token)
      .maybeSingle();

    if (portalError || !portal || portal.status === 'revoked') {
      return json({ error: 'Esta proposta nao esta mais disponivel.' }, 404);
    }

    const isExpired = new Date(portal.expires_at).getTime() <= Date.now();
    const action = cleanText(payload.action, 32);

    if (request.method === 'GET' || action === 'load') {
      const [{ data: client }, { data: organization }, { data: items }, { data: messages }] = await Promise.all([
        admin.from('clients').select('nome').eq('id', portal.client_id).maybeSingle(),
        admin.from('organizations').select('name, owner_id').eq('id', portal.organization_id).maybeSingle(),
        admin.from('proposal_portal_items')
          .select('position, saved_pdf_id, saved_pdfs(id, proposal_option_name, nome_arquivo, total_preco, total_m2, date, expiration_date, status)')
          .eq('portal_id', portal.id)
          .order('position'),
        admin.from('proposal_portal_messages')
          .select('id, saved_pdf_id, sender_type, kind, body, offer_type, offer_value, created_at')
          .eq('portal_id', portal.id)
          .order('created_at'),
      ]);

      let company: Record<string, unknown> = { name: organization?.name || 'Empresa' };
      if (organization?.owner_id) {
        const { data: info } = await admin
          .from('user_info')
          .select('empresa, telefone, email, logo, cores')
          .eq('user_id', organization.owner_id)
          .maybeSingle();
        if (info) company = {
          name: info.empresa || organization.name || 'Empresa',
          phone: info.telefone,
          email: info.email,
          logo: info.logo,
          colors: info.cores,
        };
      }

      const now = new Date().toISOString();
      const portalUpdate: Record<string, unknown> = {
        status: isExpired && portal.status === 'active' ? 'expired' : portal.status,
        updated_at: now,
      };
      if (request.method === 'GET' || payload.trackView === true) {
        portalUpdate.view_count = (portal.view_count || 0) + 1;
        portalUpdate.last_viewed_at = now;
        if (!portal.view_count) portalUpdate.first_viewed_at = now;
      }
      await admin.from('proposal_portals').update(portalUpdate).eq('id', portal.id);

      return json({
        portal: { ...portal, expired: isExpired, status: isExpired && portal.status === 'active' ? 'expired' : portal.status },
        clientName: client?.nome || 'Cliente',
        company,
        proposals: (items || []).map((item: any) => item.saved_pdfs).filter(Boolean).map((pdf: any) => ({
          id: pdf.id,
          proposalOptionName: pdf.proposal_option_name,
          nomeArquivo: pdf.nome_arquivo,
          totalPreco: Number(pdf.total_preco || 0),
          totalM2: Number(pdf.total_m2 || 0),
          date: pdf.date,
          expirationDate: pdf.expiration_date,
          status: pdf.status,
        })),
        messages: messages || [],
      });
    }

    if (isExpired) return json({ error: 'O prazo desta proposta encerrou.' }, 410);

    if (action === 'download') {
      const proposalId = Number(payload.proposalId);
      const { data: item } = await admin.from('proposal_portal_items')
        .select('saved_pdf_id, saved_pdfs(pdf_path, nome_arquivo)')
        .eq('portal_id', portal.id)
        .eq('saved_pdf_id', proposalId)
        .maybeSingle();
      const pdf = (item as any)?.saved_pdfs;
      if (!pdf?.pdf_path) return json({ error: 'PDF indisponivel para download.' }, 404);
      const { data: signed, error: signedError } = await admin.storage.from('pdfs').createSignedUrl(pdf.pdf_path, 90, {
        download: pdf.nome_arquivo || 'proposta.pdf',
      });
      if (signedError || !signed?.signedUrl) return json({ error: 'Nao foi possivel preparar o PDF.' }, 500);
      return json({ url: signed.signedUrl });
    }

    if (action === 'message') {
      const body = cleanText(payload.body);
      if (!body) return json({ error: 'Escreva uma mensagem.' }, 400);
      const { error } = await admin.from('proposal_portal_messages').insert({
        portal_id: portal.id,
        sender_type: 'client',
        kind: 'message',
        body,
      });
      if (error) throw error;
      await admin.from('proposal_portals').update({ last_activity_at: new Date().toISOString() }).eq('id', portal.id);
      return json({ ok: true });
    }

    if (action === 'respond') {
      const proposalId = Number(payload.proposalId);
      const kind = cleanText(payload.kind, 24);
      if (!['approved', 'rejected', 'negotiation'].includes(kind)) return json({ error: 'Resposta invalida.' }, 400);

      const { data: item } = await admin.from('proposal_portal_items')
        .select('saved_pdf_id')
        .eq('portal_id', portal.id)
        .eq('saved_pdf_id', proposalId)
        .maybeSingle();
      if (!item) return json({ error: 'Proposta nao encontrada neste link.' }, 404);

      const offerType = kind === 'negotiation' && ['percentage', 'fixed'].includes(payload.offerType)
        ? payload.offerType : null;
      const offerValue = offerType ? Number(payload.offerValue) : null;
      if (offerType && (!Number.isFinite(offerValue) || offerValue < 0)) {
        return json({ error: 'Informe um valor de negociacao valido.' }, 400);
      }

      const body = cleanText(payload.body);
      if (kind === 'rejected' && !body) return json({ error: 'Conte o motivo da recusa.' }, 400);

      const now = new Date().toISOString();
      const nextStatus = kind === 'approved' ? 'approved' : kind === 'rejected' ? 'rejected' : 'negotiating';
      const { error: messageError } = await admin.from('proposal_portal_messages').insert({
        portal_id: portal.id,
        saved_pdf_id: proposalId,
        sender_type: 'client',
        kind,
        body: body || null,
        offer_type: offerType,
        offer_value: offerValue,
      });
      if (messageError) throw messageError;

      await Promise.all([
        admin.from('proposal_portals').update({
          status: nextStatus,
          decision_pdf_id: proposalId,
          decision_at: now,
          last_activity_at: now,
          updated_at: now,
        }).eq('id', portal.id),
        admin.from('saved_pdfs').update({ status: kind === 'approved' ? 'approved' : 'revised' }).eq('id', proposalId),
      ]);
      return json({ ok: true, status: nextStatus });
    }

    return json({ error: 'Acao desconhecida.' }, 400);
  } catch (error) {
    console.error('[proposal-portal]', error);
    return json({ error: 'Nao foi possivel concluir agora. Tente novamente.' }, 500);
  }
});
