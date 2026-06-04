import CRMTask from '../models/CRMTask.js';

export const refreshOverdueTasks = async () => {
  const now = new Date();
  await CRMTask.updateMany(
    {
      status: 'pending',
      dueDate: { $ne: null, $lt: now }
    },
    { $set: { status: 'overdue' } }
  );
};

export const createTask = async payload => {
  const task = await CRMTask.create(payload);
  return task;
};

export const upsertOpenTask = async ({ contact, type, relatedCartSnapshot = null, title, description = '', dueDate = null, priority = 'medium', assignedTo = null, relatedProduct = null, relatedOrder = null, suggestedMessage = '' }) => {
  const existing = await CRMTask.findOne({
    contact,
    type,
    relatedCartSnapshot: relatedCartSnapshot || null,
    status: { $in: ['pending', 'overdue'] }
  });

  if (existing) {
    existing.title = title;
    existing.description = description;
    existing.dueDate = dueDate;
    existing.priority = priority;
    existing.assignedTo = assignedTo;
    existing.relatedProduct = relatedProduct;
    existing.relatedOrder = relatedOrder;
    existing.suggestedMessage = suggestedMessage;
    await existing.save();
    return existing;
  }

  return CRMTask.create({
    contact,
    type,
    relatedCartSnapshot,
    title,
    description,
    dueDate,
    priority,
    assignedTo,
    relatedProduct,
    relatedOrder,
    suggestedMessage
  });
};
