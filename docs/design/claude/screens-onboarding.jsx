// Screens 1–4: Sign In + Onboarding (Stats, Goals, Preferences)

// ────────────── 1. SIGN IN ──────────────
const SignInScreen = ({ onSignIn }) => (
  <div style={{
    position: 'absolute', inset: 0, background: T.bg,
    display: 'flex', flexDirection: 'column',
    color: T.textPrimary, fontFamily: F.stack,
  }}>
    <ScanLines opacity={0.04} />
    <StatusRow />

    {/* Wordmark block — menu-board feel */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', position: 'relative' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28,
        fontFamily: F.mono, fontSize: 11, color: T.textSecondary,
        letterSpacing: 2, textTransform: 'uppercase',
      }}>
        <span style={{ width: 6, height: 6, background: T.maroon, borderRadius: '50%' }} />
        UMass Amherst · Dining
      </div>

      <div style={{
        fontFamily: F.stack, fontSize: 44, fontWeight: 800,
        lineHeight: 1.02, letterSpacing: -1.2,
        color: T.textPrimary,
      }}>
        Meal<br/>Planner
      </div>

      {/* divider with maroon tick */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 18 }}>
        <div style={{ width: 24, height: 2, background: T.maroon }} />
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>

      <div style={{
        fontSize: 17, lineHeight: 1.45, color: T.textSecondary,
        maxWidth: 300, textWrap: 'pretty',
      }}>
        Today's UMass dining picks, built around you.
      </div>
    </div>

    {/* CTA block */}
    <div style={{ padding: '0 20px 40px' }}>
      <button
        onClick={onSignIn}
        style={{
          width: '100%', height: 52, borderRadius: 8,
          background: T.textPrimary, color: '#1A1A1A',
          border: 'none', fontFamily: F.stack, fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          cursor: 'pointer',
        }}
      >
        <GoogleG />
        Continue with UMass Google
      </button>
      <div style={{
        textAlign: 'center', marginTop: 14,
        fontFamily: F.mono, fontSize: 11, color: T.textTertiary,
        letterSpacing: 0.5,
      }}>
        Only @umass.edu accounts
      </div>
    </div>

    <HomeBar />
  </div>
);

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path d="M17.6 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.78 2.72v2.26h2.88c1.68-1.55 2.66-3.83 2.66-6.62z" fill="#4285F4"/>
    <path d="M9 18c2.4 0 4.4-.8 5.88-2.18l-2.88-2.26c-.8.54-1.82.86-3 .86-2.3 0-4.25-1.56-4.95-3.66H1.1v2.3A9 9 0 009 18z" fill="#34A853"/>
    <path d="M4.05 10.76a5.4 5.4 0 010-3.52V4.94H1.1a9 9 0 000 8.12l2.95-2.3z" fill="#FBBC05"/>
    <path d="M9 3.58c1.3 0 2.47.45 3.39 1.33l2.54-2.54C13.4.89 11.4 0 9 0A9 9 0 001.1 4.94l2.95 2.3C4.75 5.14 6.7 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

// Shared onboarding chrome
const OnboardShell = ({ step, title, onBack, onNext, nextLabel = 'Next', disabled, children }) => (
  <div style={{
    position: 'absolute', inset: 0, background: T.bg,
    display: 'flex', flexDirection: 'column',
    color: T.textPrimary, fontFamily: F.stack,
  }}>
    <StatusRow />

    {/* header row */}
    <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={onBack} style={{
        width: 32, height: 32, borderRadius: 8, background: T.surface,
        border: `1px solid ${T.border}`, color: T.textPrimary,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        <Icon name="chevronLeft" size={18} color={T.textSecondary} />
      </button>
      <div style={{
        fontFamily: F.mono, fontSize: 11, letterSpacing: 1.4, color: T.textSecondary,
        textTransform: 'uppercase',
      }}>Step {step} of 3</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            width: 18, height: 3, borderRadius: 2,
            background: i <= step ? T.maroon : T.border,
          }} />
        ))}
      </div>
    </div>

    <div style={{ padding: '20px 20px 8px' }}>
      <h1 style={{
        margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.6,
        color: T.textPrimary, lineHeight: 1.15,
      }}>{title}</h1>
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 100px' }}>
      {children}
    </div>

    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: '14px 20px 40px',
      background: 'linear-gradient(to top, rgba(14,17,17,1) 60%, rgba(14,17,17,0))',
    }}>
      <button
        onClick={disabled ? undefined : onNext}
        style={{
          width: '100%', height: 50, borderRadius: 8,
          background: disabled ? T.elevated : T.maroon,
          color: disabled ? T.textTertiary : '#fff',
          border: 'none', fontFamily: F.stack, fontSize: 15, fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.8 : 1,
        }}
      >{nextLabel}</button>
    </div>
    <HomeBar />
  </div>
);

