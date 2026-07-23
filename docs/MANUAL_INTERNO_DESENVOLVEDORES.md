# Manual interno de funcionalidades e permissões

> **Documento interno e confidencial para desenvolvedores.** Não distribuir aos usuários do sistema. O manual externo de utilização será produzido separadamente.

## Princípio de autorização

O frontend controla a visibilidade das funcionalidades para manter a interface coerente com o perfil autenticado. Essa ocultação não é uma barreira de segurança. Todas as operações corporativas também devem ser autorizadas obrigatoriamente pelo backend e pelas regras do Firestore.

Os nomes dos perfis são tratados em letras minúsculas:

- `admin`
- `gerente`
- `supervisor`
- `operador`
- `cliente`

## Matriz de funcionalidades

| Funcionalidade | admin | gerente | supervisor | operador | cliente |
|---|---:|---:|---:|---:|---:|
| Cadastrar produtos | Sim | Sim | Sim | Sim | Não |
| Visualizar e atualizar estoque | Sim | Sim | Sim | Sim | Não |
| Consultar categorias e unidades durante o cadastro | Sim | Sim | Sim | Sim | Não |
| Gerenciar categorias | Sim | Sim | Sim | Não | Não |
| Gerenciar unidades de medida | Sim | Sim | Sim | Não | Não |
| Sistema de pagamento corporativo | Sim | Sim | Não | Não | Não |
| Gestão de logins | Sim | Sim | Não | Não | Não |

## Parâmetros gerenciais da organização

**Gerenciar Categorias** e **Gerenciar Unidades de Medida** são parâmetros gerenciais pertencentes à organização. Somente funcionários com os perfis `admin`, `gerente` ou `supervisor` podem visualizar os botões, abrir as telas e executar operações de consulta, criação, edição ou exclusão.

O perfil `operador` é um funcionário operacional. Ele pode cadastrar produtos, visualizar todos os produtos e atualizar o estoque. Para preencher o cadastro, pode consultar as opções existentes de categorias e unidades de medida, mas não pode visualizar os botões gerenciais nem criar, editar ou excluir esses parâmetros.

Endpoints protegidos:

```text
GET    /api/stores/:store/corporate/categories
POST   /api/stores/:store/corporate/categories
PATCH  /api/stores/:store/corporate/categories/:id
DELETE /api/stores/:store/corporate/categories/:id

GET    /api/stores/:store/corporate/measurement-units
POST   /api/stores/:store/corporate/measurement-units
PATCH  /api/stores/:store/corporate/measurement-units/:id
DELETE /api/stores/:store/corporate/measurement-units/:id
```

Os endpoints `GET` de categorias e unidades podem aceitar `operador`, pois fornecem as opções necessárias ao cadastro de produtos. Os endpoints `POST`, `PATCH` e `DELETE` devem aceitar exclusivamente `admin`, `gerente` e `supervisor`.

## Navegação corporativa

As áreas **Estoque**, **Sistema de Pagamento** e **Gestão de Logins** são telas internas completas da aplicação. A navegação ocorre por estado da SPA e não deve alterar o endereço exibido no navegador. Não adicionar caminhos, parâmetros de consulta ou fragmentos à URL para identificar a tela corporativa aberta.

Manter a URL não é, isoladamente, um mecanismo de segurança. As permissões continuam sendo verificadas pelo backend em todas as requisições.

## Regras para manutenção

Ao criar uma nova funcionalidade:

1. Definir explicitamente os perfis autorizados.
2. Controlar a visibilidade no frontend.
3. Repetir a autorização no backend.
4. Aplicar a regra correspondente no Firestore.
5. Testar acesso permitido e acesso negado, incluindo o perfil `operador`.
6. Atualizar este manual interno.

Nunca utilizar apenas a ocultação de botões como mecanismo de segurança.
