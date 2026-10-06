import { allowMethods, requireAdminSession, sendApiError } from '../../../lib/server/api'
import { listAdminPaymentSummary } from '../../../lib/server/payments'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return

  const session = requireAdminSession(req, res)

  if (!session) return

  try {
    const summary = await listAdminPaymentSummary()

    res.status(200).json({ summary })
  } catch (error) {
    sendApiError(res, error)
  }
}
