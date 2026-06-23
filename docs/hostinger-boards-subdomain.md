# Boards no Hostinger Node (sem VPS)

Este projeto ja inclui o app de boards em `public/boards`.

## Modo recomendado (Hostinger Node)

Nao precisa subdominio separado, Nginx ou VPS.

1. Faça deploy normal do CRM na Hostinger Node.
2. Nao configure `NEXT_PUBLIC_BOARDS_URL`.
3. Abra `Boards` no menu do CRM.

O sistema carrega de dentro do proprio app, usando `/boards/index.html`.

## Quando usar URL externa

Use `NEXT_PUBLIC_BOARDS_URL` somente se quiser apontar para outro host.

Exemplo:

```env
NEXT_PUBLIC_BOARDS_URL=https://boards.example.com
```

## Validacao

- Abra `https://seu-dominio.com/boards/index.html` (deve carregar o TrelloFlow).
- Abra `https://seu-dominio.com/boards` dentro do CRM (menu lateral).
