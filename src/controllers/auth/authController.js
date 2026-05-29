const UserRepository = require('../../repositories/auth/userRepository');
const jwt = require('jsonwebtoken');

// In-memory cache for OTP validation
const otpCache = new Map();

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const dispatchSmsAlert = async (mobile, otp) => {
  const API_KEY = process.env.SMSALERT_AUTH_KEY;
  const SENDER_ID = process.env.SMSALERT_SENDER_ID;
  const TEMPLATE_ID = process.env.SMSALERT_TEMPLATE_ID;
  
  // Strict DLT-approved template matching
  const message = `${otp} is your OTP for AsmitA India ltd. Enter this code to validate your identity.`;
  
  const url = `https://www.smsalert.co.in/api/push.json?apikey=${API_KEY}&sender=${SENDER_ID}&mobileno=${mobile}&text=${encodeURIComponent(message)}&template_id=${TEMPLATE_ID}`;

  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();
  
  if (data.status !== 'success') {
    throw new Error(`SMS Gateway Error: ${JSON.stringify(data)}`);
  }
};

/// 1. UNIFIED INITIATE: Sends an OTP to any valid number (Existing or New User)
const initiateLogin = async (req, res, body) => {
  try {
    const { mobile } = JSON.parse(body);

    if (!mobile) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Mobile number is required.' }));
    }

    // REMOVED: UserRepository.findByMobile check. 
    // We now send an OTP to EVERYONE to verify they own the phone number first.

    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5-minute TTL
    
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

/// 2. VERIFY: Checks the OTP, then checks if the user exists in the DB.
const verifyOtp = async (req, res, body) => {
  try {
    const { mobile, otp } = JSON.parse(body);

    if (!mobile || !otp) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Mobile number and OTP are required.' }));
    }

    const cachedRecord = otpCache.get(mobile);

    // Validate OTP existence and TTL bounds
    if (!cachedRecord || cachedRecord.expiresAt < Date.now()) {
      otpCache.delete(mobile);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'OTP expired or invalid.' }));
    }

    if (cachedRecord.otp !== otp) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Invalid OTP.' }));
    }

    // Purge OTP post-verification to prevent replay attacks
    otpCache.delete(mobile);

    // OTP IS CORRECT -> Now we check the Database
    const user = await UserRepository.findByMobile(mobile);
    
    if (!user) {
      // NEW FLOW: The user verified their number, but they aren't in the DB.
      // Tell the Flutter app to route them to the RegistrationScreen.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        status: 'registration_required', 
        is_new_user: true,
        message: 'OTP verified. Please complete your profile.' 
      }));
    }

    // Existing User: Issue stateless session token
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

/// 3. NEW FEATURE: Registers the new user after they submit the Flutter form
const registerUser = async (req, res, body) => {
  try {
    const data = JSON.parse(body);
    const { mobile_number, full_name, email_id, gender, ownership_type } = data;

    if (!mobile_number || !full_name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Missing required fields.' }));
    }

    // Create the user in Prisma
    const newUser = await UserRepository.create({
      mobile_number: mobile_number,
      full_name: full_name,
      email_id: email_id, 
      gender: gender,
      user_type: ownership_type || 'Resident', 
      account_type: 'app',
      // Dummy hash to satisfy DB requirement if password_hash is not nullable yet
      password_hash: 'OTP_AUTH_ONLY', 
      is_active: true
    });

    // Automatically log them in after registration
    const token = jwt.sign(
      { 
        user_id: newUser.user_id, 
        user_type: newUser.user_type, 
        society_id: newUser.society_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } 
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'success', 
      token,
      data: {
          user_id: newUser.user_id,
          full_name: newUser.full_name,
          user_type: newUser.user_type, 
          account_type: newUser.account_type,
          society_id: newUser.society_id,
          email_id: newUser.email_id,
          mobile_number: newUser.mobile_number,
          gender: newUser.gender
      }
    }));
  } catch (err) {
    console.error('[AUTH_REGISTER_ERROR]', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    
    // Check if it's a unique constraint violation (e.g. Email already exists)
    if (err.code === 'P2002') {
      return res.end(JSON.stringify({ status: 'error', message: 'An account with this email already exists.' }));
    }
    
    res.end(JSON.stringify({ error: 'Internal Server Error.' }));
  }
};

module.exports = { initiateLogin, verifyOtp, registerUser };