// Compact input row used in Stats
const StatRow = ({ label, value, setValue, suffix, options }) => (
  <div style={{
    display: 'flex', alignItems: 'center', padding: '14px 14px',
    background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`,
    gap: 12,
  }}>
    <div style={{ flex: 1, fontSize: 15, color: T.textPrimary }}>{label}</div>
    {options ? (
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(o => (
          <button key={o} onClick={() => setValue(o)} style={{
            padding: '6px 12px', borderRadius: 6,
            background: value === o ? T.elevated : 'transparent',
            color: value === o ? T.textPrimary : T.textSecondary,
            border: `1px solid ${value === o ? T.border : 'transparent'}`,
            fontFamily: F.stack, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>{o}</button>
        ))}
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{
            width: 56, textAlign: 'right',
            background: 'transparent', border: 'none', outline: 'none',
            color: T.textPrimary, fontFamily: F.stack, fontSize: 17, fontWeight: 600,
          }}
        />
        {suffix && <span style={{ color: T.textSecondary, fontSize: 13, fontWeight: 500 }}>{suffix}</span>}
      </div>
    )}
  </div>
);

// ────────────── 2. BODY STATS ──────────────
const StatsScreen = ({ onBack, onNext, state, setState }) => (
  <OnboardShell step={1} title="Set your baseline." onBack={onBack} onNext={onNext}>
    <p style={{ margin: '0 0 20px', fontSize: 14, color: T.textSecondary, lineHeight: 1.45 }}>
      Quick setup so recommendations land near your actual targets. You can change these anytime.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <StatRow label="Height" value={state.height} setValue={v => setState({ ...state, height: v })} suffix="in" />
      <StatRow label="Weight" value={state.weight} setValue={v => setState({ ...state, weight: v })} suffix="lb" />
      <StatRow label="Age" value={state.age} setValue={v => setState({ ...state, age: v })} suffix="yr" />
      <StatRow label="Sex" value={state.sex} setValue={v => setState({ ...state, sex: v })} options={['F', 'M', 'Other']} />
      <StatRow label="Activity" value={state.activity} setValue={v => setState({ ...state, activity: v })} options={['Low', 'Med', 'High']} />
    </div>

    <div style={{
      marginTop: 20, padding: 14, borderRadius: 8,
      background: T.surface, border: `1px dashed ${T.border}`,
      fontFamily: F.mono, fontSize: 11, color: T.textSecondary, lineHeight: 1.7,
      letterSpacing: 0.2,
    }}>
      <div style={{ color: T.textTertiary, marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
        Baseline estimate
      </div>
      BMR ≈ 1,520 kcal · TDEE ≈ 2,280 kcal
    </div>
  </OnboardShell>
);

// ────────────── 3. GOALS ──────────────
const GOAL_OPTS = [
  { id: 'maintain', label: 'Maintain weight', sub: 'Match intake to daily burn', target: '≈ 2,280 kcal · 115g P' },
  { id: 'build',    label: 'Build muscle',   sub: 'Slight surplus + high protein', target: '≈ 2,550 kcal · 150g P' },
  { id: 'lose',     label: 'Lose weight',    sub: 'Modest deficit, preserve protein', target: '≈ 1,900 kcal · 130g P' },
  { id: 'protein',  label: 'Higher protein', sub: 'Prioritize protein across all meals', target: '≈ 2,280 kcal · 160g P' },
  { id: 'balanced', label: 'Balanced',       sub: 'Mixed macros, steady energy',  target: '≈ 2,280 kcal · 110g P' },
];

const GoalsScreen = ({ onBack, onNext, state, setState }) => (
  <OnboardShell step={2} title="What should meals optimize for?" onBack={onBack} onNext={onNext}>
    <p style={{ margin: '0 0 18px', fontSize: 14, color: T.textSecondary, lineHeight: 1.45 }}>
      Pick one. This shapes how picks are ranked — it's not a contract.
    </p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {GOAL_OPTS.map(g => {
        const sel = state.goal === g.id;
        return (
          <button
            key={g.id}
            onClick={() => setState({ ...state, goal: g.id })}
            style={{
              display: 'flex', alignItems: 'stretch', gap: 14,
              padding: '14px 14px 14px 14px', borderRadius: 8,
              background: sel ? T.elevated : T.surface,
              border: `1px solid ${sel ? T.border : T.borderSoft}`,
              color: 'inherit', cursor: 'pointer', textAlign: 'left',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Left rail — maroon when selected */}
            <div style={{
              width: 3, borderRadius: 2, alignSelf: 'stretch',
              background: sel ? T.maroon : 'transparent',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 15, fontWeight: 600, color: T.textPrimary,
                marginBottom: 2,
              }}>{g.label}</div>
              <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.35 }}>{g.sub}</div>
              <div style={{
                marginTop: 6, fontFamily: F.mono, fontSize: 11,
                color: sel ? T.textSecondary : T.textTertiary, letterSpacing: 0.3,
              }}>{g.target}</div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: 11, alignSelf: 'center',
              border: `1.5px solid ${sel ? T.maroon : T.border}`,
              background: sel ? T.maroon : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {sel && <Icon name="check" size={14} color="#fff" strokeWidth={2.5} />}
            </div>
          </button>
        );
      })}
    </div>
  </OnboardShell>
);

// ────────────── 4. PREFERENCES ──────────────
const DIET_STYLES = ['No preference', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher'];
const ALLERGENS   = ['Dairy', 'Gluten', 'Nuts', 'Shellfish', 'Soy', 'Eggs', 'Sesame'];
const MEAL_TIMING = ['Breakfast', 'Lunch', 'Dinner', 'Late night'];

const Chip = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: '7px 12px', borderRadius: 6,
    background: active ? T.elevated : T.surface,
    color: active ? T.textPrimary : T.textSecondary,
    border: `1px solid ${active ? T.border : T.borderSoft}`,
    fontFamily: F.stack, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }}>
    {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.maroon }} />}
    {children}
  </button>
);

const CommonsPrefRow = ({ name, mode, onChange }) => {
  const modes = [
    { id: 'prefer', label: 'Prefer' },
    { id: 'ok',     label: 'OK' },
    { id: 'avoid',  label: 'Avoid' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: T.surface,
      border: `1px solid ${T.borderSoft}`, borderRadius: 8,
    }}>
      <CommonsDot name={name} size={10} />
      <div style={{ flex: 1, fontSize: 14, color: T.textPrimary }}>{name}</div>
      <div style={{ display: 'flex', background: T.bg, borderRadius: 6, padding: 2, border: `1px solid ${T.borderSoft}` }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => onChange(m.id)} style={{
            padding: '4px 8px', borderRadius: 4,
            background: mode === m.id ? T.elevated : 'transparent',
            color: mode === m.id ? T.textPrimary : T.textTertiary,
            border: 'none', cursor: 'pointer',
            fontFamily: F.stack, fontSize: 11, fontWeight: 600,
            letterSpacing: 0.2,
          }}>{m.label}</button>
        ))}
      </div>
    </div>
  );
};

const SectionHeader = ({ children }) => (
  <div style={{
    fontFamily: F.mono, fontSize: 11, letterSpacing: 1.4,
    color: T.textSecondary, textTransform: 'uppercase',
    margin: '18px 0 10px',
  }}>{children}</div>
);

const PrefsScreen = ({ onBack, onNext, state, setState }) => {
  const toggle = (key, val) => {
    const arr = state[key] || [];
    setState({ ...state, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] });
  };
  const setCommons = (name, mode) => setState({ ...state, commons: { ...state.commons, [name]: mode } });

  return (
    <OnboardShell step={3} title="What should it avoid or prefer?" onBack={onBack} onNext={onNext} nextLabel="Build today's plan">
      <SectionHeader>Dietary style</SectionHeader>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {DIET_STYLES.map(d => (
          <Chip key={d} active={state.diet === d} onClick={() => setState({ ...state, diet: d })}>{d}</Chip>
        ))}
      </div>

      <SectionHeader>Allergens to avoid</SectionHeader>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ALLERGENS.map(a => (
          <Chip key={a} active={(state.allergens || []).includes(a)} onClick={() => toggle('allergens', a)}>{a}</Chip>
        ))}
      </div>

      <SectionHeader>Dining commons</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['Worcester', 'Franklin', 'Hampshire', 'Berkshire'].map(c => (
          <CommonsPrefRow key={c} name={c} mode={state.commons[c]} onChange={m => setCommons(c, m)} />
        ))}
      </div>

      <SectionHeader>Meal timing</SectionHeader>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {MEAL_TIMING.map(m => (
          <Chip key={m} active={(state.meals || []).includes(m)} onClick={() => toggle('meals', m)}>{m}</Chip>
        ))}
      </div>
    </OnboardShell>
  );
};

Object.assign(window, { SignInScreen, StatsScreen, GoalsScreen, PrefsScreen });
