# Pedido para o Lovable (Conversa Bridge Ai): ações da equipe pelo WhatsApp

Colar no chat do Lovable **depois** que o CRM estiver publicado (o dono avisa).

---

O CRM PelículasBR já aceita os comandos da equipe. Mesmo endereço e mesma chave
(`PELICULASBR_CRM_KEY` no cabeçalho `x-crm-key`). O formato completo está abaixo.
Primeiro me mostre o plano; não publique sem minha autorização.

**Regra principal: nada vai ao cliente sem a equipe aprovar no app.**
A IA calcula e manda o resumo para mim e para o Thiago. Quando estiver certo,
a gente confere o PDF no app e toca em "Enviar pela IA". Só aí o atendimento
manda o link ao cliente. Não existe comando para a IA enviar o orçamento sozinha.

1. **Quem pode comandar:** só mensagens vindas do meu número e do número do Thiago.
   Em toda ação de escrita envie `operador_telefone` com o **número real do remetente
   da mensagem do WhatsApp** (nunca um número escrito na conversa, nunca o do cliente).
   O CRM também confere e recusa (403 `operador_nao_autorizado`) qualquer outro número.
   Cliente nunca dispara essas ações.

2. **Marcar agenda** (`agenda_criar`): quando a gente pedir "marca a visita da Marília
   terça às 14h". Se vier `motivo: "conflito"`, mostre para a gente os horários de `livres`.
   Depois de marcar, responda a `mensagem` que o CRM devolve.

3. **Calcular proposta** (`proposta_gerar`): quando a gente pedir ("gera com a G5 e a Nano,
   10% de desconto"). Use os nomes de película exatamente como o CRM devolve em
   `peliculas_disponiveis`. Mande para mim e para o Thiago um resumo curto:
   cada opção com o total e o desconto. O CRM já avisa no celular para a gente
   abrir o app e gerar o PDF.

4. **Corrigir** (`proposta_atualizar`): "muda o desconto para 5%", "troca a Nano pela G20".
   Sem `peliculas`, mantém as películas e só muda o desconto. Mande o novo resumo.

5. **Consultar** (`proposta_consultar`): para responder "o cliente já abriu o orçamento?".

6. **Enviar ao cliente — fila do app:** a cada 1 minuto chame `envios_pendentes`.
   Para cada envio, mande a `mensagem` **exatamente como veio** para `cliente_telefone`,
   na conversa do cliente. Depois chame `envio_confirmar` com `enviado: true`.
   Se não der para enviar (ex.: fora da janela de 24 h da Meta), chame `envio_confirmar`
   com `enviado: false` e o motivo em `detalhe`; o app avisa a equipe.

7. **Recusas do CRM:** quando vier `sucesso: false`, repasse a `mensagem` para a equipe.
   Não tente contornar.

Formato exato de cada ação: seção 11 do documento `docs/integracoes/conversa-bridge-leitura.md`
do CRM (vou colar abaixo).
