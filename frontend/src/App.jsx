import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import './App.css'

function App() {
  const [user, setUser] = useState(null); 
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  // --- DASHBOARD STATE ---
  const [activeTab, setActiveTab] = useState('single'); 
  
  const [formData, setFormData] = useState({
    pregnancies: '', glucose: '', blood_pressure: '',
    skin_thickness: '', insulin: '', bmi: '', pedigree: '', age: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- BATCH UPLOAD STATE ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchResults, setBatchResults] = useState(null);

  // --- AUTH FUNCTIONS ---
  const handleAuthChange = (e) => setAuthData({ ...authData, [e.target.name]: e.target.value });

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    try {
      const response = await fetch(`http://127.0.0.1:5001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData),
        credentials: 'include' 
      });
      const data = await response.json();
      if (response.ok) setUser(data.username); 
      else setAuthError(data.message || 'Authentication failed');
    } catch (err) {
      setAuthError('Server connection error.');
    }
  };

  const handleLogout = async () => {
    await fetch('http://127.0.0.1:5001/api/logout', { method: 'POST', credentials: 'include' });
    setUser(null); setResult(null); setBatchResults(null);
  };

  // --- SINGLE PREDICT FUNCTION ---
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePredictSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:5001/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include' 
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: "⚠️ Failed to connect to AI server." });
    }
    setLoading(false);
  };

  const chartData = [
    { name: 'Glucose', Patient: Number(formData.glucose) || 0, Normal: 100 },
    { name: 'Blood Press.', Patient: Number(formData.blood_pressure) || 0, Normal: 80 },
    { name: 'BMI', Patient: Number(formData.bmi) || 0, Normal: 22 },
    { name: 'Insulin', Patient: Number(formData.insulin) || 0, Normal: 85 }
  ];

  // --- BATCH PREDICT FUNCTION ---
  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setLoading(true);
    
    const fileData = new FormData();
    fileData.append('file', selectedFile);

    try {
      const response = await fetch('http://127.0.0.1:5001/api/predict_batch', {
        method: 'POST',
        body: fileData,
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) setBatchResults(data.batch_results);
      else alert(data.message);
    } catch (error) {
      alert("Failed to connect to batch AI server.");
    }
    setLoading(false);
  };

  // --- CSV EXPORT FUNCTION ---
  const downloadCSV = () => {
    if (!batchResults) return;

    // 1. Create the column headers for the spreadsheet
    const headers = ["Patient ID", "Glucose", "BMI", "Risk Level", "Diagnosis", "Suspected Causes", "Specialist"];
    
    // 2. Loop through the AI results and format them as CSV rows
    const rows = batchResults.map(patient => {
      const riskText = patient.risk_code === 1 ? "High Risk" : "Normal";
      // Join multiple causes with a pipe | so it doesn't break CSV commas
      const causes = patient.suspected_causes.join(" | "); 
      
      // Wrap text in quotes just in case there are weird characters
      return [
        patient.patient_id,
        patient.vitals.glucose,
        patient.vitals.bmi,
        riskText,
        `"${patient.diagnosis}"`,
        `"${causes}"`,
        `"${patient.recommended_specialist}"`
      ].join(",");
    });

    // 3. Combine headers and rows
    const csvContent = [headers.join(","), ...rows].join("\n");
    
    // 4. Force the browser to download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "AI_Triage_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // VIEW 1: LOGIN
  // ==========================================
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>⚕️ Wiskr Health</h1>
          <form onSubmit={handleAuthSubmit} className="auth-form">
            <div className="input-group">
              <label>USERNAME</label>
              <input type="text" name="username" value={authData.username} onChange={handleAuthChange} required />
            </div>
            <div className="input-group">
              <label>PASSWORD</label>
              <input type="password" name="password" value={authData.password} onChange={handleAuthChange} required />
            </div>
            {authError && <div className="auth-error">{authError}</div>}
            <button type="submit" className="predict-btn">{isLoginMode ? 'Login' : 'Register'}</button>
          </form>
          <p className="toggle-auth" onClick={() => setIsLoginMode(!isLoginMode)}>
            {isLoginMode ? "Need an account? Register here." : "Already have an account? Login here."}
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: DASHBOARD
  // ==========================================
  return (
    <div className="dashboard-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>⚕️ AI Health Diagnostic Dashboard</h1>
          <p>Logged in as: <strong>Dr. {user}</strong></p>
        </div>
        <button onClick={handleLogout} className="logout-btn">Log Out</button>
      </header>

      {/* TABS CONTROLLER */}
      <div className="tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('single')} 
          style={{ flex: 1, padding: '15px', background: activeTab === 'single' ? '#6c5ce7' : '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          👤 Single Patient Entry
        </button>
        <button 
          onClick={() => setActiveTab('batch')} 
          style={{ flex: 1, padding: '15px', background: activeTab === 'batch' ? '#6c5ce7' : '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          📂 Bulk Dataset Import (CSV)
        </button>
      </div>

      <main className="main-content">
        
        {/* --- TAB: SINGLE PATIENT --- */}
        {activeTab === 'single' && (
          <div className="form-card">
            <h2>Patient Vitals Input</h2>
            <form onSubmit={handlePredictSubmit} className="vitals-form">
              {Object.keys(formData).map((key) => (
                <div className="input-group" key={key}>
                  <label>{key.replace('_', ' ').toUpperCase()}</label>
                  <input type="number" step="any" name={key} value={formData[key]} onChange={handleChange} required />
                </div>
              ))}
              <button type="submit" disabled={loading} className="predict-btn">
                {loading ? '🧠 AI Analyzing...' : 'Run AI Prediction'}
              </button>
            </form>

            {result && (
              <div className={`result-card ${result.risk_code === 1 ? 'high-risk' : result.risk_code === 0 ? 'low-risk' : 'error-risk'}`} style={{marginTop: '30px'}}>
                <div className="diagnosis-section">
                  <h2>Diagnostic Result</h2>
                  {result.error ? (
                    <p>{result.error}</p>
                  ) : (
                    <>
                      <div className="risk-indicator">{result.risk_code === 1 ? '⚠️ HIGH RISK DETECTED' : '✅ LOW RISK'}</div>
                      <p className="diagnosis-text">{result.diagnosis}</p>
                    </>
                  )}
                </div>

                {!result.error && result.suspected_causes && (
                  <div className="medical-insights">
                    <div className="insight-box">
                      <h4>🔍 Suspected Causes</h4>
                      <ul>{result.suspected_causes.map((cause, i) => <li key={i}>{cause}</li>)}</ul>
                    </div>
                    <div className="insight-box">
                      <h4>📋 Action Plan</h4>
                      <ul>{result.suggested_action.map((action, i) => <li key={i}>{action}</li>)}</ul>
                    </div>
                    <div className="insight-box highlight-box">
                      <h4>👨‍⚕️ Specialist Referral</h4>
                      <p className="specialist-text">{result.recommended_specialist}</p>
                    </div>
                  </div>
                )}

                {!result.error && (
                  <div className="chart-section">
                    <h3>Vitals Comparison Analysis</h3>
                    <div className="chart-wrapper" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                      <BarChart width={600} height={300} data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="name" stroke="#aaa" />
                        <YAxis stroke="#aaa" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e1e2e', borderColor: '#444', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar dataKey="Patient" fill="#6c5ce7" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Normal" fill="#2ed573" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB: BATCH UPLOAD --- */}
        {activeTab === 'batch' && (
          <div className="form-card">
            <h2>Batch AI Analysis</h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>Upload a CSV file containing patient records. The AI will analyze all rows automatically.</p>
            <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="file" accept=".csv" onChange={handleFileChange} style={{ background: '#222', padding: '15px', borderRadius: '8px', color: '#fff', border: '1px solid #444' }} required />
              <button type="submit" disabled={loading} className="predict-btn">
                {loading ? '🧠 Processing Dataset...' : 'Run Batch Analysis'}
              </button>
            </form>

            {/* Batch Table Results */}
            {batchResults && (
              <div style={{ marginTop: '40px' }}>
                
                {/* --- THE NEW DOWNLOAD BUTTON --- */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, color: '#ccc' }}>Processed Patient Records</h3>
                  <button onClick={downloadCSV} style={{ background: '#2ed573', color: '#000', fontWeight: 'bold', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    📥 Export Report (CSV)
                  </button>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #555', background: '#222' }}>
                        <th style={{ padding: '15px' }}>ID</th>
                        <th style={{ padding: '15px' }}>Glucose</th>
                        <th style={{ padding: '15px' }}>BMI</th>
                        <th style={{ padding: '15px' }}>Risk Assessment</th>
                        <th style={{ padding: '15px' }}>Recommended Specialist</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map((patient, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #333', background: patient.risk_code === 1 ? 'rgba(255, 71, 87, 0.1)' : 'rgba(46, 213, 115, 0.05)' }}>
                          <td style={{ padding: '15px' }}>{patient.patient_id}</td>
                          <td style={{ padding: '15px' }}>{patient.vitals.glucose}</td>
                          <td style={{ padding: '15px' }}>{patient.vitals.bmi}</td>
                          <td style={{ padding: '15px', fontWeight: 'bold', color: patient.risk_code === 1 ? '#ff4757' : '#2ed573' }}>
                            {patient.risk_code === 1 ? 'High Risk' : 'Normal'}
                          </td>
                          <td style={{ padding: '15px' }}>{patient.recommended_specialist}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}

export default App