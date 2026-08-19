"use client";

import { MessageCircle } from "lucide-react";

function digits(value?: string | null) {
  const clean = String(value || "").replace(/\D/g, "");
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

export function WhatsAppButton({ phone, message, compact=false }: { phone?: string | null; message: string; compact?: boolean }) {
  const number = digits(phone);
  if (!number) return <button type="button" className={compact ? "icon-btn" : "btn secondary"} disabled title="WhatsApp não informado"><MessageCircle size={16}/>{compact ? null : "WhatsApp"}</button>;
  const href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  return <a className={compact ? "icon-btn" : "btn secondary"} href={href} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><MessageCircle size={16}/>{compact ? null : "WhatsApp"}</a>;
}
