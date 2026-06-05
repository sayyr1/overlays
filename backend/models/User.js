import mongoose from 'mongoose';

export const USER_ROLES = Object.freeze({
  CUSTOMER: 'customer',
  SALES: 'sales',
  OWNER: 'owner',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin'
});

export const INTERNAL_USER_ROLES = Object.freeze([
  USER_ROLES.SALES,
  USER_ROLES.OWNER,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPERADMIN
]);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    match: /^\S+@\S+\.\S+$/
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.CUSTOMER,
    index: true
  },
  isAdmin: { type: Boolean, default: false },
  permissions: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  membershipLevel: {
    type: String,
    enum: ['STANDARD', 'GOLD', 'PREMIUM', 'PLATINUM'],
    default: 'STANDARD'
  }
}, { timestamps: true });

userSchema.pre('validate', function syncRoleFlags(next) {
  if (!this.role) {
    this.role = this.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER;
  }

  this.isAdmin = INTERNAL_USER_ROLES.includes(this.role);
  next();
});

export default mongoose.model('User', userSchema);
