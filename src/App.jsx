import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import CalendarView from "./components/CalendarView";
import ClientForm from "./components/ClientForm";
import ClientsTable from "./components/ClientsTable";
import LatePayments from "./components/LatePayments";
import ClientProfile from "./components/ClientProfile";
import HistoryView from "./components/HistoryView";
import { TabButton } from "./components/ui";

import { todayISO } from "./utils/helpers";
import {
  emptyForm,
  calculateReceivable,
  calculateTotals,
  buildCalendarEvents,
  getNextStatus,
  toNumber,
} from "./utils/calculations";

function filterRecords(records, search) {
  const term = String(search || "").toLowerCase().trim();

  if (!term) return records;

  return records.filter((item) =>
    `${item.nome} ${item.whatsapp} ${item.cpf} ${item.cep} ${item.status} ${item.frequencia} ${item.cidade}`
      .toLowerCase()
      .includes(term)
  );
}

function mapDbRecord(row) {
  return {
    id: row.id,
    nome: row.nome || "",
    whatsapp: row.whatsapp || "",
    cpf: row.cpf || "",
    cep: row.cep || "",
    endereco: row.endereco || "",
    numero: row.numero || "",
    complemento: row.complemento || "",
    bairro: row.bairro || "",
    cidade: row.cidade || "",
    estado: row.estado || "",

    abrirConta: row.abrir_conta !== false,

    valorEnviado: toNumber(row.valor_enviado),
    valorReceber: toNumber(row.valor_receber),
    porcentagemRetorno: toNumber(row.porcentagem_retorno),

    frequencia: row.frequencia || "Diário",
    dataInicio: row.data_inicio || "",
    dataTermino: row.data_termino || "",
    semanas: row.semanas || 4,
    diaPagamento: row.dia_pagamento ?? 5,
    multaPercentual: toNumber(row.multa_percentual),

    status: row.status || "Ativo",
    observacao: row.observacao || "",

    anexos: row.anexos || {},
    pagamentos: row.pagamentos || {},
    historicoEmprestimos: row.historico_emprestimos || [],

    createdAt: row.created_at || "",
  };
}

function mapRecordToForm(record) {
  return {
    nome: record.nome || "",
    whatsapp: record.whatsapp || "",
    cpf: record.cpf || "",
    cep: record.cep || "",
    endereco: record.endereco || "",
    numero: record.numero || "",
    complemento: record.complemento || "",
    bairro: record.bairro || "",
    cidade: record.cidade || "",
    estado: record.estado || "",

    abrirConta: record.abrirConta !== false,

    valorEnviado: String(record.valorEnviado || ""),
    porcentagemRetorno: String(record.porcentagemRetorno || ""),
    frequencia: record.frequencia || "Diário",
    dataInicio: record.dataInicio || todayISO(),
    dataTermino: record.dataTermino || "",
    semanas: String(record.semanas || 4),
    diaPagamento: String(record.diaPagamento ?? 5),
    multaPercentual: String(record.multaPercentual || 0),
    status: record.status || "Ativo",

    observacao: record.observacao || "",

    extrato: null,
    comprovanteResidencia: null,
    identidade: null,
    outros: null,
  };
}

