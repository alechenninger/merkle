import { useState } from 'react'
import './App.css'
import { InfoTip } from './components/InfoTip'
import { LogSection } from './features/log/LogSection'
import { useLogDemo } from './features/log/useLogDemo'
import { SparseSection } from './features/sparse/SparseSection'
import { useSparseDemo } from './features/sparse/useSparseDemo'

function App() {
  const sparse = useSparseDemo()
  const log = useLogDemo()
  const [resetToken, setResetToken] = useState(0)

  const resetDemo = () => {
    sparse.reset()
    log.reset()
    setResetToken((currentToken) => currentToken + 1)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <i />
            <i />
          </div>
          <div>
            <span className="overline">Merkle / field notes</span>
            <h1>Proof instruments</h1>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="live-indicator"><b /> Interactive model</span>
          <InfoTip text="Every digest is 32 raw bytes. The .. marker only abbreviates hashes in the interface." below>
            <span className="hash-label">SHA-256 / .. display only</span>
          </InfoTip>
          <button className="reset-button" type="button" onClick={resetDemo}>Reset demo</button>
        </div>
      </header>

      <main>
        <section className="intro-band">
          <div className="intro-copy">
            <span className="section-kicker">Data integrity lab / 02 structures</span>
            <h2>Merkle structures, made inspectable.</h2>
            <p>
              Change a state or append an event. Watch one compact root commit to the whole structure, then inspect the
              sibling hashes a verifier needs to reproduce it.
            </p>
          </div>
          <div className="intro-stats" aria-label="Model summary">
            <div><strong>2</strong><span>structures</span></div>
            <div><strong>{sparse.activeCount + log.events.length}</strong><span>active records</span></div>
            <div><strong>O(log n)</strong><span>witness size</span></div>
          </div>
        </section>

        <SparseSection key={`sparse-${resetToken}`} model={sparse} />
        <LogSection key={`log-${resetToken}`} model={log} />

        <section className="why-band" aria-labelledby="why-title">
          <div className="why-heading">
            <span className="section-kicker">Why the pattern matters</span>
            <h2 id="why-title">One root. Small witnesses. Big state.</h2>
          </div>
          <div className="why-grid">
            <article>
              <span className="why-index">A / STATE</span>
              <h3>Sparse trees make absence visible.</h3>
              <p>Known defaults let a verifier confirm that a key is empty without receiving all the other keys in the map.</p>
            </article>
            <article>
              <span className="why-index coral-text">B / HISTORY</span>
              <h3>Logs make order auditable.</h3>
              <p>Each append changes the root. A signed snapshot plus an inclusion witness makes later tampering detectable.</p>
            </article>
            <article>
              <span className="why-index blue-text">C / PROOF</span>
              <h3>Verification scales logarithmically.</h3>
              <p>The verifier recomputes one path using sibling hashes instead of downloading every unrelated branch.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer"><span>MERKLE / FIELD NOTES</span><span>interactive proof laboratory</span><span>deterministic demo hashes</span></footer>
    </div>
  )
}

export default App
