const { initiateLogin, verifyOtp } = require('./controllers/auth/authController');

const handleRequest = async (req, res) => {
  // CORS Headers (Optional but recommended for mobile/web access)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  
  req.on('end', async () => {
    try {
      if (req.url === '/api/auth/login/initiate' && req.method === 'POST') {
        await initiateLogin(req, res, body);
      } else if (req.url === '/api/auth/login/verify' && req.method === 'POST') {
        await verifyOtp(req, res, body);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Request' }));
    }
  });
};

module.exports = { handleRequest };