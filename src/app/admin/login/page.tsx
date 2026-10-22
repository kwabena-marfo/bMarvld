"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sendJson } from "@/lib/forms";
import { emailSchema, loginCodeSchema } from "@/lib/schemas";

type EmailValues = z.output<typeof emailSchema>;
type CodeValues = z.output<typeof loginCodeSchema>;

export default function AdminLogin() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="viewfinder w-full max-w-sm p-10 text-cream/40">
        <div className="text-cream">
          <div className="mb-8 text-center text-3xl">
            <Logo />
            <p className="mt-2 text-xs tracking-[0.3em] text-cream-dim uppercase">Admin</p>
          </div>
          {email ? (
            <CodeStep email={email} onBack={() => setEmail(null)} />
          ) : (
            <EmailStep onSent={setEmail} />
          )}
        </div>
      </div>
    </main>
  );
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const form = useForm<z.input<typeof emailSchema>, unknown, EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: EmailValues) {
    try {
      await sendJson("/api/admin/login/code", { email });
      onSent(email);
    } catch (err) {
      form.setError("email", { message: err instanceof Error ? err.message : "Could not send code" });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Controller
        name="email"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="admin-email">Email</FieldLabel>
            <Input {...field} id="admin-email" type="email" autoFocus autoComplete="email" aria-invalid={fieldState.invalid} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Button type="submit" disabled={form.formState.isSubmitting} className="mt-6 w-full" size="lg">
        {form.formState.isSubmitting ? "Sending…" : "Send login code"}
      </Button>
    </form>
  );
}

function CodeStep({ email, onBack }: { email: string; onBack: () => void }) {
  const router = useRouter();
  const [notice, setNotice] = useState(`We sent a 6-digit code to ${email}`);
  const form = useForm<z.input<typeof loginCodeSchema>, unknown, CodeValues>({
    resolver: zodResolver(loginCodeSchema),
    defaultValues: { email, code: "" },
  });

  async function onSubmit(values: CodeValues) {
    try {
      await sendJson("/api/admin/login/verify", values);
      router.replace("/admin");
    } catch (err) {
      form.setError("code", { message: err instanceof Error ? err.message : "Could not sign in" });
    }
  }

  async function resend() {
    try {
      await sendJson("/api/admin/login/code", { email });
      setNotice(`A new code is on its way to ${email}`);
    } catch (err) {
      form.setError("code", { message: err instanceof Error ? err.message : "Could not resend" });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Controller
        name="code"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="admin-code">Login code</FieldLabel>
            <FieldDescription>{notice}</FieldDescription>
            <Input
              {...field}
              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
              id="admin-code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-invalid={fieldState.invalid}
              className="text-center text-2xl tracking-[0.5em] md:text-2xl"
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Button type="submit" disabled={form.formState.isSubmitting} className="mt-6 w-full" size="lg">
        {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
      <div className="mt-4 flex justify-between">
        <Button type="button" variant="link" size="sm" onClick={onBack} className="px-0 text-cream-dim">
          ← Different email
        </Button>
        <Button type="button" variant="link" size="sm" onClick={resend} className="px-0 text-cream-dim">
          Resend code
        </Button>
      </div>
    </form>
  );
}
