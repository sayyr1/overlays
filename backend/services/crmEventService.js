import CRMEvent from '../models/CRMEvent.js';
import CRMContact from '../models/CRMContact.js';

export const createCRMEvent = async ({
  contactId = null,
  session = null,
  sessionId = '',
  eventType,
  productId = null,
  cartSnapshotId = null,
  orderId = null,
  adminId = null,
  metadata = {}
}) => {
  const event = await CRMEvent.create({
    contact: contactId || null,
    session: session?._id || null,
    sessionId: sessionId || session?.sessionId || '',
    eventType,
    product: productId || null,
    cartSnapshot: cartSnapshotId || null,
    order: orderId || null,
    admin: adminId || null,
    metadata
  });

  if (contactId) {
    const update = {
      lastSeenAt: new Date()
    };
    if (productId) {
      await CRMContact.findByIdAndUpdate(contactId, {
        $set: update,
        $addToSet: { interestedProducts: productId }
      });
    } else {
      await CRMContact.findByIdAndUpdate(contactId, {
        $set: update
      });
    }
  }

  return event;
};
