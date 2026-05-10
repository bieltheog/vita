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

import { todayISO } from "./utils/helpers";
import {
  emptyForm,
  calculateReceivable,
  calculateTotals,
  buildCalendarEvents,
  getNextStatus,
  toNumber,
  paymentTypes,
  paymentStatuses,
  isPaymentSettled,
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

    frequencia: row.frequencia || paymentTypes.DAILY,
    dataInicio: row.data_inicio || "",
    dataTermino: row.data_termino || "",
    semanas: row.semanas || 4,
    diaPagamento: row.dia_pagamento ?? 5,

    diasPagamentoFixos: Array.isArray(row.dias_pagamento_fixos)
      ? row.dias_pagamento_fixos
      : [],

    parcelasPersonalizadas: Array.isArray(row.parcelas_personalizadas)
      ? row.parcelas_personalizadas
      : [],

    multaPercentual: toNumber(row.multa_percentual),

    status: row.status || "Ativo",
    observacao: row.observacao || "",

    anexos: row.anexos || {},
    pagamentos: row.pagamentos || {},
    historicoEmprestimos: Array.isArray(row.historico_emprestimos)
      ? row.historico_emprestimos
      : [],

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
    frequencia: record.frequencia || paymentTypes.DAILY,
    dataInicio: record.dataInicio || todayISO(),
    dataTermino: record.dataTermino || "",
    semanas: String(record.semanas || 4),
    diaPagamento: String(record.diaPagamento ?? 5),

    diasPagamentoFixos:
      record.diasPagamentoFixos && record.diasPagamentoFixos.length > 0
        ? record.diasPagamentoFixos.map(String)
        : ["15", "30"],

    parcelasPersonalizadas: record.parcelasPersonalizadas || [],

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

  const diasPagamentoFixos = (form.diasPagamentoFixos || [])
    .map((day) => Math.floor(toNumber(day)))
    .filter((day) => day >= 1 && day <= 31);

  const parcelasPersonalizadas = (form.parcelasPersonalizadas || [])
    .map((item) => ({
      id: item.id || `${Date.now()}-${Math.random()}`,
      date: item.date || "",
      value: toNumber(item.value),
      descricao: item.descricao || "",
    }))
    .filter((item) => item.date && item.value > 0);

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
      abrirConta &&
      (form.frequencia === paymentTypes.DAILY ||
        form.frequencia === paymentTypes.FIXED_DATES)
        ? form.dataTermino || null
        : null,

    semanas:
      abrirConta && form.frequencia === paymentTypes.WEEKLY
        ? Math.max(1, toNumber(form.semanas))
        : null,

    dia_pagamento:
      abrirConta && form.frequencia === paymentTypes.WEEKLY
        ? toNumber(form.diaPagamento)
        : null,

    dias_pagamento_fixos:
      abrirConta && form.frequencia === paymentTypes.FIXED_DATES
        ? diasPagamentoFixos
        : [],

    parcelas_personalizadas:
      abrirConta && form.frequencia === paymentTypes.CUSTOM
        ? parcelasPersonalizadas
        : [],

    multa_percentual: abrirConta ? toNumber(form.multaPercentual) : 0,

    status: form.status,
    observacao: form.observacao.trim(),
  };
}

