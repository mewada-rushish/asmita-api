const UserRepository = require('../../repositories/auth/userRepository');
const jwt = require('jsonwebtoken');

/**
 * In-memory OTP cache.
 * @type {Map<string, {otp: string, expiresAt: number}>}
 */
const otpCache = new Map();

/**
 * Generates a 6-digit numeric OTP.
 * @returns {string}
 */
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Dispatches SMS via SMSAlert gateway.
 * @param {string} mobile - Recipient mobile number.
 * @param {string} otp - OTP code to send.
 * @throws {Error} If environment variables are missing or gateway request fails.
 */
const dispatchSmsAlert = async (mobile, otp) => {
  const { SMSALERT_AUTH_KEY, SMSALERT_SENDER_ID, SMSALERT_TEMPLATE_ID } = process.env;

  if (!SMSALERT_AUTH_KEY || !SMSALERT_SENDER_ID || !SMSALERT_TEMPLATE_ID) {
    throw new Error('SMS_GATEWAY_CONFIG_MISSING');
  }

  const message = `${otp} is your OTP for AsmitA India ltd. Enter this code to validate your identity.`;
  const url = `https://www.smsalert.co.in/api/push.json?apikey=${SMSALERT_AUTH_KEY}&sender=${SMSALERT_SENDER_ID}&mobileno=${mobile}&text=${encodeURIComponent(message)}&template_id=${SMSALERT_TEMPLATE_ID}`;

  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();

  if (data.status !== 'success') {
    throw new Error(`SMS_GATEWAY_REJECTED: ${JSON.stringify(data)}`);
  }
};

/**
 * Initiates the login process by dispatching an OTP.
 */
const initiateLogin = async (req, res, body) => {
  try {
    const { mobile } = JSON.parse(body);

    if (!mobile) {
      return res.end(JSON.stringify({ status: 'error', message: 'Mobile number is required.' }));
    }

    const otp = generateOtp();
    otpCache.set(mobile, { otp, expiresAt: Date.now() + 300000 }); // 5 min expiry

    await dispatchSmsAlert(mobile, otp);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', message: 'OTP dispatched successfully.' }));
  } catch (err) {
    console.error('[AUTH_INITIATE_FAILURE]', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: err.message }));
  }
};

/**
 * Verifies OTP and checks user existence to determine session vs. registration flow.
 */
const verifyOtp = async (req, res, body) => {
  try {
    const { mobile, otp } = JSON.parse(body);
    const cachedRecord = otpCache.get(mobile);

    if (!cachedRecord || cachedRecord.expiresAt < Date.now() || cachedRecord.otp !== otp) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Invalid or expired OTP.' }));
    }

    otpCache.delete(mobile);

    const user = await UserRepository.findByMobile(mobile);

    // New User Flow
    if (!user) {
      return res.end(JSON.stringify({ 
        status: 'registration_required', 
        is_new_user: true 
      }));
    }

    // Existing User Flow
    const token = jwt.sign(
      { user_id: user.user_id, user_type: user.user_type, society_id: user.society_id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', token, data: user }));
  } catch (err) {
    console.error('[AUTH_VERIFY_FAILURE]', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Authentication verification failed.' }));
  }
};

/**
 * Persists new user to database and issues session token.
 */
const registerUser = async (req, res, body) => {
  try {
    const data = JSON.parse(body);
    
    // For mapping
    const societyId = data.society_id ? parseInt(data.society_id) : null;
    const flatId = data.flat_id ? parseInt(data.flat_id) : null;
    const ownershipType = data.ownership_type || 'Tenant';

    const userData = {
      mobile_number: data.mobile_number,
      full_name: data.full_name,
      email_id: data.email_id,
      gender: data.gender,
      user_type: ownershipType,
      account_type: 'app',
      password_hash: 'OTP_AUTH_ONLY',
      is_active: true,
      society_id: societyId
    };

    const newUser = await UserRepository.create(userData, flatId, ownershipType);

    const token = jwt.sign(
      { user_id: newUser.user_id, user_type: newUser.user_type, society_id: newUser.society_id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', token, data: newUser }));
  } catch (err) {
    console.error('[AUTH_REGISTER_FAILURE]', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    
    if (err.code === 'P2002') {
      return res.end(JSON.stringify({ status: 'error', message: 'Account already exists or duplicate mapping.' }));
    }
    
    res.end(JSON.stringify({ status: 'error', message: 'Registration failed.' }));
  }
};

module.exports = { initiateLogin, verifyOtp, registerUser };