# OVERKILL SYNDROME – V4.8.2

- Cidade grafitada refeita com base na referência enviada.
- Mapa 50x50 isométrico com quadras, ruas, casas e veículos.

## V4.8.1 — integração da Cidade Grafitada

- Cenário `city` de 50 × 50, disponível no painel do mestre; catálogo em `/api/table/health`.
- Verificação de compatibilidade antes da troca de cenário.
- Limites de movimentação, zoom ampliado e posições guardadas por cenário.
- Para instalar: pare o Node, substitua os arquivos e execute `npm.cmd start`. Preserve `.rpg-data`.

# OVERKILL SYNDROME – V4.8

- Novo cenário 50x50: Cidade Grafitada.
- Ruas, prédios e veículos em estética urbana.
- Suporte de movimentação e desenho no cenário grande.

# V4.7.2 — Fichas com nomes duplicados

- Entrada pelo nome: quando houver mais de uma ficha, selecione a correta pela imagem, HP, posição e ID. Nenhuma ficha é excluída.
- A seleção não autentica identidade; mantenha a mesa privada. A senha administrativa continua obrigatória.
- Pare o servidor, substitua os arquivos, execute `npm.cmd start`, confira build 4.7.2 e atualize com Ctrl+F5. Preserve `.rpg-data`.

# V4.7.1 — Entrada pelo nome

- Digite `trinikz` (ou o usuário definido em RPG_ADMIN_USER) para abrir o acesso administrativo solicitando apenas a senha. `Mestre` também é um atalho. A autorização é verificada no servidor.
- Personagens existentes entram pelo nome, inclusive os antigos sem senha. Novos personagens preenchem nome e imagem, sem senha. Nomes são comparados sem distinguir maiúsculas/minúsculas; nomes duplicados antigos exigem correção na base para evitar escolher a ficha errada.
- ATENÇÃO: acesso pelo nome não comprova identidade; qualquer pessoa que saiba o nome pode assumir a ficha, revogando a sessão anterior. Utilize apenas em mesa privada/confiável. A senha administrativa continua obrigatória.
- Sair preserva ficha, HP, posição e desenhos. Preserve `.rpg-data`. Pare o servidor, substitua os arquivos do ZIP, rode `npm.cmd start`, confira `/api/table/health` com build 4.7.1 e recarregue com Ctrl+F5.

# V4.6 — Histórico de desenhos e pincel

- Ctrl+Z desfaz o último traço próprio no mapa; Ctrl+Y ou Ctrl+Shift+Z refaz. Não desfaz ações de borracha; novos traços descartam o histórico de refazer. Até 50 operações de refazer por autor e cenário.
- Pincel de 1–24 px em coordenadas do mapa; traços anteriores preservam a largura de 3 px.
- Olho ao lado de cada HP filtra as marcas do autor apenas nesta visualização, sem apagar nem alterar outros clientes.
- Atualize os seis arquivos e reinicie o servidor. `/api/table/health` deve indicar build 4.6. Preserve `.rpg-data`.

## V4.5.1 — diagnóstico do lápis e borracha

- Jogadores autenticados e mestre podem desenhar. Jogadores apagam apenas seus traços.
- A API informa `features.drawing: true` em `/api/table/health`.
- Se a interface estiver atualizada mas o servidor estiver antigo, o lápis informa a versão incompatível em vez do erro de permissão.
- Pare o servidor com Ctrl+C, substitua os arquivos e rode `npm.cmd start`. Confirme `build: "4.5.1"` e recarregue com Ctrl+F5. Não apague `.rpg-data`.

# V4.5 — HP e anotações

- HP de todos os personagens de jogadores abaixo do cenário, inicial 100/100, editável pelo mestre ao clicar na barra.
- Lápis livre e borracha na barra de ferramentas. Desenhos em coordenadas do mapa, sincronizados ao soltar, persistentes por cenário. Jogadores apagam apenas seus traços; mestre apaga todos. Mestre desenha com a cor da peça selecionada ou coral se não houver peça.
- A transição original ainda depende dos arquivos CSS, JS e imagem não fornecidos; mantida a versão anterior.
- Limite de 12.000 pontos e 400 traços por cenário (aproximado após apagar segmentos), para conter tamanho dos estados.

