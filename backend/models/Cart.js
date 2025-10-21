import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    size: {
      type: String,
      trim: true,
      default: ''
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      max: [99, 'Quantity must be at most 99']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Price snapshot must be zero or positive']
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    },
    color: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    _id: false,
    timestamps: true
  }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    items: {
      type: [cartItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

cartSchema.methods.toJSON = function toJSON() {
  const cartObject = this.toObject({ virtuals: true });
  cartObject.items = cartObject.items.map(item => ({
    ...item,
    quantity: Math.min(Math.max(item.quantity, 1), 99)
  }));
  return cartObject;
};

export default mongoose.model('Cart', cartSchema);
