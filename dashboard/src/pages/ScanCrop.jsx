import { useState, useRef } from 'react';
import { Camera, Upload, Leaf, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { detectDisease } from '../utils/api';

const SEVERITY_COLORS = {
  None: 'var(--green-400)', Medium: 'var(--accent-amber)',
  High: 'var(--accent-orange)', Critical: 'var(--accent-red)',
};

export default function ScanCrop() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }

  async function handleScan() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await detectDisease(file);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Inference failed. Is the model loaded?');
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Scan Crop</h1>
        <p>Upload a leaf image for AI-powered disease detection using MobileNetV2</p>
      </div>

      <div className="grid-2">
        {/* Upload */}
        <div className="card animate-in">
          <div className="card-title mb-16"><Camera size={18} /> Capture / Upload Leaf Image</div>

          <div
            style={{
              border: '2px dashed var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: preview ? 0 : 60,
              textAlign: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
              minHeight: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-elevated)',
            }}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? (
              <img
                src={preview}
                alt="Leaf preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 400 }}
              />
            ) : (
              <div>
                <Upload size={40} color="var(--text-dim)" />
                <p className="text-muted mt-16">Click to upload or drag a leaf image</p>
                <p className="text-xs text-muted mt-8">JPEG, PNG, or WebP — max 10 MB</p>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            style={{ display: 'none' }}
          />

          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button
              className="btn btn-primary w-full"
              onClick={handleScan}
              disabled={!file || loading}
            >
              {loading ? <Loader size={16} /> : <Leaf size={16} />}
              {loading ? 'Analyzing…' : 'Detect Disease'}
            </button>
            {file && (
              <button
                className="btn btn-secondary"
                onClick={() => { setFile(null); setPreview(null); setResult(null); }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Guidance */}
          <div className="mt-16" style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <p className="text-xs text-muted">
              💡 <strong>Tips:</strong> Hold phone 20 cm from leaf. Ensure good lighting.
              Focus on the affected area. Avoid shadows.
            </p>
          </div>
        </div>

        {/* Result */}
        <div className="card animate-in animate-in-delay-1">
          <div className="card-title mb-16"><AlertTriangle size={18} /> Detection Result</div>

          {error && (
            <div style={{ padding: 16, background: 'rgba(239,83,80,0.1)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
              <p style={{ color: 'var(--accent-red)' }}>⚠️ {error}</p>
            </div>
          )}

          {!result && !error && (
            <div className="loading-overlay">
              <Leaf size={40} color="var(--text-dim)" />
              <p>Upload a leaf image and click "Detect Disease"</p>
            </div>
          )}

          {result && (
            <div>
              {/* Disease name + confidence */}
              <div style={{
                textAlign: 'center', padding: 24,
                background: `linear-gradient(135deg, ${result.is_healthy ? 'rgba(76,175,80,0.08)' : 'rgba(239,83,80,0.08)'}, transparent)`,
                borderRadius: 'var(--radius-lg)', marginBottom: 20,
              }}>
                {result.is_healthy ? (
                  <CheckCircle size={48} color="var(--green-400)" />
                ) : (
                  <AlertTriangle size={48} color={SEVERITY_COLORS[result.severity]} />
                )}
                <h2 style={{ marginTop: 12, fontSize: '1.4rem' }}>
                  {result.disease}
                </h2>
                <div className="flex items-center justify-between" style={{ justifyContent: 'center', gap: 12, marginTop: 8 }}>
                  <span className="badge badge-green">{result.crop}</span>
                  <span className="badge" style={{
                    background: `${SEVERITY_COLORS[result.severity]}22`,
                    color: SEVERITY_COLORS[result.severity],
                  }}>
                    {result.severity} severity
                  </span>
                </div>
                <div style={{
                  marginTop: 16, fontSize: '2rem', fontWeight: 800,
                  color: result.confidence > 0.8 ? 'var(--green-400)' : 'var(--accent-amber)',
                }}>
                  {(result.confidence * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted">Confidence</div>
              </div>

              {/* Treatment */}
              <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <div className="text-xs text-muted mb-16" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                  Recommended Treatment
                </div>
                <p style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {result.treatment}
                </p>
              </div>

              {/* Raw class */}
              <div className="mt-16 text-xs text-muted">
                Model class: <code style={{ color: 'var(--green-300)' }}>{result.predicted_class}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