# OVERKILL SYNDROME – V4.4

- Diálogo com fundo mais escuro e desfoque.
- Transição de mapa sincronizada para todos os jogadores.
- Resultado dos dados usando a cor do personagem.

# Portfólio TRINIKZ e OVERKILL SYNDROME

## Entrar no RPG (mesa única)

Com Node.js 18 ou superior, execute `npm start` na raiz do projeto. Abra `http://localhost:3000/rpg`.

- Jogadores: clique em **Meu personagem**, informe nome e envie uma imagem PNG/JPEG/WebP ou cole um link. A cor do marcador é automática. Todos entram na mesma mesa; não há código de convite. A aba guarda sua própria sessão para retornar após atualizar a página. **Sair** remove o personagem da mesa e revoga a sessão.
- Mestre: clique em **Mestre** e autentique-se diretamente, sem criar personagem. Se já estiver como jogador, o login libera as ferramentas na sessão atual.
- Envie o mesmo endereço do RPG aos amigos. Em uma rede local, substitua `localhost` pelo IPv4 do computador (consulte `ipconfig`). Para jogadores pela internet, use um serviço Node.js com HTTPS e um endereço público.

### Hospedagem

Use uma única instância Node.js, `npm start` e um volume persistente configurado por `RPG_DATA_DIR`. A mesa compartilhada é salva em `OVERKILL.json`; as imagens enviadas ficam na subpasta `portraits`. As salas antigas não são importadas automaticamente. Não apague os arquivos antigos se quiser preservá-los.

Se o portfólio continuar numa hospedagem estática, configure a meta `rpg-api-origin` em `html/overkill.html` com o endereço HTTPS do backend, e `RPG_ORIGINS` no servidor com as origens autorizadas do portfólio. A rota SSE `/api/table/events` deve ser encaminhada sem buffering pelo proxy. GitHub Pages sozinho não executa o backend Node nem o login.

## Diálogo direto (visual, sem texto)

1. Como mestre autenticado, segure Shift e clique nos personagens (2 a 5); clique novamente para retirar um da seleção. Somente os personagens clicados entram no grupo. Solte Shift e escolha Diálogo direto. Em telas táteis, use Interagir.
2. Escolha Diálogo direto. A tela recebe uma camada preta de 42% de opacidade no centro (com vinheta mais escura nas bordas) e os retratos aparecem centralizados, com cantos arredondados e fade-in.
3. O mestre pode clicar em qualquer retrato; jogadores podem destacar o próprio. O retrato ativo mantém as cores originais. Os outros perdem brilho, saturação e ficam ligeiramente menores. A abertura e a seleção são sincronizadas para todos os participantes conectados à mesa, inclusive espectadores.
4. Use X ou Escape para encerrar para toda a mesa (mestre) ou fechar apenas sua própria visualização (jogador), com fade-out. As falas são feitas pelo aplicativo de voz externo; não há campo de texto nem envio de falas.

Personalize as imagens ao entrar na mesa, criar NPCs ou usar Alterar imagem do personagem. PNG/WebP transparente de corpo inteiro é ideal. Se não houver imagem própria, o retrato padrão continua disponível.

## Administração da mesa — autenticação obrigatória

Clique em **Mestre**, mesmo antes de cadastrar um personagem. O formulário solicita usuário e senha. O servidor verifica o login e cada ação privilegiada. Use Bloquear administração para revogar o acesso; a sessão do mestre sem personagem é encerrada. A autorização dura até logout ou reinicialização do servidor e não é persistida. Cinco tentativas por minuto por IP. Não existe acesso administrativo na hospedagem estática sem backend.

### Configurar credenciais

No início de `server.cjs`, procure `ADMIN / MESTRE — CREDENCIAIS`. O usuário inicial é `trinikz`; a senha inicial solicitada está representada pelo hash no servidor. Para produção, altere a senha por uma forte e exclusiva, via variáveis de ambiente `RPG_ADMIN_USER` e `RPG_ADMIN_PASSWORD` no serviço Node, e use HTTPS. Não publique sua senha em código cliente ou repositórios públicos; o hash da senha inicial não é adequado como segredo de produção. Reinicie o servidor após alterar as variáveis.

