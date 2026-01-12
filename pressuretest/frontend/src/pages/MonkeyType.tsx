import { useNavigate } from "react-router-dom";
import { useState } from "react";

const MonkeyType = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const start = () => {
    navigate("/monkeytype", { state: { name } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
        <h1 className="text-3xl bg-black font-bold mb-3">MonkeyType Pressure</h1>
        <p className="text-gray-600 mb-8">
          Type words while maintaining precise pressure levels on each keystroke. 
          Test your accuracy and speed combined!
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
          <button
            onClick={() => navigate('/')}
            className="w-full rounded-2xl px-4 py-2 font-xl bg-gray-300 text-black hover:opacity-90"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonkeyType;
