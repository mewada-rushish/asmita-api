const { PrismaClient } = require('@prisma/client');

// Initialize directly. Node v25 handles .env parsing natively before execution.
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

module.exports = prisma;