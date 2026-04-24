// Main app — renders all 7 screens inside iOS device frames on a design canvas
const { useState } = React;

const phoneShell = (children) => (
  <div style={{
    width: 402, height: 874, borderRadius: 48, overflow: 'hidden',
    position: 'relative', background: '#000',
    boxShadow: '0 40px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.25)',
    fontFamily: F.stack, WebkitFontSmoothing: 'antialiased',
  }}>
    <div style={{
      position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
      width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 70,
    }} />
    {children}
  </div>
);

const GOAL_OPTS_MAP = {
  maintain: 'Maintain weight',
  build: 'Build muscle',
  lose: 'Lose weight',
  protein: 'Higher protein',
  balanced: 'Balanced',
};

function App() {
  const [stats, setStats] = useState({
    height: '68', weight: '148', age: '20', sex: 'F', activity: 'Med',
  });
  const [goals, setGoals] = useState({ goal: 'protein' });
  const [prefs, setPrefs] = useState({
    diet: 'No preference',
    allergens: ['Dairy'],
    commons: { Worcester: 'prefer', Franklin: 'ok', Hampshire: 'ok', Berkshire: 'avoid' },
    meals: ['Lunch', 'Dinner'],
  });

  const goalLabel = GOAL_OPTS_MAP[goals.goal] || 'Higher protein';

  return (
    <DesignCanvas initialZoom={0.55}>
      <DCSection id="onboarding" title="Onboarding · 1–4">
        <DCArtboard id="s1" label="01 · Sign in" width={402} height={874}>
          {phoneShell(<SignInScreen onSignIn={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="s2" label="02 · Body stats" width={402} height={874}>
          {phoneShell(<StatsScreen state={stats} setState={setStats} onBack={() => {}} onNext={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="s3" label="03 · Goals" width={402} height={874}>
          {phoneShell(<GoalsScreen state={goals} setState={setGoals} onBack={() => {}} onNext={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="s4" label="04 · Preferences" width={402} height={874}>
          {phoneShell(<PrefsScreen state={prefs} setState={setPrefs} onBack={() => {}} onNext={() => {}} />)}
        </DCArtboard>
      </DCSection>

      <DCSection id="app" title="App · 5–7">
        <DCArtboard id="s5" label="05 · Today" width={402} height={874}>
          {phoneShell(<HomeScreen onNav={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="s6" label="06 · Chat" width={402} height={874}>
          {phoneShell(<ChatScreen onNav={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="s7" label="07 · Settings" width={402} height={874}>
          {phoneShell(<SettingsScreen onNav={() => {}} goalLabel={goalLabel} />)}
        </DCArtboard>
      </DCSection>

      <DCSection id="edge" title="Edge states">
        <DCArtboard id="s5e" label="05b · Today (empty)" width={402} height={874}>
          {phoneShell(<HomeScreen onNav={() => {}} empty />)}
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
