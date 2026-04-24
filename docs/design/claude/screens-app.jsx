// Screens 5–7: Home / Today, Chat, Settings

// ─────────── Small building blocks ───────────

const MacroLine = ({ kcal, protein, carbs, fat, sep = '·' }) => (
  <div style={{
    fontFamily: F.mono, fontSize: 11, color: T.textSecondary,
    letterSpacing: 0.3, whiteSpace: 'nowrap',
  }}>
    {kcal} kcal {sep} {protein}g P
    {carbs != null && <> {sep} {carbs}g C</>}
    {fat != null && <> {sep} {fat}g F</>}
  </div>
);

const Tag = ({ children, tone = 'neutral' }) => {
  const palettes = {
    neutral:    { bg: T.elevated, fg: T.textSecondary, bd: T.border },
    highlight:  { bg: 'rgba(242,193,78,0.12)', fg: T.highlight, bd: 'rgba(242,193,78,0.3)' },
    green:      { bg: 'rgba(111,191,115,0.12)', fg: T.green, bd: 'rgba(111,191,115,0.3)' },
    warn:       { bg: 'rgba(226,122,106,0.12)', fg: T.danger, bd: 'rgba(226,122,106,0.3)' },
  };
  const p = palettes[tone] || palettes.neutral;
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4,
      background: p.bg, color: p.fg, border: `1px solid ${p.bd}`,
      fontFamily: F.stack, fontSize: 10, fontWeight: 600,
      letterSpacing: 0.3, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
};

const tagTone = (t) => {
  if (['High protein', 'Pick'].includes(t)) return 'highlight';
  if (['Vegan', 'Vegetarian', 'Gluten-free'].includes(t)) return 'green';
  if (t.startsWith('No ') || t.startsWith('Contains')) return 'warn';
  return 'neutral';
};

// ─────────── 5. HOME / TODAY ───────────

const HeroCard = ({ data, onRegen }) => (
  <div style={{
    margin: '0 16px', padding: 16,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderLeft: `3px solid ${T.maroon}`,
    borderRadius: 8, position: 'relative',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10,
    }}>
      <div style={{
        fontFamily: F.mono, fontSize: 10, letterSpacing: 1.4,
        color: T.highlight, textTransform: 'uppercase',
      }}>Best move right now</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textTertiary, fontSize: 11 }}>
        <Icon name="clock" size={12} color={T.textTertiary} />
        <span style={{ fontFamily: F.mono, letterSpacing: 0.3 }}>{data.period}</span>
      </div>
    </div>

    <div style={{
      fontSize: 20, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.3,
      color: T.textPrimary, marginBottom: 10, textWrap: 'pretty',
    }}>{data.dish}</div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
      <CommonsTag name={data.commons} />
      <span style={{ color: T.textTertiary, fontSize: 12 }}>{data.station}</span>
    </div>

    <MacroLine kcal={data.kcal} protein={data.protein} carbs={data.carbs} fat={data.fat} />

    <div style={{
      marginTop: 12, padding: '10px 12px', background: T.bg,
      borderRadius: 6, border: `1px solid ${T.borderSoft}`,
      fontSize: 13, lineHeight: 1.45, color: T.textSecondary,
    }}>
      <span style={{ color: T.textPrimary, fontWeight: 600 }}>Why this · </span>
      {data.reason}
    </div>

    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button style={{
        flex: 1, height: 38, borderRadius: 6, border: 'none',
        background: T.maroon, color: '#fff',
        fontFamily: F.stack, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>Get directions</button>
      <button style={{
        width: 38, height: 38, borderRadius: 6,
        background: T.elevated, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }} title="Regenerate">
        <Icon name="refresh" size={16} color={T.textSecondary} strokeWidth={1.8} />
      </button>
      <button style={{
        width: 38, height: 38, borderRadius: 6,
        background: T.elevated, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }} title="Swap">
        <Icon name="menu" size={16} color={T.textSecondary} strokeWidth={1.8} />
      </button>
    </div>
  </div>
);

const MealRow = ({ item, recommended }) => (
  <div style={{
    padding: '12px 16px', display: 'flex', gap: 12,
    borderBottom: `1px solid ${T.borderSoft}`,
    background: recommended ? 'rgba(242,193,78,0.03)' : 'transparent',
    position: 'relative',
  }}>
    {recommended && (
      <div style={{
        position: 'absolute', left: 0, top: 12, bottom: 12,
        width: 2, background: T.highlight, borderRadius: 1,
      }} />
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 14, fontWeight: 600, color: T.textPrimary, lineHeight: 1.3,
        marginBottom: 4,
      }}>{item.dish}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <CommonsTag name={item.commons} />
        <span style={{ color: T.textTertiary, fontSize: 11 }}>·</span>
        <span style={{ color: T.textTertiary, fontSize: 11 }}>{item.station}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <MacroLine kcal={item.kcal} protein={item.protein} />
        {item.tags.map(t => <Tag key={t} tone={tagTone(t)}>{t}</Tag>)}
      </div>
    </div>
  </div>
);

const MealSection = ({ meal }) => {
  const statusLabel = {
    now: 'Serving now',
    upcoming: 'Upcoming',
    closed: 'Closed',
  }[meal.status];
  const statusColor = {
    now: T.green, upcoming: T.textSecondary, closed: T.textTertiary,
  }[meal.status];

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{
        padding: '0 16px 8px', display: 'flex',
        alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.2 }}>
            {meal.period}
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTertiary }}>
            {meal.window}
          </span>
        </div>
        <span style={{
          fontFamily: F.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
          color: statusColor,
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          {meal.status === 'now' && <span style={{
            width: 6, height: 6, borderRadius: '50%', background: T.green,
            boxShadow: `0 0 6px ${T.green}`,
          }} />}
          {statusLabel}
        </span>
      </div>
      <div style={{
        margin: '0 16px', background: T.surface,
        borderRadius: 8, border: `1px solid ${T.borderSoft}`,
        overflow: 'hidden',
      }}>
        {meal.items.map((it, i) => (
          <MealRow key={i} item={it} recommended={it.recommended} />
        ))}
      </div>
    </div>
  );
};

