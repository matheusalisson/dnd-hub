# BanD&D — Hub do Mestre

Uma interface inicial, responsiva e em português para apoiar mestres de Dungeons & Dragons. O projeto não requer instalação de dependências: é feito com HTML, CSS e JavaScript nativos.

## Como executar

O site exige login: a primeira tela é a de entrada (login ou cadastro), e nada do hub aparece antes disso. Por isso ele precisa do servidor; aberto direto pelo `index.html` ou por um servidor estático, mostra só o aviso de servidor indisponível.

Requer Node.js 22.13 ou mais novo (sem `npm install`: o servidor usa só módulos do próprio Node, inclusive o SQLite embutido).

```bash
npm start
```

Abra `http://127.0.0.1:3000`. O banco fica em `data/bandd.db` (fora do git). Variáveis opcionais: `PORT`, `HOST`, `DB_FILE` e `COOKIE_SECURE=1` (quando o site estiver atrás de HTTPS). Os testes da API rodam com `npm test`.

- **Cadastro e login** por e-mail e senha, obrigatórios para usar o site. Se a sessão expirar, o site volta para a tela de entrada e as alterações pendentes são enviadas ao entrar de novo. A senha nunca é gravada: o banco guarda só um hash scrypt com sal aleatório por usuário. A sessão usa um cookie `HttpOnly`/`SameSite=Lax`, e o banco guarda só o hash do token. Login e cadastro têm limite de tentativas.
- **Sincronização:** com a conta aberta, campanhas, anotações, iniciativa e criaturas próprias vão para o servidor e são carregadas em qualquer computador. Sem conexão, as alterações ficam numa fila e são enviadas depois. Ao entrar pela primeira vez, dados de versões anteriores que estavam só no navegador são enviados para a conta.
- **Campanhas compartilhadas:** no botão de membros de cada campanha, o dono gera um código de convite (vale para uma pessoa por 7 dias) com permissão "Pode ver" ou "Pode editar", muda permissões e remove membros. Quem recebe usa "Entrar com código" em Campanhas. Anotações ligadas a uma campanha são vistas por todos os membros; só o dono exclui a campanha.
- **Exportação e importação:** "Exportar da conta" baixa o mesmo formato de backup do navegador. Com a conta aberta, importar um backup soma as campanhas e anotações à conta e substitui a iniciativa e as criaturas importadas.
- Ao sair da conta, os dados deste navegador são apagados (continuam na conta).

## O que já está incluído

