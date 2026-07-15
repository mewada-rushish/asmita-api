const prisma = require('../../lib/prisma');

const UserRepository = {
  async findByEmail(email) {
    return await prisma.users.findUnique({ 
      where: { email_id: email } 
    });
  },

  async findByMobile(mobileNumber) {
    return await prisma.users.findFirst({ 
      where: { mobile_number: mobileNumber } 
    });
  },

  async create(userData, flatId = null, ownershipType = 'Owner') {
    if (flatId) {
      return await prisma.users.create({ 
        data: {
          ...userData,
          user_flat_mapping: {
            create: {
              flat_id: flatId,
              ownership_type: ownershipType.charAt(0).toUpperCase() + ownershipType.slice(1).toLowerCase()
            }
          }
        }
      });
    }
    return await prisma.users.create({ 
      data: userData 
    });
  },

  async update(userId, updateData) {
    return await prisma.users.update({
      where: { user_id: userId },
      data: updateData
    });
  }
};

module.exports = UserRepository;