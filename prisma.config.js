require("dotenv/config");

module.exports = {
  schema: "prisma/schema.prisma",
  ...(process.env.DATABASE_URL && {
    datasource: {
      url: process.env.DATABASE_URL,
    },
  }),
};
