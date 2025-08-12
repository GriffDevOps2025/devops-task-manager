import React, { useEffect, useState } from "react";
import "./App.css";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        setTasks(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="App"><h1>DevOps Task Manager</h1><p>Loading tasks…</p></div>;

  return (
    <div className="App">
      <h1>DevOps Task Manager</h1>
      {tasks.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, maxWidth: 560, margin: "20px auto" }}>
          {tasks.map((t) => (
            <li
              key={t.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fff",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            >
              <span style={{ fontWeight: 600 }}>{t.title}</span>
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: t.done ? "#e6ffed" : "#fff5e6",
                  border: "1px solid " + (t.done ? "#a6f3be" : "#ffd9a6"),
                  color: t.done ? "#18794e" : "#8a5c00",
                  fontWeight: 600,
                }}
              >
                {t.done ? "Done" : "Not done"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


