/**
 * PolygonMapPicker
 * A Leaflet map that lets the user:
 *  1. Search for a location (Nominatim geocoding)
 *  2. Paste / type exact lat,lon coordinates
 *  3. Use their device GPS location
 *  4. Click to draw polygon vertices
 *  5. Drag existing vertices to adjust
 *  6. See the calculated area in acres / hectares
 *
 * Props:
 *  value    – [[lat, lon], ...]  current polygon points
 *  onChange – (points) => void   called whenever points change
 *  center   – [lat, lon]         initial map centre (default: India centre)
 */
import { useState, useRef, useCallback } from 'react';
import {
  MapContainer, TileLayer, Polygon, CircleMarker, useMapEvents, useMap, useMapEvent,
} from 'react-leaflet';
import { Search, Trash2, CheckCircle, PenLine, Locate, Navigation } from 'lucide-react';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

// ── Area calculation (Shoelace + Haversine-based conversion) ──────────────────
function polygonAreaHa(coords) {
  if (coords.length < 3) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const centerLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const latM = (Math.PI * R) / 180;
  const lonM = (Math.PI * R * Math.cos(toRad(centerLat))) / 180;
  const pts = coords.map(([lat, lon]) => [lat * latM, lon * lonM]);
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2 / 10000;
}

// ── Fly-to helper ─────────────────────────────────────────────────────────────
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.coords, target.zoom ?? 14, { duration: 1.2 });
  }, [target, map]);
  return null;
}

