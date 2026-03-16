import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

const CROPPY_FEATURES = [
  {
    id: "satellite",
    title: "Satellite Intelligence",
    description: "NDVI, EVI, NDWI and 5 more vegetation indices from Sentinel-2 every 5 days. Spot stress zones before they spread across your field.",
    image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "disease",
    title: "AI Disease Detection",
    description: "Photograph a leaf and get an instant diagnosis. Our CNN classifies 38 diseases across 14 crop varieties in under 2 seconds.",
    image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "weather",
    title: "Weather and Stress Forecast",
    description: "7-day crop stress probability powered by an LSTM model trained on NASA POWER climate data. Know what is coming before it arrives.",
    image: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "market",
    title: "Mandi Market Prices",
    description: "Live Agmarknet commodity prices across hundreds of mandis. Compare rates, pick the right market, and sell at peak value.",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "pest",
    title: "Pest Risk Alerts",
    description: "Push notifications when temperature and humidity create ideal conditions for pests. Rule-engine and ML hybrid, tuned for Indian crops.",
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "reports",
    title: "PDF Field Reports",
    description: "Download a shareable, print-ready field health report in one click. Includes satellite maps, indices, weather and crop recommendations.",
    image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&auto=format&fit=crop&q=80",
  },
];

const Gallery4 = ({
  title = "Everything your farm needs",
  description = "From satellite imagery to AI inference — the full precision agriculture stack, built for Indian farmers.",
  items = CROPPY_FEATURES,
}) => {
  const [carouselApi, setCarouselApi] = useState(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expanded, setExpanded] = useState(null); // item or null

  useEffect(() => {
    if (!carouselApi) return;
    const update = () => {
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    update();
    carouselApi.on("select", update);
    return () => { carouselApi.off("select", update); };
  }, [carouselApi]);

  // close modal on Escape
  const handleKey = useCallback((e) => {
    if (e.key === "Escape") setExpanded(null);
  }, []);
  useEffect(() => {
    if (expanded) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    } else {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [expanded, handleKey]);

  const btnBase = {
    width: 38, height: 38, borderRadius: 8, border: "1.5px solid #d4d4d4",
    background: "#fff", cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", transition: "all 0.15s",
    flexShrink: 0,
  };

  return (
    <>
      <section style={{ background: "#f9fafb", padding: "88px 0 64px" }}>

        {/* ── centered header ── */}
        <div style={{ textAlign: "center", marginBottom: 52, padding: "0 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#43a047",
            textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>
            Platform
          </div>
          <h2 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 900,
            color: "#111", margin: "0 0 14px", lineHeight: 1.1, letterSpacing: "-1px" }}>
            {title}
          </h2>
          <p style={{ fontSize: 16, color: "#777", lineHeight: 1.7,
            margin: "0 auto", maxWidth: 520 }}>
            {description}
          </p>
        </div>

        {/* ── prev/next aligned right ── */}
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 40px",
          display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...btnBase, opacity: canScrollPrev ? 1 : 0.3 }}
              onClick={() => carouselApi?.scrollPrev()}
              disabled={!canScrollPrev}
            >
              <ArrowLeft size={17} color="#333" />
            </button>
            <button
              style={{ ...btnBase, opacity: canScrollNext ? 1 : 0.3 }}
              onClick={() => carouselApi?.scrollNext()}
              disabled={!canScrollNext}
            >
              <ArrowRight size={17} color="#333" />
            </button>
          </div>
        </div>

        {/* ── carousel ── */}
        <Carousel setApi={setCarouselApi} opts={{ dragFree: true, align: "start" }}>
          <CarouselContent style={{ paddingLeft: 40, marginLeft: 0 }}>
            {items.map((item) => (
              <CarouselItem key={item.id} style={{ flex: "0 0 300px", paddingLeft: 16, minWidth: 0 }}>
                <div
                  onClick={() => setExpanded(item)}
                  style={{
                    position: "relative", height: 400, borderRadius: 18,
                    overflow: "hidden", cursor: "pointer",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                    transition: "transform 0.25s, box-shadow 0.25s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.18)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.10)";
                  }}
                >
                  <img src={item.image} alt={item.title} loading="lazy"
                    referrerPolicy="no-referrer"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                      objectFit: "cover", display: "block" }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.22) 55%, transparent 100%)",
                    pointerEvents: "none",
                  }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "22px 20px", color: "#fff" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 7, lineHeight: 1.3 }}>
                      {item.title}
                    </div>
                    <div style={{
                      fontSize: 13, color: "rgba(67,160,71,0.72)", lineHeight: 1.6,
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {item.description}
                    </div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center" }}>
                      <ArrowRight size={14} color="#69f0ae" />
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
            <CarouselItem style={{ flex: "0 0 24px", paddingLeft: 0 }}><div /></CarouselItem>
          </CarouselContent>
        </Carousel>

        {/* dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 28 }}>
          {items.map((_, i) => (
            <button key={i} onClick={() => carouselApi?.scrollTo(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: currentSlide === i ? 22 : 8, height: 8,
                borderRadius: 99, border: "none", padding: 0, cursor: "pointer",
                background: currentSlide === i ? "#43a047" : "#c8e6c9",
                transition: "width 0.25s, background 0.25s",
              }}
            />
          ))}
        </div>
      </section>

      {/* ── EXPANDED MODAL ── */}
      {expanded && (
        <div
          onClick={() => setExpanded(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "relative", borderRadius: 24, overflow: "hidden",
              width: "100%", maxWidth: 780, maxHeight: "88vh",
              boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
              animation: "scaleIn 0.22s ease",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* image */}
            <div style={{ position: "relative", height: 420, flexShrink: 0 }}>
              <img src={expanded.image} alt={expanded.title}
                referrerPolicy="no-referrer"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)",
              }} />
              {/* close btn */}
              <button
                onClick={() => setExpanded(null)}
                style={{
                  position: "absolute", top: 16, right: 16,
                  width: 36, height: 36, borderRadius: "50%", border: "none",
                  background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                  color: "#fff", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* text body */}
            <div style={{ background: "#fff", padding: "28px 32px 32px" }}>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#111",
                margin: "0 0 12px", letterSpacing: "-0.5px" }}>
                {expanded.title}
              </h3>
              <p style={{ fontSize: 15, color: "#555", lineHeight: 1.75, margin: 0 }}>
                {expanded.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* animation keyframes injected once */}
      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.93); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </>
  );
};

export { Gallery4 };
