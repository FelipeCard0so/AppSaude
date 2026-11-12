// ==========================================
// CONFIGURAÇÕES E ESTADO
// ==========================================
let registros = JSON.parse(localStorage.getItem('saude_registros')) || [];
let registrosRuins = JSON.parse(localStorage.getItem('saude_ruins')) || [];

// Sanitização de segurança: garante ID exclusivo para cada item
registros = registros.map((r, index) => {
  if (!r.id) {
    r.id = "reg_" + Date.now() + "_" + index + "_" + Math.floor(Math.random() * 1000);
  }
  return r;
});
localStorage.setItem('saude_registros', JSON.stringify(registros));

// ✅ SEU LINK DO GOOGLE APPS SCRIPT DIRETO NA VARIÁVEL:
const webhookGoogleScript = "https://script.google.com/macros/s/AKfycbyicwbCq833fd9jlOk-pthzbn6ESYNsniWQLJaxx6qiGMcJwozB10SREh8y70tndlMe/exec";

let chartInstance = null;

function campoNumerico(valor) {
  return valor !== null && valor !== undefined && String(valor).trim() !== '' && isFinite(Number(valor));
}

window.addEventListener('DOMContentLoaded', () => {
  atualizarDashboard();
  initChart();
  document.getElementById('inputPA').addEventListener('input', event => {
    const numeros = event.target.value.replace(/\D/g, '').slice(0, 5);
    event.target.value = numeros.length > 3 ? numeros.slice(0, 3) + '/' + numeros.slice(3) : numeros;
  });
});

