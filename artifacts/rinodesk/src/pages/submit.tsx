import { useState } from "react";
import { useCreateTicket } from "@workspace/api-client-react";
import { TerminalSquare, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type Priority = "low" | "normal" | "high" | "urgent";

const CATEGORIES = [
  { value: "billing", label: "Billing & Payments" },
  { value: "technical", label: "Technical Issue" },
  { value: "shipping", label: "Shipping & Delivery" },
  { value: "returns", label: "Returns & Refunds" },
  { value: "account", label: "Account & Access" },
  { value: "other", label: "Other" },
];

const PRIORITIES: { value: Priority; label: string; description: string }[] = [
  { value: "low", label: "Low", description: "General question, no urgency" },
  { value: "normal", label: "Normal", description: "Needs attention soon" },
  { value: "high", label: "High", description: "Impacting my workflow" },
  { value: "urgent", label: "Urgent", description: "Complete blocker" },
];

export default function Submit() {
  const createTicket = useCreateTicket();

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    subject: "",
    body: "",
    priority: "normal" as Priority,
    category: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<number | null>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.customerName.trim()) e.customerName = "Name is required";
    if (!form.customerEmail.trim()) e.customerEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) e.customerEmail = "Enter a valid email";
    if (!form.subject.trim()) e.subject = "Subject is required";
    if (!form.body.trim()) e.body = "Please describe your issue";
    else if (form.body.trim().length < 20) e.body = "Please provide more detail (at least 20 characters)";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    const subjectWithCategory = form.category
      ? `[${CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category}] ${form.subject}`
      : form.subject;

    try {
      const ticket = await createTicket.mutateAsync({
        data: {
          subject: subjectWithCategory,
          body: form.body,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          priority: form.priority,
        },
      });
      setTicketId(ticket.id);
      setSubmitted(true);
    } catch {
      setErrors({ submit: "Something went wrong. Please try again." });
    }
  };

  const field = (id: string) => ({
    id,
    value: form[id as keyof typeof form],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [id]: e.target.value }));
      if (errors[id]) setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    },
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Ticket Submitted</h1>
          <p className="text-slate-500 mb-6">
            We've received your request. Our team will review it shortly and get back to you at{" "}
            <span className="font-medium text-slate-700">{form.customerEmail}</span>.
          </p>
          {ticketId && (
            <div className="bg-slate-50 rounded-lg px-4 py-3 inline-block mb-6">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Reference number</span>
              <p className="text-lg font-mono font-semibold text-slate-800">#{String(ticketId).padStart(5, "0")}</p>
            </div>
          )}
          <button
            onClick={() => { setSubmitted(false); setForm({ customerName: "", customerEmail: "", subject: "", body: "", priority: "normal", category: "" }); setTicketId(null); }}
            className="text-sm text-blue-600 hover:underline"
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <TerminalSquare className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-slate-800">Support</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Submit a Support Request</h1>
          <p className="text-slate-500 mt-1">Fill in the details below and our team will get back to you as soon as possible.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {/* Name + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="customerName" className="block text-sm font-medium text-slate-700">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Jane Smith"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${errors.customerName ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"}`}
                {...field("customerName")}
              />
              {errors.customerName && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.customerName}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="customerEmail" className="block text-sm font-medium text-slate-700">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="jane@company.com"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${errors.customerEmail ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"}`}
                {...field("customerEmail")}
              />
              {errors.customerEmail && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.customerEmail}</p>}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label htmlFor="category" className="block text-sm font-medium text-slate-700">Category</label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a category (optional)</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label htmlFor="subject" className="block text-sm font-medium text-slate-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Brief description of your issue"
              className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${errors.subject ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"}`}
              {...field("subject")}
            />
            {errors.subject && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.subject}</p>}
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label htmlFor="body" className="block text-sm font-medium text-slate-700">
              Details <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={5}
              placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or relevant context."
              className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none ${errors.body ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"}`}
              {...field("body")}
            />
            <div className="flex justify-between items-center">
              {errors.body ? <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.body}</p> : <span />}
              <span className="text-xs text-slate-400">{form.body.length} chars</span>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Priority</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                  className={`rounded-lg border px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    form.priority === p.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit error */}
          {errors.submit && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errors.submit}
            </div>
          )}

          <button
            type="submit"
            disabled={createTicket.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg px-4 py-3 text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {createTicket.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            ) : (
              "Submit Request"
            )}
          </button>

          <p className="text-xs text-slate-400 text-center">
            By submitting this form you agree to our support team reviewing your request.
          </p>
        </form>
      </main>
    </div>
  );
}
