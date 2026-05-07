// app/api/expedientes/afiliacion/[cedula]/route.ts
// Ficha de afiliación — Art. 5 Párr. I y II Reglamento JCE 2026
import { NextRequest, NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { requireAdmin } from '@/lib/security/authGuard'

const db: any = prisma

export async function GET(
  req: NextRequest,
  { params }: { params: { cedula: string } }
) {
  const authErr = requireAdmin(req)
  if (authErr) return authErr

  const cedula = decodeURIComponent(params.cedula).trim()
  const format = req.nextUrl.searchParams.get('format') ?? 'html'

  try {
    // Buscar militante con formato con/sin guiones
    const cedulaDigits = cedula.replace(/\D/g, '')
    const cedulaFmt = cedulaDigits.length === 11
      ? `${cedulaDigits.slice(0,3)}-${cedulaDigits.slice(3,10)}-${cedulaDigits.slice(10)}`
      : cedula

    const militante = await db.militante.findFirst({
      where: { OR: [{ cedula: cedulaFmt }, { cedula: cedulaDigits }, { cedula }] },
      include: {
        verificationSessions: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          include: {
            evidences: { select: { kind: true, sha256: true, sizeBytes: true, capturedAt: true } },
            attempts:  { select: { type: true, status: true, score: true, createdAt: true }, take: 5 },
            consent:   { select: { consentVersion: true, createdAt: true } },
          },
        },
      },
    })

    if (!militante) {
      return NextResponse.json({ success: false, error: 'Militante no encontrado' }, { status: 404 })
    }

    const session  = militante.verificationSessions?.[0] ?? null
    const liveEv   = session?.evidences?.find((e: any) => e.kind === 'live_capture')
    const hash     = militante.livenessHash ?? liveEv?.sha256 ?? null
    const verScore = session?.attempts?.find((a: any) => a.type === 'liveness')?.score ?? null

    const data = {
      militante: {
        id:            militante.id,
        cedula:        militante.cedula,
        nombres:       militante.nombres,
        apellidos:     militante.apellidos,
        fechaNac:      militante.fechaNac,
        sexo:          militante.sexo,
        estadoCivil:   militante.estadoCivil,
        telefono:      militante.telefono,
        telefonoAlt:   militante.telefonoAlt,
        email:         militante.email,
        provincia:     militante.provincia,
        municipio:     militante.municipio,
        distritoMunicipal: militante.distritoMunicipal,
        seccion:       militante.seccion,
        sector:        militante.sector,
        direccion:     militante.direccion,
        ocupacion:     militante.ocupacion,
        tipoMilitancia: militante.tipoMilitancia,
        motivo:        militante.motivo,
        estado:        militante.estado,
        idProvinciaJCE:        militante.idProvinciaJCE        ?? null,
        idMunicipioJCE:        militante.idMunicipioJCE        ?? null,
        idDistritoMunicipalJCE: militante.idDistritoMunicipalJCE ?? null,
        fechaRegistro: militante.createdAt,
      },
      verificacion: {
        status:         militante.verificationStatus,
        verifiedAt:     militante.verifiedAt,
        verifiedBy:     militante.verifiedBy,
        livenessHash:   hash,
        score:          verScore,
        consentVersion: session?.consent?.consentVersion ?? null,
        consentFecha:   session?.consent?.createdAt ?? null,
        sessionId:      session?.id ?? null,
      },
      emitidoEn: new Date().toISOString(),
    }

    if (format === 'json') {
      return NextResponse.json({ success: true, data })
    }

    return new NextResponse(buildHTML(data), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('[expediente/afiliacion]', err)
    return NextResponse.json({ success: false, error: 'Error al generar expediente' }, { status: 500 })
  }
}

function fmt(d: any): string {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

function fmtLarga(d: any): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' })
}

function campo(lbl: string, val: string | null | undefined): string {
  return `<div style="margin-bottom:9px">
    <span style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:2px">${lbl}</span>
    <span style="font-size:12px;color:#111827;font-weight:500">${val || '—'}</span>
  </div>`
}

function buildHTML(data: any): string {
  const m   = data.militante
  const v   = data.verificacion
  const hoy = fmtLarga(data.emitidoEn)

  const badge = m.estado === 'ACTIVO'
    ? `<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">ACTIVO</span>`
    : `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">${m.estado}</span>`

  const hashBlock = v.livenessHash
    ? `<p style="font-size:9px;font-family:monospace;word-break:break-all;color:#166534;margin:4px 0 0;line-height:1.5">${v.livenessHash}</p>`
    : `<p style="font-size:9px;color:#9ca3af;margin:4px 0 0">No disponible — verificación pendiente</p>`

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/>
<title>Ficha de Afiliación — ${m.nombres} ${m.apellidos}</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  @page{size:letter portrait;margin:0}
  @media print{
    .no-print{display:none!important}
    body{background:white!important}
    .print-wrap{background:white!important;padding:0!important;display:block!important}
    .pagina{box-shadow:none!important;margin:0!important;width:100%!important;padding:15mm 18mm 12mm!important}
  }
  body{margin:0;font-family:'Times New Roman',Times,serif;background:#f0f0f0}
  .toolbar{background:#0D3B8C;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;position:sticky;top:0;z-index:10}
  .print-wrap{background:#e5e7eb;padding:24px 16px;display:flex;flex-direction:column;align-items:center;gap:12px}
  .pagina{width:215.9mm;min-height:279.4mm;background:white;padding:18mm 20mm 15mm;position:relative;box-shadow:0 2px 20px rgba(0,0,0,.12)}
  .stripe{height:5px;background:linear-gradient(to right,#0D3B8C 0 33.33%,#F5C400 33.33% 66.66%,#C8001E 66.66% 100%);position:absolute;top:0;left:0;right:0}
  .stripe-bot{height:4px;background:linear-gradient(to right,#0D3B8C 0 33.33%,#F5C400 33.33% 66.66%,#C8001E 66.66% 100%);position:absolute;bottom:0;left:0;right:0}
  h3{font-size:10px;color:#0D3B8C;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin:14px 0 8px}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
  .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 16px}
</style>
</head><body>
<div class="no-print toolbar">
  <span style="color:white;font-weight:600;font-size:13px">Ficha de Afiliación — ${m.cedula}</span>
  <div style="display:flex;gap:8px">
    <button onclick="window.history.back()" style="background:rgba(255,255,255,.15);color:white;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">← Volver</button>
    <button onclick="window.print()" style="background:white;color:#0D3B8C;font-weight:700;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:13px">🖨 Imprimir / PDF</button>
  </div>
</div>
<div class="no-print" style="background:#e5e7eb;padding:8px 16px;text-align:center">
  <p style="font-size:11px;color:#9ca3af;font-family:sans-serif;margin:0">Activa <strong>«Gráficos de fondo»</strong> para conservar colores en PDF</p>
</div>
<div class="print-wrap">
<div class="pagina">
  <div class="stripe"></div>

  <!-- Encabezado -->
  <table style="width:100%;border-bottom:2px solid #0D3B8C;padding-bottom:10px;margin-bottom:14px;margin-top:8px"><tbody><tr>
    <td style="width:72px;vertical-align:middle">
      <img src="/logo-apd.png" alt="APD" style="width:72px;height:72px;object-fit:contain"/>
    </td>
    <td style="vertical-align:middle;padding-left:14px">
      <p style="margin:0;font-size:13px;font-weight:700;color:#0D3B8C;text-transform:uppercase">Alianza por la Democracia</p>
      <p style="margin:1px 0 0;font-size:9px;color:#6b7280">República Dominicana · Partido Político Nacional</p>
      <p style="margin:4px 0 0;font-size:12px;font-weight:700;color:#C8001E">FICHA DE AFILIACIÓN</p>
      <p style="margin:1px 0 0;font-size:8px;color:#9ca3af">Art. 5 Párr. I — Reglamento JCE, 15 enero 2026</p>
    </td>
    <td style="text-align:right;vertical-align:top;white-space:nowrap">
      ${badge}
      <p style="font-size:8px;color:#6b7280;margin:5px 0 2px">Emitida: ${hoy}</p>
      <p style="font-size:8px;color:#6b7280;margin:0">Reg. ID: ${m.id}</p>
    </td>
  </tr></tbody></table>

  <!-- I. Datos personales -->
  <h3>I. Datos personales del afiliado/a</h3>
  <div class="g2">
    ${campo('Nombres', m.nombres)}${campo('Apellidos', m.apellidos)}
    ${campo('Cédula de Identidad y Electoral', m.cedula)}${campo('Fecha de nacimiento', fmt(m.fechaNac))}
    ${campo('Sexo', m.sexo)}${campo('Estado civil', m.estadoCivil)}
    ${campo('Teléfono', m.telefono)}${campo('Teléfono alternativo', m.telefonoAlt)}
  </div>
  ${m.email ? campo('Correo electrónico', m.email) : ''}

  <!-- II. Domicilio -->
  <h3>II. Domicilio y circunscripción electoral</h3>
  <div class="g3">
    ${campo('Provincia', m.provincia)}${campo('Municipio', m.municipio)}${campo('Distrito municipal', m.distritoMunicipal)}
    ${campo('Sección', m.seccion)}${campo('Sector / Barrio', m.sector)}${campo('', '')}
  </div>
  ${campo('Dirección exacta', m.direccion)}
  <div class="g3">
    ${campo('Id Provincia JCE', m.idProvinciaJCE ? String(m.idProvinciaJCE) : null)}
    ${campo('Id Municipio JCE', m.idMunicipioJCE ? String(m.idMunicipioJCE) : null)}
    ${campo('Id DM JCE', m.idDistritoMunicipalJCE ? String(m.idDistritoMunicipalJCE) : null)}
  </div>

  <!-- III. Afiliación -->
  <h3>III. Datos de afiliación</h3>
  <div class="g3">
    ${campo('Tipo de militancia', m.tipoMilitancia)}
    ${campo('Ocupación', m.ocupacion)}
    ${campo('Fecha de registro', fmt(m.fechaRegistro))}
  </div>
  ${m.motivo ? campo('Motivación', m.motivo) : ''}

  <!-- IV. Verificación -->
  <h3>IV. Verificación de identidad biométrica (Prueba de vida)</h3>
  <div class="g2">
    ${campo('Estado', v.status === 'approved' ? 'APROBADA ✓' : v.status ?? '—')}
    ${campo('Fecha de verificación', fmt(v.verifiedAt))}
    ${campo('Método', v.verifiedBy ?? '—')}
    ${campo('Consentimiento', v.consentVersion ?? '—')}
    ${v.score !== null && v.score !== undefined ? campo('Puntuación liveness', `${v.score}/100`) : ''}
  </div>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 10px;margin-top:6px">
    <p style="font-size:8px;font-weight:700;color:#166534;margin:0;text-transform:uppercase;letter-spacing:.05em">
      🔒 Hash SHA-256 del frame de prueba de vida — Evidencia auditable Art. 5 Párr. II
    </p>
    ${hashBlock}
    ${v.sessionId ? `<p style="font-size:8px;color:#4b7280;margin:4px 0 0">Session ID: ${v.sessionId}</p>` : ''}
  </div>

  <!-- V. Declaración y firmas -->
  <h3>V. Declaración jurada y firma</h3>
  <p style="font-size:10px;color:#374151;line-height:1.6;margin:0 0 10px">
    El/La suscrito/a declara bajo fe de juramento que los datos consignados son verídicos, que se registra libre y voluntariamente en la <strong>Alianza por la Democracia (APD)</strong>, y que no tiene afiliación activa en otra organización política. La identidad fue verificada mediante prueba de vida biométrica conforme al Art. 5 Párr. I y II del Reglamento JCE de enero 2026.
  </p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px"><tbody><tr>
    <td style="width:45%;text-align:center;padding:0 12px;vertical-align:bottom">
      <div style="border-top:1px solid #374151;margin-top:40px;padding-top:4px;font-size:10px">
        <strong>${m.nombres} ${m.apellidos}</strong><br/>
        Cédula: ${m.cedula}<br/>Afiliado/a
      </div>
    </td>
    <td style="width:10%"></td>
    <td style="width:45%;text-align:center;padding:0 12px;vertical-align:bottom">
      <div style="border-top:1px solid #374151;margin-top:40px;padding-top:4px;font-size:10px">
        <strong>Dr. Max Puig</strong><br/>
        Presidente<br/>Alianza por la Democracia (APD)
      </div>
    </td>
  </tr></tbody></table>

  <!-- Pie -->
  <div style="position:absolute;bottom:14px;left:20mm;right:20mm;border-top:1px solid #e5e7eb;padding-top:5px">
    <p style="margin:0;font-size:7.5px;color:#9ca3af;text-align:center">
      Documento generado digitalmente el ${hoy} — Sistema de Padrón APD · verificateapd.org.do · Alianza por la Democracia (APD)
    </p>
  </div>
  <div class="stripe-bot"></div>
</div>
</div>
</body></html>`
}
