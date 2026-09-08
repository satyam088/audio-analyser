import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
// import axios from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useGoogleLogin } from "@react-oauth/google";


// Wrapper component that uses the Google hook (only rendered when provider exists)

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("/auth/login", { email, password });
      login(res.data.user, res.data.token);

      if (res.data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        navigate("/register", { state: { pendingEmail: err.response.data.email } });
      } else {
        setError(err.response?.data?.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    setGoogleLoading(true);
    setError("");
    try {
      const res = await axios.post("/auth/google", {
        accessToken: tokenResponse.access_token,
      });
      login(res.data.user, res.data.token);
      if (res.data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    
  )
}


export default Login;