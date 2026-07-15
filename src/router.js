const { initiateLogin, verifyOtp, registerUser } = require('./controllers/auth/authController');
const { getSocieties, getTowers, getFloors, getFlats } = require('./controllers/properties/propertiesController');

const handleRequest = async (req, res) => {
  // Global CORS Setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Safely parse the URL pathname to strip out trailing parameters
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  let body = '';
  req.on('data', chunk => { body += chunk; });
  
  req.on('end', async () => {
    try {
      // Route parsing matching our clean pathname variable
      if (pathname === '/api/auth/login/initiate' && req.method === 'POST') {
        await initiateLogin(req, res, body);
      } else if (pathname === '/api/auth/login/verify' && req.method === 'POST') {
        await verifyOtp(req, res, body);
      } else if (pathname === '/api/auth/register' && req.method === 'POST') {
        // NEW FEATURE: Added the registration endpoint
        await registerUser(req, res, body);
      } else if (pathname === '/api/properties/societies' && req.method === 'GET') {
        await getSocieties(req, res);
      } else if (pathname === '/api/properties/towers' && req.method === 'GET') {
        await getTowers(req, res, searchParams);
      } else if (pathname === '/api/properties/floors' && req.method === 'GET') {
        await getFloors(req, res, searchParams);
      } else if (pathname === '/api/properties/flats' && req.method === 'GET') {
        await getFlats(req, res, searchParams);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Endpoint Not Found: [${req.method}] ${pathname}` }));
      }
    } catch (error) {
      console.error('[ROUTER_DISPATCH_ERROR]', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server routing break.' }));
    }
  });
};

module.exports = { handleRequest };