// Staff-facing screens: Worker Dashboard, Pickup Protocol, Overdue list

// ─── 6. Worker Dashboard ─────────────────────────────────────
function ScreenWorkerDash() {
  const t = useLang();
  const todayPickups = [
    { time: '09:00', who: 'Anna Nowak', v: VEHICLES[1], plate: 'WX 5519M' },
    { time: '11:30', who: 'Marek Lis', v: VEHICLES[2], plate: 'WX 6204A' },
    { time: '14:00', who: 'Tomasz Wójcik', v: VEHICLES[5], plate: 'WX 1102D' },
  ];
  const todayReturns = [
    { time: '10:30', who: 'Jakub Kowalski', v: VEHICLES[0], plate: 'WX 4827K', overdue: false },
    { time: '16:00', who: 'P. Adamczyk', v: VEHICLES[4], plate: 'WX 7715C', overdue: true },
  ];
  const pendingReqs = [
    { who: 'Krzysztof D.', v: VEHICLES[3], dates: '02 – 09 kwi', total: 2380 },
    { who: 'Magdalena R.', v: VEHICLES[2], dates: '05 – 07 kwi', total: 1140 },
  ];
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '58px 22px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Wt · 24 marca</div>
            <h1 style={{ fontSize: 40, fontWeight: 700, color: tokens.ink, letterSpacing: -1, margin: '4px 0 2px', lineHeight: 1 }}>{t.workerDash}</h1>
            <div style={{ fontSize: 13, color: tokens.ink2 }}>Dyspozytor: Piotr · 12 pojazdów</div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 99, background: tokens.accent, color: tokens.accentInk,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 500, letterSpacing: 0.4,
            boxShadow: '0 4px 14px rgba(180,54,56,0.30)',
          }}>PB</div>
        </div>
        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 18 }}>
          {[
            { n: 3, l: t.pickupsToday, c: tokens.accent },
            { n: 2, l: t.returnsToday, c: tokens.ink },
            { n: 2, l: t.pending, c: tokens.amber },
          ].map((k, i) => (
            <div key={i} style={{
              background: tokens.card, borderRadius: 14, padding: '12px 12px 11px',
              boxShadow: tokens.shadow1,
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.c, letterSpacing: -0.6, lineHeight: 1 }}>{k.n}</div>
              <div style={{ fontSize: 10.5, color: tokens.muted, marginTop: 5, fontWeight: 540, letterSpacing: -0.05, lineHeight: 1.2 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 0 110px' }}>
        {/* Pickups section */}
        <Section title={t.pickupsToday + ' · ' + todayPickups.length} icon={Icon.key}>
          {todayPickups.map((p, i) => (
            <ActionRow key={i}
              time={p.time}
              title={p.who}
              subtitle={`${p.v.brand} ${p.v.model.split(' ')[0]} · ${p.plate}`}
              v={p.v}
              cta="Protokół"
              ctaStyle="primary"
            />
          ))}
        </Section>
        {/* Returns section */}
        <Section title={t.returnsToday + ' · ' + todayReturns.length} icon={Icon.arrowDown}>
          {todayReturns.map((p, i) => (
            <ActionRow key={i}
              time={p.time}
              title={p.who}
              subtitle={`${p.v.brand} ${p.v.model.split(' ')[0]} · ${p.plate}`}
              v={p.v}
              cta={p.overdue ? "Po terminie" : "Zwrot"}
              ctaStyle={p.overdue ? 'danger' : 'ghost'}
            />
          ))}
        </Section>
        {/* Pending requests */}
        <Section title={t.pending + ' · ' + pendingReqs.length} icon={Icon.bell}>
          {pendingReqs.map((p, i) => (
            <div key={i} style={{
              background: tokens.card, borderRadius: 16, padding: 14, marginBottom: 10,
              boxShadow: tokens.shadow1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{p.who}</div>
                  <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2 }}>{p.v.brand} {p.v.model.split(' ')[0]} · {p.dates}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: tokens.ink }}>{p.total} zł</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button style={{
                  flex: 1, height: 38, borderRadius: 10, border: `1px solid ${tokens.hair}`,
                  background: 'transparent', color: tokens.red,
                  fontFamily: tokens.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>{t.reject}</button>
                <button style={{
                  flex: 2, height: 38, borderRadius: 10, border: 'none',
                  background: tokens.ink, color: '#fff',
                  fontFamily: tokens.font, fontSize: 13, fontWeight: 650, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}><Icon.check s={14} c="#fff" /> {t.approve}</button>
              </div>
            </div>
          ))}
        </Section>
      </div>
      <TabBar
        tabs={[
          { id: 'dash', icon: Icon.home, label: 'Dash' },
          { id: 'cal', icon: Icon.calendar, label: t.calendar },
          { id: 'fleet', icon: Icon.truck, label: t.fleet },
          { id: 'me', icon: Icon.user, label: t.profile },
        ]}
        active="dash"
      />
    </div>
  );
}

function Section({ title, icon: I, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        padding: '0 22px 8px', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase',
      }}>
        <I s={14} c={tokens.muted} /> {title}
      </div>
      <div style={{ padding: '0 18px' }}>{children}</div>
    </div>
  );
}

function ActionRow({ time, title, subtitle, v, cta, ctaStyle }) {
  const styles = {
    primary: { background: tokens.ink, color: '#fff' },
    ghost: { background: tokens.bg, color: tokens.ink, border: `1px solid ${tokens.hair}` },
    danger: { background: tokens.redSoft, color: tokens.red },
  };
  return (
    <div style={{
      background: tokens.card, borderRadius: 16, padding: '12px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: tokens.shadow1,
    }}>
      <div style={{
        width: 50, textAlign: 'center', flexShrink: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4, lineHeight: 1 }}>{time}</div>
      </div>
      <div style={{ width: 1, height: 38, background: tokens.hair2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
      </div>
      <button style={{
        height: 32, padding: '0 12px', borderRadius: 10, border: 'none',
        ...styles[ctaStyle],
        fontFamily: tokens.font, fontSize: 12, fontWeight: 650, cursor: 'pointer', flexShrink: 0,
      }}>{cta}</button>
    </div>
  );
}

// ─── 7. Pickup Protocol (multi-step) ─────────────────────────
function ScreenPickupProtocol() {
  const t = useLang();
  const [step, setStep] = React.useState(3);
  const v = VEHICLES[1];
  const totalSteps = 6;
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div style={{
        padding: '54px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button style={chrome.iconBtn} onClick={() => step > 1 && setStep(step - 1)}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            {t.step} {step} {t.of} {totalSteps}
          </div>
          <div style={{ fontSize: 15, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, marginTop: 1 }}>{t.pickupProtocol}</div>
        </div>
        <button style={chrome.iconBtn}><Icon.close s={18} c={tokens.ink} /></button>
      </div>
      {/* Progress */}
      <div style={{ padding: '4px 22px 12px' }}>
        <div style={{ height: 4, background: tokens.hair2, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(step / totalSteps) * 100}%`,
            background: tokens.ink, borderRadius: 99, transition: 'width .25s',
          }}/>
        </div>
      </div>
      {/* Vehicle context strip */}
      <div style={{
        margin: '0 18px 4px', padding: '10px 12px', borderRadius: 14, background: tokens.card,
        display: 'flex', alignItems: 'center', gap: 12, boxShadow: tokens.shadow1,
      }}>
        <div style={{
          width: 60, height: 38, borderRadius: 8, background: tokens.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Silhouette kind={v.type} color={tokens.ink} w={54} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{v.brand} {v.model.split(' ')[0]}</div>
          <div style={{ fontSize: 11, color: tokens.muted, marginTop: 1 }}>R-2401 · Anna Nowak · 09:00</div>
        </div>
        <StatusBadge status="active" t={t} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px 140px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6, margin: '4px 0 4px' }}>
          Stan techniczny
        </h2>
        <div style={{ fontSize: 13, color: tokens.ink2, marginBottom: 18, lineHeight: 1.4 }}>
          Zarejestruj odczyt licznika, poziom paliwa i zauważone uszkodzenia.
        </div>
        {/* Odometer + fuel side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: tokens.card, borderRadius: 16, padding: 14, boxShadow: tokens.shadow1 }}>
            <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase' }}>{t.odometer}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6 }}>48 712</span>
              <span style={{ fontSize: 12, color: tokens.muted, fontWeight: 540 }}>km</span>
            </div>
          </div>
          <div style={{ background: tokens.card, borderRadius: 16, padding: 14, boxShadow: tokens.shadow1 }}>
            <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase' }}>{t.fuelLevel}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6 }}>7/8</span>
              <span style={{ fontSize: 12, color: tokens.muted, fontWeight: 540 }}>· pełny</span>
            </div>
            {/* mini fuel gauge */}
            <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
              {[0,1,2,3,4,5,6,7].map(i => (
                <div key={i} style={{
                  flex: 1, height: 5, borderRadius: 2,
                  background: i < 7 ? tokens.ink : tokens.hair2,
                }}/>
              ))}
            </div>
          </div>
        </div>
        {/* Photos */}
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '12px 4px 8px' }}>
          {t.photos} · 4 z 6
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { l: t.front, filled: true },
            { l: t.back, filled: true },
            { l: t.left, filled: true },
            { l: t.right, filled: true },
            { l: t.interior, filled: false },
            { l: t.damage, filled: false },
          ].map((p, i) => (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 12,
              background: p.filled ? '#1a1a1f' : tokens.card,
              border: p.filled ? 'none' : `1.5px dashed ${tokens.hair}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              position: 'relative', overflow: 'hidden',
            }}>
              {p.filled ? (
                <>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `repeating-linear-gradient(135deg, #1a1a1f 0 8px, #15151a 8px 16px)`,
                  }}/>
                  <Icon.check s={16} c="rgba(255,255,255,0.9)" />
                  <span style={{
                    position: 'relative', fontFamily: tokens.mono, fontSize: 9,
                    color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3, textTransform: 'uppercase',
                  }}>{p.l}</span>
                </>
              ) : (
                <>
                  <Icon.camera s={18} c={tokens.muted} />
                  <span style={{
                    fontFamily: tokens.font, fontSize: 10, fontWeight: 600,
                    color: tokens.muted, letterSpacing: 0.2, textTransform: 'uppercase',
                  }}>{p.l}</span>
                </>
              )}
            </div>
          ))}
        </div>
        {/* Damage notes */}
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '6px 4px 8px' }}>
          {t.damages}
        </div>
        <div style={{
          background: tokens.card, borderRadius: 16, padding: 14, boxShadow: tokens.shadow1,
        }}>
          <div style={{ fontSize: 13.5, color: tokens.ink, lineHeight: 1.5 }}>
            Drobna rysa na lewym tylnym zderzaku (15 cm). Niewielkie zarysowanie na progu od strony pasażera. Pozostałe elementy bez uwag.
          </div>
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: `1px solid ${tokens.hair2}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase' }}>2 uwagi · auto-zapis</div>
            <div style={{ display: 'flex', gap: 6, color: tokens.muted }}>
              <Icon.camera s={14} c={tokens.muted} />
              <Icon.edit s={14} c={tokens.muted} />
            </div>
          </div>
        </div>
      </div>
      {/* Bottom CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: tokens.bg, padding: '12px 18px 30px', zIndex: 5,
        borderTop: `1px solid ${tokens.hair2}`,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{
            height: 54, padding: '0 18px', borderRadius: 16,
            background: tokens.card, border: `1px solid ${tokens.hair}`,
            color: tokens.ink, fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer',
          }} onClick={() => step > 1 && setStep(step - 1)}>Wstecz</button>
          <button style={{ ...chrome.cta, flex: 1 }} onClick={() => step < totalSteps && setStep(step + 1)}>
            Dalej <Icon.arrowRight s={16} c="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenWorkerDash, ScreenPickupProtocol });

// ─── 08. Return Protocol with comparison (S-06) ──────────────
function rpChip({ delta, tone }) {
  const map = {
    neutral: { bg: tokens.greySoft, fg: tokens.ink2 },
    bad:     { bg: tokens.redSoft,  fg: tokens.red },
    good:    { bg: tokens.greenSoft, fg: tokens.green },
  };
  const c = map[tone] || map.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 8,
      background: c.bg, color: c.fg, fontFamily: tokens.mono, fontSize: 12, fontWeight: 700, letterSpacing: 0.2,
    }}>{delta}</span>
  );
}

function RPCompare({ t, icon: I, label, pickup, ret, delta, tone, note }) {
  return (
    <div style={{ background: tokens.card, borderRadius: 16, padding: 14, boxShadow: tokens.shadow1, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <I s={15} c={tokens.muted} />
          <span style={{ fontSize: 12, fontWeight: 700, color: tokens.muted, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
        </div>
        {rpChip({ delta, tone })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.atPickup}</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: tokens.muted, letterSpacing: -0.4, marginTop: 3 }}>{pickup}</div>
        </div>
        <Icon.arrowRight s={16} c={tokens.hair === tokens.hair ? tokens.muted : tokens.muted} />
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.atReturn}</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4, marginTop: 3 }}>{ret}</div>
        </div>
      </div>
      {note && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: `1px solid ${tokens.hair2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: tokens.muted, fontWeight: 540 }}>{note.label}</span>
          <span style={{ fontSize: 13, color: tone === 'bad' ? tokens.red : tokens.ink, fontWeight: 700 }}>{note.value}</span>
        </div>
      )}
    </div>
  );
}

