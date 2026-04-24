import React, { useState, useEffect } from "react";

const App = () => {
  const [groupedInventory, setGroupedInventory] = useState({});
  const [loading, setLoading] = useState(true);

  // THE BRIDGE: Fetching grouped data from FastAPI
  useEffect(() => {
    fetch("http://127.0.0.1:8000/inventory/grouped")
      .then((res) => {
        if (!res.ok) throw new Error("Database not reached");
        return res.json();
      })
      .then((data) => {
        setGroupedInventory(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, []);

  const theme = {
    bg: "#0d1117",
    card: "#161b22",
    accent: "#58a6ff",
    text: "#c9d1d9",
    gray: "#8b949e",
    low: "#f85149",
    healthy: "#3fb950",
  };

  return (
    <div
      style={{
        backgroundColor: theme.bg,
        minHeight: "100vh",
        color: theme.text,
        fontFamily: "Inter, sans-serif",
        padding: "20px",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1
          style={{
            color: theme.accent,
            letterSpacing: "-1px",
            fontSize: "2rem",
          }}
        >
          MatTrack PRO
        </h1>
        <p style={{ color: theme.gray, fontSize: "0.9rem" }}>
          Centralized Data Aggregator • PENTABUILD
        </p>
      </header>

      <main style={{ maxWidth: "600px", margin: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "50px" }}>
            <p style={{ color: theme.gray }}>
              📡 Syncing with PostgreSQL 17...
            </p>
          </div>
        ) : Object.keys(groupedInventory).length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "20px", color: theme.gray }}
          >
            <p>No sites registered. Use Swagger to add a Project Site.</p>
          </div>
        ) : (
          Object.keys(groupedInventory).map((site) => (
            <div key={site} style={{ marginBottom: "30px" }}>
              <h2
                style={{
                  fontSize: "1.1rem",
                  borderBottom: `1px solid ${theme.card}`,
                  paddingBottom: "8px",
                  color: theme.accent,
                }}
              >
                📍 {site}
              </h2>
              {groupedInventory[site].map((material) => (
                <div
                  key={material.id}
                  style={{
                    backgroundColor: theme.card,
                    padding: "15px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600" }}>{material.item}</div>
                    <div style={{ fontSize: "0.8rem", color: theme.gray }}>
                      {material.qty} {material.unit}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      backgroundColor:
                        material.status === "Low"
                          ? "rgba(248,81,73,0.1)"
                          : "rgba(63,185,80,0.1)",
                      color:
                        material.status === "Low" ? theme.low : theme.healthy,
                    }}
                  >
                    {material.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default App;
