import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Check, ClipboardList, LogOut, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const tasksQuery = (owner: string) => queryOptions({
  queryKey: ["tasks", owner],
  queryFn: async ({ signal }) => {
    const tasks: Tables<"tasks">[] = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from("tasks").select("*").eq("user_id", owner)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(offset, offset + size - 1).abortSignal(signal);
      if (error) throw error;
      tasks.push(...data);
      if (data.length < size) return tasks;
    }
  },
});

export const Route = createFileRoute("/_authenticated/tareas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tasksQuery(context.user.id)),
  head: () => ({ meta: [
    { title: "Mis tareas · Al Día" },
    { name: "description", content: "Consulta y organiza tus tareas privadas en Al Día." },
    { property: "og:title", content: "Mis tareas · Al Día" },
    { property: "og:description", content: "Tu lista personal de tareas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  pendingComponent: () => <p className="page-status" role="status">Cargando tus tareas…</p>,
  errorComponent: ({ reset }) => <main className="page-status"><p>No se pudieron cargar tus tareas.</p><Button onClick={reset}>Reintentar</Button></main>,
  component: TasksPage,
});

function TasksPage() {
  const { user } = Route.useRouteContext();
  return <TaskList key={user.id} />;
}

function TaskList() {
  const navigate = useNavigate();
  const { user, queryClient } = Route.useRouteContext();
  const query = tasksQuery(user.id);
  const { data: tasks } = useSuspenseQuery(query);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const done = tasks.filter((task) => task.completed).length;

  async function change(id: string, operation: () => PromiseLike<{ error: unknown }>, failure: string, onSuccess?: () => void) {
    setError("");
    setBusy(id);
    try {
      const result = await operation();
      if (result.error) throw result.error;
      onSuccess?.();
      await queryClient.invalidateQueries({ queryKey: query.queryKey });
    } catch {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    void change("new", () => supabase.from("tasks").insert({ title: title.trim() }), "No se pudo añadir la tarea.", () => setTitle(""));
  }

  async function signOut() {
    setBusy("logout");
    setError("");
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      await queryClient.invalidateQueries({ queryKey: query.queryKey });
      setError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
      setBusy(null);
      return;
    }
    await navigate({ to: "/", replace: true });
  }

  return <div className="workspace">
    <header className="workspace-header"><div className="workspace-bar">
      <Brand />
      <div className="account"><span className="account-email" title={user.email}>{user.email}</span>
      <Button type="button" variant="outline" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión" disabled={busy !== null} onClick={signOut}><LogOut /></Button></div>
    </div></header>
    <main className="task-main">
      <div className="task-heading"><span className="eyebrow">MI ESPACIO</span><h1 className="display-heading">Mis tareas<span className="brand-dot">.</span></h1>
      <p className="muted" aria-live="polite">{tasks.length - done} pendientes <span className="count-dot">·</span> {done} completadas</p></div>
      <form onSubmit={add} className="task-add">
        <Input aria-label="Nueva tarea" placeholder="¿Qué tienes pendiente?" maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} readOnly={busy === "new"} required />
        <Button aria-label="Añadir tarea" disabled={busy !== null || !title.trim()}><Plus /> <span>Añadir</span></Button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {tasks.length === 0 ? <div className="task-empty"><span className="empty-icon"><ClipboardList size={24} aria-hidden="true" /></span><p>No tienes tareas todavía</p></div> :
        <ul className="task-list" aria-label="Tus tareas">{tasks.map((task) => <li key={task.id} className="task-row">
          <label className="task-check"><span className="check-mark"><input type="checkbox" checked={task.completed} disabled={busy !== null} onChange={() => void change(task.id, () => supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id), "No se pudo cambiar el estado de la tarea.")} /><Check size={16} aria-hidden="true" /></span><span className="task-name">{task.title}</span></label>
          <Button type="button" variant="ghost" size="icon" className="task-delete" aria-label={`Borrar ${task.title}`} title="Borrar tarea" disabled={busy !== null} onClick={() => void change(task.id, () => supabase.from("tasks").delete().eq("id", task.id), "No se pudo borrar la tarea.")}><Trash2 /></Button>
        </li>)}</ul>}
    </main>
  </div>;
}
