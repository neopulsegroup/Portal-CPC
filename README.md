# Portal Conecta Caminhos

O **Portal Conecta Caminhos** é uma plataforma digital desenvolvida para facilitar a integração de migrantes em Portugal, conectando-os a oportunidades de emprego, serviços de apoio e orientação burocrática. O sistema serve como um ponto de encontro entre migrantes, empresas e entidades de apoio.

## 🚀 Funcionalidades Principais

### Para Migrantes
*   **Triagem Inicial Interativa**: Um assistente passo-a-passo que avalia a situação atual do migrante (localização, documentação, necessidades) para fornecer orientações personalizadas.
*   **Dashboard Personalizado**: Visualização do progresso, tarefas pendentes e recomendações baseadas no perfil.
*   **Gestão de Documentos**: Orientação sobre NIF, NISS e outros documentos essenciais.
*   **Apoio Multilíngue**: Interface totalmente traduzida em Português, Inglês e Espanhol.

### Para Empresas
*   **Registo e Perfil**: Criação de conta empresarial com validação de NIF e dados de contato.
*   **Publicação de Oportunidades**: Ferramentas para divulgar vagas e conectar-se com talentos.

### Funcionalidades Transversais
*   **Autenticação Segura**: Sistema de login e registo robusto via Firebase Auth.
*   **Design Responsivo**: Interface moderna e adaptável a dispositivos móveis e desktop.
*   **Geolocalização**: Integração de mapas para localização de serviços.

## 🛠️ Tecnologias Utilizadas

O projeto foi construído utilizando tecnologias modernas de desenvolvimento web, focadas em performance e experiência do utilizador.

