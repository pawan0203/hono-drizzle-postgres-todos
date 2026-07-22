import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: './src/db/drizzle',
    schema: './src/db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url:'postgresql://user:password@localhost:5433/todos',
    },
    casing:'snake_case'
})