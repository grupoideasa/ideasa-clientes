import { useEffect, useState } from 'react'
import Link from 'next/link'

import AdminLayout from '../../components/AdminLayout'
import Notice from '../../components/Notice'
import { withAdminSession } from '../../components/ProtectedPage'
import { apiFetch } from '../../lib/client/api'
import { formatCents, formatCurrency, formatDate } from '../../lib/format'

export const getServerSideProps = withAdminSession()

export default function AdminClientesPage({ session }) {
  const [requests, setRequests] = useState({ perfil: [], facturas: [] })
  const [cartera, setCartera] = useState({ companies: [], facturas: [], total: 0 })
  const [payments, setPayments] = useState({ ordenes: [], pagos: [] })
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/admin/cartera')
      .then(payload => setCartera(payload.cartera || { companies: [], facturas: [], total: 0 }))
      .catch(requestError => setError(requestError.message))

    apiFetch('/api/admin/requests')
      .then(payload => {
        setRequests(payload.requests || { perfil: [], facturas: [] })
        setWarning(currentWarning => currentWarning || payload.warning || '')
      })
      .catch(requestError => setWarning(requestError.message))

    apiFetch('/api/admin/payment-summary')
      .then(payload => {
        setPayments(payload.summary || { ordenes: [], pagos: [] })
        setWarning(currentWarning => currentWarning || payload.summary?.warning || '')
      })
      .catch(requestError => setWarning(currentWarning => currentWarning || requestError.message))
  }, [])

  const totalFacturas = cartera.companies.reduce((sum, item) => sum + Number(item.facturas || 0), 0)
  const facturasVencidas = cartera.facturas.filter(item => Number(item.DIAS_PENDIENTES || 0) > 0)
  const carteraVencida = facturasVencidas.reduce((sum, item) => sum + Number(item.IMPORTE || 0), 0)
  const clientesEnCartera = new Set(cartera.facturas.map(item => item.CODCLIENTE).filter(Boolean)).size
  const solicitudesPendientes = [...requests.perfil, ...requests.facturas].filter(item => item.estado === 'pendiente')
  const pagosAprobados = payments.pagos.filter(item => item.estado === 'aprobado')
  const totalPagosAprobados = pagosAprobados.reduce((sum, item) => sum + Number(item.total_centavos || 0), 0)
  const facturaMasVencida = [...facturasVencidas].sort(
    (a, b) => Number(b.DIAS_PENDIENTES || 0) - Number(a.DIAS_PENDIENTES || 0)
  )[0]
  const ultimoPago = payments.pagos[0]
  const ordenReciente = payments.ordenes[0]
  const solicitudesRecientes = [...requests.perfil, ...requests.facturas]
    .sort((a, b) => new Date(b.creado_en || 0) - new Date(a.creado_en || 0))
    .slice(0, 5)

  return (
    <AdminLayout title="Admin clientes" session={session}>
      <Notice type="error">{error}</Notice>
      <Notice>{warning}</Notice>
      <section className="metrics-grid">
        <div className="metric-card">
          <span>Cartera global</span>
          <strong>{formatCurrency(cartera.total)}</strong>
          <small>{totalFacturas} factura(s)</small>
        </div>
        <div className="metric-card danger">
          <span>Cartera vencida</span>
          <strong>{formatCurrency(carteraVencida)}</strong>
          <small>{facturasVencidas.length} factura(s) vencida(s)</small>
        </div>
        <div className="metric-card">
          <span>Clientes con cartera</span>
          <strong>{clientesEnCartera}</strong>
          <small>Según las facturas recientes consultadas</small>
        </div>
        <div className="metric-card">
          <span>Solicitudes pendientes</span>
          <strong>{solicitudesPendientes.length}</strong>
          <small>{requests.perfil.length + requests.facturas.length} solicitud(es) en total</small>
        </div>
      </section>
      <section className="dashboard-grid">
        <div className="panel dashboard-main-card">
          <h2>Prioridad operativa</h2>
          {facturaMasVencida ? (
            <div className="priority-alert">
              <span className="status-pill">Cartera vencida</span>
              <strong>
                Cliente {facturaMasVencida.CODCLIENTE} · {facturaMasVencida.SERIE || ''} {facturaMasVencida.NUMERO}
              </strong>
              <p>
                Tiene {facturaMasVencida.DIAS_PENDIENTES} día(s) vencido(s) por{' '}
                {formatCurrency(facturaMasVencida.IMPORTE)}.
              </p>
              <Link className="primary-button" href="/admin-clientes/cartera">
                Revisar cartera
              </Link>
            </div>
          ) : (
            <div className="priority-alert">
              <span className="status-pill">Sin alertas</span>
              <strong>No hay facturas vencidas en la muestra reciente</strong>
              <p>Si hay cartera pendiente, se mostrará en el panel de cartera interna.</p>
              <Link className="primary-button" href="/admin-clientes/cartera">
                Ver cartera
              </Link>
            </div>
          )}
        </div>
        <div className="panel">
          <h2>Pagos en línea</h2>
          <dl className="detail-list">
            <dt>Aprobados</dt>
            <dd>{pagosAprobados.length}</dd>
            <dt>Total aprobado</dt>
            <dd>{formatCents(totalPagosAprobados)}</dd>
            <dt>Último pago</dt>
            <dd>{ultimoPago ? formatDate(ultimoPago.confirmado_en) : 'Sin pagos recientes'}</dd>
            <dt>Última orden</dt>
            <dd>{ordenReciente?.estado || 'Sin órdenes recientes'}</dd>
          </dl>
        </div>
      </section>
      <section className="quick-action-grid" aria-label="Accesos rápidos internos">
        <Link className="quick-action-card" href="/admin-clientes/cartera">
          <span className="action-icon" aria-hidden="true">
            $
          </span>
          <strong>Consultar cartera</strong>
          <small>Revisa facturas, saldos y empresas.</small>
        </Link>
        <Link className="quick-action-card" href="/admin-clientes/solicitudes">
          <span className="action-icon" aria-hidden="true">
            +
          </span>
          <strong>Gestionar solicitudes</strong>
          <small>Atiende cambios de perfil y reclamos.</small>
        </Link>
        <Link className="quick-action-card" href="/facturacion-electronica/descargar">
          <span className="action-icon" aria-hidden="true">
            PDF
          </span>
          <strong>Buscar factura electrónica</strong>
          <small>Descarga, reenvía o consulta historial.</small>
        </Link>
      </section>
      <section className="company-balance-strip" aria-label="Cartera por empresa">
        {cartera.companies.map(company => (
          <div key={company.empresa}>
            <span>{company.empresaNombre}</span>
            <strong>{formatCurrency(company.total)}</strong>
            <small>
              {company.facturas} factura(s)
              {company.empresa ? ` · ${company.empresa}` : ''}
            </small>
          </div>
        ))}
      </section>
      <section className="dashboard-grid">
        <div className="table-surface">
          <h2>Cartera urgente</h2>
          {facturasVencidas.length === 0 ? (
            <p className="muted">No hay facturas vencidas en la muestra reciente.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Factura</th>
                  <th>Empresa</th>
                  <th>Días</th>
                  <th className="right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {facturasVencidas.slice(0, 6).map(item => (
                  <tr key={`${item.EMPRESA}-${item.SERIE || 'SIN_SERIE'}-${item.NUMERO}-${item.CODCLIENTE}`}>
                    <td>{item.CODCLIENTE}</td>
                    <td>{`${item.SERIE || ''} ${item.NUMERO}`}</td>
                    <td>{item.EMPRESA}</td>
                    <td>{item.DIAS_PENDIENTES ?? '-'}</td>
                    <td className="right">{formatCurrency(item.IMPORTE)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="table-surface">
          <h2>Solicitudes recientes</h2>
          {solicitudesRecientes.length === 0 ? (
            <p className="muted">No hay solicitudes recientes.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesRecientes.map(item => (
                  <tr key={item.id}>
                    <td>{item.cod_cliente}</td>
                    <td>{item.tipo}</td>
                    <td>
                      <span className="status-pill">{item.estado}</span>
                    </td>
                    <td>{formatDate(item.creado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AdminLayout>
  )
}
