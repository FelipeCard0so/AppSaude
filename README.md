# Monitor de Saúde

Aplicação web simples, responsiva e voltada para dispositivos móveis para registrar e acompanhar medições de saúde. A interface prioriza leitura fácil, botões grandes e alertas visuais.

> O aplicativo é um apoio para registro e acompanhamento. Não substitui avaliação, diagnóstico ou orientação de profissionais de saúde.

## Recursos

- Registro de pressão arterial (opcional), glicemia, batimentos cardíacos e oximetria.
- Data e hora associadas a cada aferição.
- Exibição dos quatro valores mais recentes no painel.
- Gráfico das sete medições mais recentes, com linhas de PA sistólica e diastólica, glicemia e batimentos.
- Destaque vermelho em pontos considerados alterados pelo código do aplicativo.
- Modal com os sete registros mais recentes e opção para excluir uma medição local.
- Lista local dos sete registros que geraram alerta.
- Envio de medições para abas separadas de uma planilha Google Sheets por meio de Google Apps Script.
- Armazenamento local no navegador via `localStorage`.

## Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura da página, estilos CSS, formulário e modais. Carrega Chart.js e `script.js`. |
| `script.js` | Estado local, avaliação das medições, atualização do painel e gráfico, e POST para o Apps Script. |
| `appscrpt - google.txt` | Código Google Apps Script que recebe os registros e os distribui pelas abas da planilha. Deve ser copiado para o editor do Apps Script. |

## Executar localmente

1. Mantenha os três arquivos juntos na mesma pasta.
2. Abra `index.html` em um navegador moderno.
3. Para uso em outros dispositivos, publique os arquivos estáticos em uma hospedagem HTTPS, por exemplo GitHub Pages.

A conexão com Google Fonts e Chart.js usa serviços externos; sem acesso à internet, a fonte e/ou o gráfico podem não carregar corretamente.

## Configuração do Google Sheets

O Apps Script usa o ID da planilha configurado em `appscrpt - google.txt` e cria automaticamente estas abas na primeira chamada, incluindo cabeçalhos:

- `Glicemia`
- `Pressão arterial`
- `Batimentos cardíacos`
- `Oximetria`
- `Resultados ruins`

Os registros são adicionados no fim da aba. PA é opcional; quando informada, o valor é salvo como texto (por exemplo, `12/8` ou `120/80`). As outras três medições são obrigatórias no formulário.

### Implantar ou atualizar o Apps Script

1. Abra o projeto Google Apps Script associado ao webhook.
2. Copie o conteúdo de `appscrpt - google.txt` para o editor e salve.
3. Em **Implantar → Gerenciar implantações**, edite a implantação da aplicação da Web para usar a versão nova, ou crie uma implantação nova.
4. Configure a execução com a conta que tem acesso de edição à planilha e conceda o acesso necessário aos usuários do app.
5. Se a URL da aplicação da Web mudar, atualize `webhookGoogleScript` no início de `script.js`.
6. Autorize o script a acessar a planilha quando solicitado e faça um registro de teste.

A URL da biblioteca do Apps Script não é usada pelo app. O app envia para a URL `/exec` da aplicação da Web.

### Como os dados são enviados

O navegador envia JSON como `text/plain` em uma requisição POST simples, no modo `no-cors`. Esse modo é usado para permitir a chamada a partir de uma página estática hospedada em outro domínio. Por causa do `no-cors`, o navegador não consegue ler a resposta do Apps Script: uma requisição resolvida no JavaScript significa que o envio foi encaminhado, não que a gravação na planilha foi confirmada. Confirme a gravação verificando as abas da planilha.

## Dados locais e privacidade

Os arrays `saude_registros` e `saude_ruins` ficam no `localStorage` do navegador. Eles pertencem ao perfil de navegador e dispositivo usados; limpar os dados do navegador pode apagá-los. A exclusão no modal remove o registro local, mas não apaga linhas que já foram enviadas à planilha.

O endereço do Apps Script está no código cliente. Qualquer pessoa que tenha acesso à página pode inspecionar essa URL e enviar requisições ao endpoint; limite o acesso da implantação conforme o uso pretendido e monitore a planilha.

## Regras de classificação no código

O app contém limites fixos em `avaliarMedicoes()` em `script.js` para sinalizar PA, glicemia, batimentos e oximetria. O gráfico aplica esses limites para colorir os pontos. Eles são regras implementadas no código e não uma avaliação médica individualizada. Alterações nesses critérios devem ser feitas com orientação clínica.

## Bibliotecas externas

- [Chart.js](https://www.chartjs.org/) via jsDelivr.
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) via Google Fonts.
