# Corrigir cancelamento da assinatura

## Alterações
- Ligar o botão atual a uma confirmação clara de cancelamento.
- Cancelar a assinatura recorrente no Asaas para impedir novas renovações.
- Manter o plano e os recursos disponíveis até a data final do período já pago.
- Mostrar na assinatura que a renovação foi cancelada e até quando o acesso continua.
- Registrar a entrega no changelog.

## Detalhes técnicos
- Criar uma função protegida que valide o dono da empresa ou administrador antes de cancelar no Asaas.
- Atualizar a assinatura local como cancelada somente após a confirmação do Asaas, preservando `next_due_date`.
- Ajustar as verificações de acesso e módulos para aceitar uma assinatura cancelada enquanto o período pago ainda estiver vigente.
- Gerar e aplicar migration no ambiente de desenvolvimento e entregar SQL idempotente para produção.
- Validar o fluxo e os estados de carregamento/erro.