const HomeScreen = ({ onNav, empty = false }) => (
  <div style={{
    position: 'absolute', inset: 0, background: T.bg,
    display: 'flex', flexDirection: 'column',
    color: T.textPrimary, fontFamily: F.stack,
  }}>
    <StatusRow />

    {/* Header */}
    <div style={{
      padding: '8px 16px 12px',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{
          fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6,
          color: T.textSecondary, textTransform: 'uppercase', marginBottom: 4,
        }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: T.maroon, marginRight: 6, verticalAlign: 'middle',
          }} />
          Today · {TODAY}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: T.textPrimary }}>
          What to eat.
        </div>
      </div>
      <button style={{
        width: 36, height: 36, borderRadius: 8,
        background: T.surface, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        <Icon name="filter" size={16} color={T.textSecondary} strokeWidth={1.8} />
      </button>
    </div>

    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
      {empty ? (
        <div style={{
          margin: '0 16px', padding: 28,
          background: T.surface, borderRadius: 8, border: `1px dashed ${T.border}`,
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: F.mono, fontSize: 10, color: T.textTertiary,
            letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10,
          }}>No menu yet</div>
          <div style={{ fontSize: 15, color: T.textPrimary, lineHeight: 1.45, marginBottom: 8 }}>
            Today's menu is not available yet.
          </div>
          <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.45 }}>
            Try again after menus publish around 6am.
          </div>
          <button style={{
            marginTop: 16, height: 36, padding: '0 14px',
            background: T.elevated, color: T.textPrimary,
            border: `1px solid ${T.border}`, borderRadius: 6,
            fontFamily: F.stack, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="refresh" size={14} color={T.textPrimary} strokeWidth={1.8} />
            Retry
          </button>
        </div>
      ) : (
        <>
          <HeroCard data={BEST_NOW} />
          {MEALS.map(m => <MealSection key={m.period} meal={m} />)}
        </>
      )}
    </div>

    <TabBar active="home" onNav={onNav} />
  </div>
);

// ─────────── 6. CHAT ───────────

const CHAT_SUGGESTIONS = [
  'Best high-protein dinner?',
  'Vegetarian at Worcester?',
  'Avoid dairy today',
  'Quick lunch near Franklin',
];

const Bubble = ({ role, children }) => (
  <div style={{
    display: 'flex',
    justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
    padding: '0 16px',
  }}>
    <div style={{
      maxWidth: '82%',
      padding: '10px 12px',
      background: role === 'user' ? T.elevated : T.surface,
      border: `1px solid ${role === 'user' ? T.border : T.borderSoft}`,
      borderRadius: 8,
      borderTopRightRadius: role === 'user' ? 2 : 8,
      borderTopLeftRadius: role === 'user' ? 8 : 2,
      color: T.textPrimary, fontSize: 14, lineHeight: 1.45,
      textWrap: 'pretty',
    }}>{children}</div>
  </div>
);

const ChatPick = ({ dish, commons, station, macro }) => (
  <div style={{
    marginTop: 8, padding: '10px 12px',
    background: T.bg, border: `1px solid ${T.borderSoft}`,
    borderLeft: `2px solid ${T.commons[commons]}`,
    borderRadius: 6,
  }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>{dish}</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
      <CommonsTag name={commons} />
      <span style={{ fontSize: 11, color: T.textTertiary }}>· {station}</span>
    </div>
    <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textSecondary, letterSpacing: 0.3 }}>
      {macro}
    </div>
  </div>
);

