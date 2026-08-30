import { useState } from "react";
import "./App.css";
import primoLogo from "./assets/primo-logo.png";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

function App() {
  const [prUrl, setPrUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzePR = async () => {
    if (!prUrl.trim()) {
      setError("Paste a GitHub pull request URL first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const response = await fetch(`${API_URL}/analyze-pr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: prUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "PRI-MO could not analyze this PR.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="brand">
          <img src={primoLogo} alt="PRI-MO logo" />
          <div>
            <span className="brand-name">PRI-MO</span>
            <span className="brand-subtitle">
              Pull Request Intelligence Monitor
            </span>
          </div>
        </div>

        <div className="built-with">Built with IBM Bob</div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-glow hero-glow-one"></div>
          <div className="hero-glow hero-glow-two"></div>

          <div className="hero-content">
            <div className="status-pill">
              Smarter reviews before you merge
            </div>

            <h1>
              Catch what your
              <span> tests might miss.</span>
            </h1>

            <p className="hero-description">
              Drop in a GitHub pull request. PRI-MO checks the changes,
              test coverage, and review gaps so you know what deserves
              another look before merge.
            </p>

            <div className="analyzer-box">
              <div className="input-wrapper">
                <span className="github-icon">⌘</span>

                <input
                  type="text"
                  value={prUrl}
                  onChange={(event) => setPrUrl(event.target.value)}
                  placeholder="https://github.com/owner/repository/pull/1"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      analyzePR();
                    }
                  }}
                />
              </div>

              <button onClick={analyzePR} disabled={loading}>
                {loading ? "Scanning PR..." : "Analyze my PR"}
              </button>
            </div>

            <div className="feature-row">
              <span>Test gap detection</span>
              <span>Risk signals</span>
              <span>Patch-aware review</span>
            </div>

            {error && <p className="error-message">{error}</p>}
          </div>
        </section>

        {result && (
          <section className="analysis-section">
            <div className="analysis-heading">
              <div>
                <p className="section-kicker">Analysis complete</p>
                <h2>{result.title}</h2>

                <p className="branch-info">
                  PR #{result.number} · {result.headBranch} →{" "}
                  {result.baseBranch}
                </p>
              </div>

              <div
                className={`risk-badge risk-${result.risk.level.toLowerCase()}`}
              >
                <span>{result.risk.level}</span>
                <small>Risk</small>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Source files</span>
                <strong>{result.classification.sourceFiles}</strong>
                <span>changed</span>
              </div>

              <div className="metric-card">
                <span className="metric-label">Test files</span>
                <strong>{result.classification.testFiles}</strong>
                <span>changed</span>
              </div>

              <div className="metric-card">
                <span className="metric-label">Dependencies</span>
                <strong>{result.classification.dependencyFiles}</strong>
                <span>changed</span>
              </div>

              <div className="metric-card">
                <span className="metric-label">Commits</span>
                <strong>{result.commits}</strong>
                <span>in this PR</span>
              </div>
            </div>

            <div className="content-grid">
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-number">01</span>
                    <h3>What changed?</h3>
                  </div>
                </div>

                <div className="coverage-row">
                  <div>
                    <span>Production source changed</span>
                    <strong>
                      {result.testCoverageSignals.sourceChanged
                        ? "Yes"
                        : "No"}
                    </strong>
                  </div>

                  <div>
                    <span>Tests changed</span>
                    <strong>
                      {result.testCoverageSignals.testsChanged
                        ? "Yes"
                        : "No"}
                    </strong>
                  </div>
                </div>

                {result.testCoverageSignals.changedTestFiles.length > 0 && (
                  <div className="changed-tests">
                    <span>Changed tests</span>

                    {result.testCoverageSignals.changedTestFiles.map(
                      (file) => (
                        <code key={file}>{file}</code>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-number">02</span>
                    <h3>Risk signals</h3>
                  </div>
                </div>

                <div className="risk-score">
                  <strong>{result.risk.score}</strong>
                  <span>risk score</span>
                </div>

                <ul className="signal-list">
                  {result.risk.reasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="findings-section">
              <div className="section-title-row">
                <div>
                  <p className="section-kicker">PRI-MO noticed</p>
                  <h2>What deserves another look?</h2>
                </div>

                <span className="finding-count">
                  {result.reviewFindings.length} finding
                  {result.reviewFindings.length === 1 ? "" : "s"}
                </span>
              </div>

              {result.reviewFindings.length === 0 ? (
                <div className="no-findings">
                  <span className="check-circle">✓</span>
                  <div>
                    <h3>No patch-aware gaps detected</h3>
                    <p>
                      PRI-MO did not identify any current heuristic findings
                      in this pull request.
                    </p>
                  </div>
                </div>
              ) : (
                result.reviewFindings.map((finding, index) => (
                  <article className="finding-card" key={index}>
                    <div className="finding-top">
                      <span className="attention-dot"></span>

                      <div>
                        <p className="finding-type">
                          Test coverage gap
                        </p>

                        <h3>
                          This condition may need another test.
                        </h3>
                      </div>
                    </div>

                    <div className="condition-box">
                      <span>Detected condition</span>
                      <code>{finding.condition}</code>
                    </div>

                    <div className="finding-details">
                      <div>
                        <span>Tested values</span>
                        <strong>
                          {finding.testedValues.join(", ") || "None"}
                        </strong>
                      </div>

                      <div>
                        <span>Threshold</span>
                        <strong>{finding.threshold}</strong>
                      </div>
                    </div>

                    <div className="recommendation">
                      <span>Suggested next step</span>
                      <p>{finding.recommendation}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      <footer>
        <div>
          <strong>PRI-MO</strong>
          <span>Pull Request Intelligence Monitor</span>
        </div>

        <p>
          Student-built developer tooling · Powered by GitHub data ·
          Built with IBM Bob
        </p>
      </footer>
    </div>
  );
}

export default App;
