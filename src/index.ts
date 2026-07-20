import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { serveStatic } from "hono/bun";
import { db } from "./db/db";
import { todosTable, userTable } from "./db/schema";

const app = new Hono();

app.use("/*", serveStatic({ root: "./public" }));

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type ParsedJsonBody =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

const parseJsonBody = async (c: Context): Promise<ParsedJsonBody> => {
  try {
    const body = await c.req.json();

    if (!isRecord(body)) {
      return { ok: false, error: "Body must be a JSON object" };
    }

    return { ok: true, body };
  } catch {
    return { ok: false, error: "Body must be valid JSON" };
  }
};

const validateUuidParam = (value: string, field: string) => {
  if (!uuidRegex.test(value)) {
    return `${field} must be a valid UUID`;
  }

  return null;
};

app.get("/api", (c) => {
  return c.json({
    name: "hono-drizzle-postgres-todos",
    routes: [
      "POST /users",
      "GET /users/:id",
      "GET /users/:userId/todos",
      "POST /users/:userId/todos",
      "GET /todos/:id",
      "PATCH /todos/:id",
      "DELETE /todos/:id",
    ],
  });
});

app.post("/users", async (c) => {
  const parsed = await parseJsonBody(c);

  if (!parsed.ok) {
    return c.json({ error: parsed.error }, 400);
  }

  const { email, password, age } = parsed.body;

  if (typeof email !== "string" || !email.trim()) {
    return c.json({ error: "email is required" }, 400);
  }

  if (typeof password !== "string" || password.length < 8) {
    return c.json({ error: "password must be at least 8 characters" }, 400);
  }

  if (
    age !== undefined &&
    (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 120)
  ) {
    return c.json({ error: "age must be an integer between 0 and 120" }, 400);
  }

  const hashPassword = await Bun.password.hash(password);

  try {
    const [user] = await db
      .insert(userTable)
      .values({
        email: email.trim().toLowerCase(),
        hashPassword,
        age: age as number | undefined,
      })
      .returning({
        id: userTable.id,
        email: userTable.email,
        age: userTable.age,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt,
      });

    return c.json({ user }, 201);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "23505"
    ) {
      return c.json({ error: "email already exists" }, 409);
    }

    throw error;
  }
});

app.get("/users/:id", async (c) => {
  const id = c.req.param("id");
  const uuidError = validateUuidParam(id, "id");

  if (uuidError) {
    return c.json({ error: uuidError }, 400);
  }

  const [user] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      age: userTable.age,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
    })
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);

  if (!user) {
    return c.json({ error: "user not found" }, 404);
  }

  return c.json({ user });
});

app.get("/users/:userId/todos", async (c) => {
  const userId = c.req.param("userId");
  const uuidError = validateUuidParam(userId, "userId");

  if (uuidError) {
    return c.json({ error: uuidError }, 400);
  }

  const todos = await db
    .select()
    .from(todosTable)
    .where(eq(todosTable.userId, userId))
    .orderBy(desc(todosTable.createdAt));

  return c.json({ todos });
});

app.post("/users/:userId/todos", async (c) => {
  const userId = c.req.param("userId");
  const uuidError = validateUuidParam(userId, "userId");

  if (uuidError) {
    return c.json({ error: uuidError }, 400);
  }

  const parsed = await parseJsonBody(c);

  if (!parsed.ok) {
    return c.json({ error: parsed.error }, 400);
  }

  const { title, description } = parsed.body;

  if (typeof title !== "string" || !title.trim()) {
    return c.json({ error: "title is required" }, 400);
  }

  if (description !== undefined && typeof description !== "string") {
    return c.json({ error: "description must be a string" }, 400);
  }

  try {
    const [todo] = await db
      .insert(todosTable)
      .values({
        userId,
        title: title.trim(),
        description: description?.trim() || null,
      })
      .returning();

    return c.json({ todo }, 201);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "23503"
    ) {
      return c.json({ error: "user not found" }, 404);
    }

    throw error;
  }
});

app.get("/todos/:id", async (c) => {
  const id = c.req.param("id");
  const uuidError = validateUuidParam(id, "id");

  if (uuidError) {
    return c.json({ error: uuidError }, 400);
  }

  const [todo] = await db
    .select()
    .from(todosTable)
    .where(eq(todosTable.id, id))
    .limit(1);

  if (!todo) {
    return c.json({ error: "todo not found" }, 404);
  }

  return c.json({ todo });
});

app.patch("/todos/:id", async (c) => {
  const id = c.req.param("id");
  const uuidError = validateUuidParam(id, "id");

  if (uuidError) {
    return c.json({ error: uuidError }, 400);
  }

  const parsed = await parseJsonBody(c);

  if (!parsed.ok) {
    return c.json({ error: parsed.error }, 400);
  }

  const { title, description, completed } = parsed.body;
  const changes: Partial<typeof todosTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return c.json({ error: "title must be a non-empty string" }, 400);
    }

    changes.title = title.trim();
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== "string") {
      return c.json({ error: "description must be a string or null" }, 400);
    }

    changes.description = description?.trim() || null;
  }

  if (completed !== undefined) {
    if (typeof completed !== "boolean") {
      return c.json({ error: "completed must be a boolean" }, 400);
    }

    changes.completed = completed;
  }

  if (Object.keys(changes).length === 1) {
    return c.json(
      { error: "At least one of title, description, or completed is required" },
      400,
    );
  }

  const [todo] = await db
    .update(todosTable)
    .set(changes)
    .where(eq(todosTable.id, id))
    .returning();

  if (!todo) {
    return c.json({ error: "todo not found" }, 404);
  }

  return c.json({ todo });
});

app.delete("/todos/:id", async (c) => {
  const id = c.req.param("id");
  const uuidError = validateUuidParam(id, "id");

  if (uuidError) {
    return c.json({ error: uuidError }, 400);
  }

  const [todo] = await db
    .delete(todosTable)
    .where(eq(todosTable.id, id))
    .returning({ id: todosTable.id });

  if (!todo) {
    return c.json({ error: "todo not found" }, 404);
  }

  return c.body(null, 204);
});

export default app;