### Trilha sonora

- O mestre pode colar um link individual de `music.youtube.com/watch?v=...`, `youtube.com/watch?v=...` ou `youtu.be/...`. O servidor identifica o ID do vídeo. O player oficial incorporado fica visível na mesa. Não é necessário baixar nem extrair áudio.
- Cada jogador precisa ativar a reprodução no seu próprio dispositivo. A faixa, volume e parada são compartilhados; o tempo de reprodução é aproximado. O YouTube pode impedir a incorporação de faixas e exibir anúncios. Playlists inteiras não são importadas.
- O player oficial permanece visível durante o diálogo e a faixa não é pausada pela conversa. Ao ocultar a aba, a reprodução do YouTube é pausada; ao voltar, o site tenta retomá-la se estava tocando. Se o navegador bloquear, use o botão nativo do vídeo.
- Para áudio direto, crie `audio/` na raiz do projeto, adicione `tema.mp3` e use `/audio/tema.mp3` ou uma URL pública HTTPS. O áudio continua durante o diálogo e é reproduzido em loop. Se o navegador bloquear o autoplay, clique em Ativar áudio da mesa.
- O mestre controla Volume da mesa e Volume da música (0–100% cada). Cada jogador tem Seu volume (0–200%, salvo apenas no seu navegador) ao lado do player ou no painel de áudio direto. Volume efetivo = mesa × música × pessoal, limitado a 100%. Parar encerra a faixa para todos; os volumes gerais permanecem salvos. Nenhuma música é enviada ao servidor por upload.

### Arquivos

- `server.cjs`: autenticação e permissões, comandos administrativos, sincronização de diálogo e identificação de links musicais.
- `js/rpg.js`: `DIÁLOGO DIRETO`, `ADMIN / MESTRE` e `ÁUDIO SINCRONIZADO`.
- `html/overkill.html`: palco, formulário de login e player.
- `css/overkill.css`: layout de tela cheia, filtros e transições.

Use apenas mídias que você tem autorização para compartilhar.

## Diagnóstico: “Rota não encontrada”

A V4 usa `/api/table/`, enquanto as versões anteriores usavam `/api/rooms/`. Se o navegador mostrar “Rota não encontrada” ao cadastrar ou autenticar, confira se o processo Node está executando o `server.cjs` atualizado.

1. Substitua os arquivos na raiz correta. Preserve o endereço `rpg-api-origin` se o backend estiver em outro domínio.
2. Encerre o processo Node anterior (Ctrl+C no terminal) e execute `npm start` novamente nessa raiz. Em hospedagem remota, publique também o backend e reinicie o serviço.
3. Abra `http://localhost:3000/api/table/health` (ou o endereço HTTPS do backend com `/api/table/health`). A resposta deve conter `{"service":"overkill-rpg","apiVersion":4,"status":"ok"}`.
4. Abra `http://localhost:3000/rpg` e atualize com Ctrl+F5. Em hospedagem estática, abra o frontend somente depois de configurar a meta `rpg-api-origin` para o backend correto e a variável `RPG_ORIGINS` no servidor.

Não apague `.rpg-data` para resolver esse erro. As rotas antigas não são reativadas: a mesa única e a autenticação de mestre continuam obrigatórias.

## Seleção e ataque (V4)

- Hover no tabuleiro: contorno azul. Como mestre, segure Shift para contorno vermelho; Shift + clique alterna a seleção. Solte Shift com 2–5 entidades selecionadas para abrir as opções. Escape limpa a seleção.
- Clique direito numa entidade para abrir o menu Atacar. O jogador declara ataques com seu próprio personagem; o mestre utiliza o personagem selecionado como atacante. O alvo pode ser jogador ou NPC. A ação é registrada e sincronizada, sem cálculo de dano, alcance ou rolagem automática. O clique direito no chão ainda permite arrastar a câmera.
- `js/rpg-board.js`: contornos dos sprites, detecção de hover e clique direito.
- V4: substitua os seis arquivos, reinicie o Node e recarregue a página com Ctrl+F5. Preserve `.rpg-data`.