const ChatScreen = ({ onNav }) => {
  const [messages, setMessages] = React.useState([
    { role: 'assistant', content: (
      <>
        Today's menus are loaded across all four dining commons. Ask anything — meal timing, protein targets, allergens.
      </>
    )},
    { role: 'user', content: 'Best high-protein dinner?' },
    { role: 'assistant', content: (
      <>
        Seared salmon at Berkshire is the strongest option tonight — 44g protein and fits your target.
        <ChatPick
          dish="Seared salmon, farro, green beans"
          commons="Berkshire"
          station="Exhibition · 5:00pm"
          macro="610 kcal · 44g P · 48g C · 22g F"
        />
        Runner-up: chicken shawarma plate at Worcester (38g P).
      </>
    )},
  ]);
  const [draft, setDraft] = React.useState('');

  const send = (text) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: 'user', content: text }]);
    setDraft('');
    setTimeout(() => {
      setMessages(m => [...m, { role: 'assistant', content: (
        <>Looking at today's menus for that — nothing in the 4 commons flags dairy in your watch list at dinner tonight.</>
      )}]);
    }, 600);
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, background: T.bg,
      display: 'flex', flexDirection: 'column',
      color: T.textPrimary, fontFamily: F.stack,
    }}>
      <StatusRow />

      {/* Header */}
      <div style={{
        padding: '8px 16px 14px',
        borderBottom: `1px solid ${T.borderSoft}`,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: T.textPrimary }}>
          Ask about today's menu
        </div>
        {/* Context strip */}
        <div style={{
          marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          fontFamily: F.mono, fontSize: 11, color: T.textSecondary, letterSpacing: 0.3,
        }}>
          <span style={{ color: T.highlight }}>Today</span>
          <span style={{ color: T.textTertiary }}>·</span>
          <span>All dining commons</span>
          <span style={{ color: T.textTertiary }}>·</span>
          <span>Your preferences</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>{m.content}</Bubble>
        ))}
      </div>

      {/* Suggestion chips */}
      <div style={{
        padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'nowrap',
        overflowX: 'auto', borderTop: `1px solid ${T.borderSoft}`,
      }}>
        {CHAT_SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)} style={{
            flexShrink: 0, padding: '7px 10px', borderRadius: 6,
            background: T.surface, border: `1px solid ${T.border}`,
            color: T.textSecondary, fontFamily: F.stack, fontSize: 12,
            fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{s}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px 14px',
        borderTop: `1px solid ${T.borderSoft}`,
        background: T.bg,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: T.surface, borderRadius: 8,
          border: `1px solid ${T.border}`, padding: '0 12px',
        }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(draft)}
            placeholder="Ask about today's menu…"
            style={{
              flex: 1, height: 40, background: 'transparent', border: 'none', outline: 'none',
              color: T.textPrimary, fontFamily: F.stack, fontSize: 14,
            }}
          />
        </div>
        <button onClick={() => send(draft)} style={{
          width: 40, height: 40, borderRadius: 8,
          background: draft.trim() ? T.maroon : T.elevated,
          border: 'none', cursor: draft.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="send" size={17} color={draft.trim() ? '#fff' : T.textTertiary} strokeWidth={1.8} />
        </button>
      </div>

      {/* tabs sit above home indicator */}
      <div style={{ height: 68 }} />
      <TabBar active="chat" onNav={onNav} />
    </div>
  );
};

