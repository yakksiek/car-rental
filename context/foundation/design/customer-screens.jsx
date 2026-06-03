// Customer-facing mobile screens for Flota
// Home, Fleet listing, Vehicle detail, Reservation form, My Reservations

// ─── 1. Home ─────────────────────────────────────────────────
function ScreenHome() {
  const t = useLang();
  const [type, setType] = React.useState('all');
  const featured = VEHICLES.filter(v => v.popular);
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '60px 22px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 650, color: tokens.accent, letterSpacing: 1.2, textTransform: 'uppercase' }}>SOB · 23 MAR</div>
            <div style={{ fontSize: 13, fontWeight: 540, color: tokens.muted, marginTop: 4, letterSpacing: -0.1 }}>Warszawa · Mokotów</div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 99, background: tokens.accent, color: tokens.accentInk,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 500, letterSpacing: 0.4,
            boxShadow: '0 4px 14px rgba(180,54,56,0.30)',
          }}>JK</div>
        </div>
        {/* Hero */}
        <div style={{ marginTop: 32 }}>
          <h1 style={{
            fontWeight: 700, fontSize: 56, color: tokens.ink, letterSpacing: -1.2,
            lineHeight: 0.96, margin: 0,
          }}>
            Dzień dobry,<br/>
            Jakub<span style={{ color: tokens.accent }}>.</span>
          </h1>
          <div style={{ fontSize: 14, color: tokens.ink2, marginTop: 14, lineHeight: 1.4, maxWidth: 300 }}>
            {t.tagline}
          </div>
        </div>
      </div>
      {/* Type pill bar — icon + label */}
      <div style={{
        margin: '22px 0 4px', padding: '0 22px',
        display: 'flex', gap: 8, overflowX: 'auto',
      }}>
        {[
          { id: 'all', label: 'Wszystkie' },
          { id: 'cargo', label: t.typesShort[0] },
          { id: 'passenger', label: t.typesShort[1] },
          { id: 'transporter', label: t.typesShort[2] },
          { id: 'refrigerated', label: t.typesShort[3] },
          { id: 'flatbed', label: t.typesShort[4] },
        ].map(opt => {
          const A = type === opt.id;
          return (
            <button key={opt.id} onClick={() => setType(opt.id)} style={{
              height: 40, padding: '0 14px 0 10px', borderRadius: 9999,
              border: `1px solid ${A ? tokens.ink : tokens.hair}`,
              background: A ? tokens.ink : tokens.card,
              color: A ? '#fff' : tokens.ink,
              fontFamily: tokens.font, fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
              transition: 'all .15s',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 18 }}>
                {opt.id === 'all'
                  ? <Icon.grid s={15} c={A ? '#fff' : tokens.ink} />
                  : <Silhouette kind={opt.id} color={A ? '#fff' : tokens.ink} w={28} />}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 110 }}>
        {/* Featured crimson card */}
        <div style={{ padding: '18px 22px 0' }}>
          <div style={{
            position: 'relative', background: tokens.accent, color: tokens.accentInk,
            borderRadius: 24, padding: '22px 22px 20px', overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(180,54,56,0.22)',
          }}>
            {/* decorative circles */}
            <div style={{ position: 'absolute', top: -40, right: -50, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
            <div style={{ position: 'absolute', top: 10, right: 8, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.09)' }} />
            <div style={{ fontFamily: tokens.mono, fontSize: 10.5, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,250,242,0.7)' }}>
              {t.yourDeposit}
            </div>
            <div style={{
              fontWeight: 700, fontSize: 56,
              letterSpacing: -1.6, lineHeight: 1, marginTop: 12,
            }}>
              <span>2 500</span><span style={{ fontSize: 28, opacity: 0.7, marginLeft: 6 }}>zł</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 540, opacity: 0.85, letterSpacing: -0.05 }}>
                {t.refundedAfter} · R-2401
              </div>
              <svg width="70" height="28" viewBox="0 0 70 28" style={{ flexShrink: 0 }}>
                <path d="M2 22 L14 18 L24 20 L34 12 L46 14 L56 6 L68 4" stroke="rgba(255,250,242,0.9)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 22 L14 18 L24 20 L34 12 L46 14 L56 6 L68 4 L68 26 L2 26 Z" fill="rgba(255,255,255,0.12)" />
              </svg>
            </div>
          </div>
        </div>
        {/* Popular */}
        <div style={{ padding: '18px 22px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6 }}>{t.popular}</div>
          <div style={{ fontSize: 13, color: tokens.accent, fontWeight: 650 }}>{t.seeAll}</div>
        </div>
        <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {featured.slice(0, 2).map(v => <FleetCard key={v.id} v={v} t={t} />)}
        </div>
        {/* Quick stats strip */}
        <div style={{ padding: '20px 22px 8px', fontSize: 13, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>
          Dlaczego Flota
        </div>
        <div style={{
          padding: '0 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {[
            { n: '83', l: 'pojazdów w flocie' },
            { n: '24/7', l: 'odbiór i zwrot' },
            { n: '0 zł', l: 'opłata wstępna' },
            { n: '14 lat', l: 'na rynku PL' },
          ].map((s, i) => (
            <div key={i} style={{
              background: tokens.card, borderRadius: 16, padding: '14px 14px 12px',
              boxShadow: tokens.shadow1,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6 }}>{s.n}</div>
              <div style={{ fontSize: 11.5, color: tokens.muted, marginTop: 2, letterSpacing: -0.1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      <TabBar
        tabs={[
          { id: 'home', icon: Icon.home, label: t.home },
          { id: 'cal', icon: Icon.calendar, label: t.calendar },
          { id: 'saved', icon: Icon.heart, label: t.saved },
          { id: 'me', icon: Icon.user, label: t.profile },
        ]}
        active="home"
      />
    </div>
  );
}

// ─── 2. Fleet listing ────────────────────────────────────────
function ScreenFleet() {
  const t = useLang();
  const [type, setType] = React.useState('cargo');
  const types = [
    { id: 'cargo', icon: Icon.truck },
    { id: 'passenger', icon: Icon.seats },
    { id: 'transporter', icon: Icon.truck },
    { id: 'refrigerated', icon: Icon.truck },
    { id: 'flatbed', icon: Icon.truck },
  ];
  const filtered = type === 'all' ? VEHICLES : VEHICLES.filter(v => v.type === type);
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div style={{
        padding: '54px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: tokens.bg, position: 'relative', zIndex: 5,
      }}>
        <button style={chrome.iconBtn}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ fontSize: 17, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{t.fleet}</div>
        <button style={chrome.iconBtn}><Icon.search s={18} c={tokens.ink} /></button>
      </div>
      {/* Floating pill type bar */}
      <div style={{
        padding: '6px 14px', display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 6,
      }}>
        {types.map((tp, i) => (
          <button key={tp.id} onClick={() => setType(tp.id)} style={{
            height: 64, minWidth: 84, padding: '0 14px', borderRadius: 22,
            background: type === tp.id ? tokens.ink : tokens.card,
            color: type === tp.id ? '#fff' : tokens.ink,
            border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: tokens.font, fontSize: 11, fontWeight: 600, letterSpacing: -0.1,
            boxShadow: type === tp.id ? '0 6px 18px rgba(0,0,0,0.18)' : tokens.shadow1,
            transition: 'all .15s',
          }}>
            <tp.icon s={20} c={type === tp.id ? '#fff' : tokens.ink} />
            <span>{t.typesShort[i]}</span>
          </button>
        ))}
      </div>
      {/* Filter row */}
      <div style={{
        padding: '6px 22px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ fontSize: 13, color: tokens.muted, fontWeight: 540 }}>
          <b style={{ color: tokens.ink, fontWeight: 700 }}>{filtered.length}</b> {t.results}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill style={{ height: 30, padding: '0 12px', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <Icon.calendar s={13} c={tokens.ink} /> 24 – 27 Mar
            </span>
          </Pill>
          <Pill style={{ height: 30, padding: '0 12px', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <Icon.filter s={13} c={tokens.ink} /> Filtry
            </span>
          </Pill>
        </div>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 18px 110px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(v => <FleetCard key={v.id} v={v} t={t} />)}
      </div>
      <TabBar
        tabs={[
          { id: 'home', icon: Icon.home, label: t.home },
          { id: 'cal', icon: Icon.calendar, label: t.calendar },
          { id: 'saved', icon: Icon.heart, label: t.saved },
          { id: 'me', icon: Icon.user, label: t.profile },
        ]}
        active="home"
      />
    </div>
  );
}

// ─── 3. Vehicle detail ───────────────────────────────────────
function ScreenDetail() {
  const t = useLang();
  const v = VEHICLES[0]; // Sprinter
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Floating nav */}
      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0, zIndex: 10,
        padding: '0 18px', display: 'flex', justifyContent: 'space-between',
      }}>
        <button style={chrome.iconBtn}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={chrome.iconBtn}><Icon.heart s={18} c={tokens.ink} /></button>
          <button style={chrome.iconBtn}><Icon.more s={18} c={tokens.ink} /></button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 130 }}>
        {/* Hero with silhouette */}
        <div style={{
          padding: '110px 24px 30px', background: tokens.card,
          borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            {v.year} · Furgon
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8,
            margin: '8px 0 4px', lineHeight: 1.02,
          }}>{v.brand} {v.model.split(' ')[0]}</h1>
          <div style={{ display: 'inline-flex', marginTop: 8 }}>
            <StatusBadge status="available" t={t} />
          </div>
          <div style={{ margin: '16px 0 8px', display: 'flex', justifyContent: 'center' }}>
            <Silhouette kind={v.type} color={tokens.ink} w={300} />
          </div>
          {/* Gallery dots */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
            {[0,1,2,3].map(i => (
              <span key={i} style={{
                width: i === 0 ? 18 : 6, height: 6, borderRadius: 99,
                background: i === 0 ? tokens.ink : tokens.hair,
              }}/>
            ))}
          </div>
        </div>
        {/* Specs */}
        <div style={{ padding: '20px 22px 6px', fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {t.specs}
        </div>
        <div style={{
          margin: '0 18px', background: tokens.card, borderRadius: 20,
          boxShadow: tokens.shadow1,
        }}>
          {[
            { i: Icon.seats, k: t.seats, v: `${v.seats} ${v.seats === 9 ? 'osób' : ''}` },
            { i: Icon.fuel, k: t.fuel, v: v.fuel },
            { i: Icon.gear, k: t.transmission, v: v.trans },
            { i: Icon.ruler, k: t.cargo, v: v.cargo },
            { i: Icon.weight, k: t.payload, v: v.payload },
          ].map((row, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, background: tokens.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <row.i s={16} c={tokens.ink} />
              </div>
              <div style={{ fontSize: 14, color: tokens.muted, fontWeight: 540, flex: 1 }}>{row.k}</div>
              <div style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{row.v}</div>
            </div>
          ))}
        </div>
        {/* Pricing */}
        <div style={{ padding: '24px 22px 6px', fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {t.pricing}
        </div>
        <div style={{
          margin: '0 18px', background: tokens.card, borderRadius: 20, padding: 18,
          boxShadow: tokens.shadow1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
        }}>
          {[
            { k: t.daily, v: `${v.daily} zł`, big: true },
            { k: t.monthly, v: `${v.monthly} zł`, big: true },
            { k: t.deposit, v: `${v.deposit} zł` },
            { k: t.kmLimit, v: `${v.kmLimit} km` },
            { k: t.extraKm, v: `${v.extraKm} zł/km` },
            { k: 'VAT', v: 'Doliczany' },
          ].map((p, i) => (
            <div key={i} style={{ paddingBottom: i < 4 ? 12 : 0, borderBottom: i < 4 ? `1px solid ${tokens.hair2}` : 'none' }}>
              <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase' }}>{p.k}</div>
              <div style={{
                fontSize: p.big ? 18 : 14, fontWeight: p.big ? 700 : 600,
                color: tokens.ink, letterSpacing: -0.3, marginTop: 2,
              }}>{p.v}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Sticky bottom CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 18px 30px', background: tokens.bg,
        borderTop: `1px solid ${tokens.hair2}`, zIndex: 5,
      }}>
        <button style={chrome.cta}>
          {t.checkAvailability} — {v.daily} zł{t.perDay} <Icon.arrowRight s={16} c="#fff" />
        </button>
      </div>
    </div>
  );
}

// ─── 4. Reservation form ─────────────────────────────────────
function ScreenReserve() {
  const t = useLang();
  const v = VEHICLES[0];
  const [mode, setMode] = React.useState('daily');
  const [start, setStart] = React.useState(24);
  const [end, setEnd] = React.useState(27);
  const days = end - start;
  const total = mode === 'daily' ? v.daily * days : Math.round(v.monthly / 30 * days);
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div style={{ padding: '54px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={chrome.iconBtn}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ fontSize: 17, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{t.reservation}</div>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 18px 180px' }}>
        {/* Selected vehicle */}
        <div style={{
          background: tokens.card, borderRadius: 18, padding: 14,
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: tokens.shadow1,
        }}>
          <div style={{
            width: 88, height: 56, borderRadius: 10, background: tokens.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Silhouette kind={v.type} color={tokens.ink} w={78} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{v.brand} {v.model.split(' ')[0]}</div>
            <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2 }}>{v.year} · {v.plate}</div>
          </div>
          <Icon.chevR s={16} c={tokens.muted} />
        </div>
        {/* Mode toggle */}
        <div style={{ marginTop: 18, padding: 4, background: tokens.card, borderRadius: 12, display: 'flex', boxShadow: tokens.shadow1 }}>
          {[{ id: 'daily', l: t.daily }, { id: 'monthly', l: t.monthly }].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              flex: 1, height: 36, borderRadius: 9, border: 'none',
              background: mode === m.id ? tokens.ink : 'transparent',
              color: mode === m.id ? '#fff' : tokens.ink,
              fontFamily: tokens.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all .15s',
            }}>{m.l}</button>
          ))}
        </div>
        {/* Date range card with mini-calendar */}
        <div style={{ marginTop: 14, background: tokens.card, borderRadius: 20, padding: 16, boxShadow: tokens.shadow1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase' }}>Marzec 2026</div>
              <div style={{ fontSize: 15, fontWeight: 650, color: tokens.ink, marginTop: 1, letterSpacing: -0.2 }}>{start} – {end} marca · {days} dni</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={chrome.iconBtnSm}><Icon.back s={14} c={tokens.ink} /></button>
              <button style={chrome.iconBtnSm}><Icon.chevR s={14} c={tokens.ink} /></button>
            </div>
          </div>
          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 11, color: tokens.muted, fontWeight: 600, marginBottom: 4 }}>
            {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => <div key={d} style={{ textAlign: 'center' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: 35 }, (_, i) => {
              const day = i - 6; // start on Mon, March 2026 = Sun=1, so Mon Mar 2... let's use simple
              if (day < 1 || day > 31) return <div key={i} />;
              const unavail = [12, 13, 19, 20, 21].includes(day);
              const inRange = day >= start && day <= end;
              const endpoint = day === start || day === end;
              return (
                <div key={i} onClick={() => !unavail && (day < start ? setStart(day) : setEnd(day))} style={{
                  height: 34, borderRadius: 8,
                  background: endpoint ? tokens.ink : inRange ? tokens.bg : 'transparent',
                  color: endpoint ? '#fff' : unavail ? tokens.muted : tokens.ink,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: endpoint ? 700 : 500,
                  textDecoration: unavail ? 'line-through' : 'none',
                  opacity: unavail ? 0.4 : 1,
                  cursor: unavail ? 'not-allowed' : 'pointer',
                  transition: 'all .12s',
                }}>{day}</div>
              );
            })}
          </div>
          {/* Legend — clarifies why a date is greyed out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${tokens.hair2}` }}>
            <span style={{ width: 18, height: 18, borderRadius: 6, background: tokens.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: tokens.muted, textDecoration: 'line-through' }}>15</span>
            </span>
            <span style={{ fontSize: 12, color: tokens.muted, fontWeight: 540 }}>{t.unavailableLegend}</span>
          </div>
        </div>
        {/* Customer info card */}
        <div style={{ marginTop: 14, background: tokens.card, borderRadius: 20, padding: 6, boxShadow: tokens.shadow1 }}>
          {[
            { l: 'Imię i nazwisko', v: 'Jakub Kowalski', i: Icon.user },
            { l: 'Email', v: 'jakub.k@example.pl', i: Icon.message },
            { l: 'Telefon', v: '+48 600 123 456', i: Icon.phone },
          ].map((f, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}`,
            }}>
              <f.i s={16} c={tokens.muted} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.1 }}>{f.l}</div>
                <div style={{ fontSize: 14, color: tokens.ink, fontWeight: 540, marginTop: 1 }}>{f.v}</div>
              </div>
              <Icon.edit s={14} c={tokens.muted} />
            </div>
          ))}
        </div>
      </div>
      {/* Sticky bottom price + CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: tokens.bg, paddingBottom: 30, zIndex: 5,
      }}>
        <div style={{ padding: '12px 18px 0' }}>
          <div style={{
            background: tokens.accent, borderRadius: 18, padding: '14px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            color: tokens.accentInk, boxShadow: '0 10px 28px rgba(180,54,56,0.22)',
          }}>
            <div>
              <div style={{ fontFamily: tokens.mono, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,250,242,0.7)' }}>{t.totalEst}</div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>
                {total.toLocaleString('pl-PL')}<span style={{ fontSize: 18, opacity: 0.7, marginLeft: 4 }}>zł</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,250,242,0.75)', fontWeight: 540 }}>{days} dni × {mode === 'daily' ? v.daily : Math.round(v.monthly/30)} zł</div>
              <div style={{ fontSize: 11, color: 'rgba(255,250,242,0.6)', marginTop: 2 }}>+ kaucja {v.deposit} zł</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '10px 18px 0' }}>
          <button style={chrome.cta}>{t.continueBtn} <Icon.arrowRight s={16} c="#fff" /></button>
        </div>
      </div>
    </div>
  );
}

// ─── 5. My Reservations ──────────────────────────────────────
function ScreenMyReservations() {
  const t = useLang();
  const list = [
    { id: 'R-2401', v: VEHICLES[0], dates: '24 – 27 mar', total: 960, status: 'active', subtitle: 'Pickup completed · 09:14' },
    { id: 'R-2389', v: VEHICLES[4], dates: '12 – 14 mar', total: 840, status: 'overdue', subtitle: '2 dni po terminie · kontakt' },
    { id: 'R-2402', v: VEHICLES[2], dates: '02 – 09 kwi', total: 2660, status: 'pending', subtitle: 'Czeka na zatwierdzenie' },
    { id: 'R-2376', v: VEHICLES[1], dates: '28 lut – 04 mar', total: 1450, status: 'completed', subtitle: 'Zakończona · faktura wystawiona' },
    { id: 'R-2354', v: VEHICLES[3], dates: '08 – 10 lut', total: 680, status: 'rejected', subtitle: 'Powód: wymagana kategoria C+E' },
  ];
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '58px 22px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Jakub Kowalski</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, color: tokens.ink, letterSpacing: -1, margin: '6px 0 0', lineHeight: 1 }}>{t.myReservations}</h1>
        </div>
        <button style={chrome.iconBtn}><Icon.filter s={18} c={tokens.ink} /></button>
      </div>
      {/* Filter chips */}
      <div style={{ padding: '8px 22px 6px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        <Pill active>Wszystkie</Pill>
        <Pill>Aktywne</Pill>
        <Pill>Oczekujące</Pill>
        <Pill>Zakończone</Pill>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 18px 110px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map(r => (
          <div key={r.id} style={{
            background: tokens.card, borderRadius: 20, padding: 16,
            boxShadow: tokens.shadow1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.4 }}>{r.id}</div>
                <div style={{ fontSize: 15, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, marginTop: 2 }}>
                  {r.v.brand} {r.v.model.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
              <StatusBadge status={r.status} t={t} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 76, height: 50, borderRadius: 10, background: tokens.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Silhouette kind={r.v.type} color={tokens.ink} w={66} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: tokens.ink, fontWeight: 540 }}>
                  <Icon.calendar s={13} c={tokens.muted} /> {r.dates}
                </div>
                <div style={{ fontSize: 12, color: r.status === 'overdue' || r.status === 'rejected' ? tokens.red : tokens.muted, marginTop: 4, lineHeight: 1.3 }}>
                  {r.subtitle}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: tokens.ink, letterSpacing: -0.3 }}>{r.total} zł</div>
                <div style={{ fontSize: 11, color: tokens.muted, marginTop: 1 }}>łącznie</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <TabBar
        tabs={[
          { id: 'home', icon: Icon.home, label: t.home },
          { id: 'cal', icon: Icon.calendar, label: t.calendar },
          { id: 'saved', icon: Icon.heart, label: t.saved },
          { id: 'me', icon: Icon.user, label: t.profile },
        ]}
        active="cal"
      />
    </div>
  );
}

// ─── 5a. Request summary / review ────────────────────────────
function ScreenReserveSummary() {
  const t = useLang();
  const v = VEHICLES[0]; // Sprinter — matches the reservation form
  const days = 3;
  const total = v.daily * days; // 960
  const [agree, setAgree] = React.useState(true);
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div style={{ padding: '54px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={chrome.iconBtn}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ fontSize: 17, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{t.reviewTitle}</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 18px 200px' }}>
        {/* Vehicle */}
        <div style={{ background: tokens.card, borderRadius: 18, padding: 14, display: 'flex', alignItems: 'center', gap: 14, boxShadow: tokens.shadow1 }}>
          <div style={{ width: 88, height: 56, borderRadius: 10, background: tokens.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Silhouette kind={v.type} color={tokens.ink} w={78} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{v.brand} {v.model.split(' ')[0]}</div>
            <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2 }}>{v.year} · {v.plate}</div>
          </div>
          <span style={{ fontSize: 12.5, color: tokens.accent, fontWeight: 650 }}>{t.changeBtn}</span>
        </div>

        {/* Booking details */}
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '22px 4px 8px' }}>{t.bookingDetails}</div>
        <div style={{ background: tokens.card, borderRadius: 18, padding: '4px 16px', boxShadow: tokens.shadow1 }}>
          {[
            { k: t.pickup, v: '24 mar · 14:00' },
            { k: t.return, v: '27 mar · 10:00' },
            { k: t.duration, v: `${days} dni` },
            { k: t.daily, v: `${v.daily} zł${t.perDay}` },
          ].map((r, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}` }}>
              <span style={{ fontSize: 13, color: tokens.muted, fontWeight: 540 }}>{r.k}</span>
              <span style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{r.v}</span>
            </div>
          ))}
        </div>

        {/* Customer */}
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '22px 4px 8px' }}>{t.customerData}</div>
        <div style={{ background: tokens.card, borderRadius: 18, padding: 6, boxShadow: tokens.shadow1 }}>
          {[
            { i: Icon.user, l: 'Imię i nazwisko', v: 'Jakub Kowalski' },
            { i: Icon.message, l: 'Email', v: 'jakub.k@example.pl' },
            { i: Icon.phone, l: 'Telefon', v: '+48 600 123 456' },
          ].map((f, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}` }}>
              <f.i s={16} c={tokens.muted} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.1 }}>{f.l}</div>
                <div style={{ fontSize: 14, color: tokens.ink, fontWeight: 540, marginTop: 1 }}>{f.v}</div>
              </div>
              <Icon.edit s={14} c={tokens.muted} />
            </div>
          ))}
        </div>

        {/* Payment */}
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '22px 4px 8px' }}>{t.payment}</div>
        <div style={{ background: tokens.card, borderRadius: 18, padding: 16, boxShadow: tokens.shadow1 }}>
          {[
            { k: `${t.rentalCost} · ${days} dni × ${v.daily} zł`, v: `${total} zł` },
            { k: t.depositRefundable, v: `${v.deposit} zł` },
          ].map((r, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}` }}>
              <span style={{ fontSize: 13, color: tokens.muted, fontWeight: 540 }}>{r.k}</span>
              <span style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{r.v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${tokens.hair2}` }}>
            <Icon.fuel s={14} c={tokens.muted} />
            <span style={{ fontSize: 12, color: tokens.ink2 }}>{t.paymentAtPickup}</span>
          </div>
        </div>

        {/* Terms */}
        <button onClick={() => setAgree(a => !a)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginTop: 16,
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0 4px',
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            background: agree ? tokens.ink : 'transparent', border: `1.5px solid ${agree ? tokens.ink : tokens.hair}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{agree && <Icon.check s={14} c="#fff" />}</span>
          <span style={{ fontSize: 13, color: tokens.ink2, lineHeight: 1.4, fontWeight: 540 }}>{t.agreeTerms}</span>
        </button>
      </div>

      {/* Bottom: total + Request booking */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: tokens.bg, paddingBottom: 30, zIndex: 5 }}>
        <div style={{ padding: '12px 18px 0' }}>
          <div style={{
            background: tokens.accent, borderRadius: 18, padding: '14px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            color: tokens.accentInk, boxShadow: '0 10px 28px rgba(180,54,56,0.22)',
          }}>
            <div>
              <div style={{ fontFamily: tokens.mono, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,250,242,0.7)' }}>{t.totalEst}</div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>
                {total.toLocaleString('pl-PL')}<span style={{ fontSize: 18, opacity: 0.7, marginLeft: 4 }}>zł</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,250,242,0.75)', fontWeight: 540 }}>{days} dni × {v.daily} zł</div>
              <div style={{ fontSize: 11, color: 'rgba(255,250,242,0.6)', marginTop: 2 }}>+ kaucja {v.deposit} zł</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '10px 18px 0' }}>
          <button style={chrome.cta}>{t.submitReservation} <Icon.arrowRight s={16} c="#fff" /></button>
        </div>
      </div>
    </div>
  );
}

// ─── 5b. Request received (S-02 confirmation) ────────────────
function ScreenReserveConfirm() {
  const t = useLang();
  const v = VEHICLES[0]; // Sprinter — matches the reservation form
  const steps = [
    { t: t.next1t, d: t.next1d },
    { t: t.next2t, d: t.next2d },
    { t: t.next3t, d: t.next3d },
  ];
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '64px 22px 130px' }}>
        {/* Hero */}
        <div style={{
          width: 72, height: 72, borderRadius: 99, background: tokens.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          boxShadow: '0 10px 28px rgba(180,54,56,0.28)',
        }}>
          <Icon.check s={34} c="#fff" />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8, textAlign: 'center', margin: 0, lineHeight: 1.05 }}>
          {t.requestReceived}
        </h1>
        <div style={{ fontSize: 14, color: tokens.ink2, textAlign: 'center', marginTop: 10, lineHeight: 1.45, maxWidth: 300, marginInline: 'auto' }}>
          {t.requestReceivedSub}
        </div>
        {/* Reference + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 }}>
          <span style={{ fontFamily: tokens.mono, fontSize: 13, fontWeight: 600, color: tokens.ink, background: tokens.card, padding: '6px 12px', borderRadius: 8, boxShadow: tokens.shadow1 }}>
            {t.reference} · R-2403
          </span>
          <StatusBadge status="pending" t={t} />
        </div>

        {/* Summary card */}
        <div style={{ background: tokens.card, borderRadius: 20, padding: 16, boxShadow: tokens.shadow1, marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: `1px solid ${tokens.hair2}` }}>
            <div style={{ width: 88, height: 56, borderRadius: 10, background: tokens.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Silhouette kind={v.type} color={tokens.ink} w={78} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{v.brand} {v.model.split(' ')[0]}</div>
              <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2 }}>{v.year} · {v.plate}</div>
            </div>
          </div>
          {[
            { k: t.dates, v: '24 – 27 marca · 3 dni' },
            { k: t.totalEst, v: '960 zł' },
            { k: t.deposit, v: `${v.deposit} zł` },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}`,
            }}>
              <span style={{ fontSize: 13, color: tokens.muted, fontWeight: 540 }}>{r.k}</span>
              <span style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{r.v}</span>
            </div>
          ))}
        </div>

        {/* What happens next */}
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '24px 4px 12px' }}>
          {t.whatNext}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '4px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 99, flexShrink: 0,
                  background: i === 0 ? tokens.accent : tokens.card,
                  border: i === 0 ? 'none' : `1.5px solid ${tokens.hair}`,
                  color: i === 0 ? '#fff' : tokens.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}>{i + 1}</div>
                {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 18, background: tokens.hair2, marginTop: 2 }} />}
              </div>
              <div style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{s.t}</div>
                <div style={{ fontSize: 12.5, color: tokens.muted, marginTop: 2, lineHeight: 1.4 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Emailed-to note */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '12px 14px',
          background: tokens.card, borderRadius: 14, boxShadow: tokens.shadow1,
        }}>
          <Icon.message s={16} c={tokens.muted} />
          <div style={{ fontSize: 12.5, color: tokens.ink2 }}>
            {t.emailedCopy} <b style={{ color: tokens.ink, fontWeight: 650 }}>jakub.k@example.pl</b>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 18px 30px', background: tokens.bg, borderTop: `1px solid ${tokens.hair2}`, zIndex: 5,
      }}>
        <button style={chrome.ctaInk}>{t.backToFleet} <Icon.arrowRight s={16} c="#fff" /></button>
      </div>
    </div>
  );
}

// ─── Shared chrome bits ─────────────────────────────────────
const chrome = {
  iconBtn: {
    width: 40, height: 40, borderRadius: 99, background: tokens.card,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', cursor: 'pointer', boxShadow: tokens.shadow1,
  },
  iconBtnSm: {
    width: 28, height: 28, borderRadius: 99, background: tokens.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', cursor: 'pointer',
  },
  cta: {
    width: '100%', height: 54, borderRadius: 16,
    background: tokens.accent, color: tokens.accentInk, border: 'none', cursor: 'pointer',
    fontFamily: tokens.font, fontSize: 15, fontWeight: 650, letterSpacing: -0.2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 10px 28px rgba(180,54,56,0.28), 0 2px 6px rgba(180,54,56,0.15)',
  },
  ctaInk: {
    width: '100%', height: 54, borderRadius: 16,
    background: tokens.ink, color: '#fff', border: 'none', cursor: 'pointer',
    fontFamily: tokens.font, fontSize: 15, fontWeight: 650, letterSpacing: -0.2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 2px 6px rgba(10,10,15,0.10)',
  },
};

Object.assign(window, {
  ScreenHome, ScreenFleet, ScreenDetail, ScreenReserve, ScreenMyReservations, ScreenReserveSummary, ScreenReserveConfirm, chrome,
});