function ScreenReturnProtocol() {
  const t = useLang();
  const v = VEHICLES[1]; // Ford Transit — matches the pickup protocol context
  const [sent, setSent] = React.useState(false);
  const totalSteps = 6;
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Nav */}
      <div style={{ padding: '54px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={chrome.iconBtn}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            {t.step} {totalSteps} {t.of} {totalSteps}
          </div>
          <div style={{ fontSize: 15, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, marginTop: 1 }}>{t.returnProtocol}</div>
        </div>
        <button style={chrome.iconBtn}><Icon.close s={18} c={tokens.ink} /></button>
      </div>
      {/* Progress (final step) */}
      <div style={{ padding: '4px 22px 12px' }}>
        <div style={{ height: 4, background: tokens.hair2, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '100%', background: tokens.ink, borderRadius: 99 }} />
        </div>
      </div>
      {/* Vehicle context */}
      <div style={{
        margin: '0 18px 4px', padding: '10px 12px', borderRadius: 14, background: tokens.card,
        display: 'flex', alignItems: 'center', gap: 12, boxShadow: tokens.shadow1,
      }}>
        <div style={{ width: 60, height: 38, borderRadius: 8, background: tokens.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Silhouette kind={v.type} color={tokens.ink} w={54} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{v.brand} {v.model.split(' ')[0]}</div>
          <div style={{ fontSize: 11, color: tokens.muted, marginTop: 1 }}>R-2401 · Anna Nowak · {t.return} 10:30</div>
        </div>
        <StatusBadge status="active" t={t} />
      </div>
      {/* Scroll */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px 140px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6, margin: '4px 0 4px' }}>
          {t.comparison}
        </h2>
        <div style={{ fontSize: 13, color: tokens.ink2, marginBottom: 18, lineHeight: 1.4 }}>
          {t.comparisonSub}
        </div>

        <RPCompare t={t} icon={Icon.clock} label={t.kmDriven}
          pickup="48 712 km" ret="49 940 km" delta="+1 228 km" tone="neutral"
          note={{ label: t.kmLimit + ' · 300 km/dzień', value: 'w limicie' }} />

        <RPCompare t={t} icon={Icon.fuel} label={t.fuelChange}
          pickup="7/8" ret="3/8" delta="−4/8" tone="bad"
          note={{ label: t.refuelNote, value: '+ 184 zł' }} />

        {/* New damage card */}
        <div style={{ background: tokens.card, borderRadius: 16, padding: 14, boxShadow: tokens.shadow1, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon.warning s={15} c={tokens.muted} />
              <span style={{ fontSize: 12, fontWeight: 700, color: tokens.muted, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.newDamageT}</span>
            </div>
            {rpChip({ delta: '+1', tone: 'bad' })}
          </div>
          {/* existing item */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: tokens.bg, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: tokens.muted, fontWeight: 540, lineHeight: 1.3 }}>Rysa — lewy tylny zderzak (15 cm)</div>
            </div>
            <span style={{ fontSize: 10, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', background: tokens.greySoft, padding: '3px 7px', borderRadius: 6 }}>{t.existingTag}</span>
          </div>
          {/* new item */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0 4px', borderTop: `1px solid ${tokens.hair2}`, marginTop: 4 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
              background: `repeating-linear-gradient(135deg, #1a1a1f 0 7px, #15151a 7px 14px)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon.camera s={15} c="rgba(255,255,255,0.85)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: tokens.ink, fontWeight: 600, lineHeight: 1.3 }}>Wgniecenie — prawe drzwi przesuwne (8 cm)</div>
              <div style={{ fontSize: 11, color: tokens.muted, marginTop: 2 }}>2 zdjęcia · zwrot 10:34</div>
            </div>
            <span style={{ fontSize: 10, color: tokens.red, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', background: tokens.redSoft, padding: '3px 7px', borderRadius: 6 }}>{t.addedTag}</span>
          </div>
        </div>

        {/* Return photos */}
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '6px 4px 8px' }}>
          {t.photos} · 6 z 6
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[t.front, t.back, t.left, t.right, t.interior, t.damage].map((l, i) => (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 12, position: 'relative', overflow: 'hidden',
              background: `repeating-linear-gradient(135deg, #1a1a1f 0 8px, #15151a 8px 16px)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <Icon.check s={16} c="rgba(255,255,255,0.9)" />
              <span style={{ fontFamily: tokens.mono, fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3, textTransform: 'uppercase' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: tokens.bg, padding: '12px 18px 30px', zIndex: 5, borderTop: `1px solid ${tokens.hair2}`,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{
            height: 54, padding: '0 18px', borderRadius: 16, background: tokens.card,
            border: `1px solid ${tokens.hair}`, color: tokens.ink,
            fontFamily: tokens.font, fontSize: 14, fontWeight: 650, cursor: 'pointer',
          }}>{t.backStep}</button>
          <button style={{ ...chrome.cta, flex: 1 }} onClick={() => setSent(true)}>
            <Icon.message s={16} c="#fff" /> {t.finishEmail}
          </button>
        </div>
      </div>

      {/* Sent confirmation overlay */}
      {sent && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          background: 'rgba(20,18,22,0.55)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', background: tokens.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: '28px 22px 34px', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 99, background: tokens.greenSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <Icon.check s={30} c={tokens.green} />
            </div>
            <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.5 }}>{t.protocolSent}</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: tokens.muted, marginTop: 6 }}>
              {t.sentTo} <b style={{ color: tokens.ink2, fontWeight: 650 }}>anna.nowak@example.pl</b>
            </div>
            {/* delta summary */}
            <div style={{ background: tokens.bg, borderRadius: 14, padding: 14, marginTop: 18 }}>
              {[
                { l: t.kmDriven, v: '+1 228 km' },
                { l: t.fuelChange, v: '−4/8 · +184 zł', red: true },
                { l: t.newDamageT, v: '+1' , red: true },
              ].map((r, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}`,
                }}>
                  <span style={{ fontSize: 13, color: tokens.muted, fontWeight: 540 }}>{r.l}</span>
                  <span style={{ fontFamily: tokens.mono, fontSize: 13, fontWeight: 700, color: r.red ? tokens.red : tokens.ink }}>{r.v}</span>
                </div>
              ))}
            </div>
            <button style={{ ...chrome.ctaInk, marginTop: 18 }} onClick={() => setSent(false)}>{t.doneLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ScreenReturnProtocol });

// ─── 07. Pending requests queue (S-03) ───────────────────────
function ScreenPendingQueue() {
  const t = useLang();
  const reqs = [
    { id: 'R-2402', who: 'Krzysztof Dąbrowski', v: VEHICLES[3], dates: '02 – 09 kwi', days: 7, total: 2380, ago: '2 godz. temu' },
    { id: 'R-2404', who: 'Magdalena Rusin', v: VEHICLES[2], dates: '05 – 07 kwi', days: 2, total: 1140, ago: '4 godz. temu' },
    { id: 'R-2405', who: 'Firma Trans-Bud', v: VEHICLES[5], dates: '08 – 12 kwi', days: 4, total: 2080, ago: 'wczoraj 17:20' },
    { id: 'R-2406', who: 'Ewa Lewandowska', v: VEHICLES[1], dates: '10 – 11 kwi', days: 1, total: 290, ago: 'wczoraj 09:05' },
  ];
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '54px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={chrome.iconBtn}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ fontSize: 17, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{t.pending}</div>
        <button style={chrome.iconBtn}><Icon.filter s={18} c={tokens.ink} /></button>
      </div>
      <div style={{ padding: '8px 22px 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 40, fontWeight: 700, color: tokens.amber, letterSpacing: -1, lineHeight: 1 }}>{reqs.length}</span>
        <span style={{ fontSize: 14, color: tokens.muted, fontWeight: 540 }}>oczekuje na decyzję</span>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px 110px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reqs.map(r => (
          <div key={r.id} style={{ background: tokens.card, borderRadius: 18, padding: 16, boxShadow: tokens.shadow1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: tokens.mono, fontSize: 11, color: tokens.muted, fontWeight: 600 }}>{r.id}</span>
                  <StatusBadge status="pending" t={t} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 650, color: tokens.ink, letterSpacing: -0.3, marginTop: 6 }}>{r.who}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: tokens.ink, letterSpacing: -0.3 }}>{r.total} zł</div>
                <div style={{ fontSize: 11, color: tokens.muted, marginTop: 1 }}>{r.days} dni</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <div style={{ width: 64, height: 42, borderRadius: 10, background: tokens.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Silhouette kind={r.v.type} color={tokens.ink} w={56} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.v.brand} {r.v.model.split(' ')[0]}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: tokens.muted, marginTop: 2 }}>
                  <Icon.calendar s={12} c={tokens.muted} /> {r.dates}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={{
                flex: 1, height: 40, borderRadius: 11, border: `1px solid ${tokens.hair}`,
                background: 'transparent', color: tokens.red,
                fontFamily: tokens.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{t.reject}</button>
              <button style={{
                flex: 2, height: 40, borderRadius: 11, border: 'none',
                background: tokens.ink, color: '#fff',
                fontFamily: tokens.font, fontSize: 13, fontWeight: 650, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>{t.reviewBtn} <Icon.chevR s={15} c="#fff" /></button>
            </div>
          </div>
        ))}
      </div>
      <TabBar
        tabs={[
          { id: 'dash', icon: Icon.home, label: 'Dash' },
          { id: 'cal', icon: Icon.calendar, label: t.calendar },
          { id: 'fleet', icon: Icon.truck, label: t.fleet },
          { id: 'me', icon: Icon.user, label: t.profile },
        ]}
        active="dash"
      />
    </div>
  );
}

// ─── 08. Request detail / approval (S-03) ────────────────────
function ScreenRequestDetail() {
  const t = useLang();
  const v = VEHICLES[3]; // Renault Master
  const [phase, setPhase] = React.useState('idle'); // idle | rejecting | approved | rejected
  const [reason, setReason] = React.useState(0);
  const reasons = [t.reason1, t.reason2, t.reason3, t.reason4];

  // Availability window: 01–14 April. Held block = this request (02–09);
  // a confirmed booking sits at 11–13 — no overlap, because pending requests
  // already block their own dates at submission.
  const win = 14;
  const pct = (d) => ((d - 1) / win) * 100;
  const span = (a, b) => ((b - a + 1) / win) * 100;

  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Nav */}
      <div style={{ padding: '54px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={chrome.iconBtn}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.requestLabel} R-2402</div>
          <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, marginTop: 1 }}>{t.submittedLabel} · {t.ago2h}</div>
        </div>
        <button style={chrome.iconBtn}><Icon.phone s={18} c={tokens.ink} /></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 18px 150px' }}>
        {/* Vehicle */}
        <div style={{ background: tokens.card, borderRadius: 18, padding: 16, boxShadow: tokens.shadow1, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 96, height: 60, borderRadius: 12, background: tokens.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Silhouette kind={v.type} color={tokens.ink} w={86} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{v.brand} {v.model.split(' ')[0]}</div>
            <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2, fontFamily: tokens.mono }}>{v.plate}</div>
            <div style={{ fontSize: 12.5, color: tokens.ink2, marginTop: 4, fontWeight: 600 }}>{v.daily} zł{t.perDay}</div>
          </div>
        </div>

        {/* Dates */}
        <div style={{ background: tokens.card, borderRadius: 18, padding: 16, boxShadow: tokens.shadow1, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10.5, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.pickup}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4, marginTop: 3 }}>02 kwi · 14:00</div>
            </div>
            <Icon.arrowRight s={18} c={tokens.muted} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10.5, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.return}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4, marginTop: 3 }}>09 kwi · 10:00</div>
            </div>
          </div>
        </div>

        {/* Availability — dates held */}
        <div style={{ background: tokens.card, borderRadius: 18, padding: 16, boxShadow: tokens.shadow1, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: tokens.amber }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: tokens.muted, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.datesHeld}</span>
          </div>
          <div style={{ fontSize: 12, color: tokens.ink2, lineHeight: 1.4, marginBottom: 14 }}>{t.datesHeldNote}</div>
          {/* mini timeline */}
          <div style={{ position: 'relative', height: 30, borderRadius: 8, background: tokens.bg, overflow: 'hidden' }}>
            {/* gridlines */}
            {Array.from({ length: win - 1 }, (_, i) => (
              <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(i + 2)}%`, width: 1, background: tokens.hair2 }} />
            ))}
            {/* confirmed booking (green) */}
            <div style={{
              position: 'absolute', top: 5, height: 20, left: `${pct(11)}%`, width: `${span(11, 13)}%`,
              background: tokens.greenSoft, borderRadius: 5, borderLeft: `2px solid ${tokens.green}`,
            }} />
            {/* this request — held (amber) */}
            <div style={{
              position: 'absolute', top: 5, height: 20, left: `${pct(2)}%`, width: `${span(2, 9)}%`,
              background: tokens.amberSoft, borderRadius: 5, borderLeft: `2px solid ${tokens.amber}`,
              display: 'flex', alignItems: 'center', paddingLeft: 6,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: tokens.amber, letterSpacing: 0.2, textTransform: 'uppercase' }}>R-2402</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: tokens.muted, fontFamily: tokens.mono }}>
            <span>01 kwi</span><span>14 kwi</span>
          </div>
        </div>

        {/* Customer */}
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '22px 4px 8px' }}>
          {t.customerLabel}
        </div>
        <div style={{ background: tokens.card, borderRadius: 18, boxShadow: tokens.shadow1, padding: 6 }}>
          {[
            { i: Icon.user, l: 'Imię i nazwisko', v: 'Krzysztof Dąbrowski' },
            { i: Icon.message, l: 'Email', v: 'krzysztof.d@example.pl' },
            { i: Icon.phone, l: 'Telefon', v: '+48 601 234 567' },
            { i: Icon.key, l: t.licence, v: 'Kat. B · ważne do 2031', ok: true },
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
              {f.ok && <Icon.check s={16} c={tokens.green} />}
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{ background: tokens.card, borderRadius: 18, padding: 16, boxShadow: tokens.shadow1, marginTop: 12 }}>
          {[
            { k: `7 dni × ${v.daily} zł`, v: '2 380 zł' },
            { k: t.deposit, v: `${v.deposit} zł` },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}`,
            }}>
              <span style={{ fontSize: 13, color: tokens.muted, fontWeight: 540 }}>{r.k}</span>
              <span style={{ fontSize: 14, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: tokens.bg, padding: '12px 18px 30px', zIndex: 5, borderTop: `1px solid ${tokens.hair2}`,
        display: 'flex', gap: 10,
      }}>
        <button onClick={() => setPhase('rejecting')} style={{
          height: 54, flex: 1, borderRadius: 16, background: tokens.card,
          border: `1px solid ${tokens.hair}`, color: tokens.red,
          fontFamily: tokens.font, fontSize: 15, fontWeight: 650, cursor: 'pointer',
        }}>{t.reject}</button>
        <button onClick={() => setPhase('approved')} style={{ ...chrome.cta, flex: 2 }}>
          <Icon.check s={16} c="#fff" /> {t.approve}
        </button>
      </div>

      {/* Reject reason sheet */}
      {phase === 'rejecting' && (
        <div onClick={() => setPhase('idle')} style={{
          position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(20,18,22,0.55)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', background: tokens.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: '24px 22px 34px', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: tokens.hair, margin: '0 auto 18px' }} />
            <div style={{ fontSize: 19, fontWeight: 700, color: tokens.ink, letterSpacing: -0.4 }}>{t.reasonTitle}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {reasons.map((r, i) => (
                <button key={i} onClick={() => setReason(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
                  border: `1px solid ${reason === i ? tokens.ink : tokens.hair}`,
                  background: reason === i ? tokens.bg : tokens.card, cursor: 'pointer',
                  fontFamily: tokens.font, fontSize: 14, fontWeight: 540, color: tokens.ink, textAlign: 'left',
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 99, flexShrink: 0,
                    border: `2px solid ${reason === i ? tokens.ink : tokens.hair}`,
                    background: reason === i ? tokens.ink : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{reason === i && <span style={{ width: 6, height: 6, borderRadius: 99, background: '#fff' }} />}</span>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => setPhase('rejected')} style={{
              width: '100%', height: 54, borderRadius: 16, border: 'none', marginTop: 20,
              background: tokens.red, color: '#fff',
              fontFamily: tokens.font, fontSize: 15, fontWeight: 650, cursor: 'pointer',
            }}>{t.confirmReject}</button>
          </div>
        </div>
      )}

      {/* Result overlay (approved / rejected) */}
      {(phase === 'approved' || phase === 'rejected') && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(20,18,22,0.55)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', background: tokens.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: '28px 22px 34px', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 99, margin: '0 auto 16px',
              background: phase === 'approved' ? tokens.greenSoft : tokens.redSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {phase === 'approved'
                ? <Icon.check s={30} c={tokens.green} />
                : <Icon.close s={30} c={tokens.red} />}
            </div>
            <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.5 }}>
              {phase === 'approved' ? t.bookingConfirmed : t.requestRejected}
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, color: tokens.muted, marginTop: 8, lineHeight: 1.45, maxWidth: 280, marginInline: 'auto' }}>
              {phase === 'approved' ? t.bookingConfirmedSub : t.requestRejectedSub}
            </div>
            <button onClick={() => setPhase('idle')} style={{ ...chrome.ctaInk, marginTop: 22 }}>{t.doneLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ScreenPendingQueue, ScreenRequestDetail });

// ─── 10. Pickup protocol — signature & email (S-05) ──────────
function ScreenPickupSignature() {
  const t = useLang();
  const v = VEHICLES[1]; // Ford Transit — matches pickup protocol context
  const [ack, setAck] = React.useState(true);
  const [sent, setSent] = React.useState(false);
  const totalSteps = 6;
  return (
    <div style={{ height: '100%', background: tokens.bg, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Nav */}
      <div style={{ padding: '54px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={chrome.iconBtn}><Icon.back s={18} c={tokens.ink} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: tokens.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            {t.step} {totalSteps} {t.of} {totalSteps}
          </div>
          <div style={{ fontSize: 15, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2, marginTop: 1 }}>{t.pickupProtocol}</div>
        </div>
        <button style={chrome.iconBtn}><Icon.close s={18} c={tokens.ink} /></button>
      </div>
      {/* Progress (final step) */}
      <div style={{ padding: '4px 22px 12px' }}>
        <div style={{ height: 4, background: tokens.hair2, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '100%', background: tokens.ink, borderRadius: 99 }} />
        </div>
      </div>
      {/* Vehicle context */}
      <div style={{
        margin: '0 18px 4px', padding: '10px 12px', borderRadius: 14, background: tokens.card,
        display: 'flex', alignItems: 'center', gap: 12, boxShadow: tokens.shadow1,
      }}>
        <div style={{ width: 60, height: 38, borderRadius: 8, background: tokens.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Silhouette kind={v.type} color={tokens.ink} w={54} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{v.brand} {v.model.split(' ')[0]}</div>
          <div style={{ fontSize: 11, color: tokens.muted, marginTop: 1 }}>R-2401 · Anna Nowak · 09:00</div>
        </div>
        <StatusBadge status="active" t={t} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px 150px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.6, margin: '4px 0 4px' }}>{t.signSection}</h2>
        <div style={{ fontSize: 13, color: tokens.ink2, marginBottom: 18, lineHeight: 1.4 }}>{t.signSub}</div>

        {/* Recap */}
        <div style={{ fontSize: 12, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '2px 4px 8px' }}>{t.recap}</div>
        <div style={{ background: tokens.card, borderRadius: 16, padding: 6, boxShadow: tokens.shadow1 }}>
          {[
            { i: Icon.clock, k: t.odometer, v: '48 712 km' },
            { i: Icon.fuel, k: t.fuelLevel, v: '7/8 · pełny' },
            { i: Icon.warning, k: t.damages, v: '2 uwagi' },
            { i: Icon.camera, k: t.photos, v: '6 / 6' },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
              borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${tokens.hair2}`,
            }}>
              <r.i s={15} c={tokens.muted} />
              <span style={{ flex: 1, fontSize: 13, color: tokens.muted, fontWeight: 540 }}>{r.k}</span>
              <span style={{ fontSize: 13.5, fontWeight: 650, color: tokens.ink, letterSpacing: -0.2 }}>{r.v}</span>
              <Icon.check s={15} c={tokens.green} />
            </div>
          ))}
        </div>

        {/* Acknowledgment */}
        <button onClick={() => setAck(a => !a)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginTop: 14,
          background: tokens.card, borderRadius: 14, padding: '14px 14px', boxShadow: tokens.shadow1,
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            background: ack ? tokens.ink : 'transparent', border: `1.5px solid ${ack ? tokens.ink : tokens.hair}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{ack && <Icon.check s={14} c="#fff" />}</span>
          <span style={{ fontSize: 13, color: tokens.ink2, lineHeight: 1.4, fontWeight: 540 }}>{t.ackCustomer}</span>
        </button>

        {/* Signature pad */}
        <div style={{ fontSize: 12, fontWeight: 700, color: tokens.muted, letterSpacing: 0.4, textTransform: 'uppercase', margin: '18px 4px 8px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{t.signature}</span>
          <span style={{ color: tokens.accent, cursor: 'pointer' }}>{t.clearSig}</span>
        </div>
        <div style={{ background: tokens.card, borderRadius: 16, boxShadow: tokens.shadow1, padding: 16 }}>
          <div style={{
            height: 120, borderRadius: 12, border: `1.5px dashed ${tokens.hair}`, background: tokens.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
          }}>
            {/* freehand signature */}
            <svg width="220" height="80" viewBox="0 0 220 80" fill="none">
              <path d="M12 54 C26 22 34 22 38 44 C42 64 50 60 56 40 C60 26 66 28 70 46 C74 62 84 56 92 38 C100 22 112 30 110 46 C108 60 120 58 130 44 C140 30 150 34 156 48 C162 60 176 54 188 36 C196 24 206 26 210 40"
                stroke={tokens.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Icon.pen s={14} c={tokens.muted} />
            <span style={{ fontSize: 12.5, color: tokens.ink2 }}>
              <b style={{ color: tokens.ink, fontWeight: 650 }}>{t.signedBy} Anna Nowak</b> · {t.signedAt} 09:14
            </span>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: tokens.bg, padding: '12px 18px 30px', zIndex: 5, borderTop: `1px solid ${tokens.hair2}`,
      }}>
        <button style={{ ...chrome.cta, opacity: ack ? 1 : 0.45 }} onClick={() => ack && setSent(true)}>
          <Icon.message s={16} c="#fff" /> {t.confirmEmail}
        </button>
      </div>

      {/* Sent overlay */}
      {sent && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(20,18,22,0.55)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', background: tokens.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: '28px 22px 34px', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{ width: 64, height: 64, borderRadius: 99, background: tokens.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon.check s={30} c={tokens.green} />
            </div>
            <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.5 }}>{t.protocolSentPickup}</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: tokens.muted, marginTop: 8, lineHeight: 1.45, maxWidth: 290, marginInline: 'auto' }}>
              {t.protocolSentPickupSub}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, fontSize: 13 }}>
              <Icon.message s={15} c={tokens.muted} />
              <span style={{ color: tokens.ink2 }}>{t.sentTo} <b style={{ color: tokens.ink, fontWeight: 650 }}>anna.nowak@example.pl</b></span>
            </div>
            <button style={{ ...chrome.ctaInk, marginTop: 22 }} onClick={() => setSent(false)}>{t.doneLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ScreenPickupSignature });
