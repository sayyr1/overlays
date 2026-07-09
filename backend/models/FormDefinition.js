import mongoose from 'mongoose';

const formOptionSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const formFieldSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date']
  },
  required: {
    type: Boolean,
    default: false
  },
  enabled: {
    type: Boolean,
    default: true
  },
  locked: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    trim: true,
    default: ''
  },
  helpText: {
    type: String,
    trim: true,
    default: ''
  },
  defaultValue: {
    type: String,
    trim: true,
    default: ''
  },
  width: {
    type: String,
    trim: true,
    enum: ['full', 'half', 'third'],
    default: 'full'
  },
  order: {
    type: Number,
    default: 0
  },
  options: {
    type: [formOptionSchema],
    default: []
  },
  settings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

const formDefinitionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  scope: {
    type: String,
    required: true,
    trim: true,
    enum: ['storefront', 'admin', 'superadmin']
  },
  enabled: {
    type: Boolean,
    default: true
  },
  submitLabel: {
    type: String,
    trim: true,
    default: 'Enviar'
  },
  successMessage: {
    type: String,
    trim: true,
    default: 'Formulario configurado correctamente.'
  },
  layout: {
    type: String,
    trim: true,
    enum: ['stacked', 'grid'],
    default: 'grid'
  },
  order: {
    type: Number,
    default: 0
  },
  fields: {
    type: [formFieldSchema],
    default: []
  }
}, { timestamps: true });

export default mongoose.model('FormDefinition', formDefinitionSchema);
