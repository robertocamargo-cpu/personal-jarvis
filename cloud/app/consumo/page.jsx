import { redirect } from "next/navigation";
import { chatSession } from "../../lib/chat/server";
import { ChatError } from "../../lib/chat/policy.mjs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consumo e custos — Jarvis Bob" };
const integer = value => new Intl.NumberFormat("pt-BR").format(value);
const money = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(value);
const date = value => value.split("-").reverse().join("/");

export default async function UsagePage() {
  let usage, budget;
  try {
    const { owner, store } = await chatSession();
    [usage, budget] = await Promise.all([store.usage(owner), store.budget(owner)]);
  } catch (error) {
    if (error instanceof ChatError && error.status === 401) redirect("/entrar");
    console.error("Cloud usage view unavailable", error instanceof ChatError ? error.code : "storage");
    return <><h1>Consumo indisponível</h1><p>Não foi possível consultar os dados desta conta. Tente novamente em alguns instantes.</p><a href="/conta">Voltar à conta</a></>;
  }
  const { days, totals } = usage;
  const activeDays = days.filter(day => day.completed + day.failed + day.pending > 0);
  return <section>
    <p className="eyebrow">Sua conta · Chat na nuvem</p>
    <h1>Consumo e custos</h1>
    <p className="intro">Acompanhe o uso das suas conversas por texto. Período de {date(days.at(-1).day)} a {date(days[0].day)}, no horário de Brasília.</p>
    <div className="usage-actions"><a className="button" href="/chat">Conversar</a><a className="button secondary" href="/consumo">Atualizar dados</a><a href="/conta">Minha conta</a></div>
    <div className="grid usage-summary">
      <article><h2>Estimativa em 30 dias</h2><p className="usage-value">{money(totals.estimated_usd)}</p><p>Somente respostas concluídas com consumo registrado. Não é o total da sua fatura.</p></article>
      <article><h2>Cota de hoje</h2><p className="usage-value">{budget.used} de {budget.limit} envios</p><progress aria-label="Envios usados hoje" value={budget.used} max={budget.limit} /><p>Renova à meia-noite de Brasília. Tentativas interrompidas também usam a cota.</p></article>
      <article><h2>Tokens registrados</h2><p><strong>{integer(totals.input)}</strong> de entrada</p><p><strong>{integer(totals.output)}</strong> de saída</p><p>A entrada inclui as instruções e o contexto recente da conversa.</p></article>
      <article><h2>Respostas no período</h2><p><strong>{integer(totals.completed)}</strong> concluídas</p><p><strong>{integer(totals.failed)}</strong> interrompidas ou com falha</p><p><strong>{integer(totals.pending)}</strong> em andamento</p></article>
    </div>
    {totals.failed > 0 && <p className="usage-warning" role="note">Há {integer(totals.failed)} tentativa(s) sem resposta concluída. O Google pode ter cobrado essas chamadas sem retornar o consumo; elas não entram na estimativa acima.</p>}
    <h2>Uso por dia</h2>
    {!activeDays.length ? <p>Nenhum envio registrado nos últimos 30 dias.</p> : <div className="usage-table" role="region" aria-label="Uso diário, role para os lados para ver todas as colunas" tabIndex={0}>
      <table><caption>Somente dias com atividade · valores estimados em dólar</caption><thead><tr><th scope="col">Dia</th><th scope="col">Concluídas</th><th scope="col">Falhas</th><th scope="col">Em andamento</th><th scope="col">Entrada</th><th scope="col">Saída</th><th scope="col">Estimativa</th></tr></thead>
        <tbody>{activeDays.map(day => <tr key={day.day}><th scope="row">{date(day.day)}</th><td>{integer(day.completed)}</td><td>{integer(day.failed)}</td><td>{integer(day.pending)}</td><td>{integer(day.input)}</td><td>{integer(day.output)}</td><td>{money(day.estimated_usd)}</td></tr>)}</tbody>
      </table>
    </div>}
    <p className="muted">Estes dados cobrem apenas o chat por texto deste site. Não incluem voz, uso local do Mac, outras aplicações, impostos ou hospedagem. A cobrança oficial deve ser conferida na sua conta do Google.</p>
  </section>;
}