### Core
*   **[React](https://react.dev/)**: Biblioteca JavaScript para construção de interfaces.
*   **[TypeScript](https://www.typescriptlang.org/)**: Superset de JavaScript com tipagem estática.
*   **[Vite](https://vitejs.dev/)**: Build tool rápida e leve.

### UI & Estilização
*   **[Tailwind CSS](https://tailwindcss.com/)**: Framework CSS utilitário.
*   **[shadcn/ui](https://ui.shadcn.com/)**: Coleção de componentes de UI reutilizáveis baseados em Radix UI.
*   **[Lucide React](https://lucide.dev/)**: Biblioteca de ícones consistente e leve.

### Gestão de Estado e Dados
*   **[TanStack Query](https://tanstack.com/query/latest)**: Gestão de estado assíncrono e data fetching.
*   **React Context**: Gestão de estado global (Autenticação, Idioma).

### Backend e Integrações
*   **[Firebase](https://firebase.google.com/)**: Plataforma backend-as-a-service.
    *   **Authentication**: Gestão de identidades e sessões.
    *   **Firestore**: Base de dados NoSQL em tempo real.

### Outras Ferramentas
*   **[React Router](https://reactrouter.com/)**: Navegação e roteamento (SPA).
*   **[React Hook Form](https://react-hook-form.com/)** + **[Zod](https://zod.dev/)**: Gestão e validação de formulários.
*   **[date-fns](https://date-fns.org/)**: Manipulação de datas.

## 📂 Estrutura do Projeto

```
src/
├── components/     # Componentes reutilizáveis (UI, Layout, Forms)
├── contexts/       # Contextos React (Auth, Language)
├── hooks/          # Custom Hooks
├── integrations/   # Configurações de serviços externos (Firebase, Supabase)
├── lib/            # Utilitários e configurações (i18n, utils)
├── pages/          # Componentes de página (Home, Triage, Dashboard, Auth)
└── styles/         # Estilos globais
```

## 🏁 Como Iniciar

### Pré-requisitos
*   Node.js (versão 18 ou superior)
*   npm ou yarn

### Instalação

1.  Clone o repositório:
    ```bash
    git clone <url-do-repositorio>
    cd portal-conecta-caminhos-main
    ```

2.  Instale as dependências:
    ```bash
    npm install
    ```

3.  Configure as variáveis de ambiente:
    Crie um arquivo `.env` na raiz do projeto com as credenciais do Firebase (exemplo baseado no setup atual).

4.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```

5.  Acesse a aplicação em `http://localhost:8080`.

## 🧪 Conteúdos de demonstração (CPC • Trilhas)

Esta funcionalidade permite exibir **conteúdo fictício/de exemplo** na rota **`/dashboard/cpc/trilhas`**, mantendo os conteúdos reais (vindos do Firestore) separados e com indicadores visuais claros.

### Objetivo
*   Fornecer uma **pré-visualização** de trilhas (cards com imagem/metadata) quando a base de dados não está populada ou quando é necessário demonstrar o fluxo.
*   Tornar os dados de demonstração **inequivocamente identificáveis** através de badges e rotulagem.
*   Reduzir tempo de carregamento com **cache local** (stale-while-revalidate).

### Como usar
1. Aceda a **`/dashboard/cpc/trilhas`**
2. Utilize o botão **“Mostrar demonstração”** para revelar a secção de conteúdos de exemplo
3. Utilize **“Ocultar demonstração”** para esconder a secção
4. O botão **“Criar trilhas demo”** (já existente) cria trilhas e módulos na base de dados (Firestore) — isto é diferente do modo demonstração (que não persiste dados)

### Onde fica implementado
*   Página: [TrailsAdminPage.tsx](file:///Users/renatomenezes/Desktop/Projetos/Portal-CPC/app/Backup/Backup-CPC-main/src/pages/dashboard/cpc/TrailsAdminPage.tsx)
*   Testes: [TrailsAdminPage.test.tsx](file:///Users/renatomenezes/Desktop/Projetos/Portal-CPC/app/Backup/Backup-CPC-main/src/pages/dashboard/cpc/TrailsAdminPage.test.tsx)

### Estrutura de dados (demo)
Os conteúdos de demonstração são definidos como uma lista de objetos com os campos:
* `title` (título)
* `description` (descrição)
* `image_url` (imagem/thumbnail)
* `duration_minutes` (duração)
* `category` (categoria)
* `created_at` (data de criação)

Cada card apresenta ainda badges de **categoria**, **dificuldade** e um badge explícito **Demo**.

### Diferenciação visual (real vs demo)
* Conteúdos reais: renderizados na secção **“Trilhas existentes”** e abrem o editor (`/dashboard/cpc/trilhas/:trailId`)
* Conteúdos demo: renderizados na secção **“Conteúdos de demonstração”**, com badge **Demo** e texto informativo indicando que **não são gravados na base de dados**

### Cache (otimização de carregamento)
Implementado em `localStorage` com estratégia **stale-while-revalidate**:
* Chave: `cpc-trails-cache:v1`
* Formato: `{ ts: number, data: Trail[] }`
* TTL: **5 minutos**
* Com cache válido, a página renderiza imediatamente e faz atualização em background (indicador “Atualizando…”)

A preferência de exibição de demo é persistida em:
* Chave: `cpc-trails-demo:show` (`true`/`false`)

## 🔁 Alternância de visualização (CPC • Trilhas existentes)

Na mesma rota **`/dashboard/cpc/trilhas`**, a secção **“Trilhas existentes”** suporta alternância entre:
* **Grade (grid)**: cards responsivos com imagem, título e resumo
* **Lista (list)**: linhas com detalhes (título, descrição, data, status) e ações (ex.: editar)

### Onde fica implementado
* Página: [TrailsAdminPage.tsx](file:///Users/renatomenezes/Desktop/Projetos/Portal-CPC/app/Backup/Backup-CPC-main/src/pages/dashboard/cpc/TrailsAdminPage.tsx)
* Testes: [TrailsAdminPage.test.tsx](file:///Users/renatomenezes/Desktop/Projetos/Portal-CPC/app/Backup/Backup-CPC-main/src/pages/dashboard/cpc/TrailsAdminPage.test.tsx)

### Estado e persistência
* Estado: `viewMode` (`'grid' | 'list'`)
* Persistência: `localStorage` com a chave `cpc-trails:viewMode`
* Comportamento: ao recarregar a página ou ao navegar e voltar, o modo selecionado é restaurado automaticamente

### UI e eventos
Implementado com `ToggleGroup` (shadcn/ui), usando:
* `type="single"`
* `value={viewMode}`
* `onValueChange={(v) => ...}` para atualizar o estado e persistir em `localStorage`
* `ToggleGroupItem value="grid"` e `ToggleGroupItem value="list"` para trocar o modo

### Testes
Testes cobrem:
* Toggle de demonstração (mostrar/ocultar)
* Render rápido via cache + atualização em background
* Cenário de erro + fallback para demonstração
* Alternância de visualização (grade/lista) + persistência em `localStorage`

Para executar:
```bash
npm run test:run
```

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor, siga as boas práticas de desenvolvimento, mantenha o estilo de código consistente e certifique-se de testar suas alterações.

---

Desenvolvido com foco na inclusão e apoio à comunidade migrante em Portugal.

---

Desenvolvido com ❤️ por [NEOPULSE](https://neopulse.group/)