- Painel inicial com campanha em destaque, próxima sessão e atalhos.
- Navegação responsiva com uma rota própria por tela (hash na URL), menu global e suporte aos botões voltar/avançar do navegador.
- Consulta de magias e criaturas pela [D&D 5e API](https://www.dnd5eapi.co/), na versão de regras de 2014.
- Site em português ou inglês (seletor no topo): interface, regras, condições e as 319 magias e truques do SRD 2014. Em português, magias têm nome, descrição, materiais, círculos superiores, alcance e duração traduzidos (distâncias em metros); em inglês, o texto original da API. A busca aceita nomes nas duas línguas, inclusive trechos.
- Fichas das 334 criaturas do SRD 2014 em português: traços, ações, ações lendárias, descrições, idiomas, resistências, tendências, perícias e testes de resistência. Em português, todas as distâncias (deslocamento, sentidos, alcance) aparecem em metros; nas fichas do Open5e o texto continua no original, mas as distâncias também são convertidas.
- Tema escuro ou claro (botão ☀/☾ no topo); o claro tem tons de pergaminho para não cansar a vista. Na primeira visita, segue o tema do sistema.
- Página dedicada aos 24 truques do SRD 2014.
- Catálogo opcional de criaturas do [Open5e](https://api.open5e.com/), que agrega SRD e outras fontes abertas licenciadas; permite filtrar por publicação e a ficha identifica sua fonte/licença.
- Busca de criaturas em português e inglês no catálogo SRD 2014 completo (334 entradas carregadas da API), com nomes localizados e correspondência parcial; a ficha mantém o nome original da fonte.
- Filtro por círculo de magia, paginação e detalhes dos recursos do compêndio.
- Campanhas locais com criação, edição, exclusão e abertura de um espaço para iniciar a sessão; cada campanha aceita fundos visuais prontos ou uma imagem HTTPS própria.
- Busca de criaturas do SRD 2014 e Open5e na iniciativa, com preenchimento de PV e CA, rolagem de iniciativa com d20 e modificador de Destreza e edição de PV durante o combate.
- Consulta rápida pesquisável de regras básicas de 2014, resumidas em português.
- Rastreador de iniciativa e anotações salvos no armazenamento local do navegador.
- Iniciativa com dano e cura rápidos (`−8`, `+5` ou botões Dano/Cura), condições por combatente, duplicação (3 goblins) e rolagem de iniciativa de todos os monstros de uma vez.
- Controle de turno: turno anterior, indicador "Vez de", barra fixa ao rolar a página, atalhos de teclado (`N`/`→`, `V`/`←`, `A`) e criaturas abatidas puladas automaticamente; empates resolvidos pela Destreza.
- Adição em grupo (campo Qtd.: Goblin 1, 2, 3...) com iniciativa individual quando o campo fica em branco; iniciativa editável direto na lista.
- PV temporários (absorvem dano primeiro), barra de PV com estados Sangrando/Crítico/Abatido, lembrete de CD do teste de concentração e PJ a 0 PV marcado como inconsciente.
- PJs marcados são mantidos ao **Encerrar combate**; remover combatentes e encerrar o combate podem ser desfeitos pelo aviso.
- Várias anotações, cada uma opcionalmente ligada a uma campanha.
- Criaturas próprias: importe um JSON (há um modelo para baixar na tela Criaturas → "Minhas criaturas"); elas ficam só no seu navegador e aparecem na busca da iniciativa.
- Dados e backup: exporte campanhas, combatentes, anotações e criaturas para um arquivo JSON e importe em outro computador.

O português é o texto-fonte da interface; `i18n.js` guarda as traduções para inglês, indexadas pela frase em português. As magias vêm da D&D 5e API e a tradução para português fica em `spells-pt.js`; as fichas preservam o nome original da API como referência. O catálogo Open5e agrega SRD e outras fontes abertas licenciadas; ele não é uma lista completa dos monstros de aventuras comerciais de D&D. A sincronização entre dispositivos e o compartilhamento dependem do servidor em `server/`.

## Estrutura

```text
index.html
package.json
server/
  server.js        (site + API: contas, sincronização, convites, exportação)
  db.js            (esquema SQLite)
  auth.js          (hash de senha, tokens e limite de tentativas)
  server.test.js   (testes da API)
assets/
  css/
    styles.css
  js/
    app.js
    account.js     (login, fila de sincronização e compartilhamento)
    i18n.js        (idioma: dicionário inglês, regras e condições)
    spells-pt.js   (tradução das 319 magias do SRD 2014)
    monsters-pt.js (tradução das 334 criaturas do SRD 2014)
```

## Ideias para evoluir

1. **Ficha de campanha e personagens:** participantes, níveis, vínculos, tesouros e resumos de sessão.
2. **Preparação de sessão:** checklist, calendário, cenas, ganchos narrativos e encontros planejados.
3. **Ferramentas de combate:** condições, recursos, concentração e rolagens adicionais.
4. **Construtor de encontros:** seleção de monstros da API, dificuldade por nível do grupo e orçamento de XP.
5. **Tela de mesa:** iniciativa, notas do mestre e informações de encontro em uma visualização compacta para compartilhar.
6. **Conteúdo em português:** traduzir também as fichas do Open5e (hoje só as distâncias são convertidas para metros).
7. ~~**Persistência e colaboração:** backend com autenticação, banco de dados, exportação/importação e acesso compartilhado por campanha.~~ Feito (veja "Com contas e campanhas compartilhadas").

## Ferramentas sugeridas

- **Agora:** VS Code + Live Server; Git para histórico e colaboração.
- **Interface maior:** Vite com TypeScript e React (ou Vue) para componentes e navegação escalável.
- **Testes:** Vitest para lógica e Playwright para fluxos de interface.
- **Persistência:** Supabase (PostgreSQL e autenticação) ou Firebase, caso campanhas precisem sincronizar.
- **Publicação:** GitHub Pages para esta versão estática; Vercel ou Netlify para uma aplicação com build.
- **API:** D&D 5e API para referência do SRD de 2014; conferir licença e limites antes de publicar conteúdo ou ampliar o uso.
