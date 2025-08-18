import { useNavigate } from "react-router-dom";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const start = () => {
    // Navigate to /test and pass name if provided
    navigate("/test", { state: { name } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
        <h1 className="text-3xl bg-black font-bold mb-3">Analog Typing Test</h1>
        <p className="text-gray-600 mb-8">
          Welcome! Enter your name (optional) and click Start to begin.
        </p>

        <div className="space-y-4">
          <input
            className="w-full text-black border rounded-xl px-4 py-2"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={start}
            className="w-full rounded-2xl px-4 py-2 font-xl bg-black text-white hover:opacity-90"
          >
            Start Test
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
