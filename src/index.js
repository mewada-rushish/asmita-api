const http = require('http');
const { handleRequest } = require('./router');
const prisma = require('./lib/prisma');

const PORT = process.env.PORT || 3001;
const server = http.createServer(handleRequest);

const bootstrapServer = async () => {
  try {
    console.log('⏳ Connecting to Hostinger Database...');
    
    // 1. Actively test the database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully.');

    // 2. Open the HTTP port only if the DB is ready
    server.listen(PORT, () => {
      console.log('====================================');
      console.log(`🚀 AsmitA API Running on Port ${PORT}`);
      console.log('====================================');
    });

  } catch (error) {
    console.error('❌ CRITICAL: Failed to connect to the database.');
    console.error(error);
    
    // Force the Node process to exit so PM2 knows it crashed and needs a restart
    process.exit(1); 
  }
};

// Execute the boot sequence
bootstrapServer();