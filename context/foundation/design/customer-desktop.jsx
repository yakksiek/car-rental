// Customer-facing DESKTOP screens for Flota
// Marketing landing + fleet browse

function DesktopHeader({ active = 'home' }) {
  const t = useLang();
  const nav = [
    { id: 'home', label: 'Start' },
    { id: 'fleet', label: t.fleet },
    { id: 'rates', label: 'Cennik' },
    { id: 'biz', label: 'Dla firm' },
    { id: 'help', label: 'Pomoc' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 48px', borderBottom: `1px solid ${tokens.hair2}`,
      background: tokens.card, fontFamily: tokens.font,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: tokens.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: tokens.accentInk, fontSize: 22, fontWeight: 400, lineHeight: 1,
        }}>F</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4 }}>Flota</div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: 4, background: tokens.bg, borderRadius: 9999 }}>
        {nav.map(n => {
          const A = active === n.id;
          return (
            <div key={n.id} style={{
              padding: '8px 16px', borderRadius: 9999,
              background: A ? tokens.card : 'transparent',
              color: A ? tokens.ink : tokens.ink2,
              fontSize: 13, fontWeight: A ? 650 : 540, letterSpacing: -0.1, cursor: 'pointer',
              boxShadow: A ? tokens.shadow1 : 'none',
            }}>{n.label}</div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 13, color: tokens.ink2, fontWeight: 540 }}>PL · EN</div>
        <button style={{
          height: 38, padding: '0 18px', borderRadius: 9999, border: 'none',
          background: tokens.ink, color: '#fff',
          fontFamily: tokens.font, fontSize: 13, fontWeight: 650, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>Zaloguj się</button>
      </div>
    </div>
  );
}

// ─── 11. Customer Desktop · Home ─────────────────────────────
function ScreenDesktopHome() {
  const t = useLang();
  const featured = VEHICLES.slice(0, 3);
  return (
    <div style={{ height: '100%', overflow: 'auto', background: tokens.bg, fontFamily: tokens.font }}>
      <DesktopHeader active="home" />
      {/* Hero */}
      <div style={{ padding: '64px 48px 0', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 56, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 650, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 18 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: tokens.green }}/>
              47 pojazdów dostępnych dziś
            </span>
          </div>
          <h1 style={{
            fontSize: 96, fontWeight: 700, color: tokens.ink, letterSpacing: -3.4,
            lineHeight: 0.92, margin: 0,
          }}>
            Pojazdy<br/>
            użytkowe<span style={{ color: tokens.accent }}>.</span><br/>
            <span style={{ fontSize: 56, color: tokens.muted, letterSpacing: -1.6 }}>Na dzień. <span style={{ color: tokens.accent }}>Na miesiąc.</span></span>
          </h1>
          <p style={{
            fontSize: 17, color: tokens.ink2, marginTop: 26, marginBottom: 32,
            maxWidth: 460, lineHeight: 1.5,
          }}>
            Furgony, busy osobowe, lawety, izotermy i plandeki — od warszawskiej firmy z 14-letnim
            doświadczeniem. Rezerwacja online, bez ukrytych opłat.
          </p>
          {/* Search bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: tokens.card, borderRadius: 9999, padding: 4,
            boxShadow: tokens.shadow2, maxWidth: 560,
          }}>
            <div style={{ flex: 1, padding: '8px 18px' }}>
              <div style={{ fontSize: 10, color: tokens.muted, fontWeight: 650, letterSpacing: 0.3, textTransform: 'uppercase' }}>Typ</div>
              <div style={{ fontSize: 14, color: tokens.ink, fontWeight: 600, letterSpacing: -0.2, marginTop: 1 }}>Furgony</div>
            </div>
            <div style={{ width: 1, height: 32, background: tokens.hair2 }} />
            <div style={{ flex: 1.2, padding: '8px 18px' }}>
              <div style={{ fontSize: 10, color: tokens.muted, fontWeight: 650, letterSpacing: 0.3, textTransform: 'uppercase' }}>Daty</div>
              <div style={{ fontSize: 14, color: tokens.ink, fontWeight: 600, letterSpacing: -0.2, marginTop: 1 }}>24 – 27 marca</div>
            </div>
            <div style={{ width: 1, height: 32, background: tokens.hair2 }} />
            <div style={{ flex: 1, padding: '8px 18px' }}>
              <div style={{ fontSize: 10, color: tokens.muted, fontWeight: 650, letterSpacing: 0.3, textTransform: 'uppercase' }}>Oddział</div>
              <div style={{ fontSize: 14, color: tokens.ink, fontWeight: 600, letterSpacing: -0.2, marginTop: 1 }}>Warszawa · Mokotów</div>
            </div>
            <button style={{
              height: 52, padding: '0 22px', borderRadius: 9999, border: 'none',
              background: tokens.ink, color: '#fff',
              fontFamily: tokens.font, fontSize: 13.5, fontWeight: 650, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Icon.search s={15} c="#fff" /> Szukaj
            </button>
          </div>
          {/* Stat strip */}
          <div style={{ display: 'flex', gap: 36, marginTop: 36 }}>
            {[
              { n: '83', l: 'pojazdów' },
              { n: '14 lat', l: 'na rynku' },
              { n: '24/7', l: 'odbiór' },
              { n: '4.9', l: '/ 5 · 1280 opinii' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 26, fontWeight: 700, color: tokens.ink, letterSpacing: -0.8, lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: 11.5, color: tokens.muted, fontWeight: 540, marginTop: 4, letterSpacing: -0.05 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Right side — big silhouette card */}
        <div style={{ position: 'relative' }}>
          <div style={{
            background: tokens.card, borderRadius: 28, padding: '40px 32px 32px',
            boxShadow: tokens.shadow2, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 650, letterSpacing: 0.4, textTransform: 'uppercase' }}>Polecane · Furgon</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6, marginTop: 6, lineHeight: 1.1 }}>Mercedes-Benz<br/>Sprinter 317 CDI</div>
              </div>
              <StatusBadge status="available" t={t} />
            </div>
            <div style={{ margin: '32px 0 20px', display: 'flex', justifyContent: 'center' }}>
              <Silhouette kind="cargo" color={tokens.ink} w={420} />
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
              padding: '18px 0 0', borderTop: `1px solid ${tokens.hair2}`,
            }}>
              {[
                { i: Icon.seats, k: t.seats, v: '3' },
                { i: Icon.gear, k: t.transmission, v: 'Auto' },
                { i: Icon.fuel, k: t.fuel, v: 'Diesel' },
                { i: Icon.ruler, k: 'L×W×H', v: '4.30 m' },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <s.i s={13} c={tokens.muted} />
                    <span style={{ fontSize: 10.5, color: tokens.muted, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase' }}>{s.k}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, marginTop: 4 }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 22, padding: '16px 20px', borderRadius: 16,
              background: tokens.ink, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 650, letterSpacing: 0.3, textTransform: 'uppercase' }}>Od</div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, marginTop: 1 }}>
                  320 zł<span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}> /dzień</span>
                </div>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '0 16px', height: 40, borderRadius: 9999, background: '#fff', color: tokens.ink,
                fontSize: 13, fontWeight: 650, cursor: 'pointer',
              }}>Rezerwuj <Icon.arrowRight s={14} c={tokens.ink} /></div>
            </div>
          </div>
          {/* floating mini-availability card */}
          <div style={{
            position: 'absolute', bottom: -28, left: -28,
            background: tokens.card, borderRadius: 16, padding: '12px 16px',
            boxShadow: tokens.shadow2,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: tokens.greenSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon.check s={18} c={tokens.green} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 650, color: tokens.ink, letterSpacing: -0.1 }}>Dostępny dziś</div>
              <div style={{ fontSize: 10.5, color: tokens.muted, marginTop: 1 }}>4 sztuki w tym modelu</div>
            </div>
          </div>
        </div>
      </div>
      {/* Browse the fleet section */}
      <div style={{ padding: '88px 48px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 650, letterSpacing: 0.4, textTransform: 'uppercase' }}>5 kategorii · 83 pojazdy</div>
            <h2 style={{ fontSize: 52, fontWeight: 700, color: tokens.ink, letterSpacing: -1.6, margin: '6px 0 0', lineHeight: 1 }}>
              Wybierz typ pojazdu<span style={{ color: tokens.accent }}>.</span>
            </h2>
          </div>
          <div style={{ fontSize: 14, color: tokens.ink, fontWeight: 600, letterSpacing: -0.1, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            Cała flota <Icon.arrowRight s={15} c={tokens.ink} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {[
            { id: 'cargo', label: t.types[0], count: 28, daily: '290 zł' },
            { id: 'passenger', label: t.types[1], count: 14, daily: '380 zł' },
            { id: 'transporter', label: t.types[2], count: 6, daily: '520 zł' },
            { id: 'refrigerated', label: t.types[3], count: 9, daily: '420 zł' },
            { id: 'flatbed', label: t.types[4], count: 26, daily: '340 zł' },
          ].map((c, i) => (
            <div key={c.id} style={{
              background: i === 0 ? tokens.ink : tokens.card,
              color: i === 0 ? '#fff' : tokens.ink,
              borderRadius: 20, padding: 20, cursor: 'pointer',
              boxShadow: tokens.shadow1,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              minHeight: 200,
            }}>
              <div style={{
                fontSize: 10.5, fontWeight: 650,
                color: i === 0 ? 'rgba(255,255,255,0.6)' : tokens.muted,
                letterSpacing: 0.3, textTransform: 'uppercase',
              }}>{c.count} szt. · od {c.daily}</div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0' }}>
                <Silhouette kind={c.id} color={i === 0 ? '#fff' : tokens.ink} w={170} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: -0.2 }}>{c.label}</div>
                <Icon.arrowRight s={15} c={i === 0 ? '#fff' : tokens.ink} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Featured vehicles grid */}
      <div style={{ padding: '24px 48px 56px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, color: tokens.ink, letterSpacing: -0.9, margin: 0, lineHeight: 1 }}>
            {t.popular}
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Pill active>Wszystkie</Pill>
            <Pill>Najtańsze</Pill>
            <Pill>Najnowsze</Pill>
            <Pill>9 miejsc +</Pill>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {featured.map(v => <FleetCard key={v.id} v={v} t={t} />)}
        </div>
      </div>
      {/* Bottom band */}
      <div style={{
        margin: '0 48px 48px', padding: '36px 40px',
        background: tokens.ink, color: '#fff', borderRadius: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 32,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 650, letterSpacing: 0.4, textTransform: 'uppercase' }}>Dla firm</div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, marginTop: 6, lineHeight: 1.1 }}>
              Stała flota dla Twojej firmy.<br/>
              <span style={{ color: 'rgba(255,250,242,0.55)' }}>Faktura VAT, dedykowany opiekun.</span>
            </div>
        </div>
        <button style={{
          height: 52, padding: '0 26px', borderRadius: 9999, border: 'none',
          background: '#fff', color: tokens.ink,
          fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>Skontaktuj się <Icon.arrowRight s={15} c={tokens.ink} /></button>
      </div>
    </div>
  );
}

// ─── 12. Customer Desktop · Fleet Browse ─────────────────────
function ScreenDesktopFleet() {
  const t = useLang();
  const [type, setType] = React.useState('all');
  const filtered = type === 'all' ? VEHICLES : VEHICLES.filter(v => v.type === type);
  const typeOpts = [
    { id: 'all', label: 'Wszystkie · 83' },
    { id: 'cargo', label: t.types[0] + ' · 28' },
    { id: 'passenger', label: t.types[1] + ' · 14' },
    { id: 'transporter', label: t.types[2] + ' · 6' },
    { id: 'refrigerated', label: t.types[3] + ' · 9' },
    { id: 'flatbed', label: t.types[4] + ' · 26' },
  ];
  return (
    <div style={{ height: '100%', overflow: 'auto', background: tokens.bg, fontFamily: tokens.font }}>
      <DesktopHeader active="fleet" />
      {/* Page title */}
      <div style={{ padding: '40px 48px 24px' }}>
        <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 650, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          Flota · 24 marca 2026 · Warszawa
        </div>
        <h1 style={{ fontSize: 68, fontWeight: 700, color: tokens.ink, letterSpacing: -2.2, lineHeight: 1, margin: '8px 0 0' }}>
          {filtered.length} <span style={{ color: tokens.muted, fontWeight: 400 }}>pojazdów gotowych do wynajmu.</span>
        </h1>
      </div>
      {/* Type pill bar */}
      <div style={{ padding: '8px 48px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {typeOpts.map(opt => {
          const A = type === opt.id;
          return (
            <button key={opt.id} onClick={() => setType(opt.id)} style={{
              height: 44, padding: '0 18px 0 12px', borderRadius: 9999,
              border: `1px solid ${A ? tokens.ink : tokens.hair}`,
              background: A ? tokens.ink : tokens.card,
              color: A ? '#fff' : tokens.ink,
              fontFamily: tokens.font, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
              display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              transition: 'all .15s',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 22 }}>
                {opt.id === 'all'
                  ? <Icon.grid s={16} c={A ? '#fff' : tokens.ink} />
                  : <Silhouette kind={opt.id} color={A ? '#fff' : tokens.ink} w={34} />}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
      {/* Filter bar */}
      <div style={{ padding: '0 48px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill style={{ height: 34 }}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Icon.calendar s={13} c={tokens.ink} /> 24 – 27 mar
            </span>
          </Pill>
          <Pill style={{ height: 34 }}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Icon.seats s={13} c={tokens.ink} /> 3+ miejsc
            </span>
          </Pill>
          <Pill style={{ height: 34 }}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Icon.gear s={13} c={tokens.ink} /> Auto
            </span>
          </Pill>
          <Pill style={{ height: 34 }}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Icon.filter s={13} c={tokens.ink} /> Wszystkie filtry
            </span>
          </Pill>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: tokens.muted, fontWeight: 540 }}>Sortuj:</span>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
            background: tokens.card, borderRadius: 9999, boxShadow: tokens.shadow1,
            fontSize: 13, fontWeight: 600, color: tokens.ink, cursor: 'pointer',
          }}>
            Cena rosnąco <Icon.chevD s={13} c={tokens.ink} />
          </div>
        </div>
      </div>
      {/* Vehicle grid */}
      <div style={{ padding: '0 48px 56px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {filtered.map(v => (
          <div key={v.id} style={{
            background: tokens.card, borderRadius: 22, padding: 22,
            boxShadow: tokens.shadow1, cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 650, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  {v.year} · {t.types[['cargo','passenger','transporter','refrigerated','flatbed'].indexOf(v.type)]}
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4, marginTop: 4, lineHeight: 1.1 }}>
                  {v.brand}
                </div>
                <div style={{ fontSize: 14, color: tokens.ink2, marginTop: 2 }}>{v.model}</div>
              </div>
              <StatusBadge status={v.status === 'rented' ? 'rented' : v.status === 'maintenance' ? 'maintenance' : 'available'} t={t} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0 18px', minHeight: 130 }}>
              <Silhouette kind={v.type} color={tokens.ink} w={280} />
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
              padding: '14px 0', borderTop: `1px solid ${tokens.hair2}`,
              borderBottom: `1px solid ${tokens.hair2}`,
            }}>
              {[
                { i: Icon.seats, l: v.seats },
                { i: Icon.gear, l: v.trans },
                { i: Icon.fuel, l: v.fuel },
                { i: Icon.weight, l: v.payload },
              ].map((x, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <x.i s={14} c={tokens.muted} />
                  <span style={{ fontSize: 11.5, color: tokens.ink, fontWeight: 600, letterSpacing: -0.1 }}>{x.l}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6, lineHeight: 1 }}>
                  {v.daily} zł<span style={{ fontWeight: 500, color: tokens.muted, fontSize: 13 }}>{t.perDay}</span>
                </div>
                <div style={{ fontSize: 11.5, color: tokens.muted, marginTop: 4, fontWeight: 540 }}>{v.monthly} zł{t.perMonth} · kaucja {v.deposit} zł</div>
              </div>
              <button style={{
                height: 38, padding: '0 14px', borderRadius: 9999, border: 'none',
                background: tokens.ink, color: '#fff',
                fontFamily: tokens.font, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>{t.reserve} <Icon.arrowRight s={13} c="#fff" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ScreenDesktopHome, ScreenDesktopFleet, DesktopHeader });
