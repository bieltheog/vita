"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { voidInterestOnlyAction } from "@/app/interest-only-actions";

export function VoidInterestPaymentButton({paymentId,compact=false}:{paymentId:string;compact?:boolean}){
  const router=useRouter();
  const [pending,start]=useTransition();

  function undo(){
    if(!window.confirm("Estornar este pagamento de juros? A parcela original será reaberta e a parcela criada pela renovação será cancelada."))return;
    const formData=new FormData();
    formData.set("payment_id",paymentId);
    formData.set("reason","Estorno manual de pagamento somente de juros");
    start(async()=>{
      const result=await voidInterestOnlyAction(formData);
      if(!result.ok){
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return <button
    type="button"
    className={compact?"icon-btn":"btn danger"}
    title="Estornar juros e desfazer a renovação"
    disabled={pending}
    onClick={undo}
  >
    <Undo2 size={15}/>{compact?null:(pending?"Estornando...":"Estornar juros")}
  </button>;
}
