import type { ReactNode } from 'react'

const img = (name: string) => `${import.meta.env.BASE_URL}manual/${name}.webp`

function Shot({ name, alt, caption }: { name: string; alt: string; caption: ReactNode }) {
  return (
    <figure className="man-shot">
      <img src={img(name)} alt={alt} loading="lazy" width={390} />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

const SECTIONS: Array<{ id: string; title: string; body: ReactNode }> = [
  {
    id: 'comece', title: '1. Comece aqui', body: <>
      <p>O Provisão organiza o dinheiro da família: o que entra, o que sai, as faturas e as metas. Os dados ficam no <b>Google Drive de quem entra</b>.</p>
      <ol>
        <li>Abra o app no <b>Chrome</b> (Android ou computador) ou no <b>Safari</b> (iPhone).</li>
        <li>Toque em <b>Entrar com Google</b> e use o e-mail e a senha da sua conta Google.</li>
        <li>Aceite o acesso ao Drive. O app só mexe na pasta que ele mesmo cria, <b>Finanças da Família</b>.</li>
      </ol>
      <Shot name="01-entrar" alt="Tela de entrada com o botão Entrar com Google destacado" caption={<>① Entrar com Google: o mesmo login conecta o app ao Google Drive da conta.</>} />
      <h4>Instalar como aplicativo</h4>
      <ul>
        <li><b>Android:</b> na tela de entrada, <b>Instalar o app neste aparelho</b>, ou no Chrome ⋮ → <b>Instalar app</b>.</li>
        <li><b>iPhone:</b> no Safari, <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>.</li>
        <li><b>Computador:</b> no Chrome ou no Edge, o ícone de instalar no fim da barra de endereço.</li>
      </ul>
      <p className="muted">Se o link abrir dentro do WhatsApp, do Instagram ou do Facebook, toque nos três pontinhos e escolha <b>Abrir no navegador</b>.</p>
    </>,
  },
  {
    id: 'primeiros', title: '2. Primeiros passos', body: <>
      <ol>
        <li><b>Diga quem é você</b> logo depois do login. O que for lançado neste aparelho fica no seu nome.</li>
        <li><b>Nomes dos perfis:</b> em <b>Mais → Ajustes</b>, troque “Usuário 1” e “Usuário 2” e toque em <b>Salvar nomes</b>.</li>
        <li><b>Contas:</b> <b>Mais → Contas → Nova conta</b>, com o saldo inicial.</li>
        <li><b>Cartões:</b> aba <b>Cartões → Novo cartão</b>, com limite, dia de fechamento e de vencimento.</li>
      </ol>
      <Shot name="03-mais" alt="Tela Mais com os itens destacados" caption={<>Aba Mais: ① Planejamento e metas · ② Contas · ③ Importar extrato · ④ Ajustes.</>} />
      <Shot name="10-ajustes" alt="Tela Ajustes com Nomes dos perfis destacado" caption={<>Mais → Ajustes: ① Nomes dos perfis.</>} />
      <p className="muted">O segundo celular entra com a <b>mesma conta Google</b>: os dois veem e lançam no mesmo arquivo.</p>
    </>,
  },
  {
    id: 'lancar', title: '3. Lançar gastos e receitas', body: <>
      <p>Tudo começa no botão <b>+</b> no centro da barra de baixo (no computador, <b>Novo lançamento</b> no menu lateral).</p>
      <Shot name="02-barra" alt="Barra de baixo com o botão + e as abas" caption={<>① O botão + abre um novo lançamento de qualquer tela.</>} />
      <ol>
        <li>Escolha <b>Despesa</b>, <b>Receita</b> ou <b>Investimento</b>.</li>
        <li>Digite o <b>valor</b> e confira a <b>data</b>.</li>
        <li>Escolha a <b>Categoria</b> e, se quiser, o <b>Item</b>.</li>
        <li>Em <b>Onde</b>, escolha a conta ou o cartão.</li>
        <li>Marque <b>Já está pago</b> se já saiu do bolso. Sem marcar, fica <b>Previsto</b> e vira <b>Atrasado</b> depois do vencimento.</li>
        <li>Toque em <b>Salvar</b>.</li>
      </ol>
      <Shot name="04-form" alt="Formulário Novo lançamento" caption={<>① Tipo · ② Valor · ③ Categoria.</>} />
      <h4>Opções do formulário</h4>
      <ul>
        <li><b>Repetir todo mês:</b> contas fixas (aluguel, escola, dízimo). Em <b>Por quantos meses</b>, até quando.</li>
        <li><b>Parcelas:</b> aparece ao escolher um cartão; cada parcela cai na fatura certa.</li>
        <li><b>Necessidade / Desejo:</b> classifica o gasto no método 50/30/20.</li>
        <li><b>Meta (opcional):</b> faz o valor contar no progresso de uma meta.</li>
        <li><b>Anexar comprovante:</b> guarda a foto ou o PDF no seu Drive.</li>
      </ul>
      <h4>Editar, pagar e excluir</h4>
      <ul>
        <li>Toque no lançamento para editar. Para excluir, abra e toque em <b>Excluir</b>; se foi sem querer, <b>Desfazer</b>.</li>
        <li>Na aba <b>Lançamentos</b>, os previstos têm o botão <b>Marcar como pago</b>.</li>
      </ul>
      <Shot name="05-pagar" alt="Lista de lançamentos com Marcar como pago destacado" caption={<>Marcar como pago, direto na lista.</>} />
    </>,
  },
  {
    id: 'cartoes', title: '4. Cartões e faturas', body: <>
      <ol>
        <li>Na aba <b>Cartões</b>, cada cartão mostra a fatura, o vencimento e o limite disponível.</li>
        <li><b>Lançar compras</b> registra as compras da fatura em sequência.</li>
        <li>Ao pagar o banco, <b>Pagar fatura</b> e escolha a conta de onde saiu o dinheiro.</li>
      </ol>
      <Shot name="06-cartoes" alt="Aba Cartões com botões destacados" caption={<>① Lançar compras · ② Pagar fatura · ③ Novo cartão.</>} />
      <p className="muted">Cada compra conta como gasto no mês da compra. O pagamento da fatura não é contado de novo.</p>
    </>,
  },
  {
    id: 'painel', title: '5. Painel e Resumo', body: <>
      <p><b>Painel:</b> o ano de uma vez, avisos de contas atrasadas, próximos vencimentos, gráfico mês a mês e o cartão de Metas.</p>
      <p><b>Resumo:</b> escolha <b>Dia, Semana, Mês, Trimestre, Semestre, Ano</b> ou <b>Personalizado</b> e ande com as setas ‹ ›. Para guardar ou enviar, <b>Baixar .csv</b> ou <b>Imprimir / PDF</b>.</p>
      <Shot name="07-resumo" alt="Aba Resumo com períodos e exportação destacados" caption={<>① Período · ② Baixar .csv e Imprimir / PDF.</>} />
    </>,
  },
  {
    id: 'plano', title: '6. Planejamento e metas', body: <>
      <p>Em <b>Mais → Planejamento e metas</b>, a renda é dividida em 5 áreas: <b>Generosidade</b> (Dízimos, Ofertas, Doações), <b>Necessidades</b>, <b>Desejos</b> (Física, Mental, Família, Financeira, Social), <b>Poupanças</b> e <b>Investimentos</b>.</p>
      <ol>
        <li><b>Ajustar %</b> define quanto da renda vai para cada área (a soma precisa dar 100%).</li>
        <li><b>Nova meta</b> (ou <b>+ Meta</b> dentro da área): nome, área, data-limite e, se quiser, valor.</li>
        <li>O prazo se ajusta pela data: <b>curto</b> até 1 ano, <b>médio</b> de 1 a 5, <b>longo</b> acima de 5.</li>
        <li>Meta com valor mostra a barra de progresso. Meta sem valor se marca como concluída no círculo.</li>
      </ol>
      <Shot name="08-plano" alt="Divisão da renda com Ajustar % destacado" caption={<>① Ajustar %.</>} />
      <Shot name="09-metas" alt="Metas com Nova meta e + Meta destacados" caption={<>① Nova meta · ② + Meta dentro da área.</>} />
      <p className="muted">Para um lançamento contar na meta, escolha-a em <b>Meta (opcional)</b> no formulário.</p>
    </>,
  },
  {
    id: 'importar', title: '7. Importar extrato do banco', body: <>
      <ol>
        <li>No banco, exporte o extrato ou a fatura em <b>OFX</b> ou <b>CSV</b>.</li>
        <li>Abra <b>Mais → Importar extrato</b>, escolha o arquivo, <b>Para onde</b> e <b>De quem</b>.</li>
        <li>Revise as categorias sugeridas e confirme. O que já foi importado não se repete.</li>
      </ol>
    </>,
  },
  {
    id: 'seguranca', title: '8. Segurança e privacidade', body: <>
      <ul>
        <li><b>Login:</b> só com o e-mail e a senha da conta Google, digitados na página do Google. O mesmo login conecta o app ao Drive.</li>
        <li><b>Onde ficam os dados:</b> no seu Google Drive, pasta <b>Finanças da Família</b>, e numa cópia no aparelho para funcionar sem internet.</li>
        <li><b>“Entre de novo para sincronizar”:</b> a autorização do Google vale por pouco tempo. Toque em <b>Entrar</b>; nada se perde.</li>
        <li><b>Lembretes:</b> em <b>Ajustes</b>, <b>Avisar neste aparelho</b>.</li>
      </ul>
    </>,
  },
  {
    id: 'duvidas', title: '9. Dúvidas rápidas', body: <>
      <dl className="man-faq">
        <dt>Entrar com Google não abre nada</dt><dd>O navegador bloqueou a janela do Google. Permita pop-ups deste site.</dd>
        <dt>Um celular não mostra o que o outro lançou</dt><dd>Os dois precisam entrar com a mesma conta Google. Depois, <b>Ajustes → Sincronizar agora</b>.</dd>
        <dt>O app parece desatualizado</dt><dd>Feche por completo e abra de novo.</dd>
        <dt>Troquei de celular</dt><dd>Instale de novo e entre com a mesma conta Google. Tudo volta do Drive.</dd>
        <dt>Estou sem internet</dt><dd>Pode lançar normalmente; sincroniza quando a conexão voltar.</dd>
      </dl>
    </>,
  },
]

export function Manual() {
  return (
    <div className="manual">
      <h1>Manual de uso</h1>
      <p className="muted" style={{ marginTop: -4 }}>Toque num tema para abrir o passo a passo.</p>
      <div className="man-list">
        {SECTIONS.map((s, i) => (
          <details key={s.id} className="panel man-sec" open={i === 0}>
            <summary>{s.title}</summary>
            <div className="man-body">{s.body}</div>
          </details>
        ))}
      </div>
    </div>
  )
}
