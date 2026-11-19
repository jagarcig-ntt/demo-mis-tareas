import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Restablecer contraseña · Al Día" },
    { name: "description", content: "Elige una nueva contraseña para tu cuenta de Al Día." },
    { property: "og:title", content: "Restablecer contraseña · Al Día" },
    { property: "og:description", content: "Elige una nueva contraseña para tu cuenta de Al Día." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

// Capture before the auth SDK removes the recovery hash from the address bar.
const recoveryHash = typeof window !== "undefined" && new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

function ResetPassword() {
  const navigate = useNavigate();
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active) setValid(recoveryHash && !error && Boolean(data.user));
    });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (result.error) {
      setError(result.error.code === "same_password" ? "Elige una contraseña distinta de la anterior." : "No se pudo cambiar la contraseña. Prueba con otra.");
      return;
    }
    await navigate({ to: "/tareas", replace: true });
  }

  return <main className="reset-page"><section className="auth-form">
    <Brand />
    <h1 className="display-heading">Nueva contraseña</h1>
    {valid === null ? <p role="status">Comprobando el enlace…</p> : valid ? <form onSubmit={save} className="form-fields">
      <label>Contraseña <Input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button className="form-submit" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</Button>
    </form> : <p role="alert">Este enlace no es válido o ha caducado.</p>}
    <Button asChild variant="link" className="px-0"><Link to="/">Volver al inicio</Link></Button>
  </section></main>;
}
