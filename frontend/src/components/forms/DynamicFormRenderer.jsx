import React, { useEffect, useMemo, useState } from 'react';

const WIDTH_CLASS_MAP = {
  full: 'md:col-span-6',
  half: 'md:col-span-3',
  third: 'md:col-span-2'
};

const sortedFields = fields =>
  [...(Array.isArray(fields) ? fields : [])]
    .filter(field => field?.enabled !== false)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

const renderField = (field, value, onChange, readOnly) => {
  const baseClassName = 'theme-input mt-1 w-full rounded-2xl px-3 py-2.5 text-sm focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20';

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={event => onChange(field.name, event.target.value)}
        rows={Number(field.settings?.rows) || 4}
        readOnly={readOnly}
        placeholder={field.placeholder}
        className={baseClassName}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={value}
        onChange={event => onChange(field.name, event.target.value)}
        disabled={readOnly}
        className={baseClassName}
      >
        <option value="">{field.placeholder || 'Selecciona una opcion'}</option>
        {(field.options || []).map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className="mt-2 space-y-2">
        {(field.options || []).map(option => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={field.name}
              value={option.value}
              checked={value === option.value}
              onChange={event => onChange(field.name, event.target.value)}
              disabled={readOnly}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="mt-3 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={event => onChange(field.name, event.target.checked)}
          disabled={readOnly}
        />
        <span>{field.placeholder || field.helpText || field.label}</span>
      </label>
    );
  }

  const inputType = field.type === 'phone' ? 'tel' : field.type;

  return (
    <input
      type={inputType}
      value={value}
      onChange={event => onChange(field.name, event.target.value)}
      readOnly={readOnly}
      placeholder={field.placeholder}
      className={baseClassName}
    />
  );
};

const DynamicFormRenderer = ({
  form,
  title = '',
  description = '',
  submitLabel = '',
  readOnly = false,
  onSubmit = null
}) => {
  const fields = useMemo(() => sortedFields(form?.fields), [form?.fields]);
  const initialValues = useMemo(
    () =>
      fields.reduce((acc, field) => {
        acc[field.name] = field.type === 'checkbox' ? false : field.defaultValue || '';
        return acc;
      }, {}),
    [fields]
  );
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const handleChange = (name, nextValue) => {
    setValues(prev => ({ ...prev, [name]: nextValue }));
  };

  const handleSubmit = event => {
    event.preventDefault();
    if (onSubmit) {
      onSubmit(values);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="theme-panel rounded-[28px] p-6">
      {(title || form?.title) && (
        <h3 className="text-2xl font-semibold">{title || form?.title}</h3>
      )}
      {(description || form?.description) && (
        <p className="mt-2 text-sm" style={{ color: 'var(--muted-color)' }}>
          {description || form?.description}
        </p>
      )}

      <div className={`mt-6 grid gap-4 ${form?.layout === 'stacked' ? 'grid-cols-1' : 'md:grid-cols-6'}`}>
        {fields.map(field => (
          <label
            key={field.id}
            className={`block text-sm font-medium ${WIDTH_CLASS_MAP[field.width] || ''}`}
          >
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {renderField(field, values[field.name], handleChange, readOnly)}
            {field.helpText && (
              <span className="mt-1 block text-xs" style={{ color: 'var(--muted-color)' }}>
                {field.helpText}
              </span>
            )}
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={readOnly}
        className="theme-button-primary mt-6 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
      >
        {submitLabel || form?.submitLabel || 'Enviar'}
      </button>
    </form>
  );
};

export default DynamicFormRenderer;
