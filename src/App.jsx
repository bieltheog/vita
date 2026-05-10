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
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
        active
          ? "bg-purple-600 text-white"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm">
        {icon}
      </span>

      <span className="flex-1">{label}</span>

      {badge !== undefined && Number(badge) > 0 && (
        <span className="rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300">
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

  const calendarEvents = useMemo(() => buildCalendarEvents(records), [records]);

  const delayedEvents = useMemo(
    () =>
      calendarEvents.filter(
        (event) => event.statusPagamento === paymentStatuses.LATE
      ),
    [calendarEvents]
  );

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "clientes", label: "Clientes", icon: "◌" },
    { id: "calendario", label: "Calendário", icon: "□" },
    { id: "novo", label: "Novo Cliente", icon: "+" },
    {
      id: "atrasados",
      label: "Atrasados",
      icon: "!",
      badge: delayedEvents.length,
    },
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
    setSuccess(
      "Empréstimo anterior salvo no histórico. Cadastre os novos valores."
    );
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
      <div className="flex min-h-screen items-center justify-center bg-[#070b16] text-white">
        <div className="text-slate-400">Carregando acesso...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="app-bg min-h-screen text-white">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-white/[0.08] bg-[#080d1a]/95 p-4 lg:block">
          <div className="flex h-full flex-col">
            <div className="mb-8 flex items-center gap-3 px-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-700 to-purple-400 text-xl font-bold">
                C
              </div>

              <div>
                <h1 className="text-xl font-bold">
                  Client<span className="text-purple-400">Control</span>
                </h1>
                <p className="text-xs text-slate-500">Painel Administrativo</p>
              </div>
            </div>

            <nav className="space-y-1">
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

            <div className="mt-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-sm font-bold">
                  A
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    Admin
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {session.user.email}
                  </p>
                </div>
              </div>

              <button
                onClick={logout}
                className="mt-4 w-full rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                Sair
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 md:p-5">
          <div className="mx-auto max-w-[1500px] space-y-4">
            <header className="panel rounded-2xl p-4 lg:hidden">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold">
                    Client<span className="text-purple-400">Control</span>
                  </h1>
                  <p className="text-xs text-slate-500">{session.user.email}</p>
                </div>

                <button
                  onClick={logout}
                  className="rounded-xl bg-white/[0.04] px-4 py-2 text-sm font-semibold"
                >
                  Sair
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => goToTab(item.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                      activeTab === item.id ||
                      (item.id === "clientes" && activeTab === "ficha")
                        ? "bg-purple-600 text-white"
                        : "bg-white/[0.04] text-slate-300"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </header>

            <div className="panel hidden items-center justify-between rounded-2xl p-5 lg:flex">
              <div>
                <h2 className="text-3xl font-bold text-white">
                  {activeTab === "dashboard" && "Dashboard"}
                  {activeTab === "calendario" && "Calendário"}
                  {activeTab === "novo" &&
                    (editingId ? "Editar cliente" : "Novo cliente")}
                  {activeTab === "clientes" && "Clientes"}
                  {activeTab === "ficha" && "Ficha do cliente"}
                  {activeTab === "atrasados" && "Atrasados"}
                  {activeTab === "historico" && "Histórico"}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Bem-vindo de volta. Aqui está o resumo do seu negócio.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-slate-400 xl:block">
                  Buscar...
                </div>

                <div className="rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
                  {new Date().toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                {success}
              </div>
            )}

            {activeTab === "dashboard" && (
              <Dashboard
                totals={totals}
                calendarEvents={calendarEvents}
                onGoToTab={goToTab}
              />
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