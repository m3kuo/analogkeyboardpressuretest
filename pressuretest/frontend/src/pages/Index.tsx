import { useNavigate } from "react-router-dom";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const startAnalogTest = () => {
    // Navigate to /test and pass name if provided
    navigate("/test", { state: { name } });
  };

  const startMonkeyTypeTest = () => {
    // Navigate to MonkeyType mode selection
    navigate("/monkeytype-mode", { state: { name } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow p-8">
        <h1 className="text-4xl bg-black font-bold mb-3 text-center">Analog Typing Tests</h1>
        <p className="text-gray-600 mb-8 text-center">
          Welcome! Enter your name and choose a test mode to begin.
        </p>

        <div className="space-y-4 mb-8">
          <input
            className="w-full text-black border rounded-xl px-4 py-2"
            placeholder="Enter your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-2xl font-bold mb-3">Analog Precision Test</h2>
            <p className="text-gray-600 mb-6">
              Test your keyboard control by hitting and holding precise pressure values. 
              Select individual keys and target specific pressure ranges.
            </p>
            <button
              onClick={startAnalogTest}
              className="w-full rounded-xl px-4 py-2 font-xl bg-black text-white hover:opacity-90"
            >
              Start Precision Test
            </button>
          </div>

          <div className="border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-2xl font-bold mb-3">MonkeyType Pressure</h2>
            <p className="text-gray-600 mb-6">
              Type words while maintaining precise pressure levels on each keystroke. 
              Combine typing speed with pressure accuracy.
            </p>
            <button
              onClick={startMonkeyTypeTest}
              className="w-full rounded-xl px-4 py-2 font-xl bg-black text-white hover:opacity-90"
            >
              Start MonkeyType Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
