"use client";
import { Printer } from "lucide-react";
export function PrintPageButton({label="Imprimir / PDF"}:{label?:string}){return <button type="button" className="btn secondary" onClick={()=>window.print()}><Printer size={16}/>{label}</button>}
