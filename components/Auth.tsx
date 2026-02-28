import { useState } from "react"
import { supabase } from "../services/supabase"

const sanitizeErrorText = (value: string) =>
  value
    .replace(/supabase/gi, "platform")
    .replace(/gotrue/gi, "identity service")

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(sanitizeErrorText(error.message || "Authentication failed."))
    } else {
      onLogin()
    }
  }

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(sanitizeErrorText(error.message || "Sign-up failed."))
    } else {
      alert("Check your email for confirmation")
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto mt-20">
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2"
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2"
      />
      <button onClick={handleLogin} className="bg-teal-600 text-white p-2">
        Login
      </button>
      <button onClick={handleSignup} className="border p-2">
        Sign Up
      </button>
    </div>
  )
}
