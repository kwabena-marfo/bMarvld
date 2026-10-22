"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";

async function post(path: string, body: unknown) {
  const res = await fetch(`/api/admin/login/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
}

export default function AdminLogin() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
    setLoading(false);
  }

  const sendCode = () =>
    run(async () => {
      await post("code", { email });
      setStep("code");
      setNotice(`We sent a 6-digit code to ${email}`);
    });

  const verify = () =>
    run(async () => {
      await post("verify", { email, code });
      router.replace("/admin");
    });

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "email") sendCode();
          else verify();
        }}
        className="viewfinder w-full max-w-sm p-10 text-cream/40"
      >
        <div className="text-cream">
          <div className="mb-8 text-center text-3xl">
            <Logo />
            <p className="mt-2 text-xs tracking-[0.3em] text-cream-dim uppercase">Admin</p>
          </div>

          {step === "email" ? (
            <label>
              <span className="field-label">Email</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
              />
            </label>
          ) : (
            <>
              <p className="mb-4 text-sm text-cream-dim">{notice}</p>
              <label>
                <span className="field-label">Login code</span>
                <input
                  required
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="field text-center text-2xl tracking-[0.5em]"
                />
              </label>
            </>
          )}

          {error && <p className="mt-3 text-sm text-gold">{error}</p>}

          <button
            disabled={loading || (step === "code" && code.length !== 6)}
            className="mt-6 w-full bg-gold py-3 text-xs font-semibold tracking-[0.2em] text-ink uppercase transition hover:bg-cream disabled:opacity-50"
          >
            {loading ? "Please wait…" : step === "email" ? "Send login code" : "Sign in"}
          </button>

          {step === "code" && (
            <div className="mt-4 flex justify-between text-xs text-cream-dim">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                className="hover:text-cream"
              >
                ← Different email
              </button>
              <button type="button" onClick={sendCode} disabled={loading} className="hover:text-cream">
                Resend code
              </button>
            </div>
          )}
        </div>
      </form>
    </main>
  );
}