function abrirModalRegistro() { document.getElementById('modalRegistro').style.display = 'flex'; }
function abrirModal7() { preencherTabela7(); document.getElementById('modal7').style.display = 'flex'; }
function abrirModalRuins() { preencherTabelaRuins(); document.getElementById('modalRuins').style.display = 'flex'; }
function fecharModal(id) { document.getElementById(id).style.display = 'none'; }
function abrirModalMes() {
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const seletor = document.getElementById('mesAno');
  seletor.max = mesAtual;
  seletor.value = mesAtual < '2026-08' ? '2026-08' : mesAtual;
  document.getElementById('modalMes').style.display = 'flex';
  carregarResumoMensal();
}
function carregarResumoMensal() {
  const selecionado = document.getElementById('mesAno').value;
  const area = document.getElementById('resumoMensal');
  if (!selecionado) return;
  area.innerText = 'Buscando suas medições na planilha…';
  const callback = 'receberResumoMensal';
  window[callback] = dados => {
    delete window[callback];
    const script = document.getElementById('consultaMensal');
    if (script) script.remove();
    if (!dados || dados.erro) { area.innerText = 'Não foi possível carregar o resumo. Tente novamente.'; return; }
    mostrarResumoMensal(dados);
  };
  const script = document.createElement('script');
  script.id = 'consultaMensal';
  script.src = `${webhookGoogleScript}?action=mensal&mes=${selecionado}&callback=${callback}&_=${Date.now()}`;
  script.onerror = () => { area.innerText = 'Falha ao acessar a planilha. Verifique a implantação do Apps Script.'; script.remove(); };
  document.body.appendChild(script);
}
function mostrarResumoMensal(dados) {
  const nomeMes = new Date(Number(dados.ano), Number(dados.mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const area = document.getElementById('resumoMensal');
  if (!dados.total) { area.innerHTML = `<div class="mensal-card mensal-vazio"><strong>${nomeMes}</strong><p>Nenhuma medição encontrada neste mês.</p></div>`; return; }
  const cartao = (rotulo, item, unidade, classe) => item ? `<article class="mensal-card ${classe || ''}"><h4>${rotulo}</h4><strong>${item.media}${unidade}</strong><p>Média do mês</p><p>Menor: ${item.min}${unidade}<br>Maior: ${item.max}${unidade}<br>${item.quantidade} medições</p></article>` : '';
  area.innerHTML = `<article class="mensal-card destaque"><h4>${nomeMes}</h4><strong>${dados.dias} dias</strong><p>com registros<br>${dados.total} medições no total</p></article><article class="mensal-card ${dados.alertas ? 'alerta' : ''}"><h4>Resultados que pedem atenção</h4><strong>${dados.alertas}</strong><p>${dados.alertas === 1 ? 'medição fora dos limites' : 'medições fora dos limites'}</p></article>${cartao('Glicemia', dados.glicose, ' mg/dL')}${cartao('Batimentos', dados.cardio, ' bpm')}${cartao('Oximetria', dados.oxigenio, '%')}${cartao('PA sistólica', dados.sistolica, ' mmHg')}${cartao('PA diastólica', dados.diastolica, ' mmHg')}`;
}

// ==========================================
// AVALIAÇÃO CLÍNICA
// ==========================================
function avaliarMedicoes(paStr, glic, car, oxi) {
  let ruim = false;
  let motivos = [];
  let criticoSevero = false;

  if (paStr) {
    let limpa = paStr.replace('/', ' ').replace('-', ' ').trim().split(/\s+/);
    if (limpa.length === 2) {
      let sis = parseInt(limpa[0]);
      let dia = parseInt(limpa[1]);
      if (sis <= 20) sis = sis * 10;
      if (dia <= 20) dia = dia * 10;

      if (sis >= 180 || dia >= 110) {
        ruim = true; criticoSevero = true;
        motivos.push(`PA grave (${sis}/${dia})`);
      } else if (sis >= 140 || dia >= 90 || sis < 90) {
        ruim = true;
        motivos.push(`PA alterada (${sis}/${dia})`);
      }
    }
  }

  if (!isNaN(glic) && (glic <= 55 || glic >= 250)) {
    ruim = true; criticoSevero = true;
    motivos.push(`Glicemia crítica (${glic})`);
  } else if (!isNaN(glic) && (glic < 70 || glic >= 140)) {
    ruim = true;
    motivos.push(`Glicemia alterada (${glic})`);
  }

  if (!isNaN(car) && (car < 48 || car > 120)) {
    ruim = true; criticoSevero = true;
    motivos.push(`Cardio crítico (${car} bpm)`);
  } else if (!isNaN(car) && (car < 55 || car > 100)) {
    ruim = true;
    motivos.push(`Cardio alterado (${car} bpm)`);
  }

  if (!isNaN(oxi) && oxi <= 89) {
    ruim = true; criticoSevero = true;
    motivos.push(`Oxigênio crítico (${oxi}%)`);
  } else if (!isNaN(oxi) && oxi < 93) {
    ruim = true;
    motivos.push(`Oxigênio baixo (${oxi}%)`);
  }

  return { ruim, motivos: motivos.join(", "), criticoSevero };
}

// ==========================================
// SALVAR NOVO REGISTRO E ENVIAR AO GOOGLE SHEETS
// ==========================================
function salvarRegistro(e) {
  e.preventDefault();

  const pa = document.getElementById('inputPA').value.trim();
  const glic = parseInt(document.getElementById('inputGlicose').value);
  const car = parseInt(document.getElementById('inputCardio').value);
  const oxi = parseInt(document.getElementById('inputOxi').value);
  if (!pa && isNaN(glic) && isNaN(car) && isNaN(oxi)) {
    alert('Preencha pelo menos uma medição para registrar.');
    return;
  }

  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ano = agora.getFullYear();
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  const dataHoraFormatada = `${dia}/${mes}/${ano} às ${horas}:${minutos}`;

  const idUnico = "reg_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  const avaliacao = avaliarMedicoes(pa, glic, car, oxi);

  const novoDado = {
    id: idUnico,
    pressao: pa,
    glicose: isNaN(glic) ? null : glic,
    cardio: isNaN(car) ? null : car,
    oxigenio: isNaN(oxi) ? null : oxi,
    dataHora: dataHoraFormatada,
    ruim: avaliacao.ruim,
    motivo: avaliacao.motivos
  };

  // Salva no armazenamento local do navegador
  registros.unshift(novoDado);
  localStorage.setItem('saude_registros', JSON.stringify(registros));

  if (avaliacao.ruim) {
    registrosRuins.unshift({
      id: idUnico,
      dataHora: dataHoraFormatada,
      motivo: avaliacao.motivos,
    valores: `PA:${pa || '-'} | G:${isNaN(glic) ? '-' : glic} | C:${isNaN(car) ? '-' : car} | O:${isNaN(oxi) ? '-' : oxi + '%'}`
    });
    if (registrosRuins.length > 7) registrosRuins.pop();
    localStorage.setItem('saude_ruins', JSON.stringify(registrosRuins));
  }

  // ✅ DISPARO OFICIAL PARA O GOOGLE APPS SCRIPT
  const dadosEnvio = {
    id: idUnico,
    dataHora: dataHoraFormatada,
    pressao: pa || "-",
    glicose: isNaN(glic) ? '' : glic,
    cardio: isNaN(car) ? '' : car,
    oxigenio: isNaN(oxi) ? '' : oxi,
    motivoRuim: avaliacao.ruim ? avaliacao.motivos : ""
  };

  fetch(webhookGoogleScript, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(dadosEnvio)
  })
  .then(() => {
    console.log("Envio encaminhado ao Apps Script; a resposta não pode ser confirmada pelo navegador.");
  })
  .catch(err => {
    console.error("Falha ao encaminhar o registro ao Apps Script:", err);
  });

  if (avaliacao.criticoSevero) {
    document.getElementById('msgAlertaCritico').innerText = 
      "Medição em nível crítico para o perfil cardíaco da paciente. Recomenda-se atenção imediata!";
    document.getElementById('popupAlerta').style.display = 'flex';
  }

  document.getElementById('formRegistro').reset();
  fecharModal('modalRegistro');
  atualizarDashboard();
  initChart();
}

// ==========================================
// EXCLUSÃO BLINDADA (APENAS 1 REGISTRO)
// ==========================================
function excluirRegistro(idParaRemover) {
  if (!idParaRemover) return;

  const confirmar = confirm("Deseja realmente apagar esta medição digitada incorretamente?");
  if (!confirmar) return;

  const apagarRemoto = document.createElement('script');
  apagarRemoto.src = `${webhookGoogleScript}?action=excluir&id=${encodeURIComponent(idParaRemover)}&callback=confirmarExclusaoRemota&_=${Date.now()}`;
  document.body.appendChild(apagarRemoto);

  const indexReg = registros.findIndex(item => String(item.id) === String(idParaRemover));
  if (indexReg !== -1) {
    registros.splice(indexReg, 1);
    localStorage.setItem('saude_registros', JSON.stringify(registros));
  }

  const indexRuim = registrosRuins.findIndex(item => String(item.id) === String(idParaRemover));
  if (indexRuim !== -1) {
    registrosRuins.splice(indexRuim, 1);
    localStorage.setItem('saude_ruins', JSON.stringify(registrosRuins));
  }


  preencherTabela7();
  atualizarDashboard();
  initChart();
}

// ==========================================
// ATUALIZAÇÃO DA TELA
// ==========================================
function atualizarDashboard() {
  const definirStatus = (id, valor, limiteRuim, limiteAtencao) => {
    const el = document.getElementById(id);
    if (valor === null || valor === undefined) {
      el.innerText = 'Aguardando';
      el.className = 'card-status status-ok';
      return;
    }
    const estado = limiteRuim(valor) ? 'Ruim' : limiteAtencao(valor) ? 'Atenção' : 'Está ótimo';
    el.innerText = estado;
    el.className = `card-status ${estado === 'Ruim' ? 'status-ruim' : estado === 'Atenção' ? 'status-atencao' : 'status-ok'}`;
  };

  if (registros.length === 0) {
    document.getElementById('val-pa').innerText = "--/--";
    document.getElementById('val-glicose').innerHTML = `-- <small style="font-size:12px">mg/dL</small>`;
    document.getElementById('val-cardio').innerHTML = `-- <small style="font-size:12px">bpm</small>`;
    document.getElementById('val-oxi').innerHTML = `-- <small style="font-size:12px">%</small>`;
    ['st-pa', 'st-glicose', 'st-cardio', 'st-oxi'].forEach(id => definirStatus(id, null));
    document.getElementById('resumoAlteracoes').innerText = "Nenhum registro no momento.";
    return;
  }

  const atual = registros[0];
  document.getElementById('val-pa').innerText = atual.pressao || "--";
  document.getElementById('val-glicose').innerHTML = `${campoNumerico(atual.glicose) ? atual.glicose : '--'} <small style="font-size:12px">mg/dL</small>`;
  document.getElementById('val-cardio').innerHTML = `${campoNumerico(atual.cardio) ? atual.cardio : '--'} <small style="font-size:12px">bpm</small>`;
  document.getElementById('val-oxi').innerHTML = `${campoNumerico(atual.oxigenio) ? atual.oxigenio : '--'} <small style="font-size:12px">%</small>`;

  const partesPA = String(atual.pressao || '').match(/\d+/g);
  const sistolica = partesPA && partesPA.length >= 2 ? (Number(partesPA[0]) <= 20 ? Number(partesPA[0]) * 10 : Number(partesPA[0])) : null;
  const diastolica = partesPA && partesPA.length >= 2 ? (Number(partesPA[1]) <= 20 ? Number(partesPA[1]) * 10 : Number(partesPA[1])) : null;
  definirStatus('st-pa', sistolica, () => sistolica !== null && (sistolica >= 180 || diastolica >= 110), () => sistolica !== null && (sistolica >= 140 || sistolica < 90 || diastolica >= 90));
  definirStatus('st-glicose', atual.glicose, v => v <= 55 || v >= 250, v => v < 70 || v >= 140);
  definirStatus('st-cardio', atual.cardio, v => v < 48 || v > 120, v => v < 55 || v > 100);
  definirStatus('st-oxi', atual.oxigenio, v => v <= 89, v => v < 93);

  const alteracoesSemana = registros.slice(0, 14).filter(r => r.ruim).length;
  document.getElementById('resumoAlteracoes').innerHTML = `
    <strong>Resumo:</strong> ${alteracoesSemana} alteração(ões) detectada(s) nas medições recentes.<br>
    ${alteracoesSemana >= 2 ? '<span style="color:var(--alerta-vermelho);">⚠️ Atenção: Mais de 2 medições fora do padrão.</span>' : '✅ Níveis estáveis.'}
  `;
}

function preencherTabela7() {
  const corpo = document.getElementById('tabelaCorpo7');
  corpo.innerHTML = "";
  const ultimos7 = registros.slice(0, 7);

  if (ultimos7.length === 0) {
    corpo.innerHTML = "<tr><td colspan='6'>Nenhum dado registrado.</td></tr>";
    return;
  }

  ultimos7.forEach(r => {
    corpo.innerHTML += `
      <tr>
        <td><strong>${r.pressao || '-'}</strong></td>
        <td>${campoNumerico(r.glicose) ? r.glicose : '-'}</td>
        <td>${campoNumerico(r.cardio) ? r.cardio : '-'}</td>
        <td>${campoNumerico(r.oxigenio) ? r.oxigenio + '%' : '-'}</td>
        <td style="font-size:11px;">${r.dataHora}</td>
        <td>
          <button class="btn-excluir" onclick="excluirRegistro('${r.id}')">🗑️</button>
        </td>
      </tr>
    `;
  });
}

function preencherTabelaRuins() {
  const corpo = document.getElementById('tabelaCorpoRuins');
  corpo.innerHTML = "";
  if (registrosRuins.length === 0) {
    corpo.innerHTML = "<tr><td colspan='3'>Nenhum alerta crítico registrado!</td></tr>";
    return;
  }
  registrosRuins.forEach(r => {
    corpo.innerHTML += `
      <tr>
        <td style="font-size:11px;"><strong>${r.dataHora}</strong></td>
        <td style="color:var(--alerta-vermelho);">${r.motivo}</td>
        <td>${r.valores}</td>
      </tr>
    `;
  });
}

function initChart() {
  const ctx = document.getElementById('graficoSemana').getContext('2d');
  const ultimos = registros.slice(0, 7).reverse();

  const labels = ultimos.map(r => r.dataHora.split(' ')[0]);
  const glicoses = ultimos.map(r => r.glicose);
  const batimentos = ultimos.map(r => r.cardio);
  const parsePressao = valor => {
    const partes = String(valor || '').match(/\d+/g);
    if (!partes || partes.length < 2) return { sistolica: null, diastolica: null };
    const sistolica = Number(partes[0]) <= 20 ? Number(partes[0]) * 10 : Number(partes[0]);
    const diastolica = Number(partes[1]) <= 20 ? Number(partes[1]) * 10 : Number(partes[1]);
    return { sistolica, diastolica };
  };
  const pressoes = ultimos.map(r => parsePressao(r.pressao));
  const cores = { glicose: '#7B4F63', cardio: '#3E3239', sistolica: '#D97706', diastolica: '#2563A6' };
  const pontos = (valorRuim, cor) => ultimos.map(r => valorRuim(r) ? '#C62828' : cor);
  const raios = valorRuim => ultimos.map(r => valorRuim(r) ? 7 : 4);
  const paAlterada = (r, tipo) => {
    const { sistolica, diastolica } = parsePressao(r.pressao);
    return sistolica !== null && (tipo === 'sistolica'
      ? sistolica >= 140 || sistolica < 90 || diastolica >= 90
      : diastolica >= 90 || diastolica < 60 || sistolica >= 140);
  };

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['-', '-', '-', '-'],
      datasets: [
        {
          label: 'Glicemia (mg/dL)',
          data: glicoses.length ? glicoses : [0],
          borderColor: cores.glicose,
          pointBackgroundColor: pontos(r => r.glicose < 70 || r.glicose >= 140, cores.glicose),
          pointRadius: raios(r => r.glicose < 70 || r.glicose >= 140),
          tension: 0.25,
          yAxisID: 'y'
        },
        {
          label: 'Batimentos (bpm)',
          data: batimentos.length ? batimentos : [0],
          borderColor: cores.cardio,
          pointBackgroundColor: pontos(r => r.cardio < 55 || r.cardio > 100, cores.cardio),
          pointRadius: raios(r => r.cardio < 55 || r.cardio > 100),
          tension: 0.25,
          yAxisID: 'y'
        },
        {
          label: 'PA sistólica (mmHg)',
          data: pressoes.map(p => p.sistolica),
          borderColor: cores.sistolica,
          pointBackgroundColor: pontos(r => paAlterada(r, 'sistolica'), cores.sistolica),
          pointRadius: raios(r => paAlterada(r, 'sistolica')),
          tension: 0.25,
          spanGaps: true,
          yAxisID: 'yPa'
        },
        {
          label: 'PA diastólica (mmHg)',
          data: pressoes.map(p => p.diastolica),
          borderColor: cores.diastolica,
          borderDash: [5, 4],
          pointBackgroundColor: pontos(r => paAlterada(r, 'diastolica'), cores.diastolica),
          pointRadius: raios(r => paAlterada(r, 'diastolica')),
          tension: 0.25,
          spanGaps: true,
          yAxisID: 'yPa'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { weight: 'bold' }, color: '#3E3239', usePointStyle: true, boxWidth: 12, generateLabels(chart) { return chart.data.datasets.map(function(dataset, i) { return { text: dataset.label, fillStyle: cores[Object.keys(cores)[i]], strokeStyle: cores[Object.keys(cores)[i]], lineWidth: 0, pointStyle: 'circle', hidden: !chart.isDatasetVisible(i), datasetIndex: i }; }); } } },
        tooltip: { callbacks: { label: item => `${item.dataset.label}: ${item.parsed.y === null || item.parsed.y === undefined ? 'Sem medição' : item.parsed.y}` } }
      },
      scales: {
        y: { position: 'left', beginAtZero: false, suggestedMin: 50, suggestedMax: 150, title: { display: true, text: 'Glicemia / bpm' }, ticks: { font: { weight: 'bold' }, color: '#6B5560' } },
        yPa: { position: 'right', beginAtZero: false, suggestedMin: 50, suggestedMax: 180, title: { display: true, text: 'PA (mmHg)' }, grid: { drawOnChartArea: false }, ticks: { font: { weight: 'bold' }, color: '#6B5560' } },
        x: { ticks: { font: { weight: 'bold' }, color: '#6B5560' } }
      }
    }
  });
}