// ─────────── 7. SETTINGS ───────────

const SettingsRow = ({ label, value, onClick, last, danger }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 14px', background: 'transparent', border: 'none',
      borderBottom: last ? 'none' : `1px solid ${T.borderSoft}`,
      cursor: 'pointer', textAlign: 'left',
    }}
  >
    <div style={{
      flex: 1, fontSize: 14, color: danger ? T.danger : T.textPrimary,
      fontFamily: F.stack,
    }}>{label}</div>
    {value != null && (
      <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: F.stack }}>{value}</div>
    )}
    {!danger && <Icon name="chevron" size={14} color={T.textTertiary} />}
  </button>
);

const SettingsGroup = ({ header, children }) => (
  <div style={{ marginTop: 18 }}>
    <div style={{
      padding: '0 18px 8px',
      fontFamily: F.mono, fontSize: 10, letterSpacing: 1.4,
      color: T.textSecondary, textTransform: 'uppercase',
    }}>{header}</div>
    <div style={{
      margin: '0 16px', background: T.surface,
      border: `1px solid ${T.borderSoft}`, borderRadius: 8,
      overflow: 'hidden',
    }}>{children}</div>
  </div>
);

const SettingsScreen = ({ onNav, goalLabel }) => (
  <div style={{
    position: 'absolute', inset: 0, background: T.bg,
    display: 'flex', flexDirection: 'column',
    color: T.textPrimary, fontFamily: F.stack,
  }}>
    <StatusRow />

    <div style={{ padding: '8px 16px 6px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, color: T.textPrimary }}>
        Settings
      </div>
    </div>

    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
      <SettingsGroup header="Profile">
        <SettingsRow label="Name" value="Alex P." />
        <SettingsRow label="Email" value="alexp@umass.edu" />
        <SettingsRow label="Height" value="5′ 8″" />
        <SettingsRow label="Weight" value="148 lb" />
        <SettingsRow label="Age" value="20" last />
      </SettingsGroup>

      <SettingsGroup header="Preferences">
        <SettingsRow label="Goal" value={goalLabel || 'Higher protein'} />
        <SettingsRow label="Dietary style" value="No preference" />
        <SettingsRow label="Allergens" value="Dairy" />
        <SettingsRow label="Meal timing" value="Lunch, Dinner" last />
      </SettingsGroup>

      <SettingsGroup header="Dining commons">
        <SettingsRow label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CommonsDot name="Worcester" /> Worcester</span>} value="Prefer" />
        <SettingsRow label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CommonsDot name="Franklin" /> Franklin</span>} value="OK" />
        <SettingsRow label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CommonsDot name="Hampshire" /> Hampshire</span>} value="OK" />
        <SettingsRow label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CommonsDot name="Berkshire" /> Berkshire</span>} value="Avoid" last />
      </SettingsGroup>

      <SettingsGroup header="Account">
        <SettingsRow label="Notifications" value="On" />
        <SettingsRow label="Sign out" danger last />
      </SettingsGroup>

      <div style={{ padding: '16px 20px 24px' }}>
        <button style={{
          width: '100%', height: 44, borderRadius: 8,
          background: T.maroon, color: '#fff', border: 'none',
          fontFamily: F.stack, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Save changes</button>
        <div style={{
          textAlign: 'center', marginTop: 14,
          fontFamily: F.mono, fontSize: 10, color: T.textTertiary, letterSpacing: 0.5,
        }}>
          UMass Meal Planner · v0.4.2
        </div>
      </div>
    </div>

    <TabBar active="settings" onNav={onNav} />
  </div>
);

Object.assign(window, { HomeScreen, ChatScreen, SettingsScreen });
