# Configuração do GitHub e Envio de Código (Push)

Como o repositório é privado e você está recebendo erro de permissão (403), você precisa usar um **Personal Access Token (PAT)** em vez da senha da conta.

## Passo 1: Gerar o Token no GitHub

1.  Faça login no GitHub.
2.  Clique na sua foto de perfil (canto superior direito) > **Settings** (Configurações).
3.  Role a barra lateral esquerda até o final e clique em **Developer settings**.
4.  Clique em **Personal access tokens** > **Tokens (classic)**.
5.  Clique no botão **Generate new token** > **Generate new token (classic)**.
6.  Em **Note**, dê um nome (ex: "Portal CPC Push").
7.  Em **Select scopes**, marque a caixinha **repo** (Full control of private repositories). **Isso é muito importante.**
8.  Role até o fim e clique em **Generate token**.
9.  **COPIE O TOKEN** gerado (ele começa com `ghp_...`).
    *   *Atenção:* Você não conseguirá ver esse código novamente. Salve-o ou mantenha na área de transferência.

## Passo 2: Enviar o Código pelo Terminal

Volte para o terminal do VS Code (aqui onde estamos trabalhando) e siga estes passos:

1.  Adicione o repositório remoto (se ainda não estiver adicionado):
    ```bash
    git remote add origin https://github.com/neopulsegroup/Portal-CPC.git
    ```
    *Se disser que "origin already exists", tudo bem.*

2.  Garanta que está na branch principal:
    ```bash
    git branch -M main
    ```

3.  Envie o código:
    ```bash
    git push -u origin main
    ```

## Passo 3: Autenticação

Ao rodar o comando de `push`, o terminal vai pedir suas credenciais:

1.  **Username for 'https://github.com':** Digite seu nome de usuário do GitHub e dê Enter.
2.  **Password for 'https://github.com':** **COLE O TOKEN** (o código `ghp_...` que você copiou no Passo 1).
    *   *Nota:* Ao colar, **nada vai aparecer na tela** (nem asteriscos). É normal. Apenas cole e dê Enter.

Se tudo der certo, você verá mensagens de "Compressing objects" e "Writing objects", confirmando o envio.