function NavItem({ active, icon, label, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
        active
          ? "border-purple-400/30 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-950/40"
          : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-lg">
        {icon}
      </span>

      <span className="flex-1">{label}</span>

      {badge !== undefined && Number(badge) > 0 && (
        <span className="rounded-full bg-rose-500/20 px-2 py-1 text-xs text-rose-200">
          {badge}
        </span>
      )}
    </button>
  );
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

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "calendario", label: "Calendário", icon: "📅" },
    { id: "novo", label: "Novo Cliente", icon: "+" },
    { id: "clientes", label: "Clientes", icon: "👥" },
    { id: "atrasados", label: "Atrasados", icon: "⚠", badge: delayedEvents.length },
    { id: "historico", label: "Histórico", icon: "↺" },
  ];

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

      if (form.frequencia === paymentTypes.DAILY && !form.dataTermino) {
        setError("Preencha a data de término da diária.");
        return;
      }

      if (form.frequencia === paymentTypes.FIXED_DATES && !form.dataTermino) {
        setError("Preencha a data de término das datas fixas.");
        return;
      }

      if (
        form.frequencia === paymentTypes.FIXED_DATES &&
        (!form.diasPagamentoFixos || form.diasPagamentoFixos.length === 0)
      ) {
        setError("Adicione pelo menos um dia fixo de pagamento.");
        return;
      }

      if (
        form.frequencia === paymentTypes.CUSTOM &&
        (!form.parcelasPersonalizadas ||
          form.parcelasPersonalizadas.filter(
            (item) => item.date && toNumber(item.value) > 0
          ).length === 0)
      ) {
        setError("Adicione pelo menos uma parcela personalizada.");
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

  async function updatePaymentStatus(recordId, paymentKey, paymentData) {
    setError("");
    setSuccess("");

    const target = records.find((item) => item.id === recordId);
    if (!target) return;

    const previous = records;

    const updatedPayments = {
      ...(target.pagamentos || {}),
      [paymentKey]: {
        ...(target.pagamentos?.[paymentKey] || {}),
        ...paymentData,
        updatedAt: new Date().toISOString(),
      },
    };

    const updatedTarget = {
      ...target,
      pagamentos: updatedPayments,
    };

    const updatedTargetEvents = buildCalendarEvents([updatedTarget]);

    const allPaymentsSettled =
      updatedTargetEvents.length > 0 &&
      updatedTargetEvents.every((event) => isPaymentSettled(event));

    const nextStatus = allPaymentsSettled ? "Quitado" : target.status;

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

    if (allPaymentsSettled) {
      setSuccess(
        "Todas as parcelas foram resolvidas. A ficha foi marcada automaticamente como totalmente quitada."
      );
    }
  }

  async function markPaymentPaid(recordId, paymentKey) {
    await updatePaymentStatus(recordId, paymentKey, {
      status: paymentStatuses.PAID,
      multaPercentual: 0,
    });
  }

  async function markPaymentLate(recordId, paymentKey, multaPercentual) {
    await updatePaymentStatus(recordId, paymentKey, {
      status: paymentStatuses.LATE,
      multaPercentual: Number(multaPercentual || 0),
    });
  }

  async function markPaymentPartial(recordId, paymentKey, valorPago, observacao) {
    await updatePaymentStatus(recordId, paymentKey, {
      status: paymentStatuses.PARTIAL,
      valorPago: Number(valorPago || 0),
      observacao: observacao || "",
    });
  }

  async function markPaymentCanceled(recordId, paymentKey, observacao) {
    await updatePaymentStatus(recordId, paymentKey, {
      status: paymentStatuses.CANCELED,
      observacao: observacao || "",
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
      diasPagamentoFixos: target.diasPagamentoFixos || [],
      parcelasPersonalizadas: target.parcelasPersonalizadas || [],
      multaPercentual: target.multaPercentual,
      pagamentos: target.pagamentos || {},
      observacao: target.observacao || "",
    };

    const updatedHistory = [
      ...(target.historicoEmprestimos || []),
      previousLoan,
    ];

    const cleanLoanData = {
      status: "Ativo",
      valor_enviado: 0,
      valor_receber: 0,
      porcentagem_retorno: 0,
      frequencia: paymentTypes.DAILY,
      data_inicio: null,
      data_termino: null,
      semanas: null,
      dia_pagamento: null,
      dias_pagamento_fixos: [],
      parcelas_personalizadas: [],
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
              frequencia: paymentTypes.DAILY,
              dataInicio: "",
              dataTermino: "",
              semanas: 4,
              diaPagamento: 5,
              diasPagamentoFixos: [],
              parcelasPersonalizadas: [],
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
      frequencia: paymentTypes.DAILY,
      dataInicio: "",
      dataTermino: "",
      semanas: 4,
      diaPagamento: 5,
      diasPagamentoFixos: ["15", "30"],
      parcelasPersonalizadas: [],
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
      diasPagamentoFixos: ["15", "30"],
      parcelasPersonalizadas: [],
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

  function goToTab(tab) {
    setSelectedClientId(null);

    if (tab === "novo") {
      resetForm();
    }

    setActiveTab(tab);
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070a17] text-white">
        <div className="text-zinc-400">Carregando acesso...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#070a17] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_28%),linear-gradient(135deg,#070a17,#0c1024_45%,#12051f)]" />

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-white/10 bg-[#080c1d]/85 p-4 backdrop-blur-xl lg:block">
          <div className="flex h-full flex-col">
            <div className="mb-8 flex items-center gap-3 px-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-600 to-cyan-400 text-2xl font-black shadow-lg shadow-purple-950/40">
                C
              </div>

              <div>
                <h1 className="text-xl font-black">
                  Client<span className="text-purple-300">Control</span>
                </h1>
                <p className="text-xs text-zinc-500">Painel Administrativo</p>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <NavItem
                  key={item.id}
                  active={
                    activeTab === item.id ||
                    (item.id === "clientes" && activeTab === "ficha")
                  }
                  icon={item.icon}
                  label={item.label}
                  badge={item.badge}
                  onClick={() => goToTab(item.id)}
                />
              ))}
            </nav>

            <div className="mt-auto rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-bold text-white">
                {session.user.email}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Administrador</p>

              <button
                onClick={logout}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                Sair
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 md:p-6">
          <div className="mx-auto max-w-[1500px] space-y-5">
            <header className="rounded-[2rem] border border-white/10 bg-[#11162a]/75 p-4 shadow-xl backdrop-blur-xl md:p-5 lg:hidden">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black">
                    Client<span className="text-purple-300">Control</span>
                  </h1>
                  <p className="text-xs text-zinc-500">{session.user.email}</p>
                </div>

                <button
                  onClick={logout}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold"
                >
                  Sair
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => goToTab(item.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
                      activeTab === item.id ||
                      (item.id === "clientes" && activeTab === "ficha")
                        ? "border-purple-400/40 bg-purple-600 text-white"
                        : "border-white/10 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </header>

            <div className="hidden items-center justify-between rounded-[2rem] border border-white/10 bg-[#11162a]/75 p-5 shadow-xl backdrop-blur-xl lg:flex">
              <div>
                <h2 className="text-3xl font-black">
                  {activeTab === "dashboard" && "Dashboard"}
                  {activeTab === "calendario" && "Calendário"}
                  {activeTab === "novo" && (editingId ? "Editar cliente" : "Novo cliente")}
                  {activeTab === "clientes" && "Clientes"}
                  {activeTab === "ficha" && "Ficha do cliente"}
                  {activeTab === "atrasados" && "Atrasados"}
                  {activeTab === "historico" && "Histórico"}
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Gerencie clientes, empréstimos, parcelas e recebimentos.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
                  {new Date().toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>

                <div className="rounded-2xl border border-purple-400/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
                  {session.user.email}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-600/10 p-4 text-sm text-rose-200">
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
                onMarkPaymentPartial={markPaymentPartial}
                onMarkPaymentCanceled={markPaymentCanceled}
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
        </main>
      </div>
    </div>
  );
}