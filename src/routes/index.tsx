import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import paper from "@/assets/papel-en-calma.jpg";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const description = "Entra en Al Día y organiza tus tareas en una lista privada.";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Iniciar sesión · Al Día" }, { name: "description", content: description },
    { property: "og:title", content: "Al Día · Tu lista de tareas" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

type Mode = "signin" | "signup" | "recover";
const headings: Record<Mode, string> = { signin: "Inicia sesión", signup: "Crea tu cuenta", recover: "Recupera tu acceso" };
const subtitles: Record<Mode, string> = { signin: "Qué gusto verte de nuevo.", signup: "Un espacio para tus pendientes.", recover: "Te enviaremos un enlace a tu correo." };
const actions: Record<Mode, string> = { signin: "Iniciar sesión", signup: "Crear cuenta", recover: "Enviar enlace" };

function Index() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) void navigate({ to: "/tareas", replace: true });
    });
    return () => { active = false; };
  }, [navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const address = email.trim();
      if (mode === "recover") {
        const result = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/reset-password` });
        if (result.error) throw result.error;
        setNotice("Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.");
        return;
      }
      const result = mode === "signup"
        ? await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email: address, password });
      if (result.error) {
        const messages: Record<string, string> = {
          invalid_credentials: "El correo o la contraseña no son correctos.",
          email_not_confirmed: "Confirma tu correo antes de iniciar sesión.",
          weak_password: "Elige una contraseña más segura.",
          over_email_send_rate_limit: "Se han enviado demasiados correos. Inténtalo más tarde.",
          over_request_rate_limit: "Has hecho demasiados intentos. Prueba en unos minutos.",
        };
        setError(messages[result.error.code ?? ""] ?? "No se pudo completar la solicitud. Inténtalo de nuevo.");
        return;
      }
      if (result.data.session) await navigate({ to: "/tareas", replace: true });
      else setNotice("Revisa tu correo y abre el enlace para confirmar tu cuenta.");
    } catch {
      setError("No se pudo completar la solicitud. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="entry-shell">
    <header className="entry-header"><Brand /></header>
    <main className="entry-main">
      <div className="entry-art" aria-hidden="true">
        <img src={paper} alt="" width={1024} height={1280} />
        <div className="entry-caption"><span className="eyebrow">UN DÍA A LA VEZ</span><p>Lo pendiente,<br />en orden<span className="brand-dot">.</span></p></div>
      </div>
      <section className="auth-form" aria-labelledby="access-heading">
        <span className="auth-mark"><LockKeyhole size={20} aria-hidden="true" /></span>
        <h1 id="access-heading" className="display-heading">{headings[mode]}<span className="brand-dot">.</span></h1>
        <p className="auth-subtitle muted">{subtitles[mode]}</p>
        <form className="form-fields" onSubmit={submit}>
          <label htmlFor="email">Correo electrónico</label>
          <div className="field-icon"><Mail aria-hidden="true" size={17} /><Input id="email" type="email" autoComplete="email" placeholder="tu@correo.com" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          {mode !== "recover" && <>
            <label htmlFor="password">Contraseña</label>
            <div className="field-icon password-field"><LockKeyhole aria-hidden="true" size={17} /><Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 6 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} />
            <Button type="button" size="icon" variant="ghost" title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div>
          </>}
          {mode === "signin" && <Button type="button" variant="link" className="forgot-link" disabled={busy} onClick={() => switchMode("recover")}>¿Olvidaste la contraseña?</Button>}
          {notice && <p className="form-notice" role="status">{notice}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button className="form-submit" disabled={busy}>{busy ? "Un momento…" : actions[mode]} <ArrowRight /></Button>
        </form>
        <div className="auth-switch">{mode === "signin" ? <><span>¿No tienes cuenta?</span> <Button type="button" variant="link" disabled={busy} onClick={() => switchMode("signup")}>Crea una cuenta</Button></> : <Button type="button" variant="link" disabled={busy} onClick={() => switchMode("signin")}><ArrowLeft /> Volver a iniciar sesión</Button>}</div>
      </section>
    </main>
    <footer className="entry-footer"><span>AL DÍA</span><span>LISTA PERSONAL DE TAREAS</span></footer>
  </div>;
}