// ── Map click / event handler ─────────────────────────────────────────────────
function DrawHandler({ drawing, onMapClick }) {
  useMapEvents({
    click(e) {
      if (drawing) onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PolygonMapPicker({
  value = [],
  onChange,
  center = [20.5937, 78.9629],
}) {
  const [drawing, setDrawing]       = useState(false);
  const [flyTarget, setFlyTarget]   = useState(null);
  const [search, setSearch]         = useState('');
  const [searching, setSearching]   = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [dragIdx, setDragIdx]       = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coordLat, setCoordLat]     = useState('');
  const [coordLon, setCoordLon]     = useState('');
  const [coordErr, setCoordErr]     = useState('');
  const [showCoords, setShowCoords] = useState(false);
  const mapRef = useRef(null);

  const areaHa  = polygonAreaHa(value);
  const areaAcr = areaHa * 2.47105;

  // ── Geocoding (Nominatim) ────────────────────────────────────────────────
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=5&countrycodes=in`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {}
    setSearching(false);
  }, [search]);

  function selectResult(r) {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    setFlyTarget({ coords: [lat, lon], zoom: 14 });
    setSearchResults([]);
    setSearch(r.display_name.split(',').slice(0, 2).join(','));
  }

  // ── GPS current location ─────────────────────────────────────────────────
  function useMyLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setFlyTarget({ coords: [lat, lon], zoom: 16 });
        setCoordLat(lat.toFixed(6));
        setCoordLon(lon.toFixed(6));
        setGpsLoading(false);
      },
      (err) => {
        alert('Could not get your location: ' + err.message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ── Manual coordinate jump ───────────────────────────────────────────────
  function goToCoords(e) {
    e.preventDefault();
    setCoordErr('');
    const lat = parseFloat(coordLat);
    const lon = parseFloat(coordLon);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setCoordErr('Latitude must be between -90 and 90');
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setCoordErr('Longitude must be between -180 and 180');
      return;
    }
    setFlyTarget({ coords: [lat, lon], zoom: 16 });
  }

  // ── Drawing ──────────────────────────────────────────────────────────────
  function handleMapClick(pt) {
    onChange([...value, pt]);
  }

  function removeVertex(idx) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function clearAll() {
    onChange([]);
    setDrawing(false);
  }

  // ── Drag vertex ──────────────────────────────────────────────────────────
  function startDrag(idx, e) {
    e.originalEvent?.stopPropagation();
    setDragIdx(idx);
  }
  function onVertexDrag(e) {
    if (dragIdx === null) return;
    const next = [...value];
    next[dragIdx] = [e.latlng.lat, e.latlng.lng];
    onChange(next);
  }
  function stopDrag() { setDragIdx(null); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Location controls ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Row 1: Search + GPS */}
        <form onSubmit={handleSearch} style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Search village, town, pin code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" type="submit" disabled={searching}>
              <Search size={15} />
              {searching ? 'Searching…' : 'Search'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={useMyLocation}
              disabled={gpsLoading}
              title="Use my current location"
              style={{ whiteSpace: 'nowrap', color: 'var(--accent-green)' }}
            >
              <Navigation size={15} />
              {gpsLoading ? 'Locating…' : 'My Location'}
            </button>
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {searchResults.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => selectResult(r)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 14px', background: 'none', border: 'none',
                    color: '#1b5e20', cursor: 'pointer', fontSize: '0.83rem',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Row 2: Coordinates toggle + input */}
        <div>
          <button
            type="button"
            onClick={() => setShowCoords(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: '0.8rem', padding: '2px 0',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Locate size={13} />
            {showCoords ? 'Hide' : 'Enter exact coordinates (lat / lon)'}
          </button>

          {showCoords && (
            <form onSubmit={goToCoords} style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                <input
                  className="input"
                  placeholder="Latitude (e.g. 30.9010)"
                  value={coordLat}
                  onChange={e => setCoordLat(e.target.value)}
                  style={{ flex: 1, minWidth: 140 }}
                />
                <input
                  className="input"
                  placeholder="Longitude (e.g. 75.8573)"
                  value={coordLon}
                  onChange={e => setCoordLon(e.target.value)}
                  style={{ flex: 1, minWidth: 140 }}
                />
              </div>
              <button className="btn btn-secondary" type="submit">
                Go to Point
              </button>
              {coordErr && (
                <p style={{ width: '100%', margin: 0, color: 'var(--accent-red)', fontSize: '0.78rem' }}>
                  {coordErr}
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${drawing ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setDrawing(d => !d)}
        >
          <PenLine size={14} />
          {drawing ? 'Stop Drawing' : 'Draw Boundary'}
        </button>

        {value.length > 0 && (
          <button type="button" className="btn btn-secondary" onClick={clearAll}
            style={{ color: 'var(--accent-red)' }}>
            <Trash2 size={14} /> Clear
          </button>
        )}

        {value.length >= 3 && (
          <span style={{
            marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--accent-green)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <CheckCircle size={14} />
            {areaHa.toFixed(2)} ha &nbsp;/&nbsp; {areaAcr.toFixed(2)} acres
          </span>
        )}
      </div>

      {drawing && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
          Click on the map to add boundary points. Right-click a point to remove it.
          Draw at least 3 points to form a field.
        </p>
      )}

      {/* ── Map ────────────────────────────────────────────────────────── */}
      <div style={{
        height: 420, borderRadius: 10, overflow: 'hidden',
        border: drawing ? '2px solid var(--accent-green)' : '1px solid var(--border)',
        cursor: drawing ? 'crosshair' : 'grab',
        transition: 'border-color 0.2s',
      }}>
        <MapContainer
          center={center}
          zoom={6}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OSM contributors"
          />
          <FlyTo target={flyTarget} />
          <DrawHandler drawing={drawing} onMapClick={handleMapClick} />

          {value.length >= 3 && (
            <Polygon
              positions={value}
              pathOptions={{ color: '#66bb6a', fillColor: '#66bb6a', fillOpacity: 0.18, weight: 2 }}
            />
          )}

          {value.map((pt, i) => (
            <CircleMarker
              key={i}
              center={pt}
              radius={7}
              pathOptions={{ color: '#fff', fillColor: '#4caf50', fillOpacity: 1, weight: 2 }}
              eventHandlers={{
                mousedown: (e) => startDrag(i, e),
                mousemove: onVertexDrag,
                mouseup:   stopDrag,
                contextmenu: (e) => { e.originalEvent.preventDefault(); removeVertex(i); },
              }}
            />
          ))}
        </MapContainer>
      </div>

      {value.length > 0 && value.length < 3 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--accent-amber)', margin: 0 }}>
          Add {3 - value.length} more point{3 - value.length > 1 ? 's' : ''} to complete the boundary.
        </p>
      )}
    </div>
  );
}
