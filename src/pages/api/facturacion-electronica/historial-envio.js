import { allowMethods } from '../../../lib/server/api'
import {
  getElectronicInvoiceDeliveryHistory,
  PublicInvoiceError
} from '../../../lib/server/electronic-invoicing'

function sendError(res, error) {
  if (error instanceof PublicInvoiceError) {
    res.status(error.status).json({ error: error.message })

    return
  }

  console.error(error)
  res.status(500).json({ error: 'No pudimos consultar el historial de envio en este momento.' })
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return

  try {
    const history = await getElectronicInvoiceDeliveryHistory({
      token: req.query.token
    })

    res.status(200).json({ history })
  } catch (error) {
    sendError(res, error)
  }
}
