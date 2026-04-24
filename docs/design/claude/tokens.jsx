// Design tokens for UMass Meal Planner
const T = {
  bg: '#0E1111',
  surface: '#171B1A',
  elevated: '#202624',
  maroon: '#881C1C',
  maroonDeep: '#6B1515',
  highlight: '#F2C14E',
  green: '#6FBF73',
  blue: '#6CA6C1',
  berkshire: '#B54040', // muted maroon marker (distinct from brand maroon)
  textPrimary: '#F4F1EA',
  textSecondary: '#A8B0AA',
  textTertiary: '#6E7672',
  border: '#2D3431',
  borderSoft: '#232927',
  danger: '#E27A6A',
  // Dining commons palette (muted markers)
  commons: {
    Worcester: '#6CA6C1',
    Franklin: '#6FBF73',
    Hampshire: '#F2C14E',
    Berkshire: '#B54040',
  },
};

const F = {
  stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
};

// Tiny inline SVG icons — stroke-based, 20px default
const Icon = ({ name, size = 20, color = 'currentColor', strokeWidth = 1.6 }) => {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const v = {
    chevron: <path d="M9 6l6 6-6 6" {...p} />,
    chevronLeft: <path d="M15 6l-6 6 6 6" {...p} />,
    chevronDown: <path d="M6 9l6 6 6-6" {...p} />,
    check: <path d="M5 12l4 4 10-10" {...p} />,
    x: <path d="M6 6l12 12M18 6L6 18" {...p} />,
    plus: <path d="M12 5v14M5 12h14" {...p} />,
    refresh: <g {...p}><path d="M4 12a8 8 0 0114-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 01-14 5.3L4 15"/><path d="M4 20v-5h5"/></g>,
    chat: <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2h-7l-4 3v-3H6a2 2 0 01-2-2V6z" {...p} />,
    home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-8z" {...p} />,
    settings: <g {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></g>,
    search: <g {...p}><circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/></g>,
    send: <path d="M5 12l15-7-4 16-4-6-7-3z" {...p} />,
    clock: <g {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>,
    edit: <path d="M4 20h4l10-10-4-4L4 16v4z" {...p} />,
    menu: <g {...p}><path d="M4 6h16M4 12h16M4 18h16"/></g>,
    filter: <path d="M4 5h16l-6 8v5l-4 2v-7L4 5z" {...p} />,
    google: null, // handled separately (color logo)
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {v[name]}
    </svg>
  );
};

// Subtle horizontal scan-line texture for menu-board feel (sign-in only)
const ScanLines = ({ opacity = 0.035 }) => (
  <div style={{
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: `repeating-linear-gradient(0deg, rgba(244,241,234,${opacity}) 0 1px, transparent 1px 3px)`,
  }} />
);

// Dining-common dot marker
const CommonsDot = ({ name, size = 8 }) => (
  <span style={{
    display: 'inline-block', width: size, height: size, borderRadius: size / 2,
    background: T.commons[name], flexShrink: 0,
  }} />
);

// Dining-common tag (colored text + dot) — muted, metadata feel
const CommonsTag = ({ name }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: F.stack, fontSize: 12, fontWeight: 600,
    color: T.commons[name], letterSpacing: 0.2,
  }}>
    <CommonsDot name={name} />
    {name}
  </span>
);

// Status bar helper — dark
const StatusRow = () => (
  <div style={{
    height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px 0 32px', color: T.textPrimary, fontFamily: F.stack,
    fontSize: 16, fontWeight: 600, paddingTop: 18,
  }}>
    <span>9:41</span>
    <div style={{ width: 126, height: 37 }} />
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="#F4F1EA"/><rect x="4.5" y="5" width="3" height="6" rx="0.6" fill="#F4F1EA"/><rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill="#F4F1EA"/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="#F4F1EA"/></svg>
      <svg width="16" height="11" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill="#F4F1EA"/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill="#F4F1EA"/><circle cx="8.5" cy="10.5" r="1.5" fill="#F4F1EA"/></svg>
      <svg width="25" height="12" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="#F4F1EA" strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill="#F4F1EA"/><path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill="#F4F1EA" fillOpacity="0.5"/></svg>
    </div>
  </div>
);

// Home indicator
const HomeBar = () => (
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 34,
    display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
    paddingBottom: 8, pointerEvents: 'none', zIndex: 60,
  }}>
    <div style={{ width: 139, height: 5, borderRadius: 100, background: 'rgba(244,241,234,0.55)' }} />
  </div>
);

// Bottom tab bar used by Home / Chat / Settings
const TabBar = ({ active, onNav }) => {
  const tabs = [
    { id: 'home', label: 'Today', icon: 'home' },
    { id: 'chat', label: 'Ask', icon: 'chat' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(14,17,17,0.92)',
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      borderTop: `1px solid ${T.border}`,
      paddingTop: 6, paddingBottom: 34,
      display: 'flex', justifyContent: 'space-around',
      zIndex: 50,
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onNav(t.id)}
            style={{
              background: 'none', border: 'none', padding: '6px 18px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              color: isActive ? T.textPrimary : T.textTertiary,
              fontFamily: F.stack, fontSize: 10, fontWeight: 600,
              letterSpacing: 0.3, cursor: 'pointer',
            }}
          >
            <Icon name={t.icon} size={22} color={isActive ? T.textPrimary : T.textTertiary} strokeWidth={isActive ? 1.9 : 1.5} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

Object.assign(window, { T, F, Icon, ScanLines, CommonsDot, CommonsTag, StatusRow, HomeBar, TabBar });
