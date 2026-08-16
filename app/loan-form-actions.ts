"use server";

import { createLoanAction } from "@/app/actions";
import { updateLoanAction } from "@/app/loan-actions";

export type LoanFormResult = { ok: true } | { ok: false; error: string };

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return fallback;
}

export async function createLoanFormAction(formData: FormData): Promise<LoanFormResult> {
  try {
    await createLoanAction(formData);
    return { ok: true };
  } catch (error) {
    console.error("createLoanFormAction", error);
    return { ok: false, error: readableError(error, "Não foi possível criar o empréstimo.") };
  }
}

export async function updateLoanFormAction(formData: FormData): Promise<LoanFormResult> {
  try {
    await updateLoanAction(formData);
    return { ok: true };
  } catch (error) {
    console.error("updateLoanFormAction", error);
    return { ok: false, error: readableError(error, "Não foi possível editar o empréstimo.") };
  }
}
