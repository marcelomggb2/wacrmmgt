# Hostinger: publicar o sistema da porta 8000 em subdominio

Este repo agora inclui o sistema externo em `external/trelloflow`.

## 1) DNS (painel Hostinger)

Crie um registro para o subdominio:

- Tipo: `A`
- Host: `boards`
- Valor: `IP da VPS`

Exemplo final: `boards.seudominio.com`.

## 2) Deploy automatico via script

No seu computador local (na raiz do repo):

```bash
chmod +x scripts/deploy-trelloflow-subdomain.sh
scripts/deploy-trelloflow-subdomain.sh \
  --host SEU_IP_VPS \
  --user root \
  --domain boards.seudominio.com
```

O script:
- publica os arquivos em `/var/www/boards`
- cria config do Nginx
- recarrega Nginx
- tenta emitir SSL via Certbot

## 3) Integrar no CRM

No deploy do CRM (Hostinger Node):

```env
NEXT_PUBLIC_BOARDS_URL=https://boards.seudominio.com
```

Depois: redeploy/restart da aplicacao.

## 4) Validacao

- Acesse `https://boards.seudominio.com` e confirme o frontend.
- Acesse no CRM: pagina `Boards`.
- Se iframe bloquear, ajuste cabecalhos no subdominio para permitir frame do dominio do CRM.
