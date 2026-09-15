import { useEffect, useState } from 'react'

import Notice from './Notice'
import { formatCurrency, formatDate } from '../lib/format'
import { apiFetch } from '../lib/client/api'

function PdfIcon() {
  return (
    <svg className="button-line-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h4" />
      <path d="M8.7 16.5h1.1c.9 0 1.5-.5 1.5-1.3s-.6-1.3-1.5-1.3H8.7v4.1" />
      <path d="M13 18v-4.1h1.1c1.2 0 2 .8 2 2s-.8 2.1-2 2.1z" />
      <path d="M17.3 18v-4.1h2.2" />
      <path d="M17.3 15.8h1.7" />
    </svg>
  )
}

function XmlIcon() {
  return (
    <svg className="button-line-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 9-4 3 4 3" />
      <path d="m16 9 4 3-4 3" />
      <path d="m14 5-4 14" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="button-line-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="button-line-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" />
      <path d="M17 11.2a2.6 2.6 0 1 0 0-5.2" />
      <path d="M16.2 14.2A4.7 4.7 0 0 1 21 19" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg className="button-line-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export default function ElectronicInvoiceResult({ invoice }) {
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')
  const [resendDialogOpen, setResendDialogOpen] = useState(false)
  const [resendMode, setResendMode] = useState('registered')
  const [resendEmails, setResendEmails] = useState('')
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deliveryHistory, setDeliveryHistory] = useState(null)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    setResendMessage('')
    setResendError('')
    setResendDialogOpen(false)
    setResendMode('registered')
    setResendEmails('')
    setHistoryDialogOpen(false)
    setHistoryLoading(false)
    setDeliveryHistory(null)
    setHistoryError('')
  }, [invoice?.token])

  if (!invoice) return null

  const downloadBase = `/api/facturacion-electronica/descargar?token=${encodeURIComponent(invoice.token)}`
  const reference = invoice.referencia || `${invoice.prefijo || ''}${invoice.consecutivo || ''}`

  async function resendInvoice(event) {
    event.preventDefault()

    if (!invoice?.token) return

    setResending(true)
    setResendMessage('')
    setResendError('')

    try {
      const payload = await apiFetch('/api/facturacion-electronica/reenviar', {
        method: 'POST',
        timeoutMs: 60000,
        body: JSON.stringify({
          token: invoice.token,
          mode: resendMode,
          emails: resendMode === 'multiple' ? resendEmails : ''
        })
      })
      const emailHints = payload.emailHints || (payload.emailHint ? [payload.emailHint] : [])

      setResendMessage(
        emailHints.length
          ? `Factura reenviada a: ${emailHints.join(', ')}.`
          : payload.message
      )
      setResendDialogOpen(false)
    } catch (error) {
      setResendError(error.message)
    } finally {
      setResending(false)
    }
  }

  async function openDeliveryHistory() {
    if (!invoice?.token) return

    setHistoryDialogOpen(true)

    if (deliveryHistory) return

    setHistoryLoading(true)
    setHistoryError('')

    try {
      const payload = await apiFetch(
        `/api/facturacion-electronica/historial-envio?token=${encodeURIComponent(invoice.token)}`,
        { timeoutMs: 60000 }
      )

      setDeliveryHistory(payload.history)
    } catch (error) {
      setHistoryError(error.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <section className="panel electronic-invoice-result">
      <div className="electronic-invoice-heading">
        <div>
          <p className="eyebrow">Factura encontrada</p>
          <h2>{reference}</h2>
          <p className="muted">{invoice.empresaNombre}</p>
        </div>
        <span className="status-pill">{invoice.estado}</span>
      </div>

      <dl className="detail-list">
        <dt>Cliente</dt>
        <dd>{invoice.cliente || 'Cliente IDEASA'}</dd>
        <dt>NIT o cedula del comprador</dt>
        <dd>{invoice.documento || 'No disponible'}</dd>
        <dt>Fecha</dt>
        <dd>{formatDate(invoice.fecha)}</dd>
        <dt>Total</dt>
        <dd>{formatCurrency(invoice.total)}</dd>
        {invoice.cufe ? (
          <>
            <dt>CUFE</dt>
            <dd>{invoice.cufe}</dd>
          </>
        ) : null}
      </dl>

      {invoice.integrationPending ? (
        <p className="muted">
          Esta es una respuesta de prueba mientras conectamos la API REST externa de facturacion electronica.
        </p>
      ) : null}

      <div className="button-row">
        <a className="primary-button" href={`${downloadBase}&formato=pdf`}>
          <PdfIcon />
          Descargar PDF
        </a>
        <a className="secondary-button" href={`${downloadBase}&formato=xml`}>
          <XmlIcon />
          Descargar XML
        </a>
        <button
          type="button"
          className="secondary-button"
          disabled={resending || invoice.integrationPending}
          onClick={() => setResendDialogOpen(true)}
        >
          <MailIcon />
          {resending ? 'Reenviando...' : 'Reenviar factura'}
        </button>
        <button type="button" className="secondary-button" disabled={invoice.integrationPending} onClick={openDeliveryHistory}>
          <HistoryIcon />
          Ver historial
        </button>
      </div>

      {invoice.emailHint ? (
        <p className="muted">El reenvio se realiza al correo registrado en la empresa: {invoice.emailHint}.</p>
      ) : null}

      <Notice>{resendMessage}</Notice>
      <Notice type="error">{resendError}</Notice>

      {resendDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-card resend-dialog" onSubmit={resendInvoice}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Reenvio de factura</p>
                <h3>Selecciona el destino</h3>
              </div>
              <button
                type="button"
                className="ghost-button icon-only-button"
                aria-label="Cerrar"
                onClick={() => setResendDialogOpen(false)}
              >
                <svg className="button-line-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </svg>
              </button>
            </div>

            <div className="resend-mode-grid" role="radiogroup" aria-label="Destino del reenvio">
              <button
                type="button"
                className={`resend-mode-card ${resendMode === 'registered' ? 'active' : ''}`}
                onClick={() => setResendMode('registered')}
              >
                <MailIcon />
                <span>
                  <strong>Correo registrado</strong>
                  <small>{invoice.emailHint || 'Usa el correo registrado en la empresa.'}</small>
                </span>
              </button>
              <button
                type="button"
                className={`resend-mode-card ${resendMode === 'multiple' ? 'active' : ''}`}
                onClick={() => setResendMode('multiple')}
              >
                <UsersIcon />
                <span>
                  <strong>Varios correos</strong>
                  <small>Escríbelos bien y separados por comas.</small>
                </span>
              </button>
            </div>

            {resendMode === 'multiple' ? (
              <label>
                Correos destino
                <textarea
                  value={resendEmails}
                  onChange={event => setResendEmails(event.target.value)}
                  placeholder="correo1@empresa.com, correo2@empresa.com"
                  rows={3}
                  required
                />
              </label>
            ) : null}

            <Notice type="error">{resendError}</Notice>

            <div className="button-row modal-actions">
              <button type="submit" className="primary-button" disabled={resending}>
                <MailIcon />
                {resending ? 'Reenviando...' : 'Confirmar reenvio'}
              </button>
              <button type="button" className="secondary-button" onClick={() => setResendDialogOpen(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {historyDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card delivery-history-dialog" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Historial de entrega</p>
                <h3>{reference}</h3>
              </div>
              <button
                type="button"
                className="ghost-button icon-only-button"
                aria-label="Cerrar"
                onClick={() => setHistoryDialogOpen(false)}
              >
                <svg className="button-line-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </svg>
              </button>
            </div>

            {historyLoading ? <Notice>Consultando historial de envío...</Notice> : null}
            <Notice type="error">{historyError}</Notice>

            {deliveryHistory ? (
              <>
                <div className="delivery-summary-grid">
                  <div>
                    <span>Estado DIAN</span>
                    <strong>{deliveryHistory.descripcionEstatusDocumento || deliveryHistory.resultado || 'Sin estado'}</strong>
                  </div>
                  <div>
                    <span>Envío al cliente</span>
                    <strong>{deliveryHistory.enviado ? 'Enviado' : 'Sin envío confirmado'}</strong>
                  </div>
                  <div>
                    <span>Fecha documento</span>
                    <strong>{formatDate(deliveryHistory.fechaDocumento)}</strong>
                  </div>
                </div>

                {deliveryHistory.entregas.length === 0 ? (
                  <p className="muted">TheFactory no reporta entregas registradas para esta factura.</p>
                ) : (
                  <div className="delivery-history-list">
                    {deliveryHistory.entregas.map(item => (
                      <article className="delivery-history-item" key={item.id}>
                        <div>
                          <strong>{item.entregaEstadoLabel || item.entregaDescripcion || 'Entrega registrada'}</strong>
                          <span>{item.canal}</span>
                        </div>
                        <dl className="compact-details">
                          <dt>Correo</dt>
                          <dd>{item.emailHints.length ? item.emailHints.join(', ') : 'No reportado'}</dd>
                          <dt>Fecha envío</dt>
                          <dd>{formatDate(item.entregaFecha || item.fechaProgramada)}</dd>
                          <dt>Lectura</dt>
                          <dd>{item.leidoFecha ? formatDate(item.leidoFecha) : item.leidoEstatus || 'Sin lectura reportada'}</dd>
                          <dt>Recepción</dt>
                          <dd>
                            {item.recepcionEmailFecha
                              ? formatDate(item.recepcionEmailFecha)
                              : item.recepcionEmailComentario || 'Sin recepción reportada'}
                          </dd>
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  )
}
