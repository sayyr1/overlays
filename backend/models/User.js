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

export const SYSTEM_USER_EMAIL_DOMAIN = 'users.runacommerce.local';

const USERNAME_PATTERN = /^[a-z0-9._-]{4,32}$/;

const stripDiacritics = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const sanitizeUsernameBase = value =>
  stripDiacritics(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/[._-]{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');

export const normalizeUsername = value => {
  const sanitized = sanitizeUsernameBase(value);
  if (!sanitized) return '';
  if (sanitized.length >= 4) return sanitized.slice(0, 32);
  return `${sanitized}${'user'.slice(0, 4 - sanitized.length)}`.slice(0, 32);
};

export const normalizeUserEmail = value => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || '';
};

export const isSystemGeneratedEmail = value =>
  normalizeUserEmail(value).endsWith(`@${SYSTEM_USER_EMAIL_DOMAIN}`);

export const buildSystemUserEmail = username =>
  `${normalizeUsername(username) || 'usuario'}@${SYSTEM_USER_EMAIL_DOMAIN}`;

const buildUsernameSeed = user => {
  const emailPrefix = normalizeUserEmail(user?.email).split('@')[0] || '';
  return normalizeUsername(user?.username || emailPrefix || user?.name || 'usuario');
};

const buildLegacyUsernameFallback = user => {
  const seed = buildUsernameSeed(user);
  const objectIdSuffix = user?._id ? String(user._id).slice(-4).toLowerCase() : '';

  if (!objectIdSuffix) {
    return seed;
  }

  const trimmedSeed = seed.slice(0, Math.max(4, 32 - objectIdSuffix.length - 1));
  return `${trimmedSeed}-${objectIdSuffix}`;
};

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: USERNAME_PATTERN
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
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

userSchema.pre('validate', function syncIdentityAndRole() {
  this.name = String(this.name || '').trim();

  const normalizedEmail = normalizeUserEmail(this.email);
  const normalizedUsername = normalizeUsername(this.username);

  if (normalizedUsername) {
    this.username = normalizedUsername;
  } else {
    this.username = buildLegacyUsernameFallback(this);
  }

  this.email = normalizedEmail || buildSystemUserEmail(this.username);

  if (!this.role) {
    this.role = this.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER;
  }

  this.isAdmin = INTERNAL_USER_ROLES.includes(this.role);
});

export default mongoose.model('User', userSchema);
