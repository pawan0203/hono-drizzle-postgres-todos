# Hono Drizzle Postgres Todos

## Setup

```sh
docker compose up -d
bun install
bun run db:migrate
bun run dev
```

Open http://localhost:3000.

The default database URL used by the Drizzle config is:

```sh
postgresql://user:password@localhost:5433/todos
```

## API

Create a user:

```sh
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"password123","age":25}'
```

Create a todo for a user:

```sh
curl -X POST http://localhost:3000/users/<user-id>/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Ship todo app","description":"Hono + Bun + Drizzle + Postgres"}'
```

List a user's todos:

```sh
curl http://localhost:3000/users/<user-id>/todos
```

Update a todo:

```sh
curl -X PATCH http://localhost:3000/todos/<todo-id> \
  -H 'Content-Type: application/json' \
  -d '{"completed":true}'
```

Delete a todo:

```sh
curl -X DELETE http://localhost:3000/todos/<todo-id>
```
