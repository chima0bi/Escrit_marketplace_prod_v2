import cron from 'node-cron';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { settleServiceNoShow } from './escrow.js';

async function sweep() {
  const due = await Transaction.find({
    status: TX_STATUS.PAID_HELD,
    fulfillmentStatus: 'BUYER_NO_SHOW',
    buyerNoShowReason: null,
    noShowResponseDueAt: { $lte: new Date() },
  });
  for (const transaction of due) {
    try {
      await settleServiceNoShow(transaction);
      console.log(`[no-show] settled transaction ${transaction._id}`);
    } catch (error) {
      console.error(`[no-show] settlement failed for ${transaction._id}:`, error.message);
    }
  }
}

export function startNoShowSettlementJob() {
  cron.schedule('0 * * * *', sweep);
  console.log('[no-show] settlement job started');
}
