// Desktop/tablet admin screens for Flota
// Calendar timeline, Fleet management, Overdue list

function Sidebar({ active }) {
  const t = useLang();
  const nav = [
    { id: 'dash', icon: Icon.home, label: t.workerDash },
    { id: 'cal', icon: Icon.calendar, label: t.calendar },
    { id: 'fleet', icon: Icon.truck, label: t.fleet },
    { id: 'res', icon: Icon.list, label: t.myReservations },
    { id: 'over', icon: Icon.warning, label: 'Po terminie' },
    { id: 'team', icon: Icon.user, label: 'Zespół' },
  ];
  return (
    <div style={{
      width: 240, height: '100%', background: tokens.card,
      borderRight: `1px solid ${tokens.hair2}`,
      padding: '24px 14px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '4px 10px 20px',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: tokens.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: tokens.accentInk, fontSize: 22, fontWeight: 400, lineHeight: 1,
        }}>F</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: tokens.ink, letterSpacing: -0.3, lineHeight: 1 }}>Flota</div>
          <div style={{ fontSize: 10, color: tokens.muted, marginTop: 2, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Admin</div>
        </div>
      </div>
      {/* Section label */}
      <div style={{ fontSize: 10, color: tokens.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', padding: '12px 10px 6px' }}>Operacje</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(n => {
          const A = active === n.id;
          return (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 10,
              background: A ? tokens.ink : 'transparent',
              color: A ? '#fff' : tokens.ink,
              fontSize: 13, fontWeight: A ? 650 : 540,
              letterSpacing: -0.1, cursor: 'pointer',
            }}>
              <n.icon s={16} c={A ? '#fff' : tokens.ink2} />
              <span>{n.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div style={{
          background: tokens.bg, borderRadius: 14, padding: 12,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 99, background: tokens.ink, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>PB</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 650, color: tokens.ink, letterSpacing: -0.1 }}>Piotr Bednarz</div>
              <div style={{ fontSize: 10.5, color: tokens.muted, marginTop: 1 }}>Dyspozytor · Warszawa</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 8. Calendar timeline (admin) ────────────────────────────
function ScreenCalendar() {
  const t = useLang();
  // 14-day timeline; some reservations per vehicle
  const days = [
    { d: 22, w: 'Nd' }, { d: 23, w: 'Pn' }, { d: 24, w: 'Wt', today: true },
    { d: 25, w: 'Śr' }, { d: 26, w: 'Cz' }, { d: 27, w: 'Pt' }, { d: 28, w: 'So' },
    { d: 29, w: 'Nd' }, { d: 30, w: 'Pn' }, { d: 31, w: 'Wt' },
    { d: 1, w: 'Śr', month: 'kw' }, { d: 2, w: 'Cz' }, { d: 3, w: 'Pt' }, { d: 4, w: 'So' },
  ];
  const rows = [
    { v: VEHICLES[0], blocks: [{ start: 2, end: 5, status: 'active', who: 'J. Kowalski' }, { start: 8, end: 11, status: 'approved', who: 'M. Lewandowski' }] },
    { v: VEHICLES[1], blocks: [{ start: 0, end: 1, status: 'completed', who: 'P. Nowak' }, { start: 3, end: 6, status: 'approved', who: 'A. Mazur' }, { start: 12, end: 13, status: 'pending', who: 'T. Wiśniewski' }] },
    { v: VEHICLES[2], blocks: [{ start: 1, end: 4, status: 'active', who: 'M. Lis' }, { start: 7, end: 13, status: 'approved', who: 'Firma Trans-Bud' }] },
    { v: VEHICLES[3], blocks: [{ start: 0, end: 2, status: 'completed', who: 'B. Krawczyk' }, { start: 5, end: 8, status: 'pending', who: 'K. Duda' }] },
    { v: VEHICLES[4], blocks: [{ start: 0, end: 0, status: 'overdue', who: 'P. Adamczyk' }, { start: 4, end: 7, status: 'approved', who: 'R. Wójcik' }, { start: 10, end: 13, status: 'approved', who: 'Polfresh sp.' }] },
    { v: VEHICLES[5], blocks: [{ start: 2, end: 4, status: 'active', who: 'T. Wójcik' }, { start: 6, end: 9, status: 'approved', who: 'Auto-Holowanie' }] },
  ];
  const statusColor = {
    active: { bg: tokens.blueSoft, fg: tokens.blue, bar: tokens.blue },
    approved: { bg: tokens.greenSoft, fg: tokens.green, bar: tokens.green },
    pending: { bg: tokens.amberSoft, fg: tokens.amber, bar: tokens.amber },
    overdue: { bg: tokens.redSoft, fg: tokens.red, bar: tokens.red },
    completed: { bg: tokens.greySoft, fg: tokens.grey, bar: tokens.grey },
  };
  const colWidth = 76; // px per day
  return (
    <div style={{ display: 'flex', height: '100%', background: tokens.bg, fontFamily: tokens.font }}>
      <Sidebar active="cal" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          padding: '22px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          borderBottom: `1px solid ${tokens.hair2}`,
        }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Marzec – Kwiecień 2026</div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8, margin: '4px 0 0', lineHeight: 1 }}>{t.calendar}</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              display: 'flex', background: tokens.card, borderRadius: 10, padding: 3, boxShadow: tokens.shadow1,
            }}>
              {['Dzień','Tydzień','2 tyg','Miesiąc'].map((l, i) => (
                <div key={l} style={{
                  padding: '6px 14px', borderRadius: 8,
                  background: i === 2 ? tokens.ink : 'transparent',
                  color: i === 2 ? '#fff' : tokens.ink2,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{l}</div>
              ))}
            </div>
            <Pill style={{ height: 36 }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Icon.filter s={14} c={tokens.ink} /> Filtry · 2
              </span>
            </Pill>
            <button style={{
              height: 36, padding: '0 14px', borderRadius: 10, border: 'none',
              background: tokens.ink, color: '#fff',
              fontFamily: tokens.font, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}><Icon.plus s={14} c="#fff" /> Nowa</button>
          </div>
        </div>
        {/* Timeline */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px' }}>
          <div style={{
            background: tokens.card, borderRadius: 18, margin: '20px 0', boxShadow: tokens.shadow1,
            overflow: 'hidden',
          }}>
            {/* Day header */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${tokens.hair2}` }}>
              <div style={{ width: 240, padding: '14px 18px', flexShrink: 0,
                fontSize: 11, color: tokens.muted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              }}>Pojazd</div>
              <div style={{ display: 'flex', flex: 1 }}>
                {days.map((d, i) => (
                  <div key={i} style={{
                    width: colWidth, padding: '10px 0', textAlign: 'center', flexShrink: 0,
                    borderLeft: i === 0 ? 'none' : `1px solid ${tokens.hair2}`,
                    background: d.today ? tokens.bg : 'transparent',
                  }}>
                    <div style={{ fontSize: 10, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{d.w}</div>
                    <div style={{
                      fontSize: 15, fontWeight: d.today ? 700 : 540,
                      color: d.today ? tokens.accent : tokens.ink,
                      letterSpacing: -0.3, marginTop: 2,
                    }}>{d.d}{d.month ? <span style={{ fontSize: 9, color: tokens.muted, fontWeight: 540, marginLeft: 2 }}>{d.month}</span> : null}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Vehicle rows */}
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', borderBottom: ri === rows.length - 1 ? 'none' : `1px solid ${tokens.hair2}`, position: 'relative', minHeight: 76 }}>
                <div style={{
                  width: 240, padding: '14px 18px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 54, height: 36, borderRadius: 8, background: tokens.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Silhouette kind={row.v.type} color={tokens.ink} w={48} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.v.brand} {row.v.model.split(' ')[0]}
                    </div>
                    <div style={{ fontSize: 10.5, color: tokens.muted, marginTop: 1, fontFamily: tokens.mono, letterSpacing: 0.3 }}>{row.v.plate}</div>
                  </div>
                </div>
                {/* Day cells (background grid) */}
                <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                  {days.map((d, i) => (
                    <div key={i} style={{
                      width: colWidth, flexShrink: 0,
                      borderLeft: i === 0 ? 'none' : `1px solid ${tokens.hair2}`,
                      background: d.today ? 'rgba(0,87,255,0.03)' : 'transparent',
                    }}/>
                  ))}
                  {/* Today marker line */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: 2 * colWidth, width: 2, background: tokens.accent, opacity: 0.5, pointerEvents: 'none',
                  }}/>
                  {/* Reservation blocks */}
                  {row.blocks.map((b, bi) => {
                    const c = statusColor[b.status];
                    return (
                      <div key={bi} style={{
                        position: 'absolute', top: 12, height: 50,
                        left: b.start * colWidth + 4, width: (b.end - b.start + 1) * colWidth - 8,
                        background: c.bg, borderRadius: 10,
                        borderLeft: `3px solid ${c.bar}`,
                        padding: '6px 10px', boxSizing: 'border-box',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
                        overflow: 'hidden', cursor: 'pointer',
                      }}>
                        <div style={{ fontSize: 11.5, fontWeight: 650, color: c.fg, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.who}</div>
                        <div style={{ fontSize: 10, color: c.fg, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 600 }}>
                          {t.status[b.status]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div style={{
            display: 'flex', gap: 18, alignItems: 'center', padding: '0 4px',
            fontSize: 11.5, color: tokens.muted, fontWeight: 540,
          }}>
            {Object.entries(statusColor).map(([k, c]) => (
              <div key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 8, borderRadius: 3, background: c.bg, borderLeft: `2px solid ${c.bar}` }}/>
                {t.status[k]}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 2, height: 12, background: tokens.accent }}/>
              Dziś · 24 marca
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 9. Fleet Management (admin) ─────────────────────────────
function ScreenFleetMgmt() {
  const t = useLang();
  const meta = [
    { util: 78, next: '25 mar · A. Nowak', active: 3 },
    { util: 92, next: 'dziś · brak', active: 0 },
    { util: 64, next: '02 kwi · M.R.', active: 1 },
    { util: 45, next: 'serwis · 27 mar', active: 0 },
    { util: 88, next: 'po terminie · P.A.', active: 2 },
    { util: 71, next: '06 kwi · firma Trans-Bud', active: 0 },
  ];
  const [rows, setRows] = React.useState(VEHICLES.map((v, i) => ({ ...v, ...meta[i] })));
  const [drawer, setDrawer] = React.useState(null);     // null | { mode:'add'|'edit', v }
  const [removeModal, setRemoveModal] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [dType, setDType] = React.useState('cargo');
  const [dStatus, setDStatus] = React.useState('available');
  React.useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2600); return () => clearTimeout(id); }, [toast]);
  const openAdd = () => { setDType('cargo'); setDStatus('available'); setDrawer({ mode: 'add' }); };
  const openEdit = (r) => { setDType(r.type); setDStatus(r.status === 'rented' ? 'available' : r.status); setDrawer({ mode: 'edit', v: r }); };
  const inputStyle = { width: '100%', height: 40, borderRadius: 9, border: `1px solid ${tokens.hair}`, background: tokens.bg, padding: '0 12px', fontFamily: tokens.font, fontSize: 13, color: tokens.ink, outline: 'none', boxSizing: 'border-box' };
  const fieldLabel = { fontSize: 10.5, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', display: 'block', marginBottom: 5 };
  const rowIconBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${tokens.hair}`, background: tokens.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <div style={{ display: 'flex', height: '100%', background: tokens.bg, fontFamily: tokens.font, position: 'relative' }}>
      <Sidebar active="fleet" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          padding: '22px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          borderBottom: `1px solid ${tokens.hair2}`,
        }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>83 pojazdy · 14 oddziałów</div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8, margin: '4px 0 0', lineHeight: 1 }}>{t.fleetMgmt}</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              display: 'inline-flex', background: tokens.card, borderRadius: 10, padding: 3,
              boxShadow: tokens.shadow1,
            }}>
              <div style={{ padding: 7, borderRadius: 7, background: tokens.ink }}><Icon.list s={14} c="#fff" /></div>
              <div style={{ padding: 7, borderRadius: 7 }}><Icon.grid s={14} c={tokens.muted} /></div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
              borderRadius: 10, background: tokens.card, boxShadow: tokens.shadow1,
              fontSize: 12.5, color: tokens.muted, fontWeight: 540, minWidth: 200,
            }}>
              <Icon.search s={14} c={tokens.muted} /> Marka, model, rejestracja…
            </div>
            <button style={{
              height: 36, padding: '0 14px', borderRadius: 10, border: 'none',
              background: tokens.ink, color: '#fff',
              fontFamily: tokens.font, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }} onClick={openAdd}><Icon.plus s={14} c="#fff" /> Dodaj pojazd</button>
          </div>
        </div>
        {/* KPIs */}
        <div style={{ padding: '20px 28px 6px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { l: 'Dostępne', n: '47', sub: '+3 dziś', c: tokens.green },
            { l: 'Wynajęte', n: '29', sub: '35% floty', c: tokens.blue },
            { l: 'Serwis', n: '5', sub: '2 dzisiaj', c: tokens.amber },
            { l: 'Po terminie', n: '2', sub: 'wymaga akcji', c: tokens.red },
          ].map((k, i) => (
            <div key={i} style={{
              background: tokens.card, borderRadius: 16, padding: '14px 16px',
              boxShadow: tokens.shadow1,
            }}>
              <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8, lineHeight: 1 }}>{k.n}</span>
                <span style={{ fontSize: 11, color: k.c, fontWeight: 650 }}>● {k.sub}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Filter chips */}
        <div style={{ padding: '14px 28px 8px', display: 'flex', gap: 8 }}>
          <Pill active>Wszystkie · 83</Pill>
          <Pill>Furgony · 28</Pill>
          <Pill>Busy · 14</Pill>
          <Pill>Lawety · 6</Pill>
          <Pill>Izotermy · 9</Pill>
          <Pill>Plandeki · 26</Pill>
        </div>
        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '6px 28px 28px' }}>
          <div style={{
            background: tokens.card, borderRadius: 16, boxShadow: tokens.shadow1, overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr 1fr 1.4fr 72px',
              padding: '12px 18px', borderBottom: `1px solid ${tokens.hair2}`,
              fontSize: 11, color: tokens.muted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
            }}>
              <div>Pojazd</div>
              <div>Rejestracja</div>
              <div>Status</div>
              <div>Wykorzystanie</div>
              <div>Stawka</div>
              <div>Najbliższe</div>
              <div></div>
            </div>
            {rows.map((r, i) => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr 1fr 1.4fr 72px',
                padding: '14px 18px', alignItems: 'center',
                borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${tokens.hair2}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 54, height: 36, borderRadius: 8, background: tokens.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Silhouette kind={r.type} color={tokens.ink} w={48} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{r.brand} {r.model}</div>
                    <div style={{ fontSize: 11, color: tokens.muted, marginTop: 1 }}>{r.year} · {r.fuel} · {r.trans}</div>
                  </div>
                </div>
                <div style={{ fontFamily: tokens.mono, fontSize: 12, fontWeight: 600, color: tokens.ink, letterSpacing: 0.3 }}>{r.plate}</div>
                <div><StatusBadge status={r.status} t={t} /></div>
                <div>
                  <div style={{ height: 6, borderRadius: 99, background: tokens.bg, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.util}%`, background: r.util > 80 ? tokens.green : tokens.ink, borderRadius: 99 }}/>
                  </div>
                  <div style={{ fontSize: 11, color: tokens.muted, marginTop: 4 }}>{r.util}% · 30 dni</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tokens.ink, letterSpacing: -0.2 }}>{r.daily} zł</div>
                  <div style={{ fontSize: 10.5, color: tokens.muted, marginTop: 1 }}>{r.monthly} zł/mies</div>
                </div>
                <div style={{ fontSize: 12, color: tokens.ink2 }}>{r.next}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => openEdit(r)} title={t.editAction} style={rowIconBtn}>
                    <Icon.edit s={15} c={tokens.ink2} />
                  </button>
                  <button onClick={() => setRemoveModal(r)} title={t.removeAction} style={rowIconBtn}>
                    <Icon.close s={15} c={tokens.red} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add / Edit drawer */}
      {drawer && (
        <div onClick={() => setDrawer(null)} style={{
          position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(20,18,22,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 460, height: '100%', background: tokens.card, boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '22px 24px 16px', borderBottom: `1px solid ${tokens.hair2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.fleetMgmt}</div>
                <div style={{ fontSize: 21, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4, marginTop: 2 }}>{drawer.mode === 'edit' ? t.editVehicle : t.addVehicle}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: tokens.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.close s={16} c={tokens.ink} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label style={fieldLabel}>{t.vBrand}</label><input style={inputStyle} defaultValue={drawer.v?.brand ?? ''} placeholder="Mercedes-Benz" /></div>
                <div><label style={fieldLabel}>{t.vModel}</label><input style={inputStyle} defaultValue={drawer.v?.model ?? ''} placeholder="Sprinter 317 CDI" /></div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>{t.vType}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['cargo', 'passenger', 'transporter', 'refrigerated', 'flatbed'].map((ty, i) => (
                    <button key={ty} onClick={() => setDType(ty)} style={{
                      height: 34, padding: '0 12px', borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${dType === ty ? tokens.ink : tokens.hair}`,
                      background: dType === ty ? tokens.ink : tokens.card, color: dType === ty ? '#fff' : tokens.ink,
                      fontFamily: tokens.font, fontSize: 12, fontWeight: 600,
                    }}>{t.typesShort[i]}</button>
                  ))}
                </div>
              </div>
              {[
                [{ l: t.vYear, k: 'year', ph: '2024' }, { l: t.vPlate, k: 'plate', ph: 'WX 0000A' }],
                [{ l: t.vFuel, k: 'fuel', ph: 'Diesel' }, { l: t.vTrans, k: 'trans', ph: 'Manual' }],
                [{ l: t.vSeats, k: 'seats', ph: '3' }, { l: t.vPayload, k: 'payload', ph: '1200 kg' }],
                [{ l: t.vDaily, k: 'daily', ph: '320' }, { l: t.vMonthly, k: 'monthly', ph: '6800' }],
                [{ l: t.vDeposit, k: 'deposit', ph: '2500' }, { l: t.vKmLimit, k: 'kmLimit', ph: '300' }],
              ].map((pair, ri) => (
                <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  {pair.map(f => (
                    <div key={f.k}>
                      <label style={fieldLabel}>{f.l}</label>
                      <input style={inputStyle} defaultValue={(drawer.v && drawer.v[f.k]) ?? ''} placeholder={f.ph} />
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>{t.vCargo}</label>
                <input style={inputStyle} defaultValue={drawer.v?.cargo ?? ''} placeholder="4.30 × 1.78 × 1.94 m" />
              </div>
              <div>
                <label style={fieldLabel}>{t.vStatus}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ id: 'available', l: t.statusAvailable }, { id: 'maintenance', l: t.statusService }].map(s => (
                    <button key={s.id} onClick={() => setDStatus(s.id)} style={{
                      flex: 1, height: 40, borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${dStatus === s.id ? tokens.ink : tokens.hair}`,
                      background: dStatus === s.id ? tokens.ink : tokens.card, color: dStatus === s.id ? '#fff' : tokens.ink,
                      fontFamily: tokens.font, fontSize: 13, fontWeight: 600,
                    }}>{s.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${tokens.hair2}`, display: 'flex', gap: 10 }}>
              <button onClick={() => setDrawer(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: `1px solid ${tokens.hair}`, background: tokens.card, color: tokens.ink, fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer' }}>{t.cancelB}</button>
              <button onClick={() => {
                const isEdit = drawer.mode === 'edit';
                if (!isEdit) {
                  setRows(p => [{ id: 'new-' + Date.now(), type: dType, brand: 'Nowy', model: 'Pojazd', year: 2025, fuel: 'Diesel', trans: 'Manual', seats: 3, cargo: '—', payload: '— kg', daily: 300, monthly: 6500, deposit: 2500, kmLimit: 300, extraKm: 1.2, plate: 'WX 0000X', status: dStatus, util: 0, next: '—', active: 0 }, ...p]);
                }
                setDrawer(null);
                setToast(isEdit ? t.vehicleSaved : t.vehicleAdded);
              }} style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: tokens.accent, color: '#fff', fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon.check s={15} c="#fff" /> {t.saveBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove — with deletion guard */}
      {removeModal && (
        <div onClick={() => setRemoveModal(null)} style={{
          position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(20,18,22,0.45)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, background: tokens.card, borderRadius: 20, padding: 26, boxShadow: '0 24px 70px rgba(0,0,0,0.28)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, marginBottom: 16,
              background: removeModal.active > 0 ? tokens.amberSoft : tokens.redSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon.warning s={24} c={removeModal.active > 0 ? tokens.amber : tokens.red} />
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4 }}>
              {removeModal.active > 0 ? t.blockedTitle : t.removeVehicleQ}
            </div>
            <div style={{ fontSize: 13.5, color: tokens.ink2, marginTop: 8, lineHeight: 1.45 }}>
              <b style={{ color: tokens.ink }}>{removeModal.brand} {removeModal.model}</b> · {removeModal.plate}
            </div>
            {removeModal.active > 0 ? (
              <>
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: tokens.amberSoft, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon.calendar s={16} c={tokens.amber} />
                  <div style={{ fontSize: 12.5, color: tokens.ink2, lineHeight: 1.45 }}>
                    <b style={{ color: tokens.amber, fontWeight: 700 }}>{removeModal.active} {t.blockedSub}</b><br />{t.blockedHint}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                  <button onClick={() => setRemoveModal(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: `1px solid ${tokens.hair}`, background: tokens.card, color: tokens.ink, fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer' }}>{t.viewReservations}</button>
                  <button onClick={() => setRemoveModal(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: tokens.ink, color: '#fff', fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer' }}>{t.closeBtn}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: tokens.muted, marginTop: 10, lineHeight: 1.45 }}>{t.removeVehicleSub}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                  <button onClick={() => setRemoveModal(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: `1px solid ${tokens.hair}`, background: tokens.card, color: tokens.ink, fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer' }}>{t.cancelB}</button>
                  <button onClick={() => { setRows(p => p.filter(x => x.id !== removeModal.id)); setToast(`${t.vehicleRemoved} · ${removeModal.brand} ${removeModal.model}`); setRemoveModal(null); }} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: tokens.red, color: '#fff', fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer' }}>{t.removeAction}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12,
          background: tokens.ink, color: '#fff', boxShadow: '0 12px 32px rgba(0,0,0,0.25)', fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ width: 20, height: 20, borderRadius: 99, background: tokens.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon.check s={13} c="#fff" />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── 10. Overdue list (admin) ────────────────────────────────
function ScreenOverdue() {
  const t = useLang();
  const items = [
    { id: 'R-2389', v: VEHICLES[4], who: 'Paweł Adamczyk', phone: '+48 605 871 220', due: '21 mar 18:00', days: 2, fee: 980, contact: 'wczoraj 14:30' },
    { id: 'R-2367', v: VEHICLES[0], who: 'Marta Sienkiewicz', phone: '+48 502 113 998', due: '23 mar 09:00', days: 1, fee: 460, contact: 'dziś 08:15' },
  ];
  return (
    <div style={{ display: 'flex', height: '100%', background: tokens.bg, fontFamily: tokens.font }}>
      <Sidebar active="over" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          padding: '22px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          borderBottom: `1px solid ${tokens.hair2}`,
        }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.red, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>● {items.length} wymaga akcji</div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8, margin: '4px 0 0', lineHeight: 1 }}>Po terminie</h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Pill style={{ height: 36 }}>Export CSV</Pill>
            <Pill style={{ height: 36 }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Icon.filter s={14} c={tokens.ink} /> Filtry
              </span>
            </Pill>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map(it => (
              <div key={it.id} style={{
                background: tokens.card, borderRadius: 18, padding: 18,
                boxShadow: tokens.shadow1, borderLeft: `4px solid ${tokens.red}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                  <div style={{
                    width: 110, height: 70, borderRadius: 12, background: tokens.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Silhouette kind={it.v.type} color={tokens.ink} w={96} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontFamily: tokens.mono, fontSize: 11, color: tokens.muted, fontWeight: 600 }}>{it.id}</span>
                          <StatusBadge status="overdue" t={t} />
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4 }}>
                          {it.v.brand} {it.v.model.split(' ')[0]} <span style={{ color: tokens.muted, fontWeight: 540, fontSize: 14 }}>· {it.v.plate}</span>
                        </div>
                        <div style={{ fontSize: 13, color: tokens.ink2, marginTop: 4 }}>
                          {it.who} · {it.phone}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase' }}>Naliczone</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: tokens.red, letterSpacing: -0.6, marginTop: 2 }}>+{it.fee} zł</div>
                      </div>
                    </div>
                    {/* Detail grid */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
                      marginTop: 14, padding: '12px 0', borderTop: `1px solid ${tokens.hair2}`,
                      borderBottom: `1px solid ${tokens.hair2}`,
                    }}>
                      {[
                        { l: 'Termin zwrotu', v: it.due },
                        { l: 'Opóźnienie', v: `${it.days} dni`, c: tokens.red },
                        { l: 'Ostatni kontakt', v: it.contact },
                        { l: 'Stawka kary', v: '180 zł/h' },
                      ].map((f, i) => (
                        <div key={i}>
                          <div style={{ fontSize: 10, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{f.l}</div>
                          <div style={{ fontSize: 13, fontWeight: 650, color: f.c || tokens.ink, marginTop: 3, letterSpacing: -0.1 }}>{f.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button style={{
                        height: 36, padding: '0 14px', borderRadius: 10, border: `1px solid ${tokens.hair}`,
                        background: tokens.card, color: tokens.ink,
                        fontFamily: tokens.font, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}><Icon.phone s={14} c={tokens.ink} /> {t.contactCustomer}</button>
                      <button style={{
                        height: 36, padding: '0 14px', borderRadius: 10, border: `1px solid ${tokens.hair}`,
                        background: tokens.card, color: tokens.ink,
                        fontFamily: tokens.font, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}><Icon.calendar s={14} c={tokens.ink} /> {t.extendBooking}</button>
                      <button style={{
                        height: 36, padding: '0 14px', borderRadius: 10, border: 'none',
                        background: tokens.ink, color: '#fff',
                        fontFamily: tokens.font, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
                      }}><Icon.check s={14} c="#fff" /> {t.markReturned}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenCalendar, ScreenFleetMgmt, ScreenOverdue, Sidebar });

// ─── 12. Employee account management (S-08) ──────────────────
function EmpRoleBadge({ role, t }) {
  const admin = role === 'admin';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: 6,
      background: admin ? tokens.accentSoft : tokens.greySoft,
      color: admin ? tokens.accent : tokens.grey,
      fontSize: 11, fontWeight: 650, letterSpacing: 0.1, textTransform: 'uppercase',
    }}>
      {admin ? <Icon.key s={11} c={tokens.accent} /> : <Icon.user s={11} c={tokens.grey} />}
      {admin ? t.roleAdmin : t.roleEmployee}
    </span>
  );
}

function EmpStatusBadge({ status, t }) {
  const active = status === 'active';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: 6,
      background: active ? tokens.greenSoft : tokens.amberSoft,
      color: active ? tokens.green : tokens.amber,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.1, textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 99, background: active ? tokens.green : tokens.amber }} />
      {active ? t.activeS : t.invitedS}
    </span>
  );
}

function ScreenEmployees() {
  const t = useLang();
  const [team, setTeam] = React.useState([
    { id: 1, name: 'Piotr Bednarz', email: 'piotr.bednarz@flota.pl', role: 'admin', status: 'active', last: t.onlineNow, init: 'PB' },
    { id: 2, name: 'Anna Nowak', email: 'anna.nowak@flota.pl', role: 'employee', status: 'active', last: '12 min temu', init: 'AN' },
    { id: 3, name: 'Marek Lis', email: 'marek.lis@flota.pl', role: 'employee', status: 'active', last: '2 godz. temu', init: 'ML' },
    { id: 4, name: 'Tomasz Wójcik', email: 'tomasz.wojcik@flota.pl', role: 'employee', status: 'active', last: 'wczoraj', init: 'TW' },
    { id: 5, name: 'Karolina Mazur', email: 'karolina.mazur@flota.pl', role: 'employee', status: 'invited', last: 'zaproszenie · 2 dni temu', init: 'KM' },
  ]);
  const [adding, setAdding] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [newRole, setNewRole] = React.useState('employee');

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const kpis = [
    { l: t.activeS, n: team.filter(e => e.status === 'active').length, c: tokens.green },
    { l: t.invitedS, n: team.filter(e => e.status === 'invited').length, c: tokens.amber },
    { l: t.roleAdmin, n: team.filter(e => e.role === 'admin').length, c: tokens.accent },
  ];

  const inputStyle = {
    width: '100%', height: 44, borderRadius: 10, border: `1px solid ${tokens.hair}`,
    background: tokens.bg, padding: '0 14px', fontFamily: tokens.font, fontSize: 14,
    color: tokens.ink, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: tokens.bg, fontFamily: tokens.font, position: 'relative' }}>
      <Sidebar active="team" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          padding: '22px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          borderBottom: `1px solid ${tokens.hair2}`,
        }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{team.length} osób · 1 administrator</div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8, margin: '4px 0 0', lineHeight: 1 }}>{t.employees}</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
              borderRadius: 10, background: tokens.card, boxShadow: tokens.shadow1,
              fontSize: 12.5, color: tokens.muted, fontWeight: 540, minWidth: 200,
            }}>
              <Icon.search s={14} c={tokens.muted} /> Imię lub e-mail…
            </div>
            <button onClick={() => { setNewRole('employee'); setAdding(true); }} style={{
              height: 36, padding: '0 14px', borderRadius: 10, border: 'none',
              background: tokens.ink, color: '#fff',
              fontFamily: tokens.font, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}><Icon.plus s={14} c="#fff" /> {t.addEmployee}</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ padding: '20px 28px 6px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: tokens.card, borderRadius: 16, padding: '14px 16px', boxShadow: tokens.shadow1 }}>
              <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8, lineHeight: 1 }}>{k.n}</span>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: k.c }} />
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 28px 16px' }}>
          <div style={{ background: tokens.card, borderRadius: 16, boxShadow: tokens.shadow1, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2.4fr 1fr 1fr 1.4fr 1.6fr',
              padding: '12px 18px', borderBottom: `1px solid ${tokens.hair2}`,
              fontSize: 11, color: tokens.muted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
            }}>
              <div>{t.fullName}</div>
              <div>{t.role}</div>
              <div>Status</div>
              <div>{t.lastActive}</div>
              <div style={{ textAlign: 'right' }}></div>
            </div>
            {team.map((e, i) => (
              <div key={e.id} style={{
                display: 'grid', gridTemplateColumns: '2.4fr 1fr 1fr 1.4fr 1.6fr',
                padding: '14px 18px', alignItems: 'center',
                borderBottom: i === team.length - 1 ? 'none' : `1px solid ${tokens.hair2}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 99, flexShrink: 0,
                    background: e.role === 'admin' ? tokens.accent : tokens.ink, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 650, letterSpacing: 0.3,
                  }}>{e.init}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                    <div style={{ fontSize: 11.5, color: tokens.muted, marginTop: 1, fontFamily: tokens.mono }}>{e.email}</div>
                  </div>
                </div>
                <div><EmpRoleBadge role={e.role} t={t} /></div>
                <div><EmpStatusBadge status={e.status} t={t} /></div>
                <div style={{ fontSize: 12.5, color: tokens.ink2 }}>{e.last}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setToast({ kind: 'ok', text: `${t.resetSentTo} ${e.email}` })} style={{
                    height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${tokens.hair}`,
                    background: tokens.card, color: tokens.ink,
                    fontFamily: tokens.font, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}><Icon.message s={13} c={tokens.ink2} /> {t.resetPassword}</button>
                  <button onClick={() => setConfirmRemove(e)} disabled={e.role === 'admin'} style={{
                    width: 32, height: 32, borderRadius: 9, border: `1px solid ${tokens.hair}`,
                    background: tokens.card, cursor: e.role === 'admin' ? 'not-allowed' : 'pointer',
                    opacity: e.role === 'admin' ? 0.35 : 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }} title={t.removeEmp}><Icon.close s={14} c={tokens.red} /></button>
                </div>
              </div>
            ))}
          </div>
          {/* Self-service note */}
          <div style={{
            marginTop: 14, padding: '14px 16px', borderRadius: 14, background: tokens.card,
            boxShadow: tokens.shadow1, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: tokens.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon.key s={16} c={tokens.muted} />
            </div>
            <div style={{ fontSize: 12.5, color: tokens.ink2, lineHeight: 1.4 }}>{t.selfResetNote}</div>
          </div>
        </div>
      </div>

      {/* Add employee modal */}
      {adding && (
        <div onClick={() => setAdding(false)} style={{
          position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(20,18,22,0.45)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={(ev) => ev.stopPropagation()} style={{
            width: 460, background: tokens.card, borderRadius: 20, padding: 26,
            boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4 }}>{t.addEmployee}</div>
                <div style={{ fontSize: 12.5, color: tokens.muted, marginTop: 4 }}>Wyśle e-mail z linkiem aktywacyjnym.</div>
              </div>
              <button onClick={() => setAdding(false)} style={{ ...chrome.iconBtn, width: 32, height: 32, boxShadow: 'none', background: tokens.bg }}>
                <Icon.close s={16} c={tokens.ink} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.fullName}</label>
                <input style={inputStyle} placeholder="np. Robert Zieliński" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.emailAddr}</label>
                <input style={inputStyle} placeholder="imie.nazwisko@flota.pl" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.role}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ id: 'employee', l: t.roleEmployee }, { id: 'admin', l: t.roleAdmin }].map(r => (
                    <button key={r.id} onClick={() => setNewRole(r.id)} style={{
                      flex: 1, height: 42, borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${newRole === r.id ? tokens.ink : tokens.hair}`,
                      background: newRole === r.id ? tokens.ink : tokens.card,
                      color: newRole === r.id ? '#fff' : tokens.ink,
                      fontFamily: tokens.font, fontSize: 13, fontWeight: 600,
                    }}>{r.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setAdding(false)} style={{
                flex: 1, height: 46, borderRadius: 12, border: `1px solid ${tokens.hair}`,
                background: tokens.card, color: tokens.ink,
                fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer',
              }}>{t.cancelB}</button>
              <button onClick={() => {
                setTeam(prev => [...prev, { id: Date.now(), name: 'Robert Zieliński', email: 'robert.zielinski@flota.pl', role: newRole, status: 'invited', last: 'zaproszenie · teraz', init: 'RZ' }]);
                setAdding(false);
                setToast({ kind: 'ok', text: `${t.sendInvite} → robert.zielinski@flota.pl` });
              }} style={{
                flex: 2, height: 46, borderRadius: 12, border: 'none',
                background: tokens.accent, color: '#fff',
                fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}><Icon.message s={15} c="#fff" /> {t.sendInvite}</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirm modal */}
      {confirmRemove && (
        <div onClick={() => setConfirmRemove(null)} style={{
          position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(20,18,22,0.45)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={(ev) => ev.stopPropagation()} style={{
            width: 400, background: tokens.card, borderRadius: 20, padding: 26, boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: tokens.redSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Icon.warning s={24} c={tokens.red} />
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4 }}>{t.removeConfirmQ}</div>
            <div style={{ fontSize: 13.5, color: tokens.ink2, marginTop: 8, lineHeight: 1.45 }}>
              <b style={{ color: tokens.ink }}>{confirmRemove.name}</b> — {t.removeConfirmSub}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setConfirmRemove(null)} style={{
                flex: 1, height: 46, borderRadius: 12, border: `1px solid ${tokens.hair}`,
                background: tokens.card, color: tokens.ink,
                fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer',
              }}>{t.cancelB}</button>
              <button onClick={() => {
                setTeam(prev => prev.filter(x => x.id !== confirmRemove.id));
                setToast({ kind: 'warn', text: `${t.removedEmp} · ${confirmRemove.name}` });
                setConfirmRemove(null);
              }} style={{
                flex: 1, height: 46, borderRadius: 12, border: 'none',
                background: tokens.red, color: '#fff',
                fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer',
              }}>{t.removeEmp}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12,
          background: tokens.ink, color: '#fff', boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
          fontSize: 13, fontWeight: 600, maxWidth: 460,
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: 99, flexShrink: 0,
            background: toast.kind === 'warn' ? tokens.red : tokens.green,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon.check s={13} c="#fff" />
          </span>
          {toast.text}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ScreenEmployees });
