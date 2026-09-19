import { seedOdooSampleSalesData } from './odoo';
import { auditWrite } from './write-audit';

export const seedOdooSampleSalesDataWithAudit = async (actorUserId: string, channelId?: string, requestId?: string): Promise<string> => {
  const status = await seedOdooSampleSalesData();
  const failed = /failed|not configured/i.test(status);
  auditWrite({
    action: 'sample_data_seed',
    outcome: failed ? 'failure' : 'success',
    actorUserId,
    channelId,
    requestId,
    detail: status,
  });
  return status;
};
