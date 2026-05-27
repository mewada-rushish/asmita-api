const http = require('http');
const { handleRequest } = require('./router');

const PORT = process.env.PORT || 3001;
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`AsmitA API running on port ${PORT}`);
});