## V4.1 — correção de diálogo e player

- Shift + clique seleciona explicitamente cada participante; clique no mesmo personagem para desmarcar. Solte Shift e escolha Diálogo direto (2–5 personagens). A seleção de grupos é exclusiva do mestre a partir da V4.2.
- Se o diálogo retornar “Selecione dois personagens diferentes.”, o backend está executando a API V3. A V4.1 verifica `/api/table/health` antes de enviar o diálogo e informa quando o servidor é antigo.
- O slider individual fica vertical à esquerda do vídeo. O botão extra de reprodução do YouTube foi removido; use o botão nativo do vídeo. O desbloqueio de arquivos MP3 permanece disponível.
- Para instalar, encerre o processo antigo (`Ctrl+C`), substitua os arquivos, execute `npm.cmd start` e confira se `/api/table/health` retorna `apiVersion: 4` e `build: "4.1"`. Recarregue com Ctrl+F5. Não apague `.rpg-data`.
- Mecânicas de ataque permanecem inalteradas.

## V4.2 — controle de personagens e seleção

- Jogador: a sessão identifica o dono pelo ID autenticado, não pelo nome. Só o próprio personagem pode ser movimentado ou editado. Clique direito continua disponível para selecionar alvos.
- Mestre autenticado: controla qualquer peça, NPC, cenário, música e abertura de diálogos. Segure Shift, clique de 2 a 5 peças (ou use Interagir), solte Shift e abra Diálogo direto. A seleção começa no pressionamento do mouse para evitar conflitos com arrastar.
- Participantes podem destacar seu próprio retrato e fechar localmente com X; o mestre pode destacar qualquer retrato e encerrar a conversa para todos.
- A sessão agora fica na aba (sessionStorage); a sessão antiga é migrada uma vez. Atualizar a página preserva a sessão da aba. Use uma janela privada ou outro perfil para testar um jogador sem herdar a sessão do mestre (duplicar uma aba pode copiar sessionStorage).
- O fundo do diálogo usa 75% no centro com vinheta escura.
- Instalação: Ctrl+C, extraia o ZIP na raiz, npm.cmd start, Ctrl+F5. Confira build 4.2 em /api/table/health. Preserve .rpg-data.

## V4.3 — diálogo global, dados flutuantes e menu de alvo

- O mestre abre uma conversa global de 2 a 5 peças. Todos os clientes autenticados recebem o palco via SSE, inclusive quem não foi selecionado e quem entrar durante o diálogo. O mestre fecha para todos; cada jogador pode fechar a própria visualização e destacar somente seu retrato.
- Fundo do diálogo com 42% no centro e 66% nas bordas. O player não mostra instruções redundantes de reprodução; erros de carregamento continuam visíveis.
- Clique direito em qualquer peça (jogador ou NPC) abre o menu para mestres e jogadores. Ataques continuam apenas declarações registradas, sem regras de dano.
- Rolagem validada pelo servidor: mestre usa a peça selecionada; jogador usa a própria. Resultado aparece sobre o personagem, sobe por 5 segundos e desaparece com fade de 0,7 s, sincronizado para todos. Sem peça associada, o resultado permanece no histórico.
- Instale substituindo os arquivos, reinicie com `npm.cmd start`, confira `build: "4.3"` em `/api/table/health` e recarregue com Ctrl+F5. Preserve `.rpg-data`.

## V4.3.1 — correção de dados sobre as peças
- A rolagem precisa de um personagem válido. O mestre seleciona uma peça; jogadores rolam apenas para seu personagem.
- O servidor devolve o evento de rolagem com `tokenId` e resultado; o Canvas recebe a confirmação imediatamente e deduplica o evento compartilhado.
- Instale os quatro arquivos de código e este README, reinicie e confira `build: "4.3.1"` em `/api/table/health`. Preserve `.rpg-data`.
