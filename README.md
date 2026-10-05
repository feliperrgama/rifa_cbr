# Rifa da Equipe de Robótica

Aplicação em Cloudflare Workers com front-end servido pelo Worker e reservas persistidas no Cloudflare D1.

## Instalação

Requer Node.js e npm.

```sh
npm install
```

## Criar e configurar o D1

Autentique o Wrangler na sua conta e crie o banco:

```sh
npx wrangler login
npx wrangler d1 create rifa-db
```

Copie o `database_id` retornado e substitua o valor placeholder de `database_id` em `wrangler.toml`. O binding usado pelo Worker é `env.DB`.

## Desenvolvimento local

Crie o banco D1 local e aplique o schema:

```sh
npm run db:local
npm run dev
```

Abra a URL local mostrada pelo Wrangler. O estado persistente do D1 local fica em `../.rifa-wrangler-state`, fora da pasta de assets observada pelo Wrangler. Não é necessário executar um servidor Node separado.

## Inicializar o banco de produção

Depois de preencher o ID em `wrangler.toml`, aplique o schema ao banco remoto:

```sh
npm run db:remote
```

## Deploy

```sh
npm run deploy
```

As reservas de números são gravadas em um batch atômico no D1. A chave primária de `raffle_numbers.number` impede reservas duplicadas, e o Worker retorna conflito HTTP 409 se os números escolhidos já tiverem sido reservados.
