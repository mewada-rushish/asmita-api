const UserRepository = require('../../repositories/auth/userRepository');
const jwt = require('jsonwebtoken');

const otpCache = new Map();

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const dispatchSmsAlert = async (mobile, otp) => {
  const API_KEY = process.env.SMSALERT_AUTH_KEY;
  const SENDER_ID = process.env.SMSALERT_SENDER_ID || 'ASMITA';
  const message = `Your login OTP for AsmitA is ${otp}. Do not share this with anyone.`;
  
  const url = `https://www.smsalert.co.in/api/push.json?apikey=${API_KEY}&sender=${SENDER_ID}&mobileno=${mobile}&text=${encodeURIComponent(message)}`;

  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();
  
  if (data.status !== 'success') {
    throw new Error(`SMS Gateway Error: ${JSON.stringify(data)}`);
  }
};

const initiateLogin = async (req, res, body) => {
  try {
    const { mobile } = JSON.parse(body);

    if (!mobile) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Mobile number is required.' }));
    }

    const user = await UserRepository.findByMobile(mobile);
    
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'User record not found.' }));
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000; 
    
    otpCache.set(mobile, { otp, expiresAt });

    try {
      await dispatchSmsAlert(mobile, otp);
    } catch (smsError) {
      console.error('[SMS_DISPATCH_FAILURE]', smsError);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Failed to dispatch OTP.' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'success', 
      message: 'OTP dispatched successfully.' 
    }));
  } catch (err) {
    console.error('[AUTH_INITIATE_ERROR]', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error.' }));
  }
};

const verifyOtp = async (req, res, body) => {
  try {
    const { mobile, otp } = JSON.parse(body);

    if (!mobile || !otp) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Mobile number and OTP are required.' }));
    }

    const cachedRecord = otpCache.get(mobile);

    if (!cachedRecord || cachedRecord.expiresAt < Date.now()) {
      otpCache.delete(mobile);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'OTP expired or invalid.' }));
    }

    if (cachedRecord.otp !== otp) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Invalid OTP.' }));
    }

    otpCache.delete(mobile);

    const user = await UserRepository.findByMobile(mobile);
    
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'User record not found during verification.' }));
    }

    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        user_type: user.user_type, 
        society_id: user.society_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } 
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'success', 
      token,
      data: {
          user_id: user.user_id,
          full_name: user.full_name,
          user_type: user.user_type, 
          account_type: user.account_type,
          society_id: user.society_id
      }
    }));
  } catch (err) {
    console.error('[AUTH_VERIFY_ERROR]', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error.' }));
  }
};

module.exports = { initiateLogin, verifyOtp };