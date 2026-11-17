import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [
    { title: "Privacidade e cookies — Mestre 360" },
    { name: "description", content: "Como o Mestre 360 utiliza dados de acesso e publicidade, com controle de consentimento." },
    { property: "og:title", content: "Privacidade e cookies — Mestre 360" },
    { property: "og:description", content: "Dados de acesso, publicidade e suas escolhas de privacidade." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PrivacyPage,
});
function PrivacyPage() {
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-12 pb-24 text-foreground">
    <Link to="/login" className="text-primary underline">Voltar ao acesso</Link>
    <h1 className="text-3xl font-bold">Privacidade e cookies</h1>
    <p>Aviso de medição atualizado em 17 de novembro de 2026.</p>
    <h2 className="text-xl font-semibold">Conta e serviços</h2>
    <p>O Mestre 360 utiliza os dados de cadastro para autenticação e operação da plataforma. Os dados de obras, documentos, senhas, CPF/CNPJ e informações financeiras não são incluídos no evento de cadastro enviado por esta integração de publicidade.</p>
    <h2 className="text-xl font-semibold">Publicidade — Meta</h2>
    <p>O Pixel da Meta registra a criação bem-sucedida de uma nova conta (CompleteRegistration), para medir resultados e otimizar anúncios no Facebook e Instagram. A Meta pode receber endereço da página, informações do navegador, endereço IP e identificadores de cookies de publicidade. Não enviamos nome, e-mail ou telefone como dados de correspondência. Esta integração não envia visualizações de páginas internas.</p>
    <p>Na União Europeia/EEE, Reino Unido, Suíça e Canadá, e quando não conseguimos identificar a região, o Pixel só é carregado após aceitar publicidade. Fora dessas regiões, pode ser carregado por padrão, salvo recusa ou sinal Global Privacy Control. No servidor próprio, a região pode não ser identificada e o aviso aparecer para todos.</p>
    <p>Você pode recusar ou retirar a autorização a qualquer momento em “Privacidade e cookies”. A recusa bloqueia novos envios e não apaga dados já recebidos pela Meta. As escolhas ficam registradas no navegador com data e versão deste aviso; aceites duram até 12 meses e recusas até 183 dias antes de nova solicitação. Cadastros bloqueados não são reenviados após aceite posterior. Saiba mais na <a href="https://www.facebook.com/privacy/policy/" className="text-primary underline">política de privacidade da Meta</a>.</p>
    <h2 className="text-xl font-semibold">Análise de visitas</h2>
    <p>A medição de visitas não utiliza cookies, não armazena nada no dispositivo, não conserva endereços IP e não identifica visitantes. Registra páginas visitadas, origem das visitas, país, navegador, sistema operacional, dispositivo, tempo de permanência, velocidade e erros. Os cliques são medidos nas regiões acima após aceitar análise; fora delas, salvo recusa. Global Privacy Control bloqueia cliques independentemente da escolha.</p>
    <p>Visitas, tempo de permanência, velocidade e erros continuam sendo registrados para todos, sem cookies e sem identificar visitantes. Dados detalhados são mantidos por 90 dias e resumos diários por um ano. Esses dados são coletados pelo provedor de hospedagem do sistema, sob nossa responsabilidade, e usados apenas para entender o uso da plataforma. Essa medição está ligada à hospedagem atual; a instalação em servidor próprio pode não incluir esse serviço.</p>
  </main>;
}