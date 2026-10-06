import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import Notice from '../../components/Notice'
import PageHeader from '../../components/PageHeader'
import PortalLayout from '../../components/PortalLayout'
import { withClientSession } from '../../components/ProtectedPage'
import { apiFetch } from '../../lib/client/api'
import { formatCents, formatCurrency, formatDate } from '../../lib/format'

export const getServerSideProps = withClientSession()

const DATA_REQUEST_TIMEOUT_MS = 60000
const DATA_PROGRESS_LIMIT = 95

function sortByDateAsc(left, right, key) {
  return new Date(left?.[key] || 0) - new Date(right?.[key] || 0)
}

function invoiceAmount(invoice) {
  return Number(invoice?.importe || 0)
}

export default function ClienteResumenPage({ session }) {
  const [profile, setProfile] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [history, setHistory] = useState({ ordenes: [], pagos: [] })
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const startedAt = Date.now()
    const progressTimer = setInterval(() => {
      setLoadProgress(current => {
        const elapsed = Date.now() - startedAt
        const nextProgress = 10 + Math.round((elapsed / DATA_REQUEST_TIMEOUT_MS) * 85)

        return Math.max(current, Math.min(DATA_PROGRESS_LIMIT, nextProgress))
      })
    }, 700)

    setLoading(true)
    setLoadProgress(10)
    setWarning('')
    setError('')

    Promise.all([
      apiFetch('/api/client/me', { timeoutMs: DATA_REQUEST_TIMEOUT_MS }),
      apiFetch('/api/client/invoices', { timeoutMs: DATA_REQUEST_TIMEOUT_MS }),
      apiFetch('/api/client/payment-orders', { timeoutMs: DATA_REQUEST_TIMEOUT_MS }).catch(requestError => ({
        ordenes: [],
        pagos: [],
        warning: requestError.message
      }))
    ])
      .then(([profilePayload, invoicesPayload, historyPayload]) => {
        if (!active) return

        setProfile(profilePayload)
        setInvoices(invoicesPayload.invoices || [])
        setHistory({
          ordenes: historyPayload.ordenes || [],
          pagos: historyPayload.pagos || []
        })
        setWarning(historyPayload.warning || '')
      })
      .catch(requestError => {
        if (!active) return

        setError(requestError.message)
      })
      .finally(() => {
        if (!active) return

        clearInterval(progressTimer)
        setLoadProgress(100)
        setLoading(false)
      })

    return () => {
      active = false
      clearInterval(progressTimer)
    }
  }, [])

  const client = profile?.client
  const finance = profile?.finance
  const totalCartera = invoices.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0)
  const vencidas = invoices.filter(invoice => Number(invoice.diasPendientes || 0) > 0)
  const carteraVencida = vencidas.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0)
  const porVencer = invoices.filter(invoice => Number(invoice.diasPendientes || 0) <= 0)
  const proximoVencimiento = [...porVencer].filter(invoice => invoice.fechaVencimiento).sort((a, b) =>
    sortByDateAsc(a, b, 'fechaVencimiento')
  )[0]
  const ultimaFacturaVencida = [...vencidas].sort(
    (a, b) => Number(b.diasPendientes || 0) - Number(a.diasPendientes || 0)
  )[0]
  const ultimoPago = history.pagos?.[0]
  const ultimaOrden = history.ordenes?.[0]
  const cuentas = client?.accounts || session?.accounts || []
  const carteraPorEmpresa = useMemo(() => {
    const groups = cuentas.reduce((currentGroups, account) => {
      const key = account.empresa || account.empresaNombre || 'IDEASA'

      currentGroups[key] = {
        empresa: account.empresa,
        empresaNombre: account.empresaNombre || account.empresa || 'IDEASA',
        facturas: 0,
        total: 0
      }

      return currentGroups
    }, {})

    invoices.forEach(invoice => {
      const key = invoice.empresa || invoice.empresaNombre || 'IDEASA'

      if (!groups[key]) {
        groups[key] = {
          empresa: invoice.empresa,
          empresaNombre: invoice.empresaNombre || invoice.empresa || 'IDEASA',
          facturas: 0,
          total: 0
        }
      }

      groups[key].facturas += 1
      groups[key].total += invoiceAmount(invoice)
    })

    return Object.values(groups)
  }, [cuentas, invoices])
  const facturasPrioritarias = [...invoices]
    .sort((a, b) => Number(b.diasPendientes || 0) - Number(a.diasPendientes || 0) || invoiceAmount(b) - invoiceAmount(a))
    .slice(0, 5)

  return (
    <PortalLayout title="Resumen cliente" session={session}>
      <PageHeader
        eyebrow="Inicio"
        title="Estado de tu cuenta"
        description="Revisa en un solo lugar tu cartera, facturas por vencer, pagos recientes y accesos rápidos."
      />
      <Notice type="error">{error}</Notice>
      <Notice>{warning}</Notice>
      {loading ? (
        <div className="request-progress data-progress" role="status" aria-live="polite">
          <div className="request-progress-header">
            <span>Consultando estado de cuenta</span>
            <strong>{loadProgress}%</strong>
          </div>
          <div className="request-progress-track" aria-hidden="true">
            <span style={{ width: `${loadProgress}%` }} />
          </div>
          <small>Estamos trayendo perfil, facturas pendientes y pagos registrados.</small>
        </div>
      ) : null}
      <section className="client-overview panel">
        <div>
          <span className="avatar-initial large">{(client?.nombre || session?.nombre || 'C').slice(0, 1)}</span>
        </div>
        <div>
          <p className="eyebrow">{client?.empresaNombre || session?.empresaNombre || 'IDEASA'}</p>
          <h2>{client?.razonSocial || client?.nombre || session?.nombre || 'Cliente'}</h2>
          <p>
            {client?.documento || session?.documento || 'NIT/Cedula'} · {client?.estado || 'Activo'}
          </p>
        </div>
      </section>
      <section className="metrics-grid">
        <div className="metric-card">
          <span>Saldo pendiente</span>
          <strong>{formatCurrency(totalCartera)}</strong>
          <small>{invoices.length} factura(s) pendiente(s)</small>
        </div>
        <div className="metric-card danger">
          <span>Facturas vencidas</span>
          <strong>{vencidas.length}</strong>
          <small>{formatCurrency(carteraVencida)} vencido</small>
        </div>
        <div className="metric-card">
          <span>Próximo vencimiento</span>
          <strong>{proximoVencimiento ? formatDate(proximoVencimiento.fechaVencimiento) : 'Sin fecha'}</strong>
          <small>{proximoVencimiento ? `${proximoVencimiento.serie || ''} ${proximoVencimiento.numero}` : 'Sin facturas próximas'}</small>
        </div>
        <div className="metric-card">
          <span>Último pago</span>
          <strong>{ultimoPago ? formatCents(ultimoPago.total_centavos) : 'Sin pagos'}</strong>
          <small>{ultimoPago ? formatDate(ultimoPago.confirmado_en) : 'No registra pagos por este medio'}</small>
        </div>
      </section>
      <section className="dashboard-grid">
        <div className="panel dashboard-main-card">
          <h2>Atención sugerida</h2>
          {ultimaFacturaVencida ? (
            <div className="priority-alert">
              <span className="status-pill">Vencida</span>
              <strong>
                {ultimaFacturaVencida.serie || ''} {ultimaFacturaVencida.numero}
              </strong>
              <p>
                Tiene {ultimaFacturaVencida.diasPendientes} día(s) vencido(s) por{' '}
                {formatCurrency(ultimaFacturaVencida.importe)}.
              </p>
              <Link className="primary-button" href="/clientes/facturas">
                Pagar facturas
              </Link>
            </div>
          ) : invoices.length > 0 ? (
            <div className="priority-alert">
              <span className="status-pill">Al día</span>
              <strong>{proximoVencimiento ? 'Tienes facturas por vencer' : 'No hay vencimientos próximos'}</strong>
              <p>
                {proximoVencimiento
                  ? `La próxima factura vence el ${formatDate(proximoVencimiento.fechaVencimiento)}.`
                  : 'No encontramos facturas con fecha de vencimiento pendiente.'}
              </p>
              <Link className="primary-button" href="/clientes/facturas">
                Ver facturas
              </Link>
            </div>
          ) : (
            <div className="priority-alert">
              <span className="status-pill">Sin cartera</span>
              <strong>No tienes facturas pendientes</strong>
              <p>Cuando tengas cartera registrada, aparecerá aquí para que puedas pagarla en línea.</p>
            </div>
          )}
        </div>
        <div className="panel">
          <h2>Resumen financiero</h2>
          <dl className="detail-list">
            <dt>Cupo</dt>
            <dd>{formatCurrency(finance?.cupo)}</dd>
            <dt>Cupo disponible</dt>
            <dd>{formatCurrency(finance?.cupoDisponible)}</dd>
            <dt>Deuda total</dt>
            <dd>{formatCurrency(finance?.totalDeuda || totalCartera)}</dd>
            <dt>Plazo</dt>
            <dd>{finance?.plazo || 'N/A'}</dd>
          </dl>
        </div>
      </section>
      <section className="quick-action-grid" aria-label="Accesos rápidos">
        <Link className="quick-action-card" href="/clientes/facturas">
          <span className="action-icon" aria-hidden="true">
            $
          </span>
          <strong>Pagar facturas</strong>
          <small>Selecciona una o varias facturas pendientes.</small>
        </Link>
        <Link className="quick-action-card" href="/facturacion-electronica/descargar">
          <span className="action-icon" aria-hidden="true">
            PDF
          </span>
          <strong>Descargar factura electrónica</strong>
          <small>Busca por empresa, prefijo, número y documento.</small>
        </Link>
        <Link className="quick-action-card" href="/clientes/pagos">
          <span className="action-icon" aria-hidden="true">
            OK
          </span>
          <strong>Ver pagos</strong>
          <small>Consulta órdenes, pagos aprobados y comprobantes.</small>
        </Link>
        <Link className="quick-action-card" href="/clientes/solicitudes">
          <span className="action-icon" aria-hidden="true">
            +
          </span>
          <strong>Crear solicitud</strong>
          <small>Actualiza datos o solicita soporte sobre facturas.</small>
        </Link>
      </section>
      <section className="dashboard-grid">
        <div className="table-surface">
          <h2>Facturas prioritarias</h2>
          {facturasPrioritarias.length === 0 ? (
            <p className="muted">No tienes facturas pendientes registradas.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Empresa</th>
                  <th>Vence</th>
                  <th>Días</th>
                  <th className="right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {facturasPrioritarias.map(invoice => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.numero}</strong>
                      <span>{invoice.serie || 'Sin serie'}</span>
                    </td>
                    <td>{invoice.empresaNombre || invoice.empresa}</td>
                    <td>{formatDate(invoice.fechaVencimiento)}</td>
                    <td>{invoice.diasPendientes ?? '-'}</td>
                    <td className="right">{formatCurrency(invoice.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="panel">
          <h2>Estado por empresa</h2>
          <div className="stacked-summary">
            {carteraPorEmpresa.map(company => (
              <div key={company.empresa || company.empresaNombre}>
                <span>{company.empresaNombre}</span>
                <strong>{formatCurrency(company.total)}</strong>
                <small>
                  {company.facturas} factura(s) pendiente(s)
                  {company.empresa ? ` · ${company.empresa}` : ''}
                </small>
              </div>
            ))}
          </div>
          <div className="last-activity-card">
            <span>Última orden</span>
            <strong>{ultimaOrden?.referencia || 'Sin órdenes recientes'}</strong>
            <small>
              {ultimaOrden
                ? `${ultimaOrden.estado} · ${formatDate(ultimaOrden.creado_en)}`
                : 'Cuando crees una orden de pago aparecerá aquí.'}
            </small>
          </div>
        </div>
      </section>
    </PortalLayout>
  )
}
