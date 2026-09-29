import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.POSTGRES_URL ?? "postgresql://postgres:postgres@localhost:5432/banco_de_horas_2",
  },
});