function mapFormToDb(form) {
  const abrirConta = Boolean(form.abrirConta);

  const valorReceber = abrirConta
    ? calculateReceivable(form.valorEnviado, form.porcentagemRetorno)
    : 0;

  return {
    nome: form.nome.trim(),
    whatsapp: form.whatsapp.trim(),
    cpf: form.cpf.trim(),
    cep: form.cep.trim(),
    endereco: form.endereco.trim(),
    numero: form.numero.trim(),
    complemento: form.complemento.trim(),
    bairro: form.bairro.trim(),
    cidade: form.cidade.trim(),
    estado: form.estado.trim(),

    abrir_conta: abrirConta,

    valor_enviado: abrirConta ? toNumber(form.valorEnviado) : 0,
    porcentagem_retorno: abrirConta ? toNumber(form.porcentagemRetorno) : 0,
    valor_receber: valorReceber,

    frequencia: abrirConta ? form.frequencia : null,
    data_inicio: abrirConta ? form.dataInicio || null : null,

    data_termino:
      abrirConta && form.frequencia === "Diário"
        ? form.dataTermino || null
        : null,

    semanas:
      abrirConta && form.frequencia === "Semanal"
        ? Math.max(1, toNumber(form.semanas))
        : null,

    dia_pagamento:
      abrirConta && form.frequencia === "Semanal"
        ? toNumber(form.diaPagamento)
        : null,

    multa_percentual: abrirConta ? toNumber(form.multaPercentual) : 0,

    status: form.status,
    observacao: form.observacao.trim(),
  };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [records, setRecords] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const filtered = useMemo(
    () => filterRecords(records, search),
    [records, search]
  );

  const selectedClient = useMemo(
    () => records.find((item) => item.id === selectedClientId) || null,
    [records, selectedClientId]
  );

  const totals = useMemo(() => calculateTotals(records), [records]);

  const calendarEvents = useMemo(
    () => buildCalendarEvents(records),
    [records]
  );

  const delayedEvents = useMemo(
    () => calendarEvents.filter((event) => event.statusPagamento === "Atrasado"),
    [calendarEvents]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadRecords();
    } else {
      setRecords([]);
      setLoading(false);
    }
  }, [session]);

  async function loadRecords() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("registros")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(`Erro ao carregar registros: ${error.message}`);
      setLoading(false);
      return;
    }

    setRecords((data || []).map(mapDbRecord));
    setLoading(false);
  }

  function resetForm() {
    setForm({
      ...emptyForm,
      dataInicio: todayISO(),
    });

    setEditingId(null);
    setSuccess("");
    setError("");
  }

  function openProfile(record) {
    setSelectedClientId(record.id);
    setActiveTab("ficha");
    setSuccess("");
    setError("");
  }

  function closeProfile() {
    setSelectedClientId(null);
    setActiveTab("clientes");
  }

  function startEdit(record) {
    setForm(mapRecordToForm(record));
    setEditingId(record.id);
    setSelectedClientId(null);
    setActiveTab("novo");
    setSuccess("");
    setError("");
  }

  async function uploadFile(recordId, field, file) {
    if (!file) return null;

    const extension = file.name.split(".").pop();
    const filePath = `${recordId}/${field}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from("documentos")
      .upload(filePath, file, {
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage.from("documentos").getPublicUrl(filePath);

    return {
      name: file.name,
      path: filePath,
      url: data.publicUrl,
    };
  }

  async function saveRecord(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.nome.trim()) {
      setError("Preencha o nome da pessoa.");
      return;
    }

    if (!form.cpf.trim()) {
      setError("Preencha o CPF.");
      return;
    }

    if (form.abrirConta) {
      if (!toNumber(form.valorEnviado)) {
        setError("Preencha o valor enviado/pedido.");
        return;
      }

      if (!toNumber(form.porcentagemRetorno)) {
        setError("Preencha a porcentagem de retorno.");
        return;
      }

      if (form.frequencia === "Diário" && !form.dataTermino) {
        setError("Preencha a data de término da diária.");
        return;
      }
    }

    setSaving(true);

    try {
      let saved;

      if (editingId) {
        const { data, error } = await supabase
          .from("registros")
          .update(mapFormToDb(form))
          .eq("id", editingId)
          .select()
          .single();

        if (error) throw error;

        saved = data;
      } else {
        const { data, error } = await supabase
          .from("registros")
          .insert([mapFormToDb(form)])
          .select()
          .single();

        if (error) throw error;

        saved = data;
      }

      const existing = editingId
        ? records.find((item) => item.id === editingId)?.anexos || {}
        : {};

      const anexos = {
        ...existing,

        extrato: form.extrato
          ? await uploadFile(saved.id, "extrato", form.extrato)
          : existing.extrato || null,

        comprovanteResidencia: form.comprovanteResidencia
          ? await uploadFile(
              saved.id,
              "comprovante-residencia",
              form.comprovanteResidencia
            )
          : existing.comprovanteResidencia || null,

        identidade: form.identidade
          ? await uploadFile(saved.id, "identidade", form.identidade)
          : existing.identidade || null,

        outros: form.outros
          ? await uploadFile(saved.id, "outros", form.outros)
          : existing.outros || null,
      };

      const { data: updated, error: updateError } = await supabase
        .from("registros")
        .update({ anexos })
        .eq("id", saved.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const mapped = mapDbRecord(updated);

      setRecords((prev) =>
        editingId
          ? prev.map((item) => (item.id === editingId ? mapped : item))
          : [mapped, ...prev]
      );

      setSuccess(
        editingId
          ? "Cliente atualizado com sucesso."
          : "Cliente cadastrado com sucesso."
      );

      resetForm();
      setActiveTab("clientes");
    } catch (err) {
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function updatePaymentStatus(recordId, date, paymentData) {
    setError("");
    setSuccess("");

    const target = records.find((item) => item.id === recordId);
    if (!target) return;

    const previous = records;

    const updatedPayments = {
      ...(target.pagamentos || {}),
      [date]: {
        ...(target.pagamentos?.[date] || {}),
        ...paymentData,
        updatedAt: new Date().toISOString(),
      },
    };

    const updatedTarget = {
      ...target,
      pagamentos: updatedPayments,
    };

    const updatedTargetEvents = buildCalendarEvents([updatedTarget]);

    const allPaymentsPaid =
      updatedTargetEvents.length > 0 &&
      updatedTargetEvents.every((event) => event.statusPagamento === "Pago");

    const nextStatus = allPaymentsPaid ? "Quitado" : target.status;

    setRecords((prev) =>
      prev.map((item) =>
        item.id === recordId
          ? {
              ...item,
              pagamentos: updatedPayments,
              status: nextStatus,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("registros")
      .update({
        pagamentos: updatedPayments,
        status: nextStatus,
      })
      .eq("id", recordId);

    if (error) {
      setRecords(previous);
      setError(`Erro ao atualizar pagamento: ${error.message}`);
      return;
    }

    if (allPaymentsPaid) {
      setSuccess(
        "Todas as parcelas foram pagas. A ficha foi marcada automaticamente como totalmente quitada."
      );
    }
  }

  async function markPaymentPaid(recordId, date) {
    await updatePaymentStatus(recordId, date, {
      status: "Pago",
      multaPercentual: 0,
    });
  }

  async function markPaymentLate(recordId, date, multaPercentual) {
    await updatePaymentStatus(recordId, date, {
      status: "Atrasado",
      multaPercentual: Number(multaPercentual || 0),
    });
  }

  async function toggleStatus(id) {
    setError("");

    const target = records.find((item) => item.id === id);
    if (!target) return;

    const nextStatus = getNextStatus(target.status);
    const previous = records;

    setRecords((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("registros")
      .update({
        status: nextStatus,
      })
      .eq("id", id);

    if (error) {
      setRecords(previous);
      setError(`Erro ao atualizar status: ${error.message}`);
    }
  }

  async function markRecordAsPaid(id) {
    const confirmed = window.confirm(
      "Deseja marcar esta ficha como totalmente paga? Ela ficará salva no histórico."
    );

    if (!confirmed) return;

    setError("");

    const previous = records;

    setRecords((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Quitado",
            }
          : item
      )
    );

    const { error } = await supabase
      .from("registros")
      .update({
        status: "Quitado",
      })
      .eq("id", id);

    if (error) {
      setRecords(previous);
      setError(`Erro ao encerrar ficha: ${error.message}`);
      return;
    }

    setSuccess("Ficha marcada como totalmente paga e movida para o histórico.");
  }

  async function startNewLoan(id) {
    const confirmed = window.confirm(
      "Deseja iniciar um novo empréstimo para este cliente? O empréstimo anterior será salvo no histórico da ficha."
    );

    if (!confirmed) return;

    setError("");

    const target = records.find((item) => item.id === id);
    if (!target) return;

    const previous = records;

    const previousLoan = {
      finalizadoEm: new Date().toISOString(),
      valorEnviado: target.valorEnviado,
      valorReceber: target.valorReceber,
      lucro: Number(target.valorReceber || 0) - Number(target.valorEnviado || 0),
      porcentagemRetorno: target.porcentagemRetorno,
      frequencia: target.frequencia,
      dataInicio: target.dataInicio,
      dataTermino: target.dataTermino,
      semanas: target.semanas,
      diaPagamento: target.diaPagamento,
      multaPercentual: target.multaPercentual,
      pagamentos: target.pagamentos || {},
      observacao: target.observacao || "",
    };

    const updatedHistory = [...(target.historicoEmprestimos || []), previousLoan];

    const cleanLoanData = {
      status: "Ativo",
      valor_enviado: 0,
      valor_receber: 0,
      porcentagem_retorno: 0,
      frequencia: "Diário",
      data_inicio: null,
      data_termino: null,
      semanas: null,
      dia_pagamento: null,
      multa_percentual: 0,
      pagamentos: {},
      historico_emprestimos: updatedHistory,
    };

    setRecords((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Ativo",
              valorEnviado: 0,
              valorReceber: 0,
              porcentagemRetorno: 0,
              frequencia: "Diário",
              dataInicio: "",
              dataTermino: "",
              semanas: 4,
              diaPagamento: 5,
              multaPercentual: 0,
              pagamentos: {},
              historicoEmprestimos: updatedHistory,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("registros")
      .update(cleanLoanData)
      .eq("id", id);

    if (error) {
      setRecords(previous);
      setError(`Erro ao iniciar novo empréstimo: ${error.message}`);
      return;
    }

    const updatedClient = {
      ...target,
      status: "Ativo",
      valorEnviado: 0,
      valorReceber: 0,
      porcentagemRetorno: 0,
      frequencia: "Diário",
      dataInicio: "",
      dataTermino: "",
      semanas: 4,
      diaPagamento: 5,
      multaPercentual: 0,
      pagamentos: {},
      historicoEmprestimos: updatedHistory,
    };

    setForm({
      ...mapRecordToForm(updatedClient),
      valorEnviado: "",
      porcentagemRetorno: "",
      dataInicio: todayISO(),
      dataTermino: "",
      semanas: "4",
      diaPagamento: "5",
      multaPercentual: "0",
      status: "Ativo",
    });

    setEditingId(id);
    setSelectedClientId(null);
    setActiveTab("novo");
    setSuccess("Empréstimo anterior salvo no histórico. Cadastre os novos valores.");
  }

  async function removeRecord(id) {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir definitivamente este cliente? Essa ação não pode ser desfeita."
    );

    if (!confirmed) return;

    setError("");

    const previous = records;

    setRecords((prev) => prev.filter((item) => item.id !== id));
    setSelectedClientId(null);
    setActiveTab("clientes");

    const { error } = await supabase.from("registros").delete().eq("id", id);

    if (error) {
      setRecords(previous);
      setError(`Erro ao excluir: ${error.message}`);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-zinc-400">Carregando acesso...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-black text-white px-3 py-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-purple-300 font-medium">Controle privado</p>

            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Painel de Clientes e Contas
            </h1>

            <p className="text-zinc-400 mt-2 max-w-2xl">
              Cadastro completo, contas editáveis, anexos, multas e calendário
              de recebimentos.
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-2">
            <div className="px-4 py-2 rounded-full bg-purple-600/20 text-purple-200 border border-purple-500/30 text-sm w-fit">
              Logado: {session.user.email}
            </div>

            <button
              onClick={logout}
              className="text-sm text-zinc-400 hover:text-white transition w-fit"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 md:flex-wrap md:gap-3">
          <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>
            Dashboard
          </TabButton>

          <TabButton active={activeTab === "calendario"} onClick={() => setActiveTab("calendario")}>
            Calendário
          </TabButton>

          <TabButton
            active={activeTab === "novo"}
            onClick={() => {
              resetForm();
              setSelectedClientId(null);
              setActiveTab("novo");
            }}
          >
            Novo cliente
          </TabButton>

          <TabButton
            active={activeTab === "clientes" || activeTab === "ficha"}
            onClick={() => {
              setSelectedClientId(null);
              setActiveTab("clientes");
            }}
          >
            Clientes
          </TabButton>

          <TabButton active={activeTab === "atrasados"} onClick={() => setActiveTab("atrasados")}>
            Atrasados
          </TabButton>

          <TabButton active={activeTab === "historico"} onClick={() => setActiveTab("historico")}>
            Histórico
          </TabButton>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-600/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-600/10 p-4 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {activeTab === "dashboard" && (
          <Dashboard totals={totals} calendarEvents={calendarEvents} />
        )}

        {activeTab === "calendario" && (
          <CalendarView
            calendarEvents={calendarEvents}
            onMarkPaymentPaid={markPaymentPaid}
            onMarkPaymentLate={markPaymentLate}
          />
        )}

        {activeTab === "novo" && (
          <ClientForm
            form={form}
            setForm={setForm}
            editingId={editingId}
            saving={saving}
            onSubmit={saveRecord}
            onCancelEdit={resetForm}
          />
        )}

        {activeTab === "clientes" && (
          <ClientsTable
            filtered={filtered}
            search={search}
            setSearch={setSearch}
            loading={loading}
            onOpenProfile={openProfile}
          />
        )}

        {activeTab === "ficha" && (
          <ClientProfile
            client={selectedClient}
            onBack={closeProfile}
            onEdit={startEdit}
            onMarkRecordAsPaid={markRecordAsPaid}
            onNewLoan={startNewLoan}
            onRemove={removeRecord}
          />
        )}

        {activeTab === "atrasados" && (
          <LatePayments delayedEvents={delayedEvents} />
        )}

        {activeTab === "historico" && (
          <HistoryView records={records} onOpenProfile={openProfile} />
        )}
      </div>
    </div>
  );